# Syncing with upstream Replyke

This is a fork of [replyke/monorepo](https://github.com/replyke/monorepo), repointed at an
[Agora](../agora) server and rebranded to the `@agora/*` scope. This doc keeps pulling
upstream's improvements painless.

## Remotes & branches

| | |
|---|---|
| `upstream` | `github.com/replyke/monorepo` — the original (read-only for us) |
| `origin` | private mirror (`git.rso`) |
| `github` | public mirror (`github.com/jenova-marie/agora-sdk`) |
| **`main`** | mirrors `upstream/main` verbatim — **keep original `@replyke/*` names, no edits** |
| **`agora`** | our working branch — `@agora/*` scope + the base-URL repoint. Pushed to `origin` + `github`. |

## What diverges from upstream (only two things)

1. **Base-URL repoint** — committed code on `agora`, 4 files:
   `core/src/utils/env.ts` (`getApiBaseUrl()` default), `core/src/config/axios.ts`
   (`BASE_URL = getApiBaseUrl()`), `core/src/context/chat-context.tsx` (socket fallback),
   `react-js/src/hooks/useOAuthSignIn.ts`. Everything else derives from `getApiBaseUrl()`.
2. **`@replyke/*` → `@agora/*` rename** — *not* hand-edited; produced by `./rename-to-agora.sh`
   (idempotent, re-runnable). Keeping it scripted is what makes upstream merges cheap.

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
#   - Rename lines DON'T usually conflict: upstream keeps @replyke, we keep @agora, and git
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
`@agora` rename (they stay `@replyke`), so the rename almost never conflicts — and when a new
`@replyke` reference arrives from upstream, step 3 converts it deterministically. The only real
review surface each sync is the 4 base-URL files. Keep our edits there surgical and syncing
remains a few minutes of work.

> ⚠️ Never commit `@agora` names onto `main` — it must stay a clean mirror of upstream so step 1
> always fast-forwards.
