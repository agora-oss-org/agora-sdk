# Known issues

## 1. Packages are bundler-only — not importable by Node's native ESM/CJS loader

**Status:** Known & accepted. Inherited from upstream Replyke. **Deliberately not fixed** — see rationale.

### Symptom

Importing a built `@agora-sdk/*` package directly under **Node's native module loader** (no bundler
in the path — e.g. a `node --import`, or a `node`-environment test runner that externalizes the
package) fails one of two ways:

```
# ESM entry (dist/esm/index.js):
ERR_MODULE_NOT_FOUND: Cannot find module '.../dist/esm/utils/handleError'

# CJS entry (dist/cjs/index.js, reached via the package "main"):
exports is not defined in ES module scope
```

Both are reproducible today against `@agora-sdk/core@1.2.2` and apply equally to `react-js`,
`react-native`, and `expo` (all four are `"type": "module"` with the same dual build).

### Root cause — three compounding packaging defects

The packages declare `"type": "module"`, but the dual TypeScript build was never made
Node-ESM-correct:

1. **Extensionless relative specifiers in the ESM build.** `tsconfig.esm.json` sets `module: esnext`
   and inherits `moduleResolution: "bundler"` from the base config, and the source contains ~1172
   extensionless relative imports (`from "./utils/handleError"`). tsc emits them verbatim; Node's
   native ESM resolver requires explicit `.js` extensions.
2. **CJS output is parsed as ESM.** `dist/cjs/*.js` is genuine CommonJS (`"use strict"`, `exports`,
   `require`), but because the package root is `"type": "module"`, Node parses every `.js` in the
   package as ESM. There is no `dist/cjs/package.json` containing `{"type":"commonjs"}` to flip that
   subtree back to CommonJS.
3. **No `exports` map.** Only the legacy `main` / `module` / `types` fields exist; nothing routes
   `import` vs `require` conditionally, so `main` (the broken-under-ESM CJS) is what Node picks.

### Why it works anyway — for every real consumer

`@agora-sdk/*` is consumed through **bundlers**: Vite, webpack, Metro (React Native), Next.js.
Bundlers do **not** use Node's native resolver — they (a) resolve extensionless specifiers
(`./foo` → `./foo.js`/`./foo/index.js`) and (b) handle CJS↔ESM interop themselves. So neither defect
is observable in a bundled app. The package's own `tsconfig` literally sets
`moduleResolution: "bundler"` — it was built for bundled consumers on purpose. The defects surface
**only** under Node's native loader with no bundler in the path.

### Implications for testing

This is *why* there is no test suite wired up — but it is **not** a blanket blocker:

- **Unit-testing a package's own source works fine.** A Vite/vitest runner transforms the source
  under test through its bundler-style resolver, so `packages/*/src/**/*.test.ts` importing `./foo`
  (extensionless) resolves without issue. The packaging defect is irrelevant to in-repo source tests.
- **Importing another workspace package _by name_** (which resolves to the built `dist` in
  `node_modules`) is the one thing that trips the native loader. Fix it in the **test config**, never
  the package:
  - alias the package to its `src` in `vitest.config.ts`, or
  - set `test.server.deps.inline: [/@agora-sdk\//]` so Vite transforms the dep instead of letting
    Node externalize it.
- **Downstream consumers in a node-env runner** hit it the same way. The sibling
  [`agora-sdk-plus`](https://github.com/jenova-marie/agora-sdk-plus) repo, whose vitest imports the
  *published* `@agora-sdk/core`, aliases it to a minimal in-repo stub for exactly this reason.

So: adding a test suite here is feasible. Test each package's own source directly, and alias/inline
any cross-package `@agora-sdk/*` imports.

### Why we do NOT fix it in this repo

1. **No user-facing bug.** It works for every bundled consumer — i.e. the entire React / RN / Expo
   audience this SDK targets.
2. **The fork is a tiny, documented delta over upstream Replyke** (see [SYNCING.md](../SYNCING.md)).
   Fixing defect ① means rewriting ~1172 source imports to add `.js` — a massive divergence that
   would conflict on every upstream merge, defeating the fork's entire reason for existing.
3. **The only "complete" fix — an `exports` map — is a regression risk.** An `exports` field is a
   hard encapsulation gate: the moment it exists, any path **not** listed stops resolving, breaking
   any consumer that deep-imports a subpath which resolves today via the permissive `main`/`module`
   fallback. We must not break existing apps.

### If we ever DO need Node-native importability

The correct recipe is already proven in the sibling **agora-sdk-plus** repo (original code, no
upstream-sync constraint), and can be ported deliberately:

- ship `.js` extensions on every relative import — either at the source level, or (to keep source
  byte-identical to upstream for clean merges) via a **dist-only post-build rewrite** such as
  [`tsc-alias`](https://www.npmjs.com/package/tsc-alias); and
- have `build:cjs` drop the CommonJS marker:
  `tsc -p tsconfig.cjs.json && echo '{"type":"commonjs"}' > dist/cjs/package.json`.

Add an `exports` map only with care, after auditing for any existing subpath importers. Until there
is a concrete need (e.g. an SSR/edge runtime importing the package unbundled), the current
bundler-only packaging is the right, lowest-risk choice.
