import type { MetricProcessor } from '../BaseMetricCollector'
import type { HAEGenericMetric, HAEHeartRateMetric } from '../json/hae-json'
import { toTimestamp } from '../utils'
import type { VMDataPoint } from '../victoriaMetrics'

export const heartRateProcessor: MetricProcessor<HAEHeartRateMetric['data'][0]> = {
  metricName: 'health_heart_rate',
  filter: (metric) => metric.name === 'heart_rate',
  transform: (data) =>
    data.map((point) => ({
      timestamp: toTimestamp(point.date),
      value: point.Avg,
      metricName: 'health_heart_rate',
      labels: { source: point.source ?? 'unknown' },
    })),
}

export const stepCountProcessor: MetricProcessor<HAEGenericMetric['data'][0]> = {
  metricName: 'health_step_count',
  filter: (metric) => metric.name === 'step_count',
  transform: (data) => {
    let sum = 0
    return data.map((point) => {
      sum += point.qty
      return {
        metricName: 'health_step_count',
        timestamp: toTimestamp(point.date),
        value: sum,
        labels: { source: point.source ?? 'unknown' },
      }
    })
  },
}

export const walkingRunningDistanceProcessor: MetricProcessor<HAEGenericMetric['data'][0]> = {
  metricName: 'health_walking_running_distance',
  filter: (metric) => metric.name === 'walking_running_distance',
  transform: (data) => {
    let sum = 0
    return data.map((point) => {
      sum += point.qty
      return {
        metricName: 'health_walking_running_distance',
        timestamp: toTimestamp(point.date),
        value: sum,
        labels: { source: point.source ?? 'unknown' },
      }
    })
  },
}
