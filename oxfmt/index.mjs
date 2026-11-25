// The shared oxfmt style: Prettier defaults plus no semicolons and single quotes.
// A repo's oxfmt.config.ts spreads it and adds only what is its own (ignorePatterns,
// sortTailwindcss):
//
//   import base from '@erakor/toolchain/oxfmt'
//   const config = { ...base, ignorePatterns: ['dist/'] }
//   export default config
//
// A package that uses Tailwind sorts classes the same way everywhere with `tailwind()`:
//
//   import base, { tailwind } from '@erakor/toolchain/oxfmt'
//   const config = { ...base, sortTailwindcss: tailwind('src/index.css') }

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

/**
 * Tailwind class sorting for the package's entry stylesheet: class attributes plus the strings
 * passed to `cn()` and `cva()`, the helpers shadcn/ui and the erakor repos use.
 *
 * @param {string} stylesheet path to the CSS file that imports tailwindcss, from the package root
 * @returns {NonNullable<import('oxfmt').OxfmtConfig['sortTailwindcss']>}
 */
export function tailwind(stylesheet) {
  return { stylesheet, functions: ['cn', 'cva'] }
}

export default base
