// knip settings for a package that runs the toolchain's Storybook smoke test. Spread it with the
// package's own settings, or with the shadcn preset:
//
//   import shadcn from '@erakor/toolchain/knip/shadcn'
//   import storybook from '@erakor/toolchain/knip/storybook'
//   const config = { ...shadcn, ...storybook }
//   export default config

/** @type {import('knip').KnipConfig} */
const storybook = {
  // erakor-storybook-smoke loads the package's playwright through createRequire, which knip
  // cannot follow.
  ignoreDependencies: ['playwright'],
}

export default storybook
