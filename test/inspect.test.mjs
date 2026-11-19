import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inspect } from '../scripts/lib/inspect.mjs'

const OLD = 'f1b5fee4e8d1d7a3df29460710db1808f5523d6f'
const NEW = '7b648f778dfc2e4f0753ef20bb5a0a9484f9377a'
const AHEAD = 'f932e1de2de8b7ab49f81be1b68339731d88b3d0'

const packageJson = (ref, lint = 'oxlint --deny-warnings') =>
  JSON.stringify({
    scripts: { lint },
    devDependencies: { '@erakor/toolchain': `github:erakor/toolchain#${ref}` },
  })
const workflow = (ref) => `uses: erakor/toolchain/.github/workflows/node-checks.yml@${ref}\n`
const renovate = '{ "extends": ["github>erakor/toolchain//renovate/default"] }'

/** An `io` over an in-memory repo: `files` maps path to text. */
function io(files) {
  return {
    latest: { tag: 'v1.2.1', sha: NEW },
    readFile: (_repo, path) => files[path] ?? null,
    listDir: (_repo, path) =>
      Object.keys(files)
        .filter((file) => file.startsWith(`${path}/`))
        .map((file) => file.slice(path.length + 1)),
    resolveRef: (ref) => (ref === 'v1' || ref === 'v1.2.1' ? NEW : ref),
    compare: (_base, head) => (head === AHEAD ? 'ahead' : 'behind'),
  }
}

const consumer = { repo: 'erakor/app', packageDir: '.' }
const codes = (issues) => issues.map(({ code }) => code)

test('a repo on the latest release with the flag and the preset has no issues', () => {
  const files = {
    'package.json': packageJson(NEW),
    '.github/workflows/ci.yml': workflow(NEW),
    'renovate.json': renovate,
  }
  assert.deepEqual(inspect(consumer, io(files)), [])
})

test('a floating v1 pin that resolves to the latest release is current', () => {
  const files = {
    'package.json': packageJson('v1.2.1'),
    '.github/workflows/ci.yml': workflow('v1'),
    'renovate.json': renovate,
  }
  assert.deepEqual(inspect(consumer, io(files)), [])
})

test('stale pins are errors, and differing pins are reported once as mixed', () => {
  const files = {
    'package.json': packageJson(NEW),
    '.github/workflows/ci.yml': workflow(OLD),
    'renovate.json': renovate,
  }
  const issues = inspect(consumer, io(files))
  assert.deepEqual(codes(issues), ['stale', 'mixed-pins'])
  assert.match(issues[0].message, /\.github\/workflows\/ci\.yml/)
  assert.ok(issues.every(({ level }) => level === 'error'))
})

test('a pin on a commit after the latest tag is only a warning', () => {
  const files = {
    'package.json': packageJson(AHEAD),
    '.github/workflows/ci.yml': workflow(AHEAD),
    'renovate.json': renovate,
  }
  const issues = inspect(consumer, io(files))
  assert.deepEqual(codes(issues), ['untagged', 'untagged'])
  assert.ok(issues.every(({ level }) => level === 'warn'))
})

test('a lint script without --deny-warnings is an error; other linters are not checked', () => {
  const base = { '.github/workflows/ci.yml': workflow(NEW), 'renovate.json': renovate }
  const missing = inspect(consumer, io({ ...base, 'package.json': packageJson(NEW, 'oxlint') }))
  assert.deepEqual(codes(missing), ['lint-flag'])
  const eslint = inspect(consumer, io({ ...base, 'package.json': packageJson(NEW, 'eslint .') }))
  assert.deepEqual(eslint, [])
})

test('no Renovate preset is a warning', () => {
  const files = { 'package.json': packageJson(NEW), '.github/workflows/ci.yml': workflow(NEW) }
  assert.deepEqual(codes(inspect(consumer, io(files))), ['no-renovate'])
})

test('a repo with no package.json folder checks only its workflow pins', () => {
  const files = { '.github/workflows/build.yml': workflow(OLD), 'renovate.json': renovate }
  assert.deepEqual(codes(inspect({ repo: 'erakor/swift', packageDir: null }, io(files))), ['stale'])
})

test('a missing package.json and a repo that pins nothing are errors', () => {
  const issues = inspect(consumer, io({ 'renovate.json': renovate }))
  assert.deepEqual(codes(issues), ['no-package-json', 'no-pins'])
})

test('the Renovate preset counts in any of its config locations', () => {
  const base = { 'package.json': packageJson(NEW), '.github/workflows/ci.yml': workflow(NEW) }
  assert.deepEqual(inspect(consumer, io({ ...base, '.github/renovate.json5': renovate })), [])
  assert.deepEqual(inspect(consumer, io({ ...base, '.renovaterc': renovate })), [])
  const inPackage = {
    ...base,
    'package.json': JSON.stringify({
      ...JSON.parse(base['package.json']),
      renovate: JSON.parse(renovate),
    }),
  }
  assert.deepEqual(inspect(consumer, io(inPackage)), [])
})
