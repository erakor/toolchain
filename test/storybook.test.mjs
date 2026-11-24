import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const fixtures = fileURLToPath(new URL('./fixtures/storybook/', import.meta.url))
const oxlint = fileURLToPath(new URL('../node_modules/.bin/oxlint', import.meta.url))

/** `file:line severity rule` for every Storybook diagnostic oxlint reports in the fixtures. */
function diagnostics() {
  let out
  try {
    out = execFileSync(oxlint, ['--format', 'unix', '.'], { cwd: fixtures, encoding: 'utf8' })
  } catch (error) {
    out = error.stdout
  }
  return out
    .split('\n')
    .map((line) => line.match(/^(?:\.\/)?([^:]+):(\d+):\d+: .*\[(\w+)\/storybook\((.+?)\)\]/))
    .filter(Boolean)
    .map(([, file, line, severity, rule]) => `${file}:${line} ${severity} ${rule}`)
    .sort()
}

test('runs eslint-plugin-storybook on stories and .storybook/main through extends', () => {
  assert.deepEqual(diagnostics(), [
    '.storybook/main.ts:3 Error no-uninstalled-addons',
    'src/Bad.stories.tsx:1 Error default-exports',
    'src/Bad.stories.tsx:1 Warning prefer-pascal-case',
    'src/Bad.stories.tsx:2 Warning no-redundant-story-name',
  ])
})
