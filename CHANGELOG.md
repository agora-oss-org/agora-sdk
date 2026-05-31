# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

This is a fork of [Replyke](https://github.com/replyke/monorepo); entries below
describe how the `@agora-sdk/*` packages diverge from upstream. See
[SYNCING.md](SYNCING.md) for the upstream-merge workflow.

## [Unreleased]

### Changed
- Promoted the Claude Code plugin/skill install instructions from a subsection under
  "Documentation" to a prominent top-level **🤖 Claude Code Skills** section in the README
  (added to the table of contents), and left a cross-link from Documentation.
- Renamed the Claude Code plugin `agora-sdk` → `agora` and its skill `agora-sdk` → `sdk`, so the
  skill is namespaced `agora:sdk` instead of the repetitive `agora-sdk:agora-sdk`. Plugin dir is now
  `plugins/agora/` (skill at `skills/sdk/`); the marketplace stays `agora-sdk`, so install is
  `/plugin install agora@agora-sdk`. **Breaking for anyone who already installed `agora-sdk@agora-sdk`** —
  reinstall under the new name after updating the marketplace.

## [1.2.0] - 2026-05-30

### Added
- **Claude Code plugin `agora-sdk`** (`plugins/agora-sdk/`, listed in `.claude-plugin/marketplace.json`)
  so other developers' agents can install the skill with `/plugin marketplace add jenova-marie/agora-sdk`
  + `/plugin install agora-sdk@agora-sdk`. The skill files live under the plugin's `skills/agora-sdk/`;
  `.claude/skills/agora-sdk` is a symlink to them so the skill is still discovered in-repo from a single
  source. Cross-references to repo-root docs were switched to GitHub URLs (installed plugins are cached
  and can't reach files outside the plugin root). README gained a "Claude Code integration" section.
- **Claude Code skill `agora-sdk`** (`plugins/agora-sdk/skills/agora-sdk/`) to help AI agents build apps on
  the SDK. A hub `SKILL.md` (provider+scope+hooks mental model, the "lean on the Replyke docs MCP"
  rule, and a divergence table covering the `@agora-sdk` scope rename, the `baseUrl` prop, the
  `SignUpResult` union, and the feed-ranking sort options) plus four on-demand reference files:
  `setup.md`, `auth.md`, `feeds.md`, `social-core.md`, `advanced.md` (spaces, chat,
  connections-vs-follows — thin topology + gotchas, since these have no fork divergences), and a
  self-contained `api-surface.md` (every exported provider/hook/type grouped by domain, generated
  from the export barrel). The skill deliberately documents only the fork's delta from upstream
  Replyke. Lookups follow a graceful ladder that works **without** the Replyke MCP or network:
  bundled `api-surface.md` → the version-exact `.d.ts` in the consumer's `node_modules` → Replyke MCP
  → `docs.replyke.com` via WebFetch. Keep the divergence table and `api-surface.md` in sync with this
  changelog and SYNCING.md after upstream merges.

## [1.1.1] - 2026-05-28

### Fixed
- **Account map no longer corrupts on OAuth sign-in (duplicate entries sharing one refresh token).**
  `useAccountSync` keys accounts by `user.id` but stores the *current* `auth.refreshToken`. The OAuth
  callback (`useOAuthSignIn.handleOAuthCallback`) sets the new tokens synchronously but resolves the
  new user a tick later (via `requestNewAccessTokenThunk`), so the persist effect fired with the
  **new token while `user` was still the previous account** — writing the old user's entry against
  the new token. Result: two account ids sharing one refresh token, which broke account switching and
  made sign-out (the multi-account "switch to remaining account" path) unable to end the session.
  Phase B now only persists an account when the **access token's `sub` matches the current `user.id`**
  (skips and waits while they're transiently mismatched). (Divergence from upstream — see SYNCING.md.)

## [1.1.0] - 2026-05-26

First tagged release with a changelog; it captures the full divergence of the
`@agora-sdk/*` fork from upstream Replyke (the untracked `1.0.1`–`1.0.3` patches
are folded in here).

### Added

- **Feed ranking algorithms.** `EntityListSortByOptions` widened with `"decay"` (true exponential
  half-life), `"gravity"` (HN), `"wilson"` (confidence), `"bayesian"` (shrunk mean) — the existing
  `top`/`hot`/`new`/`controversial`/`metadata.*` are unchanged. `fetchEntities` gained optional
  pass-through scalars `rankParams` (JSON string of numeric tunables, e.g. `{"halfLifeHours":12}`),
  `rankAnchor` (pins the decay clock across paginated requests; echoed back by the server), and
  `rerank` (opt into the server's re-rank webhook). Additive + backward-compatible.
- CI workflow (`.github/workflows/ci.yml`): install, build-all, then typecheck on
  pushes/PRs to `agora`.
- Publish workflow (`.github/workflows/publish.yml`): on a `v*` tag, verify the tag
  matches `@agora-sdk/core`'s version, build, and publish all packages to npm.
- `scripts/release.sh` plus root `major` / `minor` / `patch` scripts to bump all
  packages in lockstep, commit, tag, and push to `origin` + `github`.
- This `CHANGELOG.md`.

### Changed

- **`signUpWithEmailAndPassword` now returns a `SignUpResult`** (`{ status: "signed_in", user }`
  or `{ status: "confirmation_required", email }`) instead of `void`. When the server reports
  email confirmation is required, the thunk no longer sets tokens/user — the caller shows a
  "check your email" state and the user signs in after confirming. Auto-confirm sign-ups behave
  as before. New `SignUpResult` type exported from `@agora-sdk/core`. (Divergence from upstream
  Replyke — see SYNCING.md #3.)
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
  env auto-detection must pass `baseUrl` to `ReplykeProvider`. (Shipped in `1.0.2`.)

### Fixed

- **Sign-out now always clears the local session.** `signOutThunk` `await`ed the server
  `POST /auth/sign-out` before clearing local auth state, so when that call failed (e.g. a
  401 because the access token had expired and the refresh token was stale), the catch block
  bailed out and the user stayed signed in — the "Sign out" button appeared dead. The
  server-side token revoke is now best-effort: its failure is logged but local state
  (`resetAuth` / `clearUserInUserSlice` / `resetApiState` / account removal) is always cleared.
  (Divergence from upstream Replyke — see SYNCING.md #3.)
- Release/version scripts now use `pnpm --filter ... exec npm version` so package
  versions actually bump (the bare `pnpm ... version` form silently no-ops).
- Quote-anchored the scope rename so Apache-2.0 attribution comments keep referencing
  the upstream `@replyke/*` origin while real imports still convert.
- Added the Apache-2.0 attribution header to the remaining fork-modified files
  (`authThunks.ts`, `hooks/auth/useAuth.ts`, `hooks/auth/index.ts`, `index.ts`,
  `store/api/baseApi.ts`, `hooks/search/useAskContent.ts`,
  `interfaces/EntityListSortByOptions.ts`, `store/api/entityListsApi.ts`).

### Notes

- Evaluated the `"Request new access token error: - Refresh token reuse detected"`
  console noise seen on load and left it **unchanged**: the refresh flow
  (`store/slices/authThunks.ts`, `config/useAxiosPrivate.ts`) is **stock upstream**,
  not fork-modified, and the behavior is correct — it surfaces when a *stale* refresh
  token (e.g. left in `localStorage` after repointing the same browser at a different
  server) is replayed and the server's reuse-detection revokes the token family.
  Clears on a storage reset. Not patched, to keep the fork cleanly mergeable upstream.

[Unreleased]: https://github.com/jenova-marie/agora-sdk/compare/v1.2.0...agora
[1.2.0]: https://github.com/jenova-marie/agora-sdk/releases/tag/v1.2.0
[1.1.1]: https://github.com/jenova-marie/agora-sdk/releases/tag/v1.1.1
[1.1.0]: https://github.com/jenova-marie/agora-sdk/releases/tag/v1.1.0
