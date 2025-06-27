import { type DateValues, addDays, isBefore, set } from 'date-fns'
import ms from 'ms'

import { createDecayingValueCalculator } from './decayingValueCalculator'
import type { TDataPoint } from './schema'

const CAFFEINE_HALF_LIFE_MS = ms('4h')
const CAFFEINE_DELAY = ms('1h')
const MAX_QTY = 200
const BEDTIME: DateValues = { hours: 22, minutes: 0 }

type NowFunction = () => number

export class CaffeineCalculator {
  #calculator: ReturnType<typeof createDecayingValueCalculator>
  #now: NowFunction

  constructor({
    dataPoints = [],
    nowFunction = () => Date.now(),
  }: { dataPoints?: TDataPoint[]; nowFunction?: NowFunction } = {}) {
    this.#now = nowFunction
    this.#calculator = createDecayingValueCalculator({
      halfLife: CAFFEINE_HALF_LIFE_MS,
      ingestionDelay: CAFFEINE_DELAY,
      nowFunction,
      dataPoints: dataPoints.map((dp) => ({ date: dp.date, value: dp.qty })),
    })
  }

  #nextBedtime(now = this.#now()) {
    const nowDate = new Date(now)
    let bedtime = set(nowDate, BEDTIME)

    if (isBefore(bedtime, nowDate)) {
      bedtime = addDays(bedtime, 1)
    }

    return bedtime
  }

  getDataPoints() {
    return this.#calculator.getDataPoints().map((dp) => ({
      date: dp.date,
      qty: dp.value,
      ago: dp.ago,
      adjusted_qty: dp.value,
    }))
  }

  addDataPoints(dataPoints: TDataPoint[]) {
    const validDataPoints = dataPoints.filter((dp) => dp.qty <= MAX_QTY)
    const newPoints = this.#calculator.addDataPoints(validDataPoints.map((dp) => ({ date: dp.date, value: dp.qty })))
    return newPoints.length
  }

  getCaffeineLevelAtTime(time: number): number {
    return this.#calculator.getValueAtTime(time)
  }

  getCurrentCaffeineLevel(): number {
    return this.#calculator.getCurrentValue()
  }

  getBedtimeCaffeineLevel(): number {
    return this.getCaffeineLevelAtTime(this.#nextBedtime().getTime())
  }
}
