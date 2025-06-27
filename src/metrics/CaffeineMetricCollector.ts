import { Effect, Fiber, Stream } from 'effect'
import { CaffeineCalculator } from '../CaffeineCalculator'
import type { HAEDietaryCaffeineMetric } from '../json/hae-json'
import { getIntradayMetricsStream } from '../json/intradayMetrics'
import { sendMetric } from '../victoriaMetrics'

export class CaffeineMetricCollector {
  private fiber?: Fiber.RuntimeFiber<void, Error>
  private calculator: CaffeineCalculator
  private sendFiber?: Fiber.RuntimeFiber<void, Error>

  constructor(private readonly shutdownSignal?: AbortSignal) {
    this.calculator = new CaffeineCalculator({
      dataPoints: [],
      nowFunction: Date.now,
    })

    if (shutdownSignal) {
      shutdownSignal.addEventListener('abort', () => this.stop())
    }
    this.start()
  }

  private start() {
    if (this.fiber) {
      this.stop()
    }

    // Ingest caffeine data
    const ingestProgram = getIntradayMetricsStream().pipe(
      Stream.filter((metric) => metric.name === 'dietary_caffeine'),
      Stream.runForEach((metric) =>
        Effect.tryPromise({
          try: async () => {
            const data = metric.data as HAEDietaryCaffeineMetric['data']
            const newCount = this.calculator.addDataPoints(data)
            if (newCount > 0) {
              console.log(`Added ${newCount} new caffeine data points`)
            }
          },
          catch: (error) => {
            console.error('Could not ingest caffeine data', error)
            return error as Error
          },
        }),
      ),
    )

    // Send calculated metrics every minute
    const sendProgram = Stream.tick('1 minute').pipe(
      Stream.runForEach(() =>
        Effect.tryPromise({
          try: async () => {
            const now = Date.now()
            const currentLevel = this.calculator.getCurrentCaffeineLevel()
            const bedtimeLevel = this.calculator.getBedtimeCaffeineLevel()

            await Promise.all([
              sendMetric({
                metricName: 'health_dietary_caffeine',
                data: [
                  {
                    metricName: 'health_dietary_caffeine',
                    timestamp: now,
                    value: currentLevel,
                    labels: { source: 'calculation' },
                  },
                ],
              }),
              sendMetric({
                metricName: 'health_dietary_caffeine_bedtime_projection',
                data: [
                  {
                    metricName: 'health_dietary_caffeine_bedtime_projection',
                    timestamp: now,
                    value: bedtimeLevel,
                    labels: { source: 'calculation' },
                  },
                ],
              }),
            ])

            console.log(
              `Updated caffeine metrics - current: ${currentLevel.toFixed(1)}mg, bedtime: ${bedtimeLevel.toFixed(1)}mg`,
            )
          },
          catch: (error) => {
            console.error('Error in caffeine metrics send:', error)
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
