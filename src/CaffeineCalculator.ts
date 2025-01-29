import { type DateValues, addDays, isBefore, set } from 'date-fns'
import ms from 'ms'

import type { TDataPoint } from './schema'

const CAFFEINE_HALF_LIFE_MS = ms('4h')
/** How long after consumption to start counting full effect */
const CAFFEINE_DELAY = ms('1h')
/** Caffeine consumption whose half-life adjusted value is less than this will be removed */
const CLEANUP_THRESHOLD = 1
const MAX_QTY = 200
const BEDTIME: DateValues = { hours: 22, minutes: 0 }

type NowFunction = () => number

export class CaffeineCalculator {
  #data: Map<string, TDataPoint> = new Map()
  #now: NowFunction

  constructor({
    dataPoints = [],
    nowFunction = () => Date.now(),
  }: { dataPoints?: TDataPoint[]; nowFunction?: NowFunction } = {}) {
    this.#now = nowFunction
    this.addDataPoints(dataPoints)
  }

  #nextBedtime(now = this.#now()) {
    const nowDate = new Date(now)
    let bedtime = set(nowDate, BEDTIME)

    // If "bedtime" today is actually before the current time (i.e. it's after bedtime), then the
    // "next bedtime" is actually tomorrow, so we add a day to the bedtime date.
    if (isBefore(bedtime, nowDate)) {
      bedtime = addDays(bedtime, 1)
    }

    return bedtime
  }

  #valueAtTime(dp: TDataPoint, time: number): number {
    const ago = time - new Date(dp.date).getTime()
    const withHalfLife = dp.qty * 0.5 ** (ago / CAFFEINE_HALF_LIFE_MS)

    let adjusted_qty = withHalfLife

    // When caffeine intake is recorded it comes as one value instantaneously.
    // It's a bit misleading because in actuality my body doesn't _suddenly_
    // have the whole caffeine amount in my bloodstream. This is a simplified
    // approach which spreads out the impact of the new caffeine over the course
    // of `CAFFEINE_DELAY` which softens the spike on the current value of caffeine.
    if (ago < CAFFEINE_DELAY) {
      adjusted_qty = Math.max(
        CLEANUP_THRESHOLD,
        withHalfLife * (ago / CAFFEINE_DELAY),
      )
    }

    return adjusted_qty
  }

  #cleanup() {
    const now = this.#now()

    for (const dp of this.#data.values()) {
      if (this.#valueAtTime(dp, now) < CLEANUP_THRESHOLD) {
        // If the value is less than the cleanup threshold, we can remove it for memory savings and to avoid calculating again.
        this.#data.delete(dp.date)
      }
    }
  }

  getDataPoints() {
    const now = this.#now()

    return Array.from(this.#data.values()).map((dp) => ({
      ...dp,
      ago: now - new Date(dp.date).getTime(),
      adjusted_qty: this.#valueAtTime(dp, now),
    }))
  }

  /**
   * Add new caffeine ingestion data points.
   *
   * @param dataPoints - The data points to add.
   * @returns The number of data points which were not already included.
   */
  addDataPoints(dataPoints: TDataPoint[]) {
    let count = 0

    for (const dataPoint of dataPoints) {
      if (dataPoint.qty > MAX_QTY) {
        // NOTE: Annoying hack here because sometimes WaterLlama creates duplicate entries and then
        // Auto Health Export handles this by just summing them all that share a timestamp. This
        // results in, from our perspective, not duplicate data points but one very large data point.
        // I've arbitrarily decided that if the data point is above this amount, it must be one of
        // these cases and so we'll ignore it. Eventually WaterLlama fixes the data itself and so
        // later it will be corrected.
        continue
      }

      if (!this.#data.has(dataPoint.date)) {
        count++
      }

      this.#data.set(dataPoint.date, dataPoint)
    }

    this.#cleanup()

    return count
  }

  getCaffeineLevelAtTime(time: number): number {
    return Array.from(this.#data.values())
      .map((dp) => ({ ...dp, adjusted_qty: this.#valueAtTime(dp, time) }))
      .reduce((acc, curr) => acc + curr.adjusted_qty, 0)
  }

  getCurrentCaffeineLevel(): number {
    return this.getCaffeineLevelAtTime(this.#now())
  }

  getBedtimeCaffeineLevel(): number {
    return this.getCaffeineLevelAtTime(this.#nextBedtime().getTime())
  }
}
