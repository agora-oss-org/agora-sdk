# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

This is a fork of [Replyke](https://github.com/replyke/monorepo); entries below
describe how the `@agora-sdk/*` packages diverge from upstream. See
[SYNCING.md](SYNCING.md) for the upstream-merge workflow.

## [Unreleased]

### Changed

- **`signUpWithEmailAndPassword` now returns a `SignUpResult`** (`{ status: "signed_in", user }`
  or `{ status: "confirmation_required", email }`) instead of `void`. When the server reports
  email confirmation is required, the thunk no longer sets tokens/user — the caller shows a
  "check your email" state and the user signs in after confirming. Auto-confirm sign-ups behave
  as before. New `SignUpResult` type exported from `@agora-sdk/core`. (Divergence from upstream
  Replyke — see SYNCING.md #3.)
- **Sign-out always clears local auth state**, even if the server-side token revoke fails. A
  stale/expired refresh token (server returns 401 from `requireAuth`-gated `/auth/sign-out`) must
  not strand the user signed in locally, so the revoke error is swallowed and local state is
  cleared regardless. (Divergence from upstream Replyke — see SYNCING.md #3.)

### Added

- CI workflow (`.github/workflows/ci.yml`): install, build-all, then typecheck on
  pushes/PRs to `agora`.
- Publish workflow (`.github/workflows/publish.yml`): on a `v*` tag, verify the tag
  matches `@agora-sdk/core`'s version, build, and publish all packages to npm.
- `scripts/release.sh` plus root `major` / `minor` / `patch` scripts to bump all
  packages in lockstep, commit, tag, and push to `origin` + `github`.
- This `CHANGELOG.md`.

### Changed

- Rescoped all packages from `@replyke/*` to `@agora-sdk/*` (the `@agora` scope was
  unavailable). The mechanical rename lives in `rename-to-agora.sh`.
- **API base URL is now injected via a `baseUrl` prop** instead of auto-detected. The
  consuming app parses its own platform env (Vite `import.meta.env`, CRA/RN
  `process.env`, etc.) and passes the resolved value to `<ReplykeProvider baseUrl="https://host/v7">`
  (also on `ReplykeIntegrationProvider`; the `@agora-sdk/react-js` wrapper forwards it).
  Defaults to `http://localhost:4000/v7` when omitted.
  - New `config/runtime.ts` holds the value in a mutable singleton with
    `setApiBaseUrl()` / `getApiBaseUrl()` / `getSocketUrl()`, set synchronously by the
    provider on render (before any request fires).
  - Everything now reads it **lazily, per request**, so the injected value always wins:
    `config/axios.ts` stamps `baseURL` via a request interceptor (no more eager
    `BASE_URL` constant); `store/api/baseApi.ts` uses a dynamic `fetchBaseQuery`
    baseQuery; the chat socket origin (`context/chat-context.tsx`), `useAskContent`,
    and the OAuth hook all resolve the URL at call time.
- Rebranded `README.md` to Agora and documented the four shipped packages.

### Removed

- Environment-variable **auto-detection** of the API base URL. `getApiBaseUrl()` no
  longer sniffs `REACT_APP_API_BASE_URL` / `VITE_API_BASE_URL` (that path couldn't
  read `import.meta.env` reliably and was evaluated eagerly at import). It is now a
  runtime getter for the value set via `baseUrl`. **Breaking:** consumers relying on
  env auto-detection must pass `baseUrl` to `ReplykeProvider`.

### Fixed

- Release/version scripts now use `pnpm --filter ... exec npm version` so package
  versions actually bump (the bare `pnpm ... version` form silently no-ops).
- Quote-anchored the scope rename so Apache-2.0 attribution comments keep referencing
  the upstream `@replyke/*` origin while real imports still convert.
- Added the Apache-2.0 attribution header to the remaining fork-modified files
  (`authThunks.ts`, `hooks/auth/useAuth.ts`, `hooks/auth/index.ts`, `index.ts`,
  `store/api/baseApi.ts`, `hooks/search/useAskContent.ts`).
- **Sign-out now always clears the local session.** `signOutThunk` `await`ed the server
  `POST /auth/sign-out` before clearing local auth state, so when that call failed (e.g. a
  401 because the access token had expired and the refresh token was stale), the catch block
  bailed out and the user stayed signed in — the "Sign out" button appeared dead. The
  server-side token revoke is now best-effort: its failure is logged but local state
  (`resetAuth` / `clearUserInUserSlice` / `resetApiState` / account removal) is always cleared.

### Notes

- Evaluated the `"Request new access token error: - Refresh token reuse detected"`
  console noise seen on load and left it **unchanged**: the refresh flow
  (`store/slices/authThunks.ts`, `config/useAxiosPrivate.ts`) is **stock upstream**,
  not fork-modified, and the behavior is correct — it surfaces when a *stale* refresh
  token (e.g. left in `localStorage` after repointing the same browser at a different
  server) is replayed and the server's reuse-detection revokes the token family.
  Clears on a storage reset. Not patched, to keep the fork cleanly mergeable upstream.

[Unreleased]: https://github.com/jenova-marie/agora-sdk/commits/agora
