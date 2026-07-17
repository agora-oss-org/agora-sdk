# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

This is a fork of [Replyke](https://github.com/replyke/monorepo); entries below
describe how the `@agora-sdk/*` packages diverge from upstream. See
[SYNCING.md](SYNCING.md) for the upstream-merge workflow.

## [Unreleased]

### Changed
- **All reads now require a JWT (divergence #8)** — the Agora server hides all content behind a
  bearer token (upstream Replyke serves reads publicly), so the SDK now handles auth at the
  transport layer: both axios instances attach the current access token (covering the ~14 read
  hooks that used the tokenless public instance and previously broke even for signed-in users),
  boot-time requests park on an auth latch until the stored session is restored (fixes a
  first-paint 401 race), all 401 handlers share one single-flight refresh (concurrent 401s can no
  longer race refresh-token rotation into the server's reuse-detection), RTK Query gains a
  401 → refresh → retry path it never had, and `useAxiosPrivate` no longer sends `"Bearer null"`
  when signed out. `/auth/*` requests skip the latch and the 401-refresh but **do** carry the
  token, which also fixes `changePassword` and the account-deletion flows — they call `requireAuth`
  routes through the tokenless public instance and had been returning 401. The project-config
  bootstrap fetch stays unauthenticated. No public API changes; apps gate UI on the existing
  `useAuth()` state. See SYNCING.md #8 and
  `docs/superpowers/specs/2026-07-17-jwt-required-reads-design.md`.

## [1.8.0] - 2026-07-07

### Added
- **Synced upstream feature work through v7.8.2** (`@sublay/* → @agora-sdk/*` and `Sublay*` →
  `Replyke*` identifiers via `rename-to-agora.sh`). Seven upstream PRs (#38–#44), all additive and
  backward-compatible. New capabilities in `@agora-sdk/*`:
  - **Notification preferences** (PR #44) — `useNotificationPreferences` + `notificationPreferencesApi`
    with the `PushEventType` interface (the authoritative 20-value `PUSH_EVENT_TYPES` set). Read/replace
    the acting user's opted-out push types via `GET`/`PUT /:projectId/push-notifications/preferences`.
  - **Conversation muting** (PR #44) — `useMuteConversation` + the `MuteDuration` interface
    (`"8h"`/`"24h"`/`"1w"`/`"forever"`) and new `ConversationMember` mute fields (`mutedUntil`,
    `mutedForever`, self-serialized on the viewer's own row).
    `POST /:projectId/chat/conversations/:id/mute`.
  - **Space visibility** (PR #43) — `visibility` (`"public"`/`"unlisted"`/`"private"`) exposed on
    `useCreateSpace`/`useUpdateSpace` and the `Space`/`SpacePreview` models.
  - **Follows/connections text search** (PR #42) — the follower/following/connection list hooks accept
    `query` + `searchFields` (`"username"`/`"name"`) via the shared `UserSearchParams` interface.
  - **User matching** (PR #41) — `useMatchUsers` (activity/interest matching) + `UserMatchResult` /
    `MatchedFacet` / `SampleContent` types. `POST /:projectId/match/users`.
  - **Search `includeChildSpaces`** (PR #38) — `useAskContent`/`useSearchContent` can search a space's
    whole descendant subtree.
  - **`useAskContent` RN token streaming** (PR #40) — the answer streams token-by-token on React
    Native via a `reactNative.textStreaming` fetch init (ignored by web `fetch`).
  - **Space-reputation parameter consolidation** (PR #39) — a shared `SpaceReputationContextParams` /
    `SpaceReputationUserParams` + `buildSpaceReputationParams` helper (now re-exported from
    `@agora-sdk/core`), threaded through every fetch hook (entities, comments, reactions,
    relationships, users, chat, search) so a unified `spaceReputation: { spaceId, includeDescendants? }`
    object supersedes the flat `spaceReputationId`/`spaceReputationDescendants` scalars (still honored,
    with a one-time dev warning when both are supplied).
- **Server-side spec for the new/changed endpoints:** `../agora-server/docs/SDK-V7.8.2-SERVER-SPEC.md`
  documents the client contracts this sync introduces and which the Agora server must implement
  (notification-preferences and conversation-mute routes, space `visibility`, follows/connections
  `searchFields`, `POST /match/users`, and the `spaceReputation` enrichment param), with the current
  server state and backward-compat notes per feature. Mirrors `SDK-EMAIL-REDIRECT-TO-SPEC.md`
  (divergence #6).

### Changed
- **Two merge conflicts resolved, both keeping our divergence + taking upstream's improvement**
  (no fixture adaptation was needed this sync — all 1069 core tests pass):
  `core/src/hooks/search/useAskContent.ts` — kept the base-URL divergence (`getApiBaseUrl()` at call
  time, divergence #1) while adopting upstream's new `init` object with `reactNative.textStreaming`;
  `core/src/index.ts` — kept both new export blocks side by side (our `config/runtime` re-exports and
  upstream's `buildSpaceReputationParams`). See SYNCING.md.

## [1.7.0] - 2026-07-04

### Added
- **`getEmailRedirectTo` is now a public `@agora-sdk/core` export** (alongside its `config/runtime`
  neighbors `getApiBaseUrl`/`getSocketUrl`). Previously internal-only (reached via relative import by
  `authThunks.ts`/`useRequestPasswordReset.ts`/`useSendVerificationEmail.ts`, all inside core itself);
  cross-package consumers like `@agora-sdk/auth-react-js` had no way to reuse the same
  env-var-then-`window.location.origin` resolution chain and were re-deriving the origin themselves
  (drifting out of sync — see `agora-sdk-plus` divergence fixing `useResendVerification`).

## [1.6.0] - 2026-07-04

### Added
- **`Agora*` public-API aliases** (divergence #7 — see SYNCING.md). Additive re-exports let consumers
  write `<AgoraProvider>` (plus `AgoraIntegrationProvider`, `AgoraState`, `useAgoraSelector`,
  `useAgoraDispatch`) instead of the `Replyke*` names. Added at the EOF of `core/src/index.ts` and, for
  the account-glue provider, in each platform entry (`react-js`/`react-native`/`expo` `src/index.tsx`,
  which alias their own AccountManager-injecting `ReplykeProvider` override). **Aliases, not renames** —
  the `Replyke*` internals are unchanged (renaming them would conflict on ~880 identifier lines every
  upstream merge; an alias is a few isolated additive lines). The `Replyke*` originals remain exported
  for back-compat. Committed code on `agora`, not part of `rename-to-agora.sh`.

## [1.5.0] - 2026-07-03

### Added
- **`emailRedirectTo` on native-auth email requests** (divergence #6 — see SYNCING.md). Sign-up,
  request-password-reset, and send-verification-email now include an `emailRedirectTo` origin so the
  server's emailed links return the user to the front-end that initiated the request
  (multi-front-end deployments). Resolved lazily per request by `getEmailRedirectTo()` in
  `core/src/config/runtime.ts`: `AGORA_EMAIL_REDIRECT_TO` env var (`VITE_`-/`REACT_APP_`-prefixed)
  → `window.location.origin` → omitted (server falls back to its `AUTH_EMAIL_LINK_BASE`). RN/Expo
  have no `window`, so they omit the field and get the server default. Requires no server upgrade;
  servers with `AUTH_EMAIL_LINK_ALLOWED_ORIGINS` configured validate the origin and reject unknown
  ones with `400 auth/email-redirect-not-allowed`.

### Changed
- **`publish.yml` now also creates the GitHub Release for each pushed `v*` tag.** After publishing to
  npm, the workflow extracts the matching `CHANGELOG.md` section as the release notes (appending a
  `compare/...` footer to the previous release), falling back to GitHub auto-generated notes when no
  section exists. Idempotent on re-runs (edits an existing release rather than failing). Requires the
  workflow's `contents: write` permission.

## [1.4.0] - 2026-06-28

### Added
- **Synced upstream feature work through v7.6.2** (`@sublay/* → @agora-sdk/*` and `Sublay*` →
  `Replyke*` identifiers via `rename-to-agora.sh`). New capabilities in `@agora-sdk/*`: web/native/Expo
  **push notifications** (`PushTokenAdapter` + `usePushRegistration`; `webPushTokenAdapter`,
  RN Firebase messaging adapter, Expo `expo-notifications` adapter), an **events bundle**
  (`EventProvider` + events hooks), **comment sorting** by `createdAt` with `sortDir` and a
  `controversial` option (`new`/`old` deprecated), entity `createdAt` sortBy (with the
  `DeprecatedNewSortBy` alias), a **live conversation list** with socket-reconnect reconciliation in
  `useConversations`, the space-list strictly-true boolean-flag fix, and a large vitest coverage
  expansion across all four packages.

### Changed
- **`rename-to-agora.sh` now reconciles identifiers, not just the package scope.** Upstream's
  replyke→sublay rebrand renamed identifiers (`ReplykeProvider`→`SublayProvider`,
  `useReplykeSelector`→`useSublaySelector`, the `replyke` reducer key, the `replyke-*` context files,
  etc.). The script inverts that half — `Sublay`→`Replyke` / `sublay`→`replyke` across `*.ts`/`*.tsx`
  and file basenames, after the scope rules — so merges stay mechanical. Divergence #2 in SYNCING.md
  grows from "scope only" to "scope + identifiers".
- **Adapting a few merged-in upstream test fixtures is now an expected per-sync cost.** Agora runs
  `tsc` over its tests (upstream uses vitest/esbuild, which skips typechecking) and the 401-refresh +
  runtime base-URL divergences change what some tests assert; this sync adjusted 8 such fixtures
  (5 typecheck-only, 3 to configure `baseUrl`). Not a product-behavior divergence — see SYNCING.md.

## [1.3.0] - 2026-06-18

### Added
- **`docs/KNOWN_ISSUES.md`** documenting the inherited bundler-only packaging behavior: the published
  `@agora-sdk/*` packages are not importable by Node's native ESM/CJS loader (extensionless ESM
  specifiers, CJS under `"type":"module"` with no marker, no `exports` map). It works for all bundled
  consumers and is **deliberately not fixed** (large delta vs. the sync model; an `exports` map would
  risk breaking consumers). Includes the testing implications and the proven fix recipe for if it's
  ever needed. Linked from a ⚠️ alert in CLAUDE.md. Documentation of inherited behavior, not a
  divergence from upstream.
- **`EntityProvider` / `useEntityData` now accept an optional `include`.** Pass
  `include={["user"]}` (an `EntityIncludeParam`) to load related data — most usefully the entity's
  author on a single-entity detail view, so the poster's name/avatar render alongside the post.
  `useEntityData` now threads `include` into the three single-entity fetch hooks (which already
  accepted it) and folds it into the fetch cache key so changing `include` re-fetches. Fully
  additive and backward-compatible — omitting `include` sends no `include` param and behaves exactly
  as before. Brings the detail view in line with the entity-list (`EntityListConfig.include`) and
  comment-section hooks. Divergence from upstream Replyke (a generic fix to an upstream
  inconsistency — strong upstream-PR candidate) — see SYNCING.md #4.
- **Synced upstream feature work through v7.4.2** (`@sublay/* → @agora-sdk/*` via `rename-to-agora.sh`).
  New capabilities now available in `@agora-sdk/*`: custom tables (`useTable` + `tablesSlice`),
  self-service account deletion (`useRequestAccountDeletion` / `useConfirmAccountDeletion`),
  `useFetchMutualSpaces`, space-scoped reputation (`User.spaceReputation`, `spaceReputationId`),
  a chat-message hook split into live (`useLiveChatMessages`) + query layers with reply filtering
  (`useChatMessages` is now a `@deprecated` forwarder), `ConversationPreview.otherMembers` +
  `memberIds` in `createGroup`, an Expo `useOAuthSignIn` hook, `GifData` `altText`/`aspectRatio`
  typed as `string`, and a `vitest` test harness (`pnpm --filter @agora-sdk/core run test`).

### Fixed
- **Chat store no longer holds a non-serializable `Date` (Redux Toolkit `serializableCheck` warning).**
  `useSendMessage` minted a live `Date` for the optimistic message's `createdAt`/`updatedAt` and
  dispatched it in `chat/addOptimisticMessage` — the only place a `Date` object entered the chat
  store. RTK's `serializableCheck` flagged it (`A non-serializable value was detected … path:
  payload.createdAt`), and the optimistic row's shape diverged from the server-confirmed row, whose
  dates arrive as ISO **strings** over JSON. The optimistic message now stores ISO strings
  (`new Date().toISOString()`), and `ChatMessage.createdAt`/`updatedAt` are retyped `string` to match
  the wire shape (all consumers already wrap in `new Date(...)`). Store is fully serializable again;
  optimistic and confirmed rows are identical in shape. _(Briefly tracked as fork divergence #5;
  upstream then shipped the identical fix in v7.4.x — on the sync below we took upstream's version
  and dropped our fork copy, so this is no longer a divergence. See SYNCING.md "Previously diverged,
  now dissolved into upstream.")_

### Changed
- **Synced upstream's `replyke` → `sublay` rebrand** (`git merge -s ours main`). The upstream delta
  was a pure brand rename that collides head-on with this fork's `@replyke/* → @agora-sdk/*` rename,
  so it was recorded as merged (advancing the merge-base for clean future pulls) while leaving the
  `agora` tree unchanged — the `@sublay/*` names and `*.sublay.io` brand-domain URLs are declined,
  same as the `@replyke` originals.
- **Adopted upstream's one non-rename improvement:** a `declare const process` guard in
  `core/src/utils/env.ts`, so the `typeof process` checks typecheck without `@types/node` on
  browser/RN/Vite targets where `process` may be absent.
- **Kept `Replyke*` internal identifiers** through the v7.4.x sync. Upstream's rebrand renamed
  internal code identifiers (`useReplykeDispatch → useSublayDispatch`, the `replyke` Redux state key,
  the `ReplykeProvider` export, etc.); we **decline** that rename and translate incoming `Sublay* →
  Replyke*` on each sync (the published scope stays `@agora-sdk/*`). The naming divergence is
  conflict-free — git keeps our names automatically — so only new upstream files need converting.
- **Two divergences dissolved into upstream** on this sync (took upstream's version, dropped our fork
  copy + its Apache header): chat timestamps-as-string (was #5) and the `useAccountSync` desync guard
  (was part of #3; upstream's is better — keys off the refresh token's `sub` and covers cross-tab
  swaps). See SYNCING.md "Previously diverged, now dissolved into upstream."
- **Relocated the base-URL repoint (#1) for OAuth** into the new `core/src/hooks/auth/oauthCore.ts`:
  `requestOAuthAuthorizationUrl` now defaults `baseUrl` to `getApiBaseUrl()` instead of upstream's
  hardcoded `https://api.sublay.io/v7`, so self-hosted Agora OAuth follows the injected base URL. The
  `react-js`/`expo` `useOAuthSignIn` hooks call into `oauthCore`, so they inherit the repoint.

## [1.2.2] - 2026-05-31

### Removed
- **Extracted the Claude Code plugin to its own repo, [`jenova-marie/agora-plugins`](https://github.com/jenova-marie/agora-plugins).**
  Removed `plugins/`, `.claude-plugin/`, and the `.claude/skills/` symlink from this repo, keeping the
  fork a clean mirror of upstream + the documented divergences. The README's "Claude Code Skills"
  section still advertises the plugin but now points at the new repo:
  `/plugin marketplace add jenova-marie/agora-plugins` + `/plugin install agora@agora-plugins`.

### Added
- **`CONTRIBUTING.md`** — contributor guide covering the fork/branch model (PRs target `agora`,
  never the upstream-mirroring `main`), dev setup, the three upstream divergences to respect,
  commit conventions, the changelog requirement, and the PR checklist. README's Contributing and
  Community sections updated to actively welcome contributions and link the guide.

### Fixed
- **Reactive token refresh now fires on access-token expiry.** The `useAxiosPrivate` response
  interceptor (`core/src/config/useAxiosPrivate.ts`) keyed its refresh-and-retry on HTTP **403**,
  but the Agora server returns **401** for an expired/invalid access token (it reserves 403 for
  authorization denials like members-only spaces). So an expired token was never refreshed
  reactively — requests failed until a full reload re-ran the boot-path refresh — and every genuine
  403 uselessly pinged the refresh endpoint. The interceptor now triggers on **401**, which is the
  spec-compliant trigger (RFC 9110 / RFC 6750). The file gains a `Modified from original
  @replyke/core` header (it was previously stock upstream). **New divergence from upstream Replyke
  — see SYNCING.md #3.** (Consumers using the published npm package must upgrade to get the fix.)
- Corrected the README's API base URL docs, which still described the removed env-var
  auto-detection (`VITE_API_BASE_URL` / `REACT_APP_API_BASE_URL`). The Building Agora
  section, the Quick Start steps, and the `App.tsx` example now show the `baseUrl` prop on
  `ReplykeProvider` (read from the app's own env), matching the actual behavior since 1.0.2.

## [1.2.1] - 2026-05-30

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

[Unreleased]: https://github.com/jenova-marie/agora-sdk/compare/v1.8.0...agora
[1.8.0]: https://github.com/jenova-marie/agora-sdk/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/jenova-marie/agora-sdk/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/jenova-marie/agora-sdk/compare/v1.5.1...v1.6.0
[1.5.1]: https://github.com/jenova-marie/agora-sdk/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/jenova-marie/agora-sdk/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/jenova-marie/agora-sdk/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/jenova-marie/agora-sdk/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/jenova-marie/agora-sdk/releases/tag/v1.2.2
[1.2.1]: https://github.com/jenova-marie/agora-sdk/releases/tag/v1.2.1
[1.2.0]: https://github.com/jenova-marie/agora-sdk/releases/tag/v1.2.0
[1.1.1]: https://github.com/jenova-marie/agora-sdk/releases/tag/v1.1.1
[1.1.0]: https://github.com/jenova-marie/agora-sdk/releases/tag/v1.1.0
