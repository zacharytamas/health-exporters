import { haeJsonMetricSchema } from './hae-json'

import { z } from 'zod'

import { Effect, pipe } from 'effect'
import type { ZodError } from 'zod'
import type { HAEJsonMetric } from './hae-json'

export const getMetricsFromJson = (
  json: unknown,
): Effect.Effect<HAEJsonMetric[], ZodError> =>
  Effect.try<HAEJsonMetric[], ZodError>({
    try: () =>
      z
        .object({ data: z.object({ metrics: z.array(haeJsonMetricSchema) }) })
        .transform((data) => data.data.metrics)
        .parse(json),
    catch: (error) => error as ZodError,
  })

const getPathForAutomationAndDate = (automation: string, date: string) =>
  `/Users/zachary/Library/Mobile Documents/iCloud~com~ifunography~HealthExport/Documents/${automation}/HealthAutoExport-${date}.json`

/**
 * Returns the parsed JSON from a path, if possible.
 *
 * @param path - The path to the JSON file
 * @returns The JSON from the path
 */
const getJsonFromPath = (path: string): Effect.Effect<unknown, Error> =>
  Effect.tryPromise({
    try: () => Bun.file(path).json(),
    catch: () => new Error(`Could not read file: ${path}`),
  })

export const getMetricsForAutomationAndDate = (
  automation: string,
  date: string,
): Effect.Effect<HAEJsonMetric[], Error> =>
  pipe(
    getPathForAutomationAndDate(automation, date),
    getJsonFromPath,
    Effect.flatMap(getMetricsFromJson),
  )
