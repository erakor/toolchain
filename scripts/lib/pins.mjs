// Finding and rewriting the two places a consumer pins this repo: the `@erakor/toolchain`
// dependency in package.json, and `uses: erakor/toolchain/.github/workflows/*.yml@<ref>` lines.

const SHA = /^[0-9a-f]{40}$/
const FLOATING_MAJOR = /^v\d+$/

const DEPENDENCY = /("@erakor\/toolchain"\s*:\s*"github:erakor\/toolchain#)([^"]+)(")/g
const WORKFLOW =
  /(uses:\s*erakor\/toolchain\/\.github\/workflows\/[\w.-]+\.ya?ml@)([^\s#]+)([ \t]*#[^\n]*)?/g

/** True for a full commit SHA. */
export const isSha = (ref) => SHA.test(ref)

/** Every pin in `text` as `{ kind, ref }`; `kind` is `dependency` or `workflow`. */
export function findPins(text) {
  const pins = []
  for (const match of text.matchAll(DEPENDENCY)) pins.push({ kind: 'dependency', ref: match[2] })
  for (const match of text.matchAll(WORKFLOW)) pins.push({ kind: 'workflow', ref: match[2] })
  return pins
}

/**
 * Point every pin at a release, keeping each pin's style: a commit SHA stays a SHA (a workflow
 * pin keeps a `# vX.Y.Z` comment), a tag stays a tag. A floating major (`v1`) is left alone: it
 * is meant to move on its own. `shouldMove(ref)` can veto a pin, e.g. one already past the
 * release, so a rewrite never downgrades.
 */
export function rewritePins(text, { tag, sha }, shouldMove = () => true) {
  const keep = (ref) => FLOATING_MAJOR.test(ref) || !shouldMove(ref)
  const dependency = (all, head, ref, tail) =>
    keep(ref) ? all : `${head}${isSha(ref) ? sha : tag}${tail}`
  const workflow = (all, head, ref) => {
    if (keep(ref)) return all
    return isSha(ref) ? `${head}${sha} # ${tag}` : `${head}${tag}`
  }
  return text.replace(DEPENDENCY, dependency).replace(WORKFLOW, workflow)
}
