import { Context, Effect, Layer } from 'effect'
import { type VMDataPoint, dataPointToPrometheus } from '../../victoriaMetrics'

export class VictoriaMetricsService extends Context.Tag(
  'VictoriaMetricsService',
)<
  VictoriaMetricsService,
  {
    sendMetric(options: {
      metricName: string
      data: VMDataPoint[]
    }): Effect.Effect<Response, Error>
  }
>() {}

export const VictoriaMetricsLive = Layer.succeed(
  VictoriaMetricsService,
  VictoriaMetricsService.of({
    sendMetric: ({ metricName, data }) =>
      Effect.tryPromise({
        try: () =>
          fetch('http://192.168.1.234:8428/api/v1/import/prometheus', {
            method: 'POST',
            body: data.map(dataPointToPrometheus).join('\n'),
          }),
        catch: (cause) =>
          new Error(`Could not update ${metricName} metric`, { cause }),
      }),
  }),
)

export const VictoriaMetricsLog = Layer.succeed(
  VictoriaMetricsService,
  VictoriaMetricsService.of({
    sendMetric: ({ metricName, data }) =>
      Effect.gen(function* () {
        yield* Effect.logInfo(`Sending ${metricName} metric`, data)
        return new Response()
      }),
  }),
)
