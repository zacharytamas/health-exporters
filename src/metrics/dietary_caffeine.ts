import { CronJob } from 'cron'
import { Gauge } from 'prom-client'

import { CaffeineCalculator } from '../CaffeineCalculator'
import type MetricsManager from '../MetricsManager'
import type { TDataPoint } from '../schema'

export default class DietaryCaffeineMetricManager {
  #instantaneousMetric = new Gauge({
    name: 'health_dietary_caffeine',
    help: 'The current estimated dietary caffeine level in my body, in mg.',
    labelNames: ['source'],
  })

  #bedtimeProjectionMetric = new Gauge({
    name: 'health_dietary_caffeine_bedtime_projection',
    help: 'The current projected amount of caffeine in my body at the next bedtime, in mg.',
    labelNames: ['source'],
  })

  #caffeineCalculator = new CaffeineCalculator({
    dataPoints: [],
    nowFunction: Date.now,
  })

  constructor(private readonly metricsManager: MetricsManager) {
    this.#reset()
    metricsManager.registerMetric(
      'health_dietary_caffeine',
      this.#instantaneousMetric,
    )
    metricsManager.registerMetric(
      'health_dietary_caffeine_bedtime_projection',
      this.#bedtimeProjectionMetric,
    )

    if (!this.metricsManager.getShutdownSignal().aborted) {
      const updateJob = CronJob.from({
        cronTime: '*/1 * * * *', // Every minute
        start: true,
        onTick: () => this.#update(),
      })

      this.metricsManager.getShutdownSignal().addEventListener('abort', () => {
        updateJob.stop()
      })
    }
  }

  #reset() {
    this.#instantaneousMetric.reset()
    this.#instantaneousMetric.inc({ source: 'calculation' }, 0)
    this.#bedtimeProjectionMetric.reset()
    this.#bedtimeProjectionMetric.inc({ source: 'calculation' }, 0)
  }

  #update() {
    this.#reset()
    this.#instantaneousMetric.inc(
      { source: 'calculation' },
      this.#caffeineCalculator.getCurrentCaffeineLevel(),
    )
    this.#bedtimeProjectionMetric.inc(
      { source: 'calculation' },
      this.#caffeineCalculator.getBedtimeCaffeineLevel(),
    )
  }

  addDataPoints(dataPoints: TDataPoint[]) {
    const added = this.#caffeineCalculator.addDataPoints(dataPoints)

    if (added > 0) {
      this.#update()
    }

    return added
  }

  getDataPoints() {
    return this.#caffeineCalculator.getDataPoints()
  }
}
