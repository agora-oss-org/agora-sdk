# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ This is a fork of Replyke — read this first

Agora is a fork of [replyke/monorepo](https://github.com/replyke/monorepo), rescoped to
`@agora-sdk/*` and repointed at an [Agora server](https://github.com/jenova-marie/agora). The
fork's entire value is that its divergence from upstream is **tiny and documented**, which keeps
upstream merges cheap. Before editing, understand the branch model and the four divergences —
full detail is in [SYNCING.md](SYNCING.md); contributor-facing rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

**Branches:**

| Branch | What it is |
|---|---|
| `main` | Mirrors `upstream/main` **verbatim** — original `@replyke/*` names, **no edits**. Never commit fork work here. |
| `agora` | The working branch and repo default. `@agora-sdk/*` scope + the Agora changes. All work and PRs land here. |

**The only things that diverge from upstream — keep edits within these, don't add new fork points:**

1. **Base-URL repoint** (4 files: `core/src/utils/env.ts`, `core/src/config/axios.ts`,
   `core/src/context/chat-context.tsx`, `core/src/hooks/auth/oauthCore.ts` — the OAuth helper
   defaults its `baseUrl` to `getApiBaseUrl()`; the platform `useOAuthSignIn` hooks call into it and
   need no edit). The SDK reads its
   API base URL from the `baseUrl` prop on `ReplykeProvider` via `getApiBaseUrl()` (default
   `http://localhost:4000/v7`), **not** from env-var auto-detection. Everything reads it lazily,
   per-request, so the injected value always wins.
2. **The `@replyke/*` → `@agora-sdk/*` rename is scripted, not hand-edited** — produced by
   `./rename-to-agora.sh` (idempotent, re-runnable). When merging upstream, let the script convert
   any `@replyke/*` references; don't rename imports by hand.
3. **Auth-flow behavior** (2 files, each carrying a `Modified from original @replyke/core` Apache-2.0
   §4(b) header that must be preserved): `signUpWithEmailAndPassword` resolves to a `SignUpResult`
   union (`signed_in` | `confirmation_required`) instead of `void`; sign-out always clears local
   state even if the server revoke fails (`store/slices/authThunks.ts` + `hooks/auth/useAuth.ts`);
   `useAxiosPrivate` refreshes on HTTP **401** (Agora returns 401 on token expiry, 403 for
   authorization denials) — upstream keys off 403, so don't revert it on merge. (The old
   `useAccountSync` sub-match guard dissolved in the v7.4.x sync — upstream shipped a better version;
   see SYNCING.md "Previously diverged, now dissolved into upstream.")
4. **Entity `include` passthrough** (1 file, with the `Modified from original @replyke/core` header):
   `core/src/hooks/entities/useEntityData.tsx` threads an optional `include` into the single-entity
   fetch hooks so `EntityProvider` can load related data (e.g. the author via `include={["user"]}`).
   Additive; a generic fix to an upstream inconsistency and a strong upstream-PR candidate.

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

There is no test suite or linter wired up in this repo.

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

The repo ships **four published packages** (all currently `1.2.1`; internal refs via `workspace:*`):

| Package | Role |
|---|---|
| `@agora-sdk/core` | All hooks, context providers, types, store, and config — the bulk of the SDK; platform-agnostic (React + RN) |
| `@agora-sdk/react-js` | Web: re-exports core + web token storage (localStorage) and OAuth |
| `@agora-sdk/react-native` | Bare RN: re-exports core + Keychain token management |
| `@agora-sdk/expo` | Expo: re-exports core + SecureStore token management |

> `packages/ui/{react-js,react-native}` exist as upstream leftovers but are **not built or
> published** — the fork ships only the headless API/hooks layer, no UI components.

### The model: providers + hooks

State flows through React Context providers, consumed via hooks. Code keeps the upstream
`Replyke*` identifiers (only the package scope is rebranded). Key providers (in
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
