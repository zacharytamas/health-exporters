import { Effect } from 'effect'
import {
  DietaryCaffeineMetricService,
  DietaryCaffeineMetricServiceLayer,
} from './metrics/services/DietaryCaffeineMetric'
import { IntradayDataLive } from './metrics/services/IntradayData'
import { VictoriaMetricsLive } from './metrics/services/VictoriaMetrics'

const program = Effect.gen(function* () {
  const dietaryCaffeineMetric = yield* DietaryCaffeineMetricService
  dietaryCaffeineMetric.start()
})

Effect.runFork(
  program.pipe(
    Effect.provide(DietaryCaffeineMetricServiceLayer),
    Effect.provide(VictoriaMetricsLive),
    Effect.provide(IntradayDataLive),
  ),
)
