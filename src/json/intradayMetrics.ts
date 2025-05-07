import { Effect, Stream } from 'effect'
import type { HAEJsonMetric } from './hae-json'
import { getMetricsForAutomationAndDate } from './metrics'

export const getIntradayMetricsForDate = (
  date: string,
): Effect.Effect<Record<string, HAEJsonMetric>, Error> =>
  getMetricsForAutomationAndDate('Intraday', date).pipe(
    Effect.map((metrics) =>
      Object.fromEntries(metrics.map((val) => [val.name, val])),
    ),
  )

let intradayStream: Stream.Stream<HAEJsonMetric, Error>

export const getIntradayMetricsStream = () => {
  if (!intradayStream) {
    intradayStream = Stream.tick('4 minutes').pipe(
      Stream.flatMap(() => {
        const date = new Date()
        const dateString = `${date.getFullYear()}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
        return getIntradayMetricsForDate(dateString).pipe(
          Effect.catchAll((error) => {
            console.error('Error getting intraday metrics', error)
            return Effect.succeed({})
          }),
        )
      }),
      Stream.flatMap((metrics) => {
        return Stream.fromIterable(Object.values(metrics))
      }),
    )
  }

  return intradayStream
}
