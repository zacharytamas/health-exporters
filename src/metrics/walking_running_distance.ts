import { Effect, Fiber, Stream } from 'effect'
import type { RuntimeFiber } from 'effect/Fiber'
import type { HAEGenericMetric } from '../json/hae-json'
import { getIntradayMetricsStream } from '../json/intradayMetrics'
import { toTimestamp } from '../utils'
import { type VMDataPoint, sendMetric } from '../victoriaMetrics'

export class WalkingRunningDistanceMetric {
  private fork?: RuntimeFiber<void, Error>

  constructor(private readonly abortSignal: AbortSignal) {
    if (!this.abortSignal.aborted) {
      this.start()

      this.abortSignal.addEventListener('abort', () => {
        this.stop()
      })
    }
  }

  private start() {
    if (this.fork) {
      Fiber.interrupt(this.fork)
    }

    this.fork = Effect.runFork(
      getIntradayMetricsStream().pipe(
        Stream.filter((metrics) => metrics.name === 'walking_running_distance'),
        Stream.map((metric) =>
          (metric.data as HAEGenericMetric['data']).reduce(
            (acc, curr) => ({
              sum: acc.sum + curr.qty,
              data: [
                ...acc.data,
                {
                  metricName: 'health_walking_running_distance',
                  timestamp: toTimestamp(curr.date),
                  value: acc.sum + curr.qty,
                  labels: { source: curr.source ?? 'unknown' },
                },
              ],
            }),
            { sum: 0, data: [] } as { sum: number; data: VMDataPoint[] },
          ),
        ),
        Stream.runForEach(({ data }) => {
          Effect.runPromise(
            sendMetric({ metricName: 'health_walking_running_distance', data }),
          )
            .then((result) => {
              console.log(
                `Updated walking running distance metrics (${data.length} samples)`,
              )
            })
            .catch((error) => {
              console.error(
                'Could not update walking running distance metric',
                error,
              )
            })

          return Effect.void
        }),
      ),
    )
  }

  private stop() {
    if (this.fork) {
      Fiber.interrupt(this.fork)
    }
  }
}
