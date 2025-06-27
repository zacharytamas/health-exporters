type NowFunction = () => number

type TDataPoint = {
  date: string
  value: number
}

type TDecayingValueCalculator = {
  getDataPoints(): (TDataPoint & { ago: number })[]
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

    return newDataPoints
  }

  function getDataPoints(): (TDataPoint & { ago: number })[] {
    const now = nowFunction()

    cleanup(now)

    return Array.from(_dataPoints.values()).map((dp) => ({
      ...dp,
      ago: now - new Date(dp.date).getTime(),
    }))
  }

  function cleanup(now = nowFunction()) {
    for (const dp of _dataPoints.values()) {
      if (new Date(dp.date).getTime() < now - halfLife * 10) {
        _dataPoints.delete(dp.date)
      }
    }
  }

  function valueAtTime(dp: TDataPoint, time: number): number {
    const age = time - new Date(dp.date).getTime()

    if (age < 0) {
      // If the data point is in the future, it has no value at this time.
      return 0
    }

    const withHalfLife = dp.value * 0.5 ** (age / halfLife)

    let adjusted_qty = withHalfLife

    if (age < ingestionDelay) {
      adjusted_qty = Math.max(1, withHalfLife * (age / ingestionDelay))
    }

    return adjusted_qty
  }

  function getValueAtTime(time: number): number {
    return getDataPoints()
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
