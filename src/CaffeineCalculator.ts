import ms from 'ms'

import type { TDataPoint } from './schema'

const CAFFEINE_HALF_LIFE_MS = ms('4h')
/** How long after consumption to start counting full effect */
const CAFFEINE_DELAY = ms('1h')
/** Caffeine consumption whose half-life adjusted value is less than this will be removed */
const CLEANUP_THRESHOLD = 1

type NowFunction = () => number

export class CaffeineCalculator {
  #data: Map<string, TDataPoint> = new Map()
  #now: NowFunction

  constructor({
    dataPoints = [],
    nowFunction = () => Date.now(),
  }: { dataPoints?: TDataPoint[]; nowFunction?: NowFunction } = {}) {
    this.addDataPoints(dataPoints)
    this.#now = nowFunction
  }

  #currentValue(dp: TDataPoint, now: number): number {
    const ago = now - new Date(dp.date).getTime()
    const withHalfLife = dp.qty * 0.5 ** (ago / CAFFEINE_HALF_LIFE_MS)

    let adjusted_qty = withHalfLife

    // When caffeine intake is recorded it comes as one value instantaneously.
    // It's a bit misleading because in actuality my body doesn't _suddenly_
    // have the whole caffeine amount in my bloodstream. This is a simplified
    // approach which spreads out the impact of the new caffeine over the course
    // of `CAFFEINE_DELAY` which softens the spike on the current value of caffeine.
    if (ago > CAFFEINE_DELAY) {
      adjusted_qty = Math.max(
        CLEANUP_THRESHOLD,
        withHalfLife * (ago / CAFFEINE_DELAY),
      )
    }

    return adjusted_qty
  }

  addDataPoints(dataPoints: TDataPoint[]) {
    for (const dataPoint of dataPoints) {
      this.#data.set(dataPoint.date, dataPoint)
    }
  }

  getCurrentCaffeineLevel(now = this.#now()): number {
    return Array.from(this.#data.values())
      .map((dp) => {
        const adjusted_qty = this.#currentValue(dp, now)

        if (adjusted_qty < CLEANUP_THRESHOLD) {
          // If the value is less than the cleanup threshold, we can remove it for memory savings and to avoid calculating again.
          this.#data.delete(dp.date)
        }

        return { ...dp, adjusted_qty }
      })
      .reduce((acc, curr) => acc + curr.adjusted_qty, 0)
  }
}
