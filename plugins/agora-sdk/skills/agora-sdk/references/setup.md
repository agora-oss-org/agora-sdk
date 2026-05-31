# Setup & Provider Configuration

## Install

Pick the package matching the target platform — all re-export `@agora-sdk/core`, so install exactly one in app code.

```bash
# React web
pnpm add @agora-sdk/react-js

# bare React Native
pnpm add @agora-sdk/react-native react-native-keychain

# Expo (managed)
pnpm add @agora-sdk/expo expo-secure-store
```

Peer deps shared by all: `react`, `react-redux`, `@reduxjs/toolkit`. Platform peers: `react-dom` (web), `react-native` (+ `react-native-keychain`) for RN, `expo` (+ `expo-secure-store`) for Expo. The SDK manages its own isolated Redux store — you do **not** configure Redux yourself unless you opt into integration mode (below).

## Wrap the app

`ReplykeProvider` is the root. It initializes the store, bootstraps auth from storage, and sets runtime config. Everything using Agora must be a descendant.

```tsx
import { ReplykeProvider } from "@agora-sdk/react-js";

function App() {
  return (
    <ReplykeProvider
      projectId="proj_xxx"                    // required — from the Agora/Replyke dashboard
      baseUrl="https://api.myhost.com/v7"     // see "baseUrl rule" below
      signedToken={externalJwt /* optional */}
    >
      {/* your app */}
    </ReplykeProvider>
  );
}
```

### Props

| Prop | Type | Notes |
|---|---|---|
| `projectId` | `string` (required) | Your project ID. |
| `baseUrl` | `string` (web/core) | Agora server base URL **including `/v7`**. Defaults to `http://localhost:4000/v7`. |
| `signedToken` | `string \| null` | A JWT from your own auth system for external-auth mode. Omit/`null` for built-in auth. |
| `children` | `ReactNode` | — |

> The React Native / Expo `ReplykeProvider` overrides do **not** take `baseUrl` as a documented prop the same way — RN apps typically resolve the host from native env/config. On core/web it is a first-class prop. If you need to set it imperatively on any platform, use `setApiBaseUrl()` (below) before the first request fires.

## ⚠️ The `baseUrl` rule (Agora divergence)

Upstream Replyke auto-detects the API host from env vars (`VITE_API_BASE_URL`, `REACT_APP_API_BASE_URL`). **Agora removed that** — `import.meta.env` / `process.env` couldn't be read reliably at import time and was evaluated eagerly. Instead:

1. **Your app** parses its own platform env (Vite `import.meta.env`, CRA/RN `process.env`, app config…).
2. You pass the resolved string to `<ReplykeProvider baseUrl={…}>`.
3. The provider calls `setApiBaseUrl()` synchronously on render, **before any request fires**.
4. Everything (axios, RTK Query, the chat socket origin, OAuth, `useAskContent`) reads it **lazily, per request**, so the injected value always wins.

If you omit `baseUrl`, the app silently talks to `http://localhost:4000/v7` — the most common "why is prod hitting localhost" bug. Always set it explicitly outside local dev.

### Runtime config getters (`@agora-sdk/core`)

From `config/runtime.ts` — a mutable singleton:

- `setApiBaseUrl(url: string)` — set the base URL imperatively (the provider does this for you).
- `getApiBaseUrl(): string` — current base URL.
- `getSocketUrl(): string` — base URL stripped to its origin, used for the chat socket.io connection.

## Auth gating: always check `initialized`

`initialized` is `false` until the SDK has attempted to restore a session from storage. Gate auth-dependent UI on it to avoid a flash of unauthenticated content:

```tsx
const { initialized, signOut } = useAuth();
const { user } = useUser();
if (!initialized) return <Loading />;
if (!user) return <SignedOut />;
```

## Redux integration mode (existing store)

If the host app already runs Redux, do **not** spin up two stores — use `ReplykeIntegrationProvider` and wire the pieces into your own store. From `@agora-sdk/core`:

- `replykeReducers` — feature reducers (mount under the `replyke` key).
- `replykeApiReducer` — RTK Query API reducer.
- `replykeMiddleware` — middleware array (API + custom).
- `replykeApi` — the base RTK Query API.
- `type ReplykeState` — the slice's state shape.

For the full wiring, use the lookup ladder ([SKILL.md](../SKILL.md)): MCP/docs `/v7/sdk/redux-integration`, or inspect the exported types in `node_modules/@agora-sdk/core/dist/esm/store/integration.d.ts`.
