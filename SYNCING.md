# Syncing with upstream Replyke

This is a fork of [replyke/monorepo](https://github.com/replyke/monorepo), repointed at an
[Agora](../agora) server and rebranded to the `@agora-sdk/*` scope. This doc keeps pulling
upstream's improvements painless.

## Remotes & branches

| | |
|---|---|
| `upstream` | `github.com/jenova-marie/agora-sdk` — tracks upstream (mirrors sublay) main; read-only for us |
| `origin` | private mirror (`git.rso`) |
| `github` | public mirror (`github.com/jenova-marie/agora-sdk`) |
| **`main`** | mirrors `upstream/main` verbatim — **keep upstream's names (now `@sublay/*`, formerly `@replyke/*`), no edits** |
| **`agora`** | our working branch — `@agora-sdk/*` scope + the base-URL repoint. Pushed to `origin` + `github`. |

## What diverges from upstream (six things)

1. **Base-URL repoint** — committed code on `agora`, 4 files:
   `core/src/utils/env.ts` (`getApiBaseUrl()` default), `core/src/config/axios.ts`
   (`BASE_URL = getApiBaseUrl()`), `core/src/context/chat-context.tsx` (socket fallback via
   `getSocketUrl()`), and `core/src/hooks/auth/oauthCore.ts` (the OAuth `requestOAuthAuthorizationUrl`
   defaults `baseUrl` to `getApiBaseUrl()` instead of upstream's hardcoded `api.sublay.io` host —
   carries a `Modified from original @replyke/core` header). The platform OAuth hooks
   (`react-js`/`expo` `useOAuthSignIn`) call into `oauthCore`, so they inherit the repoint and need
   no edit of their own. Everything else derives from `getApiBaseUrl()`. `env.ts` additionally
   carries a `declare const process` guard (adopted from upstream during the sublay-rebrand sync) so
   the `typeof process` checks typecheck without `@types/node`.
2. **Scope + identifier rename** — *not* hand-edited; produced by `./rename-to-agora.sh`
   (idempotent, re-runnable). Two passes:
   - **Scope**: converts both `@replyke/` and `@sublay/` quoted imports → `@agora-sdk/`. Upstream
     rebranded `@replyke/*` → `@sublay/*` (merged into `agora` via `-s ours`, content declined).
   - **Identifiers** (added in the v7.6.2 sync): the sublay rebrand also renamed internal
     identifiers (`ReplykeProvider` → `SublayProvider`, `useReplykeSelector` → `useSublaySelector`,
     the `replyke` Redux reducer key, the `replyke-*` context files, etc.). The script inverts that
     half — `Sublay` → `Replyke` / `sublay` → `replyke` across `*.ts`/`*.tsx` and file basenames,
     running after the scope pass. Agora keeps the `Replyke*` convention.
   Keeping both passes scripted is what makes upstream merges mechanical. Note: the script skips
   pure `//`-comment lines for the lowercase rule, so agora comments that reference the real
   `api.sublay.io` host or the "sublay rebrand" history are intentionally preserved.
3. **Auth-flow behavior** — hand edits in 3 files, each marked with a `Modified from original
   @replyke/core` header (Apache-2.0 §4(b)):
   - `core/src/store/slices/authThunks.ts` + `core/src/hooks/auth/useAuth.ts`:
     `signUpWithEmailAndPassword` resolves to a **`SignUpResult`** (`{ status: "signed_in" }` |
     `{ status: "confirmation_required", email }`) instead of `void`, so the UI can show a
     "check your email" state when the Agora server requires email confirmation. The new
     `SignUpResult` type is re-exported from `core/src/hooks/auth/index.ts` and `core/src/index.ts`.
   - `core/src/store/slices/authThunks.ts`: sign-out now **always clears local auth state** even
     if the server-side revoke fails (a stale/expired refresh token must not strand the user
     signed in).
   - `core/src/config/useAxiosPrivate.ts`: the reactive refresh interceptor triggers on **HTTP
     401**, not upstream's 403. The Agora server returns **401** for an expired/invalid access
     token (the spec-compliant code per RFC 9110 / RFC 6750) and reserves **403** for genuine
     authorization denials (members-only spaces, ownership/operator gates). Keying refresh off 403
     meant expiry never triggered a refresh (the request just failed until a full reload re-ran the
     boot-path refresh), *and* every legitimate 403 uselessly hit the refresh endpoint. **Don't
     "fix" this back to 403 when merging upstream** — 401 is correct for the Agora server contract.

   Unlike #1 and #2, these are genuine behavioral forks from upstream and the **likely
   merge-conflict spots** if upstream refactors auth — re-apply them by hand, preserving upstream's
   surrounding logic, and keep the `Modified from original` headers. (Server-side counterpart:
   `/auth/sign-up` returns `{ status: "confirmation_required" }`, documented in the Agora server's
   `docs/MANIFEST.md`.)
4. **Entity `include` passthrough** — hand edit in 1 file, marked with a `Modified from original
   @replyke/core` header:
   - `core/src/hooks/entities/useEntityData.tsx`: accepts an optional `include`
     (`EntityIncludeParam`) and forwards it to the single-entity fetch hooks (`useFetchEntity`,
     `useFetchEntityByForeignId`, `useFetchEntityByShortId` — which already accept it), so
     `EntityProvider` can load related data such as the entity author (`include={["user"]}`) on a
     detail view, matching the entity-list and comment-section hooks. `include` is also folded into
     the fetch cache key so changing it re-fetches. Additive and backward-compatible.

   This is a generic fix to an inconsistency in upstream Replyke itself (the fetch hooks already take
   `include`; only `useEntityData` failed to thread it). **Strong upstream-PR candidate** — if
   contributed to Replyke it dissolves on the next merge.
5. **Feed-ranking algorithms** — hand edit in 1 file, marked with a
   `Modified from the original @replyke/core source.` header:
   - `core/src/interfaces/EntityListSortByOptions.ts`: widened with `"decay"` (true exponential
     half-life), `"gravity"` (HN), `"wilson"` (confidence), `"bayesian"` (shrunk mean) sort options —
     the existing `top`/`hot`/`new`/`controversial`/`metadata.*` are unchanged. `fetchEntities`
     gained optional pass-through scalars `rankParams` (JSON string of numeric tunables),
     `rankAnchor` (pins the decay clock across paginated requests), and `rerank` (opt into the
     server's re-rank webhook). Additive and backward-compatible. The server-side counterpart is
     documented in the Agora server's `docs/MANIFEST.md`.
6. **`emailRedirectTo` on native-auth email requests** — hand edits in 4 files;
   `useRequestPasswordReset.ts` and `useSendVerificationEmail.ts` newly carry the
   `Modified from the original @replyke/core source.` header, `runtime.ts` and `authThunks.ts`
   already had one (extended):
   - `core/src/config/runtime.ts`: new `getEmailRedirectTo()` — resolves the
     `AGORA_EMAIL_REDIRECT_TO` env var (via `getEnvVar`, so `VITE_`/`REACT_APP_` prefixed) →
     `window.location.origin` → `undefined`.
   - `core/src/store/slices/authThunks.ts` (sign-up, both JSON and FormData bodies),
     `core/src/hooks/auth/useRequestPasswordReset.ts`, and
     `core/src/hooks/auth/useSendVerificationEmail.ts`: each sends `emailRedirectTo` when a value
     resolves and **omits the field entirely** otherwise, so the server falls back to its
     `AUTH_EMAIL_LINK_BASE`. Lets each front-end of a multi-front-end deployment get email links
     (confirmation / password reset) that point back at itself. Additive and backward-compatible —
     old servers ignore the field. Deliberately **no** `ReplykeProvider` prop, to keep the provider
     files clean for upstream merges; the server-side counterpart (validation against
     `AUTH_EMAIL_LINK_ALLOWED_ORIGINS`, `400 auth/email-redirect-not-allowed` on mismatch) is
     documented in the Agora server's `docs/MANIFEST.md`.

### Previously diverged, now dissolved into upstream

These were tracked divergences that upstream later implemented independently; on the sync that
brought them in we took upstream's version and dropped our fork copy (and its header). Recorded here
so the history is legible — **do not re-add them**:

- **Chat timestamps as ISO strings** (was #5). Upstream's `fix/core-timestamps-as-string` retyped
  `ChatMessage.createdAt/updatedAt` and `Conversation.lastMessageAt` to `string` and switched the
  optimistic send to `new Date().toISOString()` — identical to our fork fix. Dissolved in the v7.4.x
  sync.
- **Account-sync desync guard** (was part of #3, `useAccountSync.ts`). Upstream shipped the same
  corrupt-account-map guard and **improved** it (keys off the *refresh* token's `sub`, not the access
  token's, and also covers cross-tab account swaps). We took theirs verbatim. Dissolved in the v7.4.x
  sync.

## Sync workflow

```bash
# 1. Pull upstream onto main (clean — main has no edits, just mirrors upstream)
git fetch upstream
git checkout main
git merge --ff-only upstream/main          # or: git reset --hard upstream/main

# 2. Merge upstream into our working branch
git checkout agora
git merge main
#   (If an upstream delta is a *pure* rebrand/rename you're declining wholesale — as the
#    @replyke->@sublay one was — record it without taking content: `git merge -s ours main`.)
#   Conflicts are rare and predictable:
#   - Rename lines DON'T usually conflict: upstream uses @sublay (formerly @replyke), we use
#     @agora-sdk, and git takes ours unless upstream edited the exact same import line.
#   - The 4 base-URL files above are the likely conflict spots if upstream refactors them —
#     re-apply our env-driven version, keeping upstream's surrounding logic.

# 3. Re-apply scope + identifiers to any NEW upstream code (idempotent).
#    NEW upstream files arrive with @sublay/* scope and Sublay*/sublay* identifiers — the script
#    converts both passes deterministically.
./rename-to-agora.sh

# 4. Relink + verify
pnpm install
pnpm run build-all

# 5. Ship
git commit -am "Sync upstream <date/sha>"
git push origin agora && git push github agora
```

## Why this stays cheap

Git only conflicts when **both** sides change the **same lines**. Upstream never touches our
`@agora-sdk` rename (they use `@sublay`, formerly `@replyke`), so the rename almost never conflicts
— and when a new `@sublay` (or legacy `@replyke`) reference or `Sublay*` identifier arrives from
upstream, step 3 converts it deterministically. The real review surface each sync is the 4
base-URL files plus the 2 auth-flow files (divergence #3) and `EntityListSortByOptions.ts`
(divergence #5) — keep those edits surgical and syncing remains a few minutes of work.

Each sync may also require adapting a handful of merged-in upstream **test fixtures** — because
agora runs `tsc` over tests (upstream uses vitest/esbuild, which skips typechecking) and because
agora's 401-refresh and runtime base-URL divergences change what those tests assert. This is
expected, not a divergence in product behavior (the v7.6.2 sync adapted 8 such fixtures).

> ⚠️ Never commit `@agora-sdk` names onto `main` — it must stay a clean mirror of upstream so step 1
> always fast-forwards.
