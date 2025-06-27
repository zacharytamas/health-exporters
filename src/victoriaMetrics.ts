import { Effect } from 'effect'

export type VMDataPoint = {
  metricName: string
  value: number
  timestamp: number
  labels?: Record<string, string>
}

export const dataPointToPrometheus = ({ metricName, value, timestamp, labels }: VMDataPoint) =>
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

export const sendMetric = async ({
  metricName,
  data,
}: {
  metricName: string
  data: VMDataPoint[]
}): Promise<Response> => {
  try {
    const body = data.map(dataPointToPrometheus).join('\n')

    const response = await fetch('http://192.168.1.234:8428/api/v1/import/prometheus', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body,
    })

    if (!response.ok) {
      const responseText = await response.text()
      throw new Error(`Victoria Metrics responded with ${response.status}: ${responseText}`)
    }

    return response
  } catch (error) {
    console.error(`Failed to send ${metricName} metric:`, error)
    throw new Error(`Could not update ${metricName} metric`, { cause: error })
  }
}
