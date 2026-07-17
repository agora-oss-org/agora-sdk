# JWT-required reads — transport-layer auth (divergence #8)

**Date:** 2026-07-17
**Status:** Approved design, pre-implementation
**Scope:** `@agora-sdk/core` (SDK only; the server change is a separate effort in `agora-server`)

## Background & motivation

Upstream Replyke's architecture allows public, unauthenticated reads. Verified on both sides:

- **Server** (`agora-server`): `apps/api/src/routes/index.ts` mounts
  `project.use("*", resolveProject, optionalAuth)` — every project route gets *optional* auth.
  `requireAuth` is added per-route (~192 usages) only on writes and private reads. All content GET
  routes (entities, comments, users, spaces, reactions, relationships) are world-readable.
- **SDK**: three transport paths all assume reads succeed without credentials:
  1. The **public axios instance** (`core/src/config/axios.ts` default export) never attaches an
     `Authorization` header. ~14 *read* hooks use it: `useFetchUser` / `ByForeignId` /
     `ByUsername`, `useFetchComment` / `ByForeignId`, `useFetchEntityReactions`,
     `useFetchCommentReactions`, the six relationships hooks (followers / following / connections,
     lists + counts), `useFetchSpaceChildren`, `useCheckUsernameAvailability`, and
     `useProjectData` (the `ReplykeProvider` boot fetch).
  2. **`axiosPrivate` via `useAxiosPrivate`** (~110 files) stamps `Authorization: Bearer
     ${accessToken}` unconditionally — literally `"Bearer null"` when signed out — and relies on
     the server treating an invalid token as anonymous.
  3. **RTK Query `baseApi`** attaches the token only when present and has no refresh-on-401
     wrapper.

The Agora product model is changing: **all content goes behind a valid JWT bearer token** (hard
sign-in wall — no guest/visitor token tier). The server will flip content routes from
`optionalAuth` to `requireAuth`; **auth routes and the project-config fetch stay public** so the
provider can boot pre-auth.

Without SDK changes this breaks:

- **Signed-in users** (the worst bug): the ~14 public-instance read hooks send no header at all →
  401 even with a valid session.
- **Boot race**: hooks fire on mount while `AccountManager` loads the refresh token from storage
  asynchronously; requests dispatched before `initializeAuthThunk` completes 401 even for a
  returning user with a good session.
- **Signed-out noise**: `"Bearer null"` → 401 → futile refresh attempt with no refresh token.
- **RTK Query endpoints** fail once, no retry, when they land in the access-token expiry window.

## Decision drivers

1. **Minimal upstream divergence** — the fork's value is that syncing stays cheap (see
   SYNCING.md). Prefer edits inside files already on the divergence ledger.
2. Upstream would never accept per-hook auth migration (they *want* public reads), so per-hook
   edits are pure permanent divergence — rejected.

## Rejected alternatives

- **Migrate the ~14 public-instance read hooks to `useAxiosPrivate`** — upstream-idiomatic but
  creates 14 new permanently-diverged files; every future sync pays for it.
- **App-level gating only** — insufficient: the 14 public-instance hooks 401 even for signed-in
  users, so the SDK must change regardless.

## Design — divergence #8: transport-layer auth

All auth handling moves to the shared transport modules, five of six already fork-owned.

### a) Token + refresh registry in `core/src/config/runtime.ts` (already forked, #1/#6)

Alongside the base-URL singleton, add:

- `registerAccessTokenGetter(fn: () => string | null)` + internal getter — how the axios layer
  reads the current access token without importing the store (avoids the circular import
  `config/axios` ← `authThunks` ← store).
- `registerTokenRefresher(fn: () => Promise<string | undefined>)` — performs one token refresh,
  resolving to the new access token or `undefined` on failure.
- **Auth-settled latch**: `markAuthSettled()` / `whenAuthSettled(): Promise<void>` — a one-shot
  latch resolved when the boot-time auth initialization finishes (success *or* failure).

### b) Module-level interceptors in `core/src/config/axios.ts` (already forked, #1)

Applied to **both** the public instance and `axiosPrivate`:

- **Request interceptor** — for URLs *not* containing `/auth/`: `await whenAuthSettled()`, then if
  no `Authorization` header is set and the registered getter returns a token, attach
  `Authorization: Bearer <token>`.
  - The `/auth/` exemption is **load-bearing**: the boot refresh itself flows through the public
    instance *before* the latch resolves — gating it would deadlock the SDK.
- **Response interceptor** — on 401 for non-`/auth/` URLs, if the request hasn't already been
  retried (per-request `sent` flag), invoke the registered refresher through a **shared
  module-level mutex** (single in-flight refresh) and retry once with the new token; if the
  refresher yields no token, reject with the original error. This extends the resilience
  `useAxiosPrivate` consumers already have to the public-instance hooks and RTK-free paths.
  - **Composition with `useAxiosPrivate`**: `axiosPrivate` ends up with two 401 handlers (the
    module-level one plus `useAxiosPrivate`'s existing hook-level one). Both must key off the
    *same* per-request `sent` flag so a 401 is refreshed/retried exactly once regardless of which
    interceptor sees it first.

### c) Registrations in `core/src/store/index.ts` (new divergence surface — two lines)

Where the store singleton is created:

- `registerAccessTokenGetter(() => replykeStore.getState().replyke.auth.accessToken)`
- `registerTokenRefresher(...)` — dispatches `requestNewAccessTokenThunk` with the current
  project id and resolves to the resulting access token or `undefined`.

This is the only file in the change not already on the divergence ledger; the delta is a couple
of isolated, additive lines.

### d) `initializeAuthThunk` resolves the latch (`core/src/store/slices/authThunks.ts`, already forked, #3/#6)

In its `finally`, call `markAuthSettled()`. Closes the boot race: a returning user's first
content requests wait until the storage-loaded refresh token has been exchanged for an access
token.

### e) `useAxiosPrivate` stops sending `"Bearer null"` (`core/src/config/useAxiosPrivate.ts`, already forked, #3)

Skip attaching the header when `accessToken` is falsy. Signed-out requests then fail with one
clean 401 (the module-level interceptor also finds no token) instead of a garbage bearer token,
and no doomed refresh spin.

### f) RTK `baseApi` reauth (`core/src/store/api/baseApi.ts`, already forked)

`dynamicBaseQuery` awaits `whenAuthSettled()` before executing, and on a 401 result invokes the
registered refresher (same mutex) and retries once.

## Behavior summary

- **Signed in**: every request on every path carries the JWT; expiry anywhere triggers one shared
  refresh + retry.
- **Signed out**: requests go out with no `Authorization`, fail with one clean 401, no refresh
  attempted (refresher resolves `undefined` immediately when there's no refresh token). Apps gate
  UI on the existing `useAuth()` state (`initialized`, user) — **no new public API**.
- **Boot**: non-auth requests park on the latch until `initializeAuthThunk` settles, then proceed
  with whatever token resulted.

## Error handling

- Refresh failure rejects the original 401; the per-request retry flag and the `/auth/` URL
  exemption make loops impossible (a failed sign-in's 401 never triggers a refresh).
- The latch resolves in `finally`, so a failed boot never wedges the request pipeline.

## Testing (core vitest suite, jsdom)

- Request interceptor: attaches token when registered getter has one; leaves existing
  `Authorization` alone; exempts `/auth/` URLs; parks until `markAuthSettled()`.
- Response interceptor: 401 → single refresh → retry; concurrent 401s share one refresh (mutex);
  refresh failure rejects original error; `/auth/` 401s pass through untouched.
- `useAxiosPrivate`: no header when `accessToken` is null; existing 401-refresh tests keep
  passing.
- `baseApi`: awaits latch; 401 → refresh → retry.

## Documentation & licensing

- SYNCING.md: add divergence **#8** (and update the "seven things" counts here and in CLAUDE.md).
- CHANGELOG.md `[Unreleased]`: `Changed` entry cross-referencing SYNCING.md #8.
- Apache-2.0 §4(b) `Modified from the original @replyke/core source.` headers: extend on already-
  marked files; add to `store/index.ts` if it lacks one.

## Server-side counterpart (out of scope here, recorded for coordination)

`agora-server`: flip content routes from `optionalAuth` to `requireAuth`; keep `/auth/*` routes
and the project-config fetch public. Document in the server's `docs/MANIFEST.md`.
