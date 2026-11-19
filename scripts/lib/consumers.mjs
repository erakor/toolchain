import { readFileSync } from 'node:fs'

/** The repos in consumers.json: `{ repo, packageDir, smoke }` each. */
export const consumers = JSON.parse(
  readFileSync(new URL('../../consumers.json', import.meta.url), 'utf8'),
)
