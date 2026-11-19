import { execFileSync } from 'node:child_process'

const TOOLCHAIN = 'erakor/toolchain'

/** Run `gh` and return its stdout; throws with gh's stderr on failure. */
export function gh(...args) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    throw new Error(`gh ${args.join(' ')}: ${error.stderr || error.message}`, { cause: error })
  }
}

/** Run `fn`, returning `fallback` instead when GitHub answers 404. */
function orNotFound(fallback, fn) {
  try {
    return fn()
  } catch (error) {
    if (/HTTP 404|Not Found/.test(error.message)) return fallback
    throw error
  }
}

/** A file's text from a repo's default branch, or null when it does not exist. */
export const readFile = (repo, path) =>
  orNotFound(null, () =>
    gh('api', '-H', 'Accept: application/vnd.github.raw+json', `repos/${repo}/contents/${path}`),
  )

/** File names in a repo folder, or an empty list when the folder does not exist. */
export const listDir = (repo, path) =>
  orNotFound([], () =>
    gh('api', `repos/${repo}/contents/${path}`, '--jq', '.[].name').split('\n').filter(Boolean),
  )

/** False when the token cannot see the repo: its files would then all look missing. */
export const repoReadable = (repo) => orNotFound(false, () => gh('api', `repos/${repo}`) !== '')

/** Run `fn(key)` once per key: a run asks about the same few refs for every pin it reads. */
function memoize(fn) {
  const cache = new Map()
  return (...key) => {
    const id = key.join('\0')
    if (!cache.has(id)) cache.set(id, fn(...key))
    return cache.get(id)
  }
}

/** The commit SHA a tag, branch or SHA of this repo points at. */
export const resolveRef = memoize((ref) =>
  gh('api', `repos/${TOOLCHAIN}/commits/${ref}`, '--jq', '.sha').trim(),
)

/** `behind`, `identical`, `ahead` or `diverged`: where `head` stands relative to `base`. */
export const compare = memoize((base, head) =>
  gh('api', `repos/${TOOLCHAIN}/compare/${base}...${head}`, '--jq', '.status').trim(),
)

/** The highest `vX.Y.Z` tag of this repo. */
export function latestTag() {
  return gh('api', '--paginate', `repos/${TOOLCHAIN}/tags`, '--jq', '.[].name')
    .split('\n')
    .filter((name) => /^v\d+\.\d+\.\d+$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .at(-1)
}
