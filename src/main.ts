import { Registry } from 'prom-client'

import MetricsManager from './MetricsManager'
import DietaryCaffeineMetricManager from './metrics/dietary_caffeine'

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

    if (url.pathname === '/metrics') {
      return new Response(await metricsManager.getRegistry().metrics())
    }

    return new Response('Not found', { status: 404 })
  },
})

process.on('SIGINT', () => {
  shutdownAbortController.abort()
  process.exit(0)
})
