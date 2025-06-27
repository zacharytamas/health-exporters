import { Effect, Fiber, Stream } from 'effect'
import ms from 'ms'
import { createDecayingValueCalculator } from '../decayingValueCalculator'
import type { HAEGenericMetric } from '../json/hae-json'
import { getIntradayMetricsStream } from '../json/intradayMetrics'
import { type VMDataPoint, sendMetric } from '../victoriaMetrics'

export class WaterMetricCollector {
  private fiber?: Fiber.RuntimeFiber<void, Error>
  private sendFiber?: Fiber.RuntimeFiber<void, Error>
  private waterCalculator: ReturnType<typeof createDecayingValueCalculator>

  constructor(private readonly shutdownSignal?: AbortSignal) {
    this.waterCalculator = createDecayingValueCalculator({
      halfLife: ms('12h'),
      ingestionDelay: ms('1h'),
    })

    if (shutdownSignal) {
      shutdownSignal.addEventListener('abort', () => this.stop())
    }
    this.start()
  }

  private metricValueForTime(time: number, kind: 'rolling' | 'total', value?: number): VMDataPoint {
    return {
      metricName: 'health_dietary_water',
      value: value ?? this.waterCalculator.getValueAtTime(time),
      timestamp: time,
      labels: { source: 'calculation', kind },
    }
  }

  private start() {
    if (this.fiber) {
      this.stop()
    }

    // Ingest water data
    const ingestProgram = getIntradayMetricsStream().pipe(
      Stream.filter((metric) => {
        const isWaterMetric = metric.name === 'dietary_water'
        if (isWaterMetric) {
          console.log('Found dietary_water metric with', metric.data.length, 'data points')
        }
        return isWaterMetric
      }),
      Stream.runForEach((metric) =>
        Effect.tryPromise({
          try: async () => {
            const data = metric.data as HAEGenericMetric['data']
            const waterDataPoints = data.map((d) => ({ date: d.date, value: d.qty }))
            const newDataPoints = this.waterCalculator.addDataPoints(waterDataPoints)

            if (newDataPoints.length > 0) {
              console.log(`Added ${newDataPoints.length} new water data points`)

              // Send backfilled rolling values if we have new historical data
              if (newDataPoints.length !== data.length) {
                const sortedNewPoints = newDataPoints.sort((a, b) => a.date.localeCompare(b.date))
                const earliestDate = sortedNewPoints[0].date
                const now = new Date()
                now.setSeconds(0, 0)

                const backfillData: VMDataPoint[] = []
                for (let t = new Date(earliestDate).getTime(); t <= now.getTime(); t += ms('1 minute')) {
                  const rollingValue = this.metricValueForTime(t, 'rolling')
                  if (rollingValue.value !== 0) {
                    backfillData.push(rollingValue)
                  }
                }

                if (backfillData.length > 0) {
                  await sendMetric({
                    metricName: 'health_dietary_water',
                    data: backfillData,
                  })
                  console.log(`Sent ${backfillData.length} backfilled water metrics`)
                }
              }
            }
          },
          catch: (error) => {
            console.error('Could not ingest water data', error)
            return error as Error
          },
        }),
      ),
    )

    // Send current water metrics every minute
    const sendProgram = Stream.tick('1 minute').pipe(
      Stream.runForEach(() =>
        Effect.tryPromise({
          try: async () => {
            if (this.waterCalculator.getDataPoints().length === 0) {
              console.log('No water data to send')
              return // Don't send if no data
            }

            const now = new Date()
            now.setSeconds(0, 0)
            const timestamp = now.getTime()

            const rollingValue = this.metricValueForTime(timestamp, 'rolling')

            // Calculate 24-hour total
            const totalValue = this.waterCalculator
              .getDataPoints()
              .filter((d) => new Date(d.date).getTime() > timestamp - ms('24h'))
              .reduce((acc, d) => acc + d.value, 0)

            const totalMetric = this.metricValueForTime(timestamp, 'total', totalValue)

            await sendMetric({
              metricName: 'health_dietary_water',
              data: [rollingValue, totalMetric],
            })

            console.log(
              `Updated water metrics - rolling: ${rollingValue.value.toFixed(1)}oz, 24h total: ${totalValue.toFixed(1)}oz`,
            )
          },
          catch: (error) => {
            console.error('Error in water metrics send:', error)
            return error as Error
          },
        }),
      ),
    )

    this.fiber = Effect.runFork(ingestProgram)
    this.sendFiber = Effect.runFork(sendProgram)
  }

  stop() {
    if (this.fiber) {
      Effect.runSync(Fiber.interrupt(this.fiber))
      this.fiber = undefined
    }
    if (this.sendFiber) {
      Effect.runSync(Fiber.interrupt(this.sendFiber))
      this.sendFiber = undefined
    }
  }
}
