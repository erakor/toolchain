import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const fixtures = fileURLToPath(new URL('./fixtures/secret-env/', import.meta.url))
const oxlint = fileURLToPath(new URL('../node_modules/.bin/oxlint', import.meta.url))

/** `file:line rule` for every diagnostic oxlint reports in the fixtures folder. */
function diagnostics() {
  let out
  try {
    out = execFileSync(oxlint, ['--format', 'unix', '.'], { cwd: fixtures, encoding: 'utf8' })
  } catch (error) {
    out = error.stdout
  }
  return out
    .split('\n')
    .map((line) => line.match(/^(?:\.\/)?([^:]+):(\d+):\d+: .*\[Error\/secret-env\((.+?)\)\]/))
    .filter(Boolean)
    .map(([, file, line, rule]) => `${file}:${line} ${rule}`)
    .sort()
}

test('flags secret-looking NEXT_PUBLIC_ reads, including destructured, and secret reads in the next.config env block', () => {
  assert.deepEqual(diagnostics(), [
    'next.config.mjs:2 no-secret-in-config-env',
    'next.config.mjs:2 no-secret-in-config-env',
    'next.config.mjs:3 no-secret-in-config-env',
    'reads.ts:1 no-public-secret',
    'reads.ts:2 no-public-secret',
    'reads.ts:3 no-public-secret',
    'reads.ts:8 no-public-secret',
  ])
})
