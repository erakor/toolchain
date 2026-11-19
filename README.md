# toolchain

Shared lint, format, TypeScript and editor settings for the erakor repos
(transit-board, kinolog, markdown-preview, alfresco), so they stay in step instead of drifting one
repo at a time.

| What                                                         | Where                                       | How a repo gets it                                                          |
| ------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------- |
| Formatter style (oxfmt)                                      | `oxfmt/index.mjs`                           | `oxfmt.config.ts` spreads it                                                |
| Lint baseline (oxlint)                                       | `oxlint/base.json`, `oxlint/react.json`     | `.oxlintrc.json` `extends` it                                               |
| Secret env var rule                                          | `oxlint/plugins/secret-env.mjs`             | `jsPlugins` in `.oxlintrc.json`                                             |
| TypeScript                                                   | `tsconfig/base.json`, `tsconfig/react.json` | tsconfig `extends`                                                          |
| CI checks                                                    | `.github/workflows/node-checks.yml`         | `uses: erakor/toolchain/.github/workflows/node-checks.yml@v1`               |
| Dependency updates                                           | `renovate/default.json`                     | `renovate.json`: `"extends": ["github>erakor/toolchain//renovate/default"]` |
| `.editorconfig`, `.gitattributes`, `.nvmrc`, `.swift-format` | `files/`, `swift/`                          | copied by `sync.yml`, as a PR in each repo                                  |

## Using it in a JS/TS package

```bash
pnpm add -D oxlint oxfmt "@erakor/toolchain@github:erakor/toolchain#v1.0.0"
```

`oxfmt.config.ts` (oxfmt finds only `.oxfmtrc.json(c)` and `oxfmt.config.ts`/`.mts`, not `.mjs`):

```ts
import base from '@erakor/toolchain/oxfmt'

const config = { ...base, ignorePatterns: ['dist/'] }

export default config
```

`.oxlintrc.json`:

```json
{
  "extends": ["./node_modules/@erakor/toolchain/oxlint/react.json"],
  "rules": {}
}
```

`tsconfig.json`: `"extends": "@erakor/toolchain/tsconfig/react.json"`, then only what the project
adds (paths, includes, framework plugins).

## The style

Prettier defaults plus no semicolons and single quotes: width 100, trailing commas everywhere,
parentheses around every arrow function parameter, double quotes in JSX.

## Changing something

Change it here, run `pnpm lint && pnpm format:check && pnpm test`, then tag a release
(`vX.Y.Z`, and move `v1` for the reusable workflow). Renovate opens the bump in each repo, and
`sync.yml` opens a PR for copied files.

## Gotchas found while migrating

- `@oxlint/migrate` copies ESLint's `*.stories.@(ts|tsx)` extglobs, which oxlint never matches:
  the rules in that override silently stop running. Use `*.stories.{ts,tsx}`.
- `oxfmt --migrate prettier` writes `printWidth: 80` when the Prettier config has none.
- Oxlint JS plugins (like `eslint-plugin-storybook` or `secret-env`) run in V8 and are alpha; keep
  them few. `eslint-plugin-react-compiler` as a JS plugin is known to be very slow.
- `eslint-disable` comments keep working, including `react-hooks/` rule names.
