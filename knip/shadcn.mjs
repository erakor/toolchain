// knip settings for a package that vendors shadcn/ui components. Its knip.config.ts re-exports
// this, or spreads it and adds only what is its own (entry files, say):
//
//   import shadcn from '@erakor/toolchain/knip/shadcn'
//   const config = { ...shadcn, entry: ['scripts/**/*.mjs'] }
//   export default config
//
// A package without shadcn needs no knip config from here: knip's defaults are the baseline.

/** @type {import('knip').KnipConfig} */
const shadcn = {
  // Registry components export every part of a component, most of which an app never uses.
  // Unused files and dependencies there are still reported.
  ignoreIssues: {
    '**/components/ui/**': ['exports', 'types'],
  },
}

export default shadcn
