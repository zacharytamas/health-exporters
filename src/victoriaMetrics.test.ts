import { expect, test } from 'bun:test'
import { dataPointToPrometheus } from './victoriaMetrics'

test('dataPointToPrometheus', () => {
  expect(
    dataPointToPrometheus({ metricName: 't', value: 1, timestamp: 500 }),
  ).toBe('t 1 500')

  expect(
    dataPointToPrometheus({
      metricName: 't',
      value: 1,
      timestamp: 500,
      labels: { a: 'b' },
    }),
  ).toBe('t{a="b"} 1 500')

  expect(
    dataPointToPrometheus({
      metricName: 't',
      value: 1,
      timestamp: 500,
      labels: { a: 'b', c: 'd' },
    }),
  ).toBe('t{a="b", c="d"} 1 500')
})
