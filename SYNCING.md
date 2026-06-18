# Syncing with upstream Replyke

This is a fork of [replyke/monorepo](https://github.com/replyke/monorepo), repointed at an
[Agora](../agora) server and rebranded to the `@agora-sdk/*` scope. This doc keeps pulling
upstream's improvements painless.

## Remotes & branches

| | |
|---|---|
| `upstream` | `github.com/replyke/monorepo` — the original (read-only for us) |
| `origin` | private mirror (`git.rso`) |
| `github` | public mirror (`github.com/jenova-marie/agora-sdk`) |
| **`main`** | mirrors `upstream/main` verbatim — **keep upstream's names (now `@sublay/*`, formerly `@replyke/*`), no edits** |
| **`agora`** | our working branch — `@agora-sdk/*` scope + the base-URL repoint. Pushed to `origin` + `github`. |

## What diverges from upstream (five things)

1. **Base-URL repoint** — committed code on `agora`, 4 files:
   `core/src/utils/env.ts` (`getApiBaseUrl()` default), `core/src/config/axios.ts`
   (`BASE_URL = getApiBaseUrl()`), `core/src/context/chat-context.tsx` (socket fallback),
   `react-js/src/hooks/useOAuthSignIn.ts`. Everything else derives from `getApiBaseUrl()`.
   `env.ts` additionally carries a `declare const process` guard (adopted from upstream during the
   sublay-rebrand sync) so the `typeof process` checks typecheck without `@types/node`.
2. **`@replyke/*` → `@agora-sdk/*` rename** — *not* hand-edited; produced by `./rename-to-agora.sh`
   (idempotent, re-runnable). Upstream rebranded `@replyke/*` → `@sublay/*` (merged into `agora` via
   `-s ours`, content declined), so the script now converts **both** `@replyke/` and `@sublay/`
   quoted imports → `@agora-sdk/`. Keeping it scripted is what makes upstream merges cheap.
3. **Auth-flow behavior** — hand edits in 4 files, each marked with a `Modified from original
   @replyke/core` header (Apache-2.0 §4(b)):
   - `core/src/store/slices/authThunks.ts` + `core/src/hooks/auth/useAuth.ts`:
     `signUpWithEmailAndPassword` resolves to a **`SignUpResult`** (`{ status: "signed_in" }` |
     `{ status: "confirmation_required", email }`) instead of `void`, so the UI can show a
     "check your email" state when the Agora server requires email confirmation. The new
     `SignUpResult` type is re-exported from `core/src/hooks/auth/index.ts` and `core/src/index.ts`.
   - `core/src/store/slices/authThunks.ts`: sign-out now **always clears local auth state** even
     if the server-side revoke fails (a stale/expired refresh token must not strand the user
     signed in).
   - `core/src/hooks/auth/useAccountSync.ts`: only persist an account entry once the access
     token's `sub` matches the current `user.id`, preventing a **corrupt account map** (two ids
     sharing one refresh token) during the transient token/user desync on OAuth sign-in.
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
5. **Chat date fields as ISO strings** — hand edits in 3 files, each marked with a `Modified from
   original @replyke/core` header:
   - `core/src/interfaces/models/ChatMessage.ts`: `createdAt`/`updatedAt` retyped `Date → string`.
   - `core/src/interfaces/models/Conversation.ts`: `lastMessageAt` retyped `Date | null → string | null`.
   - `core/src/hooks/chat/messages/useSendMessage.tsx`: the optimistic message stores
     `new Date().toISOString()` instead of a live `Date`.

   The server sends these timestamps as ISO **strings** over JSON; the live `Date` minted in the
   optimistic-send path was the only non-serializable value entering the Redux chat store, tripping
   RTK's `serializableCheck` on `chat/addOptimisticMessage`. Retyping to `string` matches the wire
   shape (consumers already wrap in `new Date(...)` at the point of use). This is a generic fix to an
   upstream bug — **strong upstream-PR candidate** (the header is fork-only and must NOT go in the
   upstream PR); if contributed to Replyke it dissolves on the next merge.

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

# 3. Re-apply the scope to any NEW @replyke/@sublay refs upstream introduced (idempotent)
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
— and when a new `@sublay` (or legacy `@replyke`) reference arrives from upstream, step 3 converts
it deterministically. The real review surface each sync is the 4 base-URL files plus the 2 auth-flow
files (divergence #3) — keep those edits surgical and syncing remains a few minutes of work.

> ⚠️ Never commit `@agora-sdk` names onto `main` — it must stay a clean mirror of upstream so step 1
> always fast-forwards.
