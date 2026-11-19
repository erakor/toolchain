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

const isNotFound = (error) => /HTTP 404|Not Found/.test(error.message)

/** A file's text from a repo's default branch, or null when it does not exist. */
export function readFile(repo, path) {
  try {
    return gh(
      'api',
      '-H',
      'Accept: application/vnd.github.raw+json',
      `repos/${repo}/contents/${path}`,
    )
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

/** File names in a repo folder, or an empty list when the folder does not exist. */
export function listDir(repo, path) {
  try {
    const out = gh('api', `repos/${repo}/contents/${path}`, '--jq', '.[].name')
    return out.split('\n').filter(Boolean)
  } catch (error) {
    if (isNotFound(error)) return []
    throw error
  }
}

/** The commit SHA a tag, branch or SHA of this repo points at. */
export const resolveRef = (ref) =>
  gh('api', `repos/${TOOLCHAIN}/commits/${ref}`, '--jq', '.sha').trim()

/** `behind`, `identical`, `ahead` or `diverged`: where `head` stands relative to `base`. */
export const compare = (base, head) =>
  gh('api', `repos/${TOOLCHAIN}/compare/${base}...${head}`, '--jq', '.status').trim()

/** The highest `vX.Y.Z` tag of this repo. */
export function latestTag() {
  const tags = gh('api', '--paginate', `repos/${TOOLCHAIN}/tags`, '--jq', '.[].name')
    .split('\n')
    .filter((name) => /^v\d+\.\d+\.\d+$/.test(name))
  const parts = (tag) => tag.slice(1).split('.').map(Number)
  tags.sort((a, b) => {
    const [x, y] = [parts(a), parts(b)]
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
  })
  return tags.at(-1)
}
