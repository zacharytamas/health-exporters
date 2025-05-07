import { Context, Effect, Fiber, Layer, Stream } from 'effect'
import type { RuntimeFiber } from 'effect/Fiber'
import type { HAEHeartRateMetric } from '../../json/hae-json'
import { toTimestamp } from '../../utils'
import { IntradayData } from './IntradayData'
import { VictoriaMetricsService } from './VictoriaMetrics'

export class HeartRateMetric extends Context.Tag('HeartRateMetricService')<
  HeartRateMetric,
  {
    start(): void
    stop(): void
  }
>() {}

export const HeartRateMetricLive = Layer.effect(
  HeartRateMetric,
  Effect.gen(function* () {
    const victoriaMetrics = yield* VictoriaMetricsService
    const intradayData = yield* IntradayData

    let ingestFork: RuntimeFiber<void, Error> | undefined

    return {
      start: () => {
        if (ingestFork) {
          Fiber.interrupt(ingestFork)
        }

        ingestFork = Effect.runFork(
          intradayData.getIntradayStream().pipe(
            Stream.filter((metrics) => metrics.name === 'heart_rate'),
            Stream.map((metric) =>
              (metric.data as HAEHeartRateMetric['data']).map((point) => ({
                timestamp: toTimestamp(point.date),
                value: point.Avg,
                metricName: 'health_heart_rate',
                labels: { source: point.source ?? 'unknown' },
              })),
            ),
            Stream.runForEach((data) => {
              return Effect.gen(function* () {
                yield* Effect.log(
                  `Sending heart rate data. count=${data.length}`,
                )

                yield* victoriaMetrics.sendMetric({
                  metricName: 'health_heart_rate',
                  data,
                })
              })
            }),
          ),
        )
      },
      stop: () => {
        if (ingestFork) {
          Fiber.interrupt(ingestFork)
        }
      },
    }
  }),
)
