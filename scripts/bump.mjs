// Opens a pull request in each repo of consumers.json that pins an older release, moving the
// `@erakor/toolchain` dependency (and its lockfile) and every `uses: erakor/toolchain/...` line
// to one release. Each pin keeps its style (SHA stays SHA, tag stays tag).
//
//   node scripts/bump.mjs                      # latest release, every consumer
//   node scripts/bump.mjs --tag v1.3.0 --only erakor/kinolog
//   node scripts/bump.mjs --dry-run            # clone and rewrite, but push and open nothing
//
// Needs `gh` (signed in or GH_TOKEN with write access to the consumers), git, and pnpm 12 for the
// lockfile. Run by .github/workflows/bump-consumers.yml on every release tag.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compare, gh, latestTag, resolveRef } from './lib/gh.mjs'
import { rewritePins } from './lib/pins.mjs'

const args = process.argv.slice(2)
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const dryRun = args.includes('--dry-run')
const only = option('--only')

const tag = option('--tag') ?? latestTag()
const sha = resolveRef(tag)
const branch = `toolchain/${tag}`
const identity = [
  '-c',
  'user.name=github-actions[bot]',
  '-c',
  'user.email=41898282+github-actions[bot]@users.noreply.github.com',
]

const consumers = JSON.parse(readFileSync(new URL('../consumers.json', import.meta.url), 'utf8'))
const git = (cwd, ...rest) => execFileSync('git', [...identity, ...rest], { cwd, encoding: 'utf8' })

/** True when a pin is older than the release; one already past it is not moved back. */
function isBehind(ref) {
  const pinned = resolveRef(ref)
  return pinned !== sha && compare(tag, pinned) === 'behind'
}

/** Rewrite one file in place; true when it changed. */
function rewrite(path) {
  const before = readFileSync(path, 'utf8')
  const after = rewritePins(before, { tag, sha }, isBehind)
  if (after === before) return false
  writeFileSync(path, after)
  return true
}

function bump({ repo, packageDir }) {
  const dir = join(mkdtempSync(join(tmpdir(), 'bump-')), 'repo')
  gh('repo', 'clone', repo, dir, '--', '--depth', '1')

  const touched = []
  const packageFile = packageDir === null ? null : join(dir, packageDir, 'package.json')
  if (packageFile !== null && rewrite(packageFile)) touched.push(packageFile)

  const workflows = join(dir, '.github', 'workflows')
  for (const name of readdirSync(workflows).filter((file) => /\.ya?ml$/.test(file))) {
    if (rewrite(join(workflows, name))) touched.push(join(workflows, name))
  }

  if (touched.length === 0) return console.log(`ok       ${repo} nothing behind ${tag} to move`)

  if (touched.includes(packageFile)) {
    execFileSync(
      'pnpm',
      ['install', '--lockfile-only', '--ignore-scripts', '--no-frozen-lockfile'],
      {
        cwd: join(dir, packageDir),
        stdio: 'inherit',
      },
    )
  }

  git(dir, 'checkout', '-b', branch)
  git(dir, 'add', '-A')
  git(dir, 'commit', '-m', `chore: bump erakor/toolchain to ${tag}`)
  if (dryRun)
    return console.log(`dry-run  ${repo}\n${git(dir, 'show', '--stat', '--format=', 'HEAD')}`)

  git(dir, 'push', '--force', 'origin', branch)
  const open = gh(
    'pr',
    'list',
    '-R',
    repo,
    '--head',
    branch,
    '--state',
    'open',
    '--json',
    'number',
    '--jq',
    'length',
  )
  if (open.trim() === '0') {
    gh(
      'pr',
      'create',
      '-R',
      repo,
      '--head',
      branch,
      '--title',
      `chore: bump erakor/toolchain to ${tag}`,
      '--body',
      `Moves the \`@erakor/toolchain\` dependency, its lockfile entry and every shared-workflow pin to ${tag} (${sha.slice(0, 7)}).\n\nOpened by erakor/toolchain's bump-consumers workflow.`,
    )
  }

  // An older, still-open bump is now redundant.
  const superseded = gh(
    'pr',
    'list',
    '-R',
    repo,
    '--state',
    'open',
    '--json',
    'number,headRefName',
    '--jq',
    `.[] | select(.headRefName | startswith("toolchain/")) | select(.headRefName != "${branch}") | .number`,
  )
    .split('\n')
    .filter(Boolean)
  for (const number of superseded) {
    gh(
      'pr',
      'close',
      number,
      '-R',
      repo,
      '--delete-branch',
      '--comment',
      `Superseded by the ${tag} bump.`,
    )
  }
  console.log(`opened   ${repo} -> ${tag}`)
}

let failed = false
for (const consumer of consumers.filter(({ repo }) => only === undefined || repo === only)) {
  try {
    bump(consumer)
  } catch (error) {
    failed = true
    console.error(`FAILED   ${consumer.repo}: ${error.message}`)
  }
}
process.exitCode = failed ? 1 : 0
