# toolchain

Shared lint, format, TypeScript, CI and editor settings for the erakor repos (transit-board,
kinolog, markdown-preview, transit, taime, katremil, alfresco), so they stay in step instead of
drifting one repo at a time.

| What                                                         | Where                                    | How a repo gets it                                                          |
| ------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------- |
| Formatter style (oxfmt)                                      | `oxfmt/index.mjs`                        | `oxfmt.config.ts` spreads it                                                |
| Lint baseline (oxlint)                                       | `oxlint/base.json`, `oxlint/react.json`  | `.oxlintrc.json` `extends` it                                               |
| shadcn/ui exemptions (oxlint, knip)                          | `oxlint/shadcn.json`, `knip/shadcn.mjs`  | opt in: see [shadcn/ui](#shadcnui)                                          |
| Storybook lint (eslint-plugin-storybook)                     | `oxlint/storybook.json`                  | opt in: see [Storybook](#storybook)                                         |
| Secret env var rule                                          | `oxlint/plugins/secret-env.mjs`          | `jsPlugins` in `.oxlintrc.json`                                             |
| TypeScript                                                   | `tsconfig/{base,react,node}.json`        | tsconfig `extends`                                                          |
| Tailwind class sorting (oxfmt)                               | `tailwind()` in `oxfmt/index.mjs`        | `sortTailwindcss: tailwind('src/index.css')`                                |
| CI checks (JS/TS)                                            | `.github/workflows/node-checks.yml`      | `uses: erakor/toolchain/.github/workflows/node-checks.yml@v1`               |
| CI checks (Storybook: build, open every story)               | `.github/workflows/storybook-checks.yml` | `uses: erakor/toolchain/.github/workflows/storybook-checks.yml@v1`          |
| CI checks (Swift: swift-format lint)                         | `.github/workflows/swift-checks.yml`     | `uses: erakor/toolchain/.github/workflows/swift-checks.yml@v1`              |
| Dependency updates                                           | `renovate/default.json`                  | `renovate.json`: `"extends": ["github>erakor/toolchain//renovate/default"]` |
| `.editorconfig`, `.gitattributes`, `.nvmrc`, `.swift-format` | `files/`, `swift/`                       | copied by `sync.yml`, as a PR in each repo                                  |

## Using it in a JS/TS package

```bash
pnpm add -D oxlint oxfmt "@erakor/toolchain@github:erakor/toolchain#v1.5.0"
```

`oxfmt.config.ts` (oxfmt finds only `.oxfmtrc.json(c)` and `oxfmt.config.ts`/`.mts`, not `.mjs`):

```ts
import base from '@erakor/toolchain/oxfmt'

const config = { ...base, ignorePatterns: ['dist/'] }

export default config
```

oxlint and oxfmt both skip what `.gitignore` lists, so build output (`dist/`,
`storybook-static/`) needs no `ignorePatterns`; list only files that are committed but not
formatted or linted by hand (generated or vendored code).

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

Config files that Node runs itself (`vite.config.ts`, a `tsconfig.node.json` project) extend
`tsconfig/node.json` instead: the base plus `types: ["node"]`, `nodenext` resolution and
`allowImportingTsExtensions`, which Node's type stripping needs for relative `.ts` imports.

A package that uses Tailwind sorts classes with the shared helper, which also sorts the strings
passed to `cn()` and `cva()`:

```ts
import base, { tailwind } from '@erakor/toolchain/oxfmt'

const config = { ...base, sortTailwindcss: tailwind('src/index.css') }

export default config
```

`package.json` here is `"private": true` on purpose: the package is installed from GitHub, never
published to npm, so `files` and `exports` still apply.

A repo's workflow calls the reusable one and keeps its own triggers and concurrency. Group pull
requests by ref so a new push cancels the outdated run, and pushes to `main` by commit so every
merge keeps its own result:

```yaml
concurrency:
  group: ci-${{ github.event_name == 'pull_request' && github.ref || github.sha }}
  cancel-in-progress: true

jobs:
  checks:
    uses: erakor/toolchain/.github/workflows/node-checks.yml@<sha> # vX.Y.Z
```

`node-checks.yml` also runs the package's `build` script when called `with: { build: true }`, so a
repo whose build is its only extra check needs no job of its own.

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

## Keeping the consumers in step

`consumers.json` lists every repo that uses this one: its `packageDir` (where `package.json`
lives, `null` for a Swift-only repo) and whether the smoke test covers it. Four pieces read it:

| Piece                                                        | When                        | What it does                                                                                           |
| ------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `smoke.yml`                                                  | a PR touching the shared CI | Runs this branch's `node-checks.yml` and package against each `smoke` consumer's default branch.       |
| `bump-consumers.yml` (`scripts/bump.mjs`)                    | a `vX.Y.Z` tag is pushed    | Opens a PR in each consumer moving every pin to that release; never moves a pin that is already ahead. |
| `renovate/default.json`                                      | Renovate's weekly run       | Opens one "erakor toolchain" PR per consumer covering the package and the workflow pin together.       |
| `doctor.yml` (`scripts/doctor.mjs`, `pnpm consumers:doctor`) | Mondays, or by hand         | Reports stale or mixed pins, a `lint` script without `--deny-warnings`, a missing Renovate preset.     |

Before moving `v1`, open a PR: if `smoke.yml` is red for a consumer, its CI would break too (or it
is already red on its own `main`; compare with its latest run). `bump-consumers.yml` needs the same
`SYNC_ENABLED` variable and `SYNC_TOKEN` secret as file sync, and the token needs Contents and
Pull requests read/write on every repo in `consumers.json`. The bump PR and Renovate's PR change
the same lines; merge whichever lands first and the other goes quiet. `pnpm consumers:doctor` needs `gh`
signed in; `pnpm consumers:bump --dry-run` clones each consumer and shows the diff without pushing.

Pin the package as a `vX.Y.Z` tag (`github:erakor/toolchain#v1.5.0`) so Renovate can update it; a
bare commit SHA works for the bump script and the doctor but Renovate leaves it alone. A workflow
pin is a commit SHA with a `# vX.Y.Z` comment, which Renovate and the bump script both keep.

## Changing something

Change it here and run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`. Open a PR
(the smoke test runs), merge it, then tag a release (`vX.Y.Z`, and move `v1` for the reusable
workflow). The tag opens a bump PR in each consumer, Renovate catches any it missed, and
`sync.yml` opens a PR for copied files.

## shadcn/ui

A package that vendors shadcn/ui components opts in to two configs. Code under
`components/ui/` is not exempted otherwise, since a repo may keep its own components there.

`.oxlintrc.json` adds `oxlint/shadcn.json` after the React baseline. It turns off the rules the
stock registry components break, in `**/components/ui/**` and shadcn's `hooks/use-mobile.ts`,
and tells `label-has-associated-control` that `Input`, `Textarea`, `Checkbox` and `Switch` are
form controls, so wrapping one in a `<label>` passes:

```json
{
  "extends": [
    "./node_modules/@erakor/toolchain/oxlint/react.json",
    "./node_modules/@erakor/toolchain/oxlint/shadcn.json"
  ]
}
```

`knip.config.ts` ignores the components' unused exports (unused files and dependencies there are
still reported):

```ts
export { default } from '@erakor/toolchain/knip/shadcn'
```

A package without shadcn needs no knip config: knip's defaults are the baseline.

`oxlint/react.json` still exempts `**/components/ui/**` from `heading-has-content` and
`anchor-has-content` for every package, as it did before `shadcn.json` existed; v2 drops that in
favour of the opt-in.

## Storybook

A package with Storybook opts in to three pieces. Add `eslint-plugin-storybook` and `playwright`
to its devDependencies (the smoke test uses the package's own Playwright), then:

`.oxlintrc.json` adds `oxlint/storybook.json`, which runs the Storybook rules on `*.stories.*`
files and `no-uninstalled-addons` on `.storybook/main.*`:

```json
{
  "extends": [
    "./node_modules/@erakor/toolchain/oxlint/react.json",
    "./node_modules/@erakor/toolchain/oxlint/storybook.json"
  ]
}
```

A workflow job builds Storybook and opens every story in Chromium:

```yaml
jobs:
  storybook:
    uses: erakor/toolchain/.github/workflows/storybook-checks.yml@<sha> # vX.Y.Z
```

The same smoke test runs locally after a build, from the package:
`pnpm build-storybook && pnpm exec erakor-storybook-smoke` (the folder defaults to
`storybook-static`). `.storybook/main.ts` and `preview.tsx` stay in each repo: frameworks
(`@storybook/nextjs-vite`, `@storybook/react-vite`) and theme switching differ, and what is left
in common is a stories glob.

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
