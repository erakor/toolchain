import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const oxlint = fileURLToPath(new URL('../../node_modules/.bin/oxlint', import.meta.url))

/**
 * Run oxlint on `test/fixtures/<fixture>/` and return `file:line severity rule` for every
 * diagnostic from `plugin`, sorted.
 */
export function diagnostics(fixture, plugin) {
  const cwd = fileURLToPath(new URL(`../fixtures/${fixture}/`, import.meta.url))
  let out
  try {
    out = execFileSync(oxlint, ['--format', 'unix', '.'], { cwd, encoding: 'utf8' })
  } catch (error) {
    out = error.stdout
  }
  const pattern = new RegExp(`^(?:\\./)?([^:]+):(\\d+):\\d+: .*\\[(\\w+)/${plugin}\\((.+?)\\)\\]`)
  return out
    .split('\n')
    .map((line) => line.match(pattern))
    .filter(Boolean)
    .map(([, file, line, severity, rule]) => `${file}:${line} ${severity} ${rule}`)
    .sort()
}
