// Reports how far each repo in consumers.json has drifted from the latest release: stale or
// mixed pins, a lint script without --deny-warnings, no Renovate preset. Read-only.
//
//   pnpm consumers:doctor              # exits 1 when any repo has an error
//   pnpm consumers:doctor --json
//
// (`pnpm doctor` is pnpm's own command, so the script has a different name.)
//
// Needs the `gh` CLI, signed in (or GH_TOKEN set).
import { compare, latestTag, listDir, readFile, repoReadable, resolveRef } from './lib/gh.mjs'
import { consumers } from './lib/consumers.mjs'
import { inspect } from './lib/inspect.mjs'

const tag = latestTag()
const latest = { tag, sha: resolveRef(tag) }
const io = { readFile, listDir, resolveRef, compare, latest }

const unreadable = [
  { level: 'error', code: 'unreadable', message: 'repo not found, or the token cannot read it' },
]
const results = consumers.map((consumer) => ({
  repo: consumer.repo,
  issues: repoReadable(consumer.repo) ? inspect(consumer, io) : unreadable,
}))

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ latest, results }, null, 2))
} else {
  console.log(`latest release: ${latest.tag} (${latest.sha.slice(0, 7)})\n`)
  for (const { repo, issues } of results) {
    console.log(issues.length === 0 ? `ok    ${repo}` : `      ${repo}`)
    for (const { level, code, message } of issues) {
      console.log(`  ${level === 'error' ? 'ERROR' : 'warn '} ${code}: ${message}`)
    }
  }
}

if (results.some(({ issues }) => issues.some(({ level }) => level === 'error'))) {
  process.exitCode = 1
}
