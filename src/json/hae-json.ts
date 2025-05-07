import { z } from 'zod'

export const heartRateMetric = z.object({
  name: z.literal('heart_rate'),
  units: z.literal('count/min'),
  data: z.array(
    z.object({
      Min: z.number(),
      Max: z.number(),
      Avg: z.number(),
      source: z.string(),
      date: z.string(),
    }),
  ),
})

export const restingHeartRateMetric = z.object({
  name: z.literal('resting_heart_rate'),
  units: z.literal('count/min'),
  data: z.array(
    z.object({
      qty: z.number(),
      date: z.string(),
    }),
  ),
})

export const dietaryCaffeineMetric = z.object({
  name: z.literal('dietary_caffeine'),
  units: z.literal('mg'),
  data: z.array(
    z.object({
      qty: z.number(),
      date: z.string(),
      source: z.string().optional(),
    }),
  ),
})

const genericMetric = z.object({
  name: z.string(),
  units: z.string(),
  data: z.array(
    z
      .object({
        qty: z.number(),
        date: z.string(),
        source: z.string().optional(),
      })
      .strict(),
  ),
})

export const haeJsonMetricSchema = z.union([
  heartRateMetric,
  restingHeartRateMetric,
  dietaryCaffeineMetric,
  genericMetric,
])

export type HAEJsonMetric = z.infer<typeof haeJsonMetricSchema>
export type HAEGenericMetric = z.infer<typeof genericMetric>
export type HAEHeartRateMetric = z.infer<typeof heartRateMetric>
export type HAEDietaryCaffeineMetric = z.infer<typeof dietaryCaffeineMetric>
