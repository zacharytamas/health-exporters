import { Effect } from 'effect'

export type VMDataPoint = {
  metricName: string
  value: number
  timestamp: number
  labels?: Record<string, string>
}

export const dataPointToPrometheus = ({
  metricName,
  value,
  timestamp,
  labels,
}: VMDataPoint) =>
  [
    `${metricName}${
      labels
        ? `{${Object.entries(labels)
            .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
            .join(', ')}}`
        : ''
    }`,
    value,
    timestamp,
  ]
    .filter(Boolean)
    .join(' ')

export const sendMetric = ({
  metricName,
  data,
}: {
  metricName: string
  data: VMDataPoint[]
}): Effect.Effect<Promise<Response>, Error> =>
  Effect.try({
    try: () =>
      fetch('http://192.168.1.234:8428/api/v1/import/prometheus', {
        method: 'POST',
        body: data.map(dataPointToPrometheus).join('\n'),
      }),
    catch: (error) =>
      new Error(`Could not update ${metricName} metric`, { cause: error }),
  })
