import z from 'zod'

export const dataPointSchema = z.object({
  date: z.string(),
  source: z.string(),
  qty: z.number(),
})

export type TDataPoint = z.infer<typeof dataPointSchema>

export const caffeineMetricSchema = z.object({
  name: z.literal('dietary_caffeine'),
  units: z.literal('mg'),
  data: z.array(dataPointSchema),
})

export type TCaffeineMetric = z.infer<typeof caffeineMetricSchema>

export const metricSchema = z.discriminatedUnion('name', [caffeineMetricSchema])

export type TMetric = z.infer<typeof metricSchema>
