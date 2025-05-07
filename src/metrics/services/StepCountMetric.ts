import { Context, Effect, Fiber, Layer, Stream } from 'effect'
import type { RuntimeFiber } from 'effect/Fiber'
import type { HAEGenericMetric } from '../../json/hae-json'
import { toTimestamp } from '../../utils'
import type { VMDataPoint } from '../../victoriaMetrics'
import { IntradayData } from './IntradayData'
import { VictoriaMetricsService } from './VictoriaMetrics'

export class StepCountMetric extends Context.Tag('StepCountMetricService')<
  StepCountMetric,
  {
    start(): void
    stop(): void
  }
>() {}

export const StepCountMetricLive = Layer.effect(
  StepCountMetric,
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
            Stream.filter((metrics) => metrics.name === 'step_count'),
            Stream.map((metric) =>
              (metric.data as HAEGenericMetric['data']).reduce(
                (acc, curr) => ({
                  sum: acc.sum + curr.qty,
                  data: [
                    ...acc.data,
                    {
                      metricName: 'health_step_count',
                      timestamp: toTimestamp(curr.date),
                      value: acc.sum + curr.qty,
                      labels: { source: curr.source ?? 'unknown' },
                    },
                  ],
                }),
                { sum: 0, data: [] } as { sum: number; data: VMDataPoint[] },
              ),
            ),
            Stream.runForEach((data) => {
              return Effect.gen(function* () {
                yield* Effect.logInfo(
                  `Sending step count data. sum=${data.sum.toFixed(0)} count=${data.data.length}`,
                )

                yield* victoriaMetrics.sendMetric({
                  metricName: 'health_step_count',
                  data: data.data,
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
