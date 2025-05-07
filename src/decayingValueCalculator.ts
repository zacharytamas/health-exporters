import { Context, Layer } from 'effect'

type NowFunction = () => number

type TDataPoint = {
  date: string
  value: number
}

type TDecayingValueCalculator = {
  getDataPoints(): TDataPoint[]
  addDataPoints(dataPoints: TDataPoint[]): TDataPoint[]
  getValueAtTime(time: number): number
  getCurrentValue(): number
}

export const createDecayingValueCalculator = ({
  halfLife,
  ingestionDelay = 0,
  dataPoints = [],
  nowFunction = () => Date.now(),
}: {
  halfLife: number
  ingestionDelay?: number
  dataPoints?: TDataPoint[]
  nowFunction?: NowFunction
}): TDecayingValueCalculator => {
  const _dataPoints = new Map<string, TDataPoint>()

  function addDataPoints(dataPoints: TDataPoint[]): TDataPoint[] {
    const newDataPoints: TDataPoint[] = []

    for (const dp of dataPoints) {
      if (!_dataPoints.has(dp.date)) {
        newDataPoints.push(dp)
      }

      _dataPoints.set(dp.date, dp)
    }

    cleanup()

    return newDataPoints
  }

  function getDataPoints() {
    const now = nowFunction()

    return Array.from(_dataPoints.values()).map((dp) => ({
      ...dp,
      ago: now - new Date(dp.date).getTime(),
      adjusted_qty: valueAtTime(dp, now),
    }))
  }

  function cleanup() {
    const now = nowFunction()

    for (const dp of _dataPoints.values()) {
      if (valueAtTime(dp, now) < 1) {
        _dataPoints.delete(dp.date)
      }
    }
  }

  function valueAtTime(dp: TDataPoint, time: number): number {
    const ago = time - new Date(dp.date).getTime()
    const withHalfLife = dp.value * 0.5 ** (ago / halfLife)

    let adjusted_qty = withHalfLife

    if (ago < ingestionDelay) {
      adjusted_qty = Math.max(1, withHalfLife * (ago / ingestionDelay))
    }

    return adjusted_qty
  }

  function getValueAtTime(time: number): number {
    return Array.from(_dataPoints.values())
      .map((dp) => ({ ...dp, adjusted_qty: valueAtTime(dp, time) }))
      .reduce((acc, curr) => acc + curr.adjusted_qty, 0)
  }

  function getCurrentValue(): number {
    return getValueAtTime(nowFunction())
  }

  if (dataPoints.length > 0) {
    addDataPoints(dataPoints)
  }

  return {
    getDataPoints,
    addDataPoints,
    getValueAtTime,
    getCurrentValue,
  }
}
