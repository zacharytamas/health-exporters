import { Context, Effect, Fiber, Layer, Sink, Stream } from 'effect'
import type { RuntimeFiber } from 'effect/Fiber'
import ms from 'ms'
import { createDecayingValueCalculator } from '../../decayingValueCalculator'
import type { HAEGenericMetric } from '../../json/hae-json'
import type { VMDataPoint } from '../../victoriaMetrics'
import { IntradayData } from './IntradayData'
import { VictoriaMetricsService } from './VictoriaMetrics'

const TICK_INTERVAL_STRING = '1 minute'

export class DietaryWaterMetric extends Context.Tag('DietaryWaterMetricService')<
  DietaryWaterMetric,
  { start(): void; stop(): void }
>() {}

export const DietaryWaterMetricLive = Layer.effect(
  DietaryWaterMetric,
  Effect.gen(function* () {
    const intradayData = yield* IntradayData
    const victoriaMetrics = yield* VictoriaMetricsService

    const waterCalculator = createDecayingValueCalculator({
      halfLife: ms('12h'),
      ingestionDelay: ms('1h'),
    })

    const metricValueForTime = (time: number, kind: 'rolling' | 'total', value?: number): VMDataPoint => ({
      metricName: 'health_dietary_water',
      value: value ?? waterCalculator.getValueAtTime(time),
      timestamp: time,
      labels: { source: 'calculation', kind },
    })

    let ingestFork: RuntimeFiber<void, Error> | undefined
    let sendFork: RuntimeFiber<void, Error> | undefined

    // biome-ignore lint: This is just how it's done with Sink
    const sendSink = Sink.forEach((data: VMDataPoint[]) => {
      return Effect.gen(function* () {
        if (data.length === 0) {
          return
        }

        yield* Effect.logInfo(
          `Sending rolling dietary water value: ${data.map((d) => `${d.value}oz @ ${new Date(d.timestamp).toISOString()}`).join(', ')}`,
        )

        yield* victoriaMetrics
          .sendMetric({ metricName: 'health_dietary_water', data })
          .pipe(Effect.catchAll((error) => Effect.log('Failed to send health_dietary_water metric', error)))
      })
    })

    return {
      start: () => {
        if (ingestFork) {
          Fiber.interrupt(ingestFork)
        }

        if (sendFork) {
          Fiber.interrupt(sendFork)
        }

        ingestFork = Effect.runFork(
          Stream.run(
            intradayData.getIntradayStream().pipe(
              Stream.filter((metrics) => metrics.name === 'dietary_water'),
              Stream.map((metric) =>
                (metric.data as HAEGenericMetric['data']).map((d) => ({ date: d.date, value: d.qty })),
              ),
              Stream.map((data) => {
                const newDataPoints = waterCalculator.addDataPoints(data)
                const dataPoints: VMDataPoint[] = []

                if (newDataPoints.length > 0 && newDataPoints.length !== data.length) {
                  newDataPoints.sort((a, b) => a.date.localeCompare(b.date))
                  const earliestDate = newDataPoints[0].date
                  const now = new Date()
                  now.setSeconds(0, 0)

                  for (let t = new Date(earliestDate).getTime(); t <= now.getTime(); t += ms(TICK_INTERVAL_STRING)) {
                    const value = metricValueForTime(t, 'rolling')
                    if (value.value !== 0) {
                      dataPoints.push(value)
                    }
                  }
                }

                return []
                // return dataPoints
              }),
            ),
            sendSink,
          ),
        )

        sendFork = Effect.runFork(
          Stream.run(
            Stream.tick(TICK_INTERVAL_STRING).pipe(
              Stream.map(() => {
                const now = new Date()
                now.setSeconds(0, 0)
                const dataPoints: VMDataPoint[] = []

                if (waterCalculator.getDataPoints().length > 0) {
                  dataPoints.push(metricValueForTime(now.getTime(), 'rolling'))

                  // Update the 24hr total. This is the total of all water ingestion data points from the past 24 hours.
                  dataPoints.push(
                    metricValueForTime(
                      now.getTime(),
                      'total',
                      waterCalculator
                        .getDataPoints()
                        .filter((d) => new Date(d.date).getTime() > now.getTime() - ms('24h'))
                        .reduce((acc, d) => acc + d.value, 0),
                    ),
                  )
                }

                return dataPoints
              }),
            ),
            sendSink,
          ),
        )
      },
      stop: () => {
        if (ingestFork) {
          Fiber.interrupt(ingestFork)
        }

        if (sendFork) {
          Fiber.interrupt(sendFork)
        }
      },
    }
  }),
)
