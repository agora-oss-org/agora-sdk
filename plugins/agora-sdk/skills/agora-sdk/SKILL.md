---
name: agora-sdk
description: Use when building a React, React Native, or Expo app on the Agora SDK (@agora-sdk/core, @agora-sdk/react-js, @agora-sdk/react-native, @agora-sdk/expo) — social features like comments, reactions/votes, feeds, follows, spaces, chat, notifications, and auth. Agora is a fork of Replyke; this skill maps the provider+hooks model and flags where the fork's API diverges from upstream Replyke docs.
metadata:
  author: jenova-marie
  version: "1.0.0"
---

# Agora SDK

Agora is an open-source social-features framework (comments, reactions, feeds, follows, spaces, chat, notifications, auth) for React, React Native, and Expo. It is a **fork of [Replyke](https://github.com/replyke/monorepo)**, rescoped to `@agora-sdk/*`.

## Core principle: own the divergences, look up the rest

Agora is API-compatible with Replyke v7, so for the shared 80% (exact hook arguments, data-model fields) you **look things up** rather than memorize — see the lookup ladder below. This skill's hand-written value is the *judgment* layer: the mental model, the per-domain topology/gotchas, and the four fork divergences. Apply the divergence table to **anything** you derive from upstream Replyke docs — an agent that copies them verbatim produces code that won't compile or silently hits the wrong server.

## Looking things up (works with or without the Replyke MCP)

Use the **first source available** — they degrade gracefully, and none of the lower tiers need a network or the MCP:

1. **Bundled API surface** → [references/api-surface.md](references/api-surface.md). A self-contained index of every exported provider/hook/type grouped by domain. Always present; start here to find *which* symbol you need.
2. **The installed `.d.ts` (the version-exact floor)** → the consuming app has the packages in `node_modules`, so the real declarations are on disk: `cat node_modules/@agora-sdk/core/dist/esm/index.d.ts`, or drill in, e.g. `cat node_modules/@agora-sdk/core/dist/esm/hooks/auth/useAuth.d.ts`. This is the **most accurate** source — it's literally the version installed — and needs no network or MCP. Use it for exact signatures and field shapes.
3. **Replyke docs MCP** *(if mounted)* — richest prose + examples: `search_replyke_documentation(query)` for concepts; `query_docs_filesystem_replyke_documentation` to read pages, e.g. `cat /v7/hooks/comments/use-create-comment.mdx`, `ls /v7/hooks`.
4. **`docs.replyke.com` via WebFetch** *(if no MCP but online)* — the same docs publicly. Start at the machine index **`https://docs.replyke.com/llms.txt`** to discover exact page paths, then fetch any page's clean-markdown twin by appending `.md`, e.g. `https://docs.replyke.com/v7/hooks/comments/use-create-comment.md`. Paths are `/v7/`-prefixed (the same suffix used in the `→` pointers throughout these reference files) — unversioned paths 404.

Tiers 3–4 describe **upstream Replyke**, so always re-apply the divergence table to anything from them. Tiers 1–2 are this fork, version-exact.

### ⚠️ Agora divergences from upstream Replyke

| Replyke docs say | Agora reality | Failure if you ignore it |
|---|---|---|
| `import … from "@replyke/react-js"` (and `/core`, `/react-native`, `/expo`) | `@agora-sdk/react-js` etc. — the `@replyke` scope was unavailable | `Cannot find module '@replyke/...'` |
| Base URL auto-detected from env vars (`VITE_API_BASE_URL`, `REACT_APP_API_BASE_URL`) | **Must pass `baseUrl` prop** to `ReplykeProvider`. Defaults to `http://localhost:4000/v7` if omitted | App silently talks to `localhost:4000` in production |
| `signUpWithEmailAndPassword(...)` resolves to `void` | Resolves to a **`SignUpResult`** union: `{ status: "signed_in"; user }` \| `{ status: "confirmation_required"; email }` | Email-confirmation signup flow is broken; no "check your email" state |
| Entity-list `sortBy`: `top` / `hot` / `new` / `controversial` / `metadata.*` | **Adds `decay`, `gravity`, `wilson`, `bayesian`** + optional `rankParams` / `rankAnchor` / `rerank` pass-through | Misses the fork's headline feed-ranking feature |

The component/provider names are **unchanged** from upstream (`ReplykeProvider`, `EntityProvider`, etc.) — only the **package scope** changed. Don't rename the symbols, only the import path.

See [SYNCING.md](https://github.com/jenova-marie/agora-sdk/blob/main/SYNCING.md) and [CHANGELOG.md](https://github.com/jenova-marie/agora-sdk/blob/main/CHANGELOG.md) in the SDK repo — if those diverge from this table after an upstream sync, the table here is stale and should be updated.

## The mental model (unlocks ~150 hooks)

Everything follows one consistent shape. Learn it once:

1. **Root provider** — wrap the app (or subtree) in `ReplykeProvider` with `projectId` + `baseUrl` + optional `signedToken`. It owns the Redux store, auth bootstrap, and runtime config.
2. **Scope provider** — drill into a feature context: `EntityProvider` (a post/article + its comments/reactions), `SpaceProvider` (a community), `ChatProvider` → `ConversationProvider` → `MessageThreadProvider` (messaging).
3. **Hooks** — inside a scope: `use<Feature>()` reads scoped data, `use<Feature>Actions()` mutates it. Standalone `useFetch<Thing>()` / `useCreate<Thing>()` hooks work anywhere under the root provider.

```tsx
import { ReplykeProvider, EntityProvider, useEntity, useEntityComments } from "@agora-sdk/react-js";

<ReplykeProvider projectId="proj_…" baseUrl="https://api.myhost.com/v7">
  <EntityProvider foreignId="post_123" createIfNotFound>
    <Post />          {/* useEntity() → entity data */}
    <Comments />      {/* useEntityComments(), useCreateComment(), useReactionToggle() */}
  </EntityProvider>
</ReplykeProvider>
```

## Packages (all `1.1.1`, ESM + CJS, Apache-2.0)

| Package | For | Token storage | Notable extras |
|---|---|---|---|
| `@agora-sdk/core` | shared logic (React + RN) | — | every hook, provider, type, runtime config getters |
| `@agora-sdk/react-js` | React web | `localStorage` | overrides `ReplykeProvider` (+`baseUrl`); exports `useOAuthSignIn` (redirect flow) |
| `@agora-sdk/react-native` | bare React Native | `react-native-keychain` | secure Keychain account storage |
| `@agora-sdk/expo` | Expo managed | `expo-secure-store` | SecureStore account storage |

Platform packages **re-export everything from core** and override `ReplykeProvider` with platform-appropriate token storage. Import from the platform package, not core, in app code.

## Reference files (load on demand)

- **[references/api-surface.md](references/api-surface.md)** — self-contained index of every exported provider/hook/type, grouped by domain. The offline floor; consult first to find the right symbol, then drill into the installed `.d.ts` for signatures.
- **[references/setup.md](references/setup.md)** — install per platform, provider props, the `baseUrl` injection rule, runtime config (`getApiBaseUrl`/`setApiBaseUrl`/`getSocketUrl`), Redux integration.
- **[references/auth.md](references/auth.md)** — the `SignUpResult` flow (do this right or signup breaks), email/password + OAuth + external-JWT modes, multi-account switching, dev `useSignTestingJwt`.
- **[references/feeds.md](references/feeds.md)** — `useEntityList` / `useEntityListActions`, filters & sorting, and the four Agora ranking algorithms with their `rankParams` / `rankAnchor` / `rerank` knobs.
- **[references/social-core.md](references/social-core.md)** — the 80% path: `EntityProvider` → comments → reactions/votes. The single most common reason to reach for this SDK.
- **[references/advanced.md](references/advanced.md)** — spaces, chat (provider nesting + socket footgun), and connections-vs-follows. Thin: topology + hook taxonomy + gotchas, routing specifics to the Replyke MCP (these domains have no fork divergences).

## Workflow when implementing

1. Identify the feature → check whether a reference file above covers it. If so, read it.
2. For shared API detail (exact hook return shapes, data-model fields), use the **lookup ladder** above — `api-surface.md` to find the symbol, then the installed `.d.ts` for the exact signature; the Replyke MCP / public docs only if you want prose or examples.
3. **Apply the divergence table** to anything you pulled from upstream docs (ladder tiers 3–4) — fix the import scope, pass `baseUrl`, handle `SignUpResult`.
4. Write app code importing from the **platform package** (`@agora-sdk/react-js` etc.), never `@replyke/*`.
