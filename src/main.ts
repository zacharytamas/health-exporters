import { BaseMetricCollector } from './BaseMetricCollector'
import { CaffeineMetricCollector } from './metrics/CaffeineMetricCollector'
import { WaterMetricCollector } from './metrics/WaterMetricCollector'
import { heartRateProcessor, stepCountProcessor, walkingRunningDistanceProcessor } from './metrics/processors'

const shutdownController = new AbortController()

// Create metric collectors with proper types
new BaseMetricCollector(heartRateProcessor, shutdownController.signal)
new BaseMetricCollector(stepCountProcessor, shutdownController.signal)
new BaseMetricCollector(walkingRunningDistanceProcessor, shutdownController.signal)

// Use specialized collectors that handle complex state calculations
new CaffeineMetricCollector(shutdownController.signal)
new WaterMetricCollector(shutdownController.signal)

console.log('Started health metrics collectors')

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...')
  shutdownController.abort()
  process.exit(0)
})
