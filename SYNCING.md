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
| **`main`** | mirrors `upstream/main` verbatim — **keep original `@replyke/*` names, no edits** |
| **`agora`** | our working branch — `@agora-sdk/*` scope + the base-URL repoint. Pushed to `origin` + `github`. |

## What diverges from upstream (three things)

1. **Base-URL repoint** — committed code on `agora`, 4 files:
   `core/src/utils/env.ts` (`getApiBaseUrl()` default), `core/src/config/axios.ts`
   (`BASE_URL = getApiBaseUrl()`), `core/src/context/chat-context.tsx` (socket fallback),
   `react-js/src/hooks/useOAuthSignIn.ts`. Everything else derives from `getApiBaseUrl()`.
2. **`@replyke/*` → `@agora-sdk/*` rename** — *not* hand-edited; produced by `./rename-to-agora.sh`
   (idempotent, re-runnable). Keeping it scripted is what makes upstream merges cheap.
3. **Auth-flow behavior** — hand edits in 2 files, each marked with a `Modified from original
   @replyke/core` header (Apache-2.0 §4(b)):
   - `core/src/store/slices/authThunks.ts` + `core/src/hooks/auth/useAuth.ts`:
     `signUpWithEmailAndPassword` resolves to a **`SignUpResult`** (`{ status: "signed_in" }` |
     `{ status: "confirmation_required", email }`) instead of `void`, so the UI can show a
     "check your email" state when the Agora server requires email confirmation. The new
     `SignUpResult` type is re-exported from `core/src/hooks/auth/index.ts` and `core/src/index.ts`.
   - `core/src/store/slices/authThunks.ts`: sign-out now **always clears local auth state** even
     if the server-side revoke fails (a stale/expired refresh token must not strand the user
     signed in).

   Unlike #1 and #2, these are genuine behavioral forks from upstream and the **likely
   merge-conflict spots** if upstream refactors auth — re-apply them by hand, preserving upstream's
   surrounding logic, and keep the `Modified from original` headers. (Server-side counterpart:
   `/auth/sign-up` returns `{ status: "confirmation_required" }`, documented in the Agora server's
   `docs/MANIFEST.md`.)

## Sync workflow

```bash
# 1. Pull upstream onto main (clean — main has no edits, just mirrors upstream)
git fetch upstream
git checkout main
git merge --ff-only upstream/main          # or: git reset --hard upstream/main

# 2. Merge upstream into our working branch
git checkout agora
git merge main
#   Conflicts are rare and predictable:
#   - Rename lines DON'T usually conflict: upstream keeps @replyke, we keep @agora-sdk, and git
#     takes ours unless upstream edited the exact same import line.
#   - The 4 base-URL files above are the likely conflict spots if upstream refactors them —
#     re-apply our env-driven version, keeping upstream's surrounding logic.

# 3. Re-apply the scope to any NEW @replyke refs upstream introduced (idempotent)
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
`@agora-sdk` rename (they stay `@replyke`), so the rename almost never conflicts — and when a new
`@replyke` reference arrives from upstream, step 3 converts it deterministically. The real
review surface each sync is the 4 base-URL files plus the 2 auth-flow files (divergence #3) — keep
those edits surgical and syncing remains a few minutes of work.

> ⚠️ Never commit `@agora-sdk` names onto `main` — it must stay a clean mirror of upstream so step 1
> always fast-forwards.
