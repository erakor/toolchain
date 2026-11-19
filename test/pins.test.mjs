import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findPins, rewritePins } from '../scripts/lib/pins.mjs'

const OLD = 'f1b5fee4e8d1d7a3df29460710db1808f5523d6f'
const NEW = '7b648f778dfc2e4f0753ef20bb5a0a9484f9377a'
const release = { tag: 'v1.2.1', sha: NEW }

const packageJson = (ref) =>
  `{ "devDependencies": { "@erakor/toolchain": "github:erakor/toolchain#${ref}" } }`
const workflow = (ref, comment = '') =>
  `jobs:\n  checks:\n    uses: erakor/toolchain/.github/workflows/node-checks.yml@${ref}${comment}\n`

test('finds the dependency pin and every workflow pin', () => {
  const text = `${packageJson(OLD)}\n${workflow('v1')}${workflow(OLD, ' # v1.0.0')}`
  assert.deepEqual(findPins(text), [
    { kind: 'dependency', ref: OLD },
    { kind: 'workflow', ref: 'v1' },
    { kind: 'workflow', ref: OLD },
  ])
})

test('ignores text that only mentions the repo', () => {
  assert.deepEqual(
    findPins('see erakor/toolchain and "@erakor/other": "github:erakor/other#v1.0.0"'),
    [],
  )
})

test('a SHA pin stays a SHA and a workflow pin gets the release in a comment', () => {
  assert.equal(rewritePins(packageJson(OLD), release), packageJson(NEW))
  assert.equal(rewritePins(workflow(OLD), release), workflow(NEW, ' # v1.2.1'))
  assert.equal(rewritePins(workflow(OLD, ' # v1.0.0'), release), workflow(NEW, ' # v1.2.1'))
})

test('a tag pin stays a tag', () => {
  assert.equal(rewritePins(packageJson('v1.1.0'), release), packageJson('v1.2.1'))
  assert.equal(rewritePins(workflow('v1.1.0'), release), workflow('v1.2.1'))
})

test('a floating major is left alone, and a rewrite is idempotent', () => {
  assert.equal(rewritePins(workflow('v1'), release), workflow('v1'))
  assert.equal(rewritePins(packageJson('v1'), release), packageJson('v1'))
  const once = rewritePins(workflow(OLD), release)
  assert.equal(rewritePins(once, release), once)
})

test('a pin that shouldMove vetoes is left as it was', () => {
  const text = `${packageJson(OLD)}\n${workflow(OLD)}`
  assert.equal(
    rewritePins(text, release, () => false),
    text,
  )
  assert.equal(
    rewritePins(workflow(OLD), release, (ref) => ref === OLD),
    workflow(NEW, ' # v1.2.1'),
  )
})
