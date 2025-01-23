import type { TDataPoint } from './schema'

const CAFFEINE_HALF_LIFE_MS = 4 * 60 * 60 * 1000

type NowFunction = () => number

export class CaffeineManager {
  #data: Map<string, TDataPoint> = new Map()
  #now: NowFunction

  constructor({
    dataPoints = [],
    nowFunction = () => Date.now(),
  }: { dataPoints?: TDataPoint[]; nowFunction?: NowFunction } = {}) {
    this.addDataPoints(dataPoints)
    this.#now = nowFunction
  }

  addDataPoints(dataPoints: TDataPoint[]) {
    for (const dataPoint of dataPoints) {
      this.#data.set(dataPoint.date, dataPoint)
    }
  }

  getCurrentCaffeineLevel(now = this.#now()): number {
    return Array.from(this.#data.values())
      .map((dp) => ({
        ...dp,
        adjusted_qty:
          dp.qty *
          0.5 ** ((now - new Date(dp.date).getTime()) / CAFFEINE_HALF_LIFE_MS),
      }))
      .reduce((acc, curr) => acc + curr.adjusted_qty, 0)
  }
}
