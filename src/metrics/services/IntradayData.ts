import { Context, Effect, Layer, Stream } from 'effect'
import type { HAEJsonMetric } from '../../json/hae-json'
import { getIntradayMetricsForDate } from '../../json/intradayMetrics'
import ms from 'ms'

export class IntradayData extends Context.Tag('IntradayDataService')<
  IntradayData,
  {
    getIntradayStream(): Stream.Stream<HAEJsonMetric, Error>
  }
>() {}

const dateFormat = (date: Date | number) => {
  const dateObj = new Date(date)
  return `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`
}

export const IntradayDataLive = Layer.effect(
  IntradayData,
  Effect.gen(function* () {
    const stream = Stream.tick('4 minutes').pipe(
      Stream.flatMap(() =>
        Effect.all([
          getIntradayMetricsForDate(dateFormat(Date.now())).pipe(
            Effect.catchAll(() => Effect.succeed({})),
          ),
          getIntradayMetricsForDate(dateFormat(Date.now() - ms('1 day'))).pipe(
            Effect.catchAll(() => Effect.succeed({})),
          ),
        ]),
      ),
      Stream.flatMap(([metrics1, metrics2]) =>
        Stream.fromIterable([
          ...Object.values(metrics1),
          ...Object.values(metrics2),
        ]),
      ),
      // Stream.share({ capacity: 'unbounded' }),
    )

    return {
      getIntradayStream: () => {
        return stream
      },
    }
  }),
)
