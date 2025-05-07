import { Context, Effect, Fiber, Layer, Sink, Stream } from 'effect'
import type { RuntimeFiber } from 'effect/Fiber'
import ms from 'ms'
import { createDecayingValueCalculator } from '../../decayingValueCalculator'
import type { HAEGenericMetric } from '../../json/hae-json'
import type { VMDataPoint } from '../../victoriaMetrics'
import { IntradayData } from './IntradayData'
import { VictoriaMetricsService } from './VictoriaMetrics'

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
      halfLife: ms('24h'),
      ingestionDelay: ms('1h'),
    })

    const metricValueForTime = (time: number): VMDataPoint => ({
      metricName: 'health_dietary_water',
      value: waterCalculator.getValueAtTime(time),
      timestamp: time,
      labels: { source: 'calculation', kind: 'rolling' },
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
          .pipe(
            Effect.catchAll((error) =>
              Effect.log('Failed to send health_dietary_water metric', error),
            ),
          )
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
          intradayData.getIntradayStream().pipe(
            Stream.filter((metrics) => metrics.name === 'dietary_water'),
            Stream.map((metric) =>
              (metric.data as HAEGenericMetric['data']).map((d) => ({
                date: d.date,
                value: d.qty,
              })),
            ),
            Stream.runForEach((data) => {
              waterCalculator.addDataPoints(data)
              return Effect.void
            }),
          ),
        )

        sendFork = Effect.runFork(
          Stream.run(
            Stream.tick('1 minute').pipe(
              Stream.map(() => {
                const value = metricValueForTime(Date.now())
                return value.value !== 0 ? [value] : []
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
