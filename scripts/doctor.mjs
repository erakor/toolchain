// Reports how far each repo in consumers.json has drifted from the latest release: stale or
// mixed pins, a lint script without --deny-warnings, no Renovate preset. Read-only.
//
//   node scripts/doctor.mjs            # exits 1 when any repo has an error
//   node scripts/doctor.mjs --json
//
// Needs the `gh` CLI, signed in (or GH_TOKEN set).
import { compare, latestTag, listDir, readFile, resolveRef } from './lib/gh.mjs'
import { consumers } from './lib/consumers.mjs'
import { inspect } from './lib/inspect.mjs'

const tag = latestTag()
const latest = { tag, sha: resolveRef(tag) }
const io = { readFile, listDir, resolveRef, compare, latest }

const results = consumers.map((consumer) => ({
  repo: consumer.repo,
  issues: inspect(consumer, io),
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
