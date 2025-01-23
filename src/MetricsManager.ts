import type { Counter, Gauge, Registry } from 'prom-client'

type PrometheusMetric = Counter | Gauge

export default class MetricsManager {
  #metrics: Map<string, PrometheusMetric> = new Map()
  #shutdownSignal: AbortSignal

  constructor(
    private readonly registry: Registry,
    { signal }: { signal: AbortSignal },
  ) {
    this.#shutdownSignal = signal
  }

  public registerMetric(name: string, metric: PrometheusMetric) {
    this.#metrics.set(name, metric)
    this.registry.registerMetric(metric)
  }

  public getMetric(name: string) {
    return this.#metrics.get(name)
  }

  public getRegistry() {
    return this.registry
  }

  public getShutdownSignal() {
    return this.#shutdownSignal
  }
}
