import { Effect, Fiber, Stream } from 'effect'
import type { HAEJsonMetric } from './json/hae-json'
import { getIntradayMetricsStream } from './json/intradayMetrics'
import { type VMDataPoint, sendMetric } from './victoriaMetrics'

export interface MetricProcessor<T = unknown> {
  metricName: string
  filter: (metric: HAEJsonMetric) => boolean
  transform: (data: T[]) => VMDataPoint[]
}

export class BaseMetricCollector<T = unknown> {
  private fiber?: Fiber.RuntimeFiber<void, Error>

  constructor(
    private readonly processor: MetricProcessor<T>,
    shutdownSignal?: AbortSignal,
  ) {
    if (shutdownSignal) {
      shutdownSignal.addEventListener('abort', () => this.stop())
    }
    this.start()
  }

  private start() {
    if (this.fiber) {
      this.stop()
    }

    const program = getIntradayMetricsStream().pipe(
      Stream.filter(this.processor.filter),
      Stream.runForEach((metric) =>
        Effect.tryPromise({
          try: async () => {
            const dataPoints = this.processor.transform(metric.data as T[])
            if (dataPoints.length > 0) {
              await sendMetric({
                metricName: this.processor.metricName,
                data: dataPoints,
              })
              console.log(`Updated ${this.processor.metricName} metrics (${dataPoints.length} samples)`)
            }
          },
          catch: (error) => {
            console.error(`Could not update ${this.processor.metricName} metric`, error)
            return error as Error
          },
        }),
      ),
    )

    this.fiber = Effect.runFork(program)
  }

  stop() {
    if (this.fiber) {
      Effect.runSync(Fiber.interrupt(this.fiber))
      this.fiber = undefined
    }
  }
}
