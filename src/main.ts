import { Registry } from 'prom-client'
import { z } from 'zod'

import MetricsManager from './MetricsManager'
import DietaryCaffeineMetricManager from './metrics/dietary_caffeine'
import { caffeineMetricSchema } from './schema'

const shutdownAbortController = new AbortController()

const metricsManager = new MetricsManager(new Registry(), {
  signal: shutdownAbortController.signal,
})

const dietaryCaffeineMetricManager = new DietaryCaffeineMetricManager(
  metricsManager,
)

Bun.serve({
  port: process.env.PORT || 8004,
  fetch: async (req) => {
    const url = new URL(req.url)
    const requestPath = `${req.method} ${url.pathname}`

    if (requestPath === 'GET /metrics') {
      return new Response(await metricsManager.getRegistry().metrics())
    }

    if (requestPath === 'GET /explain/dietary_caffeine') {
      const dataPoints = dietaryCaffeineMetricManager.getDataPoints()
      console.table(dataPoints)
      return new Response(JSON.stringify(dataPoints, null, 2), { status: 200 })
    }

    if (requestPath === 'POST /ingest/auto_health_export') {
      const body = await req.json()
      try {
        const metrics = z
          .object({
            data: z.object({
              metrics: z.array(
                z.discriminatedUnion('name', [caffeineMetricSchema]),
              ),
            }),
          })
          .transform((data) => data.data.metrics)
          .parse(body)

        for (const metric of metrics) {
          if (metric.name === 'dietary_caffeine') {
            const added = dietaryCaffeineMetricManager.addDataPoints(
              metric.data,
            )
            console.log(`Added ${added} caffeine data points`)
          }
        }

        return new Response('OK', { status: 200 })
      } catch (error) {
        return new Response('Invalid request body', { status: 400 })
      }
    }

    return new Response('Not found', { status: 404 })
  },
})

process.on('SIGINT', () => {
  shutdownAbortController.abort()
  process.exit(0)
})
