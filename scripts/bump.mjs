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
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { consumers } from './lib/consumers.mjs'
import { compare, gh, latestTag, resolveRef } from './lib/gh.mjs'
import { rewritePins } from './lib/pins.mjs'

const { values } = parseArgs({
  options: { tag: { type: 'string' }, only: { type: 'string' }, 'dry-run': { type: 'boolean' } },
})
const tag = values.tag ?? latestTag()
const sha = resolveRef(tag)
const branch = `toolchain/${tag}`

const bot = {
  name: 'github-actions[bot]',
  email: '41898282+github-actions[bot]@users.noreply.github.com',
}
const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: bot.name,
  GIT_AUTHOR_EMAIL: bot.email,
  GIT_COMMITTER_NAME: bot.name,
  GIT_COMMITTER_EMAIL: bot.email,
}
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: gitEnv, encoding: 'utf8' })

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

function openPullRequest(repo) {
  const open = JSON.parse(
    gh('pr', 'list', '-R', repo, '--state', 'open', '--json', 'number,headRefName'),
  )
  if (!open.some((pr) => pr.headRefName === branch)) {
    const title = `chore: bump erakor/toolchain to ${tag}`
    const body = `Moves the \`@erakor/toolchain\` dependency, its lockfile entry and every shared-workflow pin to ${tag} (${sha.slice(0, 7)}).\n\nOpened by erakor/toolchain's bump-consumers workflow.`
    gh('pr', 'create', '-R', repo, '--head', branch, '--title', title, '--body', body)
  }
  // An older, still-open bump is now redundant.
  for (const pr of open) {
    if (pr.headRefName.startsWith('toolchain/') && pr.headRefName !== branch) {
      gh(
        'pr',
        'close',
        String(pr.number),
        '-R',
        repo,
        '--delete-branch',
        '--comment',
        `Superseded by the ${tag} bump.`,
      )
    }
  }
}

function bump({ repo, packageDir }) {
  const root = mkdtempSync(join(tmpdir(), 'bump-'))
  try {
    const dir = join(root, 'repo')
    gh('repo', 'clone', repo, dir, '--', '--depth', '1')

    const packageChanged = packageDir !== null && rewrite(join(dir, packageDir, 'package.json'))
    let changed = packageChanged
    const workflows = join(dir, '.github', 'workflows')
    for (const name of readdirSync(workflows).filter((file) => /\.ya?ml$/.test(file))) {
      if (rewrite(join(workflows, name))) changed = true
    }
    if (!changed) return console.log(`ok       ${repo} nothing behind ${tag} to move`)

    if (packageChanged) {
      const flags = ['--lockfile-only', '--ignore-scripts', '--no-frozen-lockfile']
      execFileSync('pnpm', ['install', ...flags], { cwd: join(dir, packageDir), stdio: 'inherit' })
    }

    git(dir, 'checkout', '-b', branch)
    git(dir, 'add', '-A')
    git(dir, 'commit', '-m', `chore: bump erakor/toolchain to ${tag}`)
    if (values['dry-run']) {
      return console.log(`dry-run  ${repo}\n${git(dir, 'show', '--stat', '--format=', 'HEAD')}`)
    }

    git(dir, 'push', '--force', 'origin', branch)
    openPullRequest(repo)
    console.log(`opened   ${repo} -> ${tag}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

for (const consumer of consumers.filter(({ repo }) => !values.only || repo === values.only)) {
  try {
    bump(consumer)
  } catch (error) {
    process.exitCode = 1
    console.error(`FAILED   ${consumer.repo}: ${error.message}`)
  }
}
