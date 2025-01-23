import { CronJob } from 'cron'
import { Counter } from 'prom-client'

import { CaffeineCalculator } from '../CaffeineCalculator'
import type MetricsManager from '../MetricsManager'

export default class DietaryCaffeineMetricManager {
  #metric = new Counter({
    name: 'health_dietary_caffeine',
    help: 'The current estimated dietary caffeine level in my body, in mg.',
    labelNames: ['source'],
  })

  #caffeineManager = new CaffeineCalculator({
    dataPoints: [],
    nowFunction: Date.now,
  })

  constructor(private readonly metricsManager: MetricsManager) {
    this.#reset()
    metricsManager.registerMetric('health_dietary_caffeine', this.#metric)

    if (!this.metricsManager.getShutdownSignal().aborted) {
      const resetJob = CronJob.from({
        cronTime: '0 0 * * *', // Every day at midnight
        onTick: () => this.#reset(),
        start: true,
        timeZone: 'America/New_York',
      })

      const updateJob = CronJob.from({
        cronTime: '*/1 * * * *', // Every minute
        start: true,
        onTick: () => this.#update(),
      })

      this.metricsManager.getShutdownSignal().addEventListener('abort', () => {
        resetJob.stop()
        updateJob.stop()
      })
    }
  }

  #reset() {
    this.#metric.reset()
    this.#metric.inc({ source: 'calculation' }, 0)
  }

  #update() {
    this.#reset()
    this.#metric.inc(
      { source: 'calculation' },
      this.#caffeineManager.getCurrentCaffeineLevel(),
    )
  }
}
