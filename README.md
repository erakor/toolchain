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
| CI checks (JS/TS)                                            | `.github/workflows/node-checks.yml`         | `uses: erakor/toolchain/.github/workflows/node-checks.yml@v1`               |
| CI checks (Swift: swift-format lint)                         | `.github/workflows/swift-checks.yml`        | `uses: erakor/toolchain/.github/workflows/swift-checks.yml@v1`              |
| Dependency updates                                           | `renovate/default.json`                     | `renovate.json`: `"extends": ["github>erakor/toolchain//renovate/default"]` |
| `.editorconfig`, `.gitattributes`, `.nvmrc`, `.swift-format` | `files/`, `swift/`                          | copied by `sync.yml`, as a PR in each repo                                  |

## Using it in a JS/TS package

```bash
pnpm add -D oxlint oxfmt "@erakor/toolchain@github:erakor/toolchain#v1.1.0"
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
adds (paths, includes, framework plugins). The base targets apps: `moduleResolution: "bundler"`
and `noEmit: true`. A library that emits, or code that runs under plain Node, overrides both.

`package.json` here is `"private": true` on purpose: the package is installed from GitHub, never
published to npm, so `files` and `exports` still apply.

The reusable workflow runs the package's own `lint` script as is, so put `--deny-warnings` in that
script to fail CI on warnings. Don't also pass it on the command line: oxlint rejects the flag twice.

## Requirements

Node 26 (see `.nvmrc` and `engines`), pnpm 12. Licensed MIT; see `LICENSE`.

## The style

Prettier defaults plus no semicolons and single quotes: width 100, trailing commas everywhere,
parentheses around every arrow function parameter, double quotes in JSX.

## Releases and the `v1` tag

`v1` is a floating tag, moved by hand to the latest `v1.x.y`. Every repo that calls
`node-checks.yml@v1` picks up a change the moment it moves, so move it only after
`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` pass on `main`. A repo that wants a frozen workflow
pins a `v1.x.y` tag or a commit SHA instead; Renovate keeps either current. The workflow's own
third-party actions are pinned by SHA.

## Turning on file sync

`sync.yml` does nothing until two things exist on this repo: a repository variable
`SYNC_ENABLED=true`, and a `SYNC_TOKEN` secret (a fine-grained PAT limited to the target repos,
with Contents and Pull requests read/write). Without both the job is skipped, not failed.

## Changing something

Change it here, run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, then tag a release
(`vX.Y.Z`, and move `v1` for the reusable workflow). Renovate opens the bump in each repo, and
`sync.yml` opens a PR for copied files.

## Gotchas found while migrating

- `@oxlint/migrate` copies ESLint's `*.stories.@(ts|tsx)` extglobs, which oxlint never matches:
  the rules in that override silently stop running. Use `*.stories.{ts,tsx}`.
- `oxfmt --migrate prettier` writes `printWidth: 80` when the Prettier config has none.
- Oxlint JS plugins (like `eslint-plugin-storybook` or `secret-env`) run in V8 and are alpha; keep
  them few. `eslint-plugin-react-compiler` as a JS plugin is known to be very slow.
- `eslint-disable` comments keep working, including `react-hooks/` rule names.
- oxfmt formats everything it finds: HTML, CSS and JSON included. A file that is copied verbatim
  into committed build output (markdown-preview's `src/preview.html`) must go in `ignorePatterns`,
  or a style-only reformat changes the bundle. Check with a rebuild and `git status`.
- oxfmt already skips lockfiles (`pnpm-lock.yaml`, `package-lock.json`); don't list them.
- A repo's `ignorePatterns` replaces whatever the shared config might set, since configs spread
  the base rather than merge into it. That is why the base sets none.
- pnpm 12 fails an install with `ERR_PNPM_IGNORED_BUILDS` until each dependency's build script is
  approved or denied: `pnpm approve-builds '!esbuild'` writes `allowBuilds` to
  `pnpm-workspace.yaml`. esbuild works without its postinstall (the platform package carries the
  binary).
- swift-format is not available in the Linux cloud containers, so the Swift reformat and the
  counts come from a macOS CI run (`swift-checks.yml`, or `xcrun swift-format` locally).
  Findings inside multi-line string literals (a sample document, say) change the string's text if
  "fixed": check those by hand.

## Swift 6 language mode

Turning on Swift 6 (`-swift-version 6`, or `SWIFT_VERSION: "6.0"` in an XcodeGen project) makes
data-race findings errors. The ones met so far, all isolation annotations with no behavior change:

- A class conforming to an AppKit or WebKit delegate protocol (`WKURLSchemeHandler`,
  `NSViewRepresentable`) is inferred `@MainActor`, so its static members are too. Callers that
  are not main-actor, `HTMLExport.bundledCSS` or a test, need `@MainActor` themselves.
- `Task { await f() }` as a single expression returns `f`'s result; if that is `Any?` it must be
  Sendable. Discard it: `Task { _ = await f() }`.
- A property read from `deinit` (a notification observer, say) is `nonisolated(unsafe)` when it is
  set once and only removed in `deinit`.
- In a `@MainActor` XCTest class, `setUpWithError` and `tearDownWithError` stay nonisolated and
  cannot touch the class's properties; use `override func setUp() async throws` and
  `tearDown() async throws`.
- An `@objc` selector target (a `Coordinator: NSObject`) is `@MainActor` when it reads views.
