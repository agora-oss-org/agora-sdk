# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ This is a fork of Replyke — read this first

Agora is a fork of [replyke/monorepo](https://github.com/replyke/monorepo), rescoped to
`@agora-sdk/*` and repointed at an [Agora server](https://github.com/jenova-marie/agora). The
fork's entire value is that its divergence from upstream is **tiny and documented**, which keeps
upstream merges cheap. Before editing, understand the branch model and the eight divergences —
full detail is in [SYNCING.md](SYNCING.md); contributor-facing rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

**Branches:**

| Branch | What it is |
|---|---|
| `main` | Mirrors `upstream/main` **verbatim** — original `@replyke/*` names, **no edits**. Never commit fork work here. |
| `agora` | The working branch and repo default. `@agora-sdk/*` scope + the Agora changes. All work and PRs land here. |

**The only things that diverge from upstream — keep edits within these, don't add new fork points (eight total):**

1. **Base-URL repoint** (4 files: `core/src/utils/env.ts`, `core/src/config/axios.ts`,
   `core/src/context/chat-context.tsx`, `core/src/hooks/auth/oauthCore.ts` — the OAuth helper
   defaults its `baseUrl` to `getApiBaseUrl()`; the platform `useOAuthSignIn` hooks call into it and
   need no edit). The SDK reads its
   API base URL from the `baseUrl` prop on `ReplykeProvider` via `getApiBaseUrl()` (default
   `http://localhost:4000/v7`), **not** from env-var auto-detection. Everything reads it lazily,
   per-request, so the injected value always wins.
2. **Scope + identifier rename is scripted, not hand-edited** — produced by `./rename-to-agora.sh`
   (idempotent, re-runnable). Two passes: (a) converts both `@replyke/` and `@sublay/` quoted
   imports → `@agora-sdk/`; (b) inverts upstream's sublay rebrand for identifiers —
   `Sublay*`/`sublay*` → `Replyke*`/`replyke*` across `*.ts`/`*.tsx` and file basenames — so agora
   keeps the `Replyke*` convention. When merging upstream, let the script handle all conversions;
   don't rename imports or identifiers by hand.
3. **Auth-flow behavior** (2 files, each carrying a `Modified from original @replyke/core` Apache-2.0
   §4(b) header that must be preserved): `signUpWithEmailAndPassword` resolves to a `SignUpResult`
   union (`signed_in` | `confirmation_required`) instead of `void`; sign-out always clears local
   state even if the server revoke fails (`store/slices/authThunks.ts` + `hooks/auth/useAuth.ts`);
   `useAxiosPrivate` refreshes on HTTP **401** (Agora returns 401 on token expiry, 403 for
   authorization denials) — upstream keys off 403, so don't revert it on merge. (The old
   `useAccountSync` sub-match guard dissolved in the v7.4.x sync — upstream shipped a better version;
   see SYNCING.md "Previously diverged, now dissolved into upstream.")
4. **Entity `include` passthrough** (1 file, with the `Modified from the original @replyke/core source.` header):
   `core/src/hooks/entities/useEntityData.tsx` threads an optional `include` into the single-entity
   fetch hooks so `EntityProvider` can load related data (e.g. the author via `include={["user"]}`).
   Additive; a generic fix to an upstream inconsistency and a strong upstream-PR candidate.
5. **Feed-ranking algorithms** (1 file, with the `Modified from the original @replyke/core source.` header):
   `core/src/interfaces/EntityListSortByOptions.ts` is widened with `"decay"`, `"gravity"`,
   `"wilson"`, and `"bayesian"` sort options plus `rankParams`/`rankAnchor` passthrough scalars.
   Additive and backward-compatible; the server-side counterpart is the Agora ranking engine.
6. **`emailRedirectTo` passthrough** (4 files — `core/src/config/runtime.ts`,
   `store/slices/authThunks.ts`, `hooks/auth/useRequestPasswordReset.ts`,
   `hooks/auth/useSendVerificationEmail.ts`, each carrying/extending the `Modified from the
   original @replyke/core source.` header): the three native-auth email requests send an
   `emailRedirectTo` origin (resolved by `getEmailRedirectTo()`: `AGORA_EMAIL_REDIRECT_TO` env var
   → `window.location.origin` → omitted) so emailed links return to the originating front-end.
   Additive; no `ReplykeProvider` prop by design. See SYNCING.md #6.
7. **`Agora*` public-API aliases** (4 files — `core/src/index.ts` plus the three platform entries
   `react-js`/`react-native`/`expo` `src/index.tsx`): additive re-exports so consumers can write
   `<AgoraProvider>` (and `AgoraIntegrationProvider`, `AgoraState`, `useAgoraSelector`,
   `useAgoraDispatch`). **Aliases, not renames** — internals keep the `Replyke*` convention so
   upstream merges stay clean (renaming the identifiers would conflict on ~880 lines every sync; an
   alias is a handful of isolated EOF lines). Originals stay exported for back-compat. The platform
   entries alias their own AccountManager-injecting `ReplykeProvider` override, shadowing core's
   alias. Do **not** move this into `rename-to-agora.sh` — it's committed code (like the base-URL
   repoint), not a mechanical re-scope. See SYNCING.md #7.
8. **JWT-required reads / transport-layer auth** (7 files, 5 already diverged): the Agora server
   requires a JWT on **all content routes** (hard sign-in wall; upstream serves reads publicly), so
   auth lives in the shared transport rather than in hooks — ~14 read hooks use the tokenless public
   instance and would 401 even for signed-in users, and migrating them would mean 14 new diverged
   files. `config/runtime.ts` gains a token-getter/refresher registry + a process-wide single-flight
   refresh + a boot latch (default open); `config/axios.ts` attaches the token and retries 401s once
   on **both** instances; `initializeAuthThunk` registers the callbacks and releases the latch in
   `finally` (covers standard AND integration mode); both providers arm the latch during render
   (parents render before children — never move this into an effect); `useAxiosPrivate` drops
   `"Bearer null"` and shares the single-flight; `baseApi` parks on the latch and retries once on
   401. `/auth/` URLs are exempt from the latch and the 401-refresh (deadlock + failed-sign-in
   guards) but **still carry the token** — the server puts `requireAuth` on `/auth/change-password`
   and the account-deletion routes. See SYNCING.md #8.

The auth files (#3) are the likely merge-conflict spots if upstream refactors auth — re-apply by
hand, preserve upstream's surrounding logic, and keep the headers.

## Development commands

This is a [pnpm](https://pnpm.io) workspace monorepo (`pnpm-workspace.yaml` globs `packages/**/*`).

- `pnpm install` — install
- `pnpm run build-all` — build all four published packages in dependency order (core → react-js →
  react-native → expo); each compiles to both ESM (`dist/esm`, `tsconfig.esm.json`) and CJS
  (`dist/cjs`, `tsconfig.cjs.json`)
- `pnpm --filter @agora-sdk/core run build` — build a single package while iterating
- `pnpm run typecheck` — `tsc --noEmit` at the root (CI runs install → build-all → typecheck on
  pushes/PRs to `agora`)

`pnpm --filter @agora-sdk/core run test` runs the core vitest suite (jsdom); `pnpm run test` runs
every package's. There is no linter wired up.

> ⚠️ **Before adding tests or touching the build/packaging, read
> [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md).** The published `@agora-sdk/*` packages are
> **bundler-only** — they are *not* importable by Node's native ESM/CJS loader (extensionless ESM
> specifiers; CJS output under `"type":"module"` with no `dist/cjs/package.json` marker; no `exports`
> map). This is inherited from upstream Replyke and **deliberately not fixed** (fixing it is a huge
> delta against the sync model, and an `exports` map would risk breaking existing consumers). It does
> **not** block in-repo tests: a Vite/vitest runner transforms source, so testing a package's own
> `src` works — only importing another `@agora-sdk/*` package *by name* needs an alias-to-source or
> `deps.inline` in the test config. Never "fix" the packaging to make a test pass.

### Releases

`scripts/release.sh` (via `pnpm run patch` / `minor` / `major`) bumps all four `@agora-sdk/*`
packages in lockstep, commits, tags `vX.Y.Z`, and pushes to `origin` + `github`. **Pushing the
`v*` tag triggers `.github/workflows/publish.yml`**, which verifies the tag matches
`@agora-sdk/core`'s version, builds, and publishes to npm. The release script requires a clean
tree. (`publish-prod` / `publish-beta` exist for manual publishing, but the tag-driven flow is
canonical.)

## Changelog discipline

This repo keeps a [`CHANGELOG.md`](CHANGELOG.md) in [Keep a Changelog](https://keepachangelog.com/)
format, documenting how `@agora-sdk/*` diverges from upstream.

**You MUST keep it current.** After any code, config, or build change, add a bullet under
`## [Unreleased]` in the right group (`Added` / `Changed` / `Fixed` / `Removed`) in the same commit.
Mark divergences from upstream and cross-reference SYNCING.md. When a release is cut, `[Unreleased]`
entries are renamed to the new version and a fresh empty `[Unreleased]` section is started.

## Architecture

The repo ships **four published packages** (all currently `1.4.0`; internal refs via `workspace:*`):

| Package | Role |
|---|---|
| `@agora-sdk/core` | All hooks, context providers, types, store, and config — the bulk of the SDK; platform-agnostic (React + RN) |
| `@agora-sdk/react-js` | Web: re-exports core + web token storage (localStorage) and OAuth |
| `@agora-sdk/react-native` | Bare RN: re-exports core + Keychain token management |
| `@agora-sdk/expo` | Expo: re-exports core + SecureStore token management |

> `packages/ui/{react-js,react-native}` exist as upstream leftovers but are **not built or
> published** — the fork ships only the headless API/hooks layer, no UI components.

### The model: providers + hooks

State flows through React Context providers, consumed via hooks. Code keeps the `Replyke*`
identifier convention (the npm scope is `@agora-sdk/*`; `rename-to-agora.sh` inverts both the
upstream `@sublay/*` scope and the `Sublay*`/`sublay*` identifier rebrand). Key providers (in
`core/src/context/`): `ReplykeProvider` (root — project config, `baseUrl`, auth token),
`EntityProvider` / `EntityListProvider` (single entity / filtered+sorted collections),
`CommentSectionProvider`, `AuthProvider`, `ListsProvider`, plus chat/space/conversation contexts.

The usage flow: wrap in `ReplykeProvider` → define content with `EntityProvider` → use feature
hooks (e.g. `useEntityList`, comments, votes, follows). All features follow the same provider +
hooks pattern over the REST API.

### Base-URL runtime (the #1 divergence, in code)

`core/src/config/runtime.ts` holds the API base URL in a mutable singleton
(`setApiBaseUrl()` / `getApiBaseUrl()` / `getSocketUrl()`), set synchronously by the provider on
render before any request fires. `config/axios.ts` stamps `baseURL` via a request interceptor;
`store/api/baseApi.ts` uses a dynamic `fetchBaseQuery`; the chat socket, OAuth hook, and
`useAskContent` all resolve the URL at call time. Never reintroduce an eager `BASE_URL` constant.

## Related repos

- **Server:** [jenova-marie/agora](https://github.com/jenova-marie/agora) — the API this SDK targets
- **AI tooling:** [jenova-marie/agora-plugins](https://github.com/jenova-marie/agora-plugins) — the
  Claude Code plugin/skill (`agora:sdk`) that teaches agents to build on this SDK; it was extracted
  out of this repo to keep the fork clean
