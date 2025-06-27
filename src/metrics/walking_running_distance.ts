import { BaseMetricCollector } from '../BaseMetricCollector'
import { walkingRunningDistanceProcessor } from './processors'

export class WalkingRunningDistanceMetric extends BaseMetricCollector {
  constructor(abortSignal: AbortSignal) {
    super(walkingRunningDistanceProcessor, abortSignal)
  }
}
