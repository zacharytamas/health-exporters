import { Context, Effect, Exit, Fiber, Layer, Schedule, Stream } from 'effect'
import type { RuntimeFiber } from 'effect/Fiber'
import { CaffeineCalculator } from '../../CaffeineCalculator'
import type { HAEDietaryCaffeineMetric } from '../../json/hae-json'
import { IntradayData } from './IntradayData'
import { VictoriaMetricsService } from './VictoriaMetrics'

export class DietaryCaffeineMetricService extends Context.Tag(
  'DietaryCaffeineMetricService',
)<
  DietaryCaffeineMetricService,
  {
    start(): void
    stop(): void
  }
>() {}

export const DietaryCaffeineMetricServiceLayer = Layer.effect(
  DietaryCaffeineMetricService,
  Effect.gen(function* () {
    const victoriaMetrics = yield* VictoriaMetricsService
    const intradayData = yield* IntradayData

    const caffeineCalculator = new CaffeineCalculator({
      dataPoints: [],
      nowFunction: Date.now,
    })

    let ingestFork: RuntimeFiber<void, Error> | undefined
    let sendFork: RuntimeFiber<number, Error> | undefined

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
            Stream.filter((metrics) => metrics.name === 'dietary_caffeine'),
            Stream.map(
              (metric) => metric.data as HAEDietaryCaffeineMetric['data'],
            ),
            Stream.runForEach((data) => {
              caffeineCalculator.addDataPoints(data)
              return Effect.void
            }),
          ),
        )

        sendFork = Effect.runFork(
          Effect.repeat(
            Effect.gen(function* () {
              try {
                // Do not send any metrics if we don't have any data yet.
                if (caffeineCalculator.getDataPoints().length === 0) {
                  return
                }

                yield* Effect.log(
                  `Sending dietary caffeine value: ${caffeineCalculator.getCurrentCaffeineLevel().toFixed(0)}mg`,
                )

                yield* victoriaMetrics.sendMetric({
                  metricName: 'health_dietary_caffeine',
                  data: [
                    {
                      metricName: 'health_dietary_caffeine',
                      value: caffeineCalculator.getCurrentCaffeineLevel(),
                      timestamp: Date.now(),
                      labels: { source: 'calculation' },
                    },
                  ],
                })
                yield* victoriaMetrics.sendMetric({
                  metricName: 'health_dietary_caffeine_bedtime_projection',
                  data: [
                    {
                      metricName: 'health_dietary_caffeine_bedtime_projection',
                      value: caffeineCalculator.getBedtimeCaffeineLevel(),
                      timestamp: Date.now(),
                      labels: { source: 'calculation' },
                    },
                  ],
                })
              } catch (error) {
                console.error(error)
              }
            }),
            Schedule.spaced('1 minute'),
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
