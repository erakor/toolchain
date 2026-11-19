// The shared oxfmt style: Prettier defaults plus no semicolons and single quotes.
// A repo's oxfmt.config.ts spreads it and adds only what is its own (ignorePatterns,
// sortTailwindcss):
//
//   import base from '@erakor/toolchain/oxfmt'
//   const config = { ...base, ignorePatterns: ['dist/'] }
//   export default config

/** @type {import('oxfmt').OxfmtConfig} */
const base = {
  semi: false,
  singleQuote: true,
  // oxfmt's own default; Prettier's is 80, and `oxfmt --migrate prettier` writes 80 when unset.
  printWidth: 100,
  trailingComma: 'all',
  arrowParens: 'always',
  endOfLine: 'lf',
  // package.json key order is left as npm/pnpm write it.
  sortPackageJson: false,
}

export default base
