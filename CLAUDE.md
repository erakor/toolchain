# CLAUDE.md

Shared config for the erakor repos; see README.md for what lives where and how repos consume it.

- Nothing here is repo-specific. A rule or option one repo needs goes in that repo's config, on top
  of the shared one.
- `test/secret-env.test.mjs` runs oxlint on fixtures and checks every diagnostic. Change the plugin,
  change the expected list; never loosen the test to make it pass.
- oxfmt only auto-discovers `.oxfmtrc.json(c)` and `oxfmt.config.ts`/`.mts`. A config with another
  name is silently ignored and oxfmt formats with its defaults (semicolons, double quotes).
- A change consumers see is a release: bump `version` in package.json, tag `vX.Y.Z`, and move the
  `v1` tag (reusable workflows are referenced as `@v1`). A breaking change is `v2`.
- Checks: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`.
