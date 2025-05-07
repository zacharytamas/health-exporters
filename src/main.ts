import { Effect } from 'effect'

import {
  DietaryCaffeineMetricService,
  DietaryCaffeineMetricServiceLayer,
} from './metrics/services/DietaryCaffeineMetric'
import {
  DietaryWaterMetric,
  DietaryWaterMetricLive,
} from './metrics/services/DietaryWaterMetric'
import {
  HeartRateMetric,
  HeartRateMetricLive,
} from './metrics/services/HeartRateMetric'
import { IntradayDataLive } from './metrics/services/IntradayData'
import {
  StepCountMetric,
  StepCountMetricLive,
} from './metrics/services/StepCountMetric'
import {
  VictoriaMetricsLive,
  VictoriaMetricsLog,
} from './metrics/services/VictoriaMetrics'
import { WalkingRunningDistanceMetric } from './metrics/walking_running_distance'

const program = Effect.gen(function* () {
  yield* Effect.logInfo('Starting program')
  const dietaryCaffeineMetric = yield* DietaryCaffeineMetricService
  const stepCountMetric = yield* StepCountMetric
  const dietaryWaterMetric = yield* DietaryWaterMetric
  const heartRateMetric = yield* HeartRateMetric

  yield* Effect.logInfo('Starting metrics')
  dietaryCaffeineMetric.start()
  stepCountMetric.start()
  dietaryWaterMetric.start()
  heartRateMetric.start()
  yield* Effect.logInfo('Metrics started')
})

Effect.runFork(
  program.pipe(
    Effect.provide(DietaryCaffeineMetricServiceLayer),
    Effect.provide(StepCountMetricLive),
    Effect.provide(DietaryWaterMetricLive),
    Effect.provide(HeartRateMetricLive),
    Effect.provide(VictoriaMetricsLive),
    Effect.provide(IntradayDataLive),
  ),
)

const shutdownAbortController = new AbortController()

const walkingRunningDistanceMetricManager = new WalkingRunningDistanceMetric(
  shutdownAbortController.signal,
)

process.on('SIGINT', () => {
  shutdownAbortController.abort()
  process.exit(0)
})
