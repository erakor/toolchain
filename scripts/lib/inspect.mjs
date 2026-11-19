import { findPins } from './pins.mjs'

const RENOVATE_FILES = [
  'renovate.json',
  '.github/renovate.json',
  'renovate.json5',
  '.renovaterc.json',
]
const PRESET = 'erakor/toolchain//renovate/default'

/**
 * Check one consumer against the latest release and return its problems as
 * `{ level, code, message }` (`error` fails the doctor, `warn` does not).
 *
 * `io` is what the checks need from the outside, so tests can fake it:
 * `readFile(repo, path)`, `listDir(repo, path)`, `resolveRef(ref)`, `compare(base, head)`,
 * and `latest` as `{ tag, sha }`.
 */
export function inspect(consumer, io) {
  const { repo, packageDir } = consumer
  const issues = []
  const add = (level, code, message) => issues.push({ level, code, message })

  const pins = []
  const packageJsonPath =
    packageDir === null ? null : `${packageDir}/package.json`.replace(/^\.\//, '')
  const packageText = packageJsonPath === null ? null : io.readFile(repo, packageJsonPath)

  if (packageJsonPath !== null) {
    if (packageText === null) {
      add('error', 'no-package-json', `${packageJsonPath} not found`)
    } else {
      for (const pin of findPins(packageText)) pins.push({ ...pin, where: packageJsonPath })
    }
  }

  for (const name of io.listDir(repo, '.github/workflows')) {
    const path = `.github/workflows/${name}`
    const text = io.readFile(repo, path)
    for (const pin of text === null ? [] : findPins(text)) pins.push({ ...pin, where: path })
  }

  if (pins.length === 0) add('error', 'no-pins', 'nothing pins erakor/toolchain')

  const resolved = new Set()
  for (const pin of pins) {
    const sha = io.resolveRef(pin.ref)
    resolved.add(sha)
    if (sha === io.latest.sha) continue
    const status = io.compare(io.latest.tag, sha)
    if (status === 'ahead') {
      add(
        'warn',
        'untagged',
        `${pin.where} pins ${pin.ref}, a commit after ${io.latest.tag} with no release`,
      )
    } else {
      add('error', 'stale', `${pin.where} pins ${pin.ref}, behind ${io.latest.tag}`)
    }
  }
  if (resolved.size > 1) {
    add('error', 'mixed-pins', `${resolved.size} different toolchain commits are pinned`)
  }

  if (packageText !== null) {
    const lint = JSON.parse(packageText).scripts?.lint
    if (lint !== undefined && /\boxlint\b/.test(lint) && !lint.includes('--deny-warnings')) {
      add(
        'error',
        'lint-flag',
        `"lint" is \`${lint}\`: add --deny-warnings so CI fails on warnings`,
      )
    }
  }

  const renovate = RENOVATE_FILES.map((path) => io.readFile(repo, path)).find((text) =>
    text?.includes(PRESET),
  )
  if (renovate === undefined) {
    add('warn', 'no-renovate', `no renovate config extends ${PRESET}`)
  }

  return issues
}
