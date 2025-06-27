import { Effect } from 'effect'
import {
  VictoriaMetricsLive,
  VictoriaMetricsLog,
  VictoriaMetricsService,
} from '../metrics/services/VictoriaMetrics'
import { IntradayDataLive } from '../metrics/services/IntradayData'
import {
  DietaryWaterMetric,
  DietaryWaterMetricLive,
} from '../metrics/services/DietaryWaterMetric'

const program = Effect.gen(function* () {
  const dietaryWaterMetric = yield* DietaryWaterMetric
  yield* Effect.log('Starting dietary water metric')
  dietaryWaterMetric.start()
  yield* Effect.log('Dietary water metric started')
})

Effect.runFork(
  program.pipe(
    Effect.provide(DietaryWaterMetricLive),
    Effect.provide(IntradayDataLive),
    Effect.provide(VictoriaMetricsLive),
  ),
)
