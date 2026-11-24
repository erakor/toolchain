// The shared knip settings. A repo's knip.config.ts re-exports it, or spreads it and adds only
// what is its own (entry files, say):
//
//   import base from '@erakor/toolchain/knip'
//   const config = { ...base, entry: ['scripts/**/*.mjs'] }
//   export default config

/** @type {import('knip').KnipConfig} */
const base = {
  // shadcn/ui components are vendored from its registry and export every part of a component,
  // most of which an app never uses. Unused files and dependencies there are still reported.
  ignoreIssues: {
    '**/components/ui/**': ['exports', 'types'],
  },
}

export default base
