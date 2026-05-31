# Agora: Infrastructure layer for user-created content and social graphs

<p align="center">
    <h3 align="center">Agora is a TypeScript-first SDK for adding production-grade social features to any web or mobile app.</h3>
</p>

Agora gives developers a complete foundation for building social experiences - comments, votes, notifications, feeds, follows, lists, and more - without reinventing the wheel. Instead of wiring together a mix of libraries or building from scratch, Agora offers drop-in APIs, SDKs, and hooks that are production-ready out of the box.

Built with a headless, TypeScript-first architecture, Agora fits seamlessly into your stack. Whether you're building a full social network or just need user comments on a blog post - Agora has you covered.

## Table of Contents

- [Key Features](#key-features)
- [Why Agora](#why-agora)
- [Approach and Structure](#building-agora-a-layered-api-centric-approach)
- [Packages](#packages)
- [Quick Start](#quick-start)
- [Comparison With Alternatives](#comparison-with-alternatives)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Community and Support](#community-and-support)
- [Development](#development)
- [License](#license)

## Key Features

- **Comment system** - threaded replies, mentions, votes, customizable UI-elements, built-in moderation
- **Feeds** - filter entities by tags, content, custom metadata, follow relationships, timeframe or geography and sort by hot, top or controversial.
- **In-app notifications** - auto-generated in-app notifications for pre-defined events such as votes, mentions, follows and more. Configurable webhooks for further action, such as sending push-notifications.
- **Curated lists** - user-generated collections and nested sub-collections of entities.
- **Follow graph** - one-way follow relationships ready for social graphs.
- **Authentication** - easy user authentication, or integration with an external user system.
- **Chat** - conversations, message threads, and realtime delivery over socket.io.

All features come with backend APIs and typed SDKs for React and React Native.

## Why Agora

- **Save months of work** - plug in battle-tested social primitives instead of reinventing them
- **Headless first** - bring your own auth and UI
- **Full TypeScript stack** - the same types flow from database to client hooks
- **Self host** - point the SDK at your own Agora server via a single environment variable

## Building Agora: A Layered, API-Centric Approach

Agora is API-centric. From the beginning, it was designed so that everything is powered by a clean, consistent API. This approach is what makes the system flexible and extensible.

You can think of Agora as having two core layers:

### 1. The API (Foundation)

The base layer of Agora is its API, served by the [Agora server](https://github.com/jenova-marie/agora). Everything the system can do, you can do through the API - whether it's posting a comment, reporting content, creating a new entity, or updating a user profile. As long as you're authenticated for routes that require authentication, all functionality is accessible.

The SDK points at your Agora server through `getApiBaseUrl()`, which defaults to `http://localhost:4000/v7` and is overridable via the `REACT_APP_API_BASE_URL` / `VITE_API_BASE_URL` environment variables.

### 2. Libraries & SDKs (Developer Tools)

On top of the API, Agora provides official libraries to simplify development - React and React Native (including Expo), with secure token management on native.

These libraries handle communication with the API and offer helpful abstractions for things like authentication, request state, pagination, and cache. For example, hooks like `useEntityList` make it easy to fetch entities with filters, sorting, and pagination - without writing any boilerplate yourself.

## Packages

| Package | Description |
| ------- | ----------- |
| `@agora-sdk/core` | Core hooks, context providers, and utilities for React and React Native |
| `@agora-sdk/react-js` | React-specific implementations and re-exports from core |
| `@agora-sdk/react-native` | React Native implementations with token management |
| `@agora-sdk/expo` | Expo implementations with secure token storage |

Internal packages use `workspace:*` for cross-references, and every package builds to both ESM (`dist/esm`) and CJS (`dist/cjs`).

## Quick Start

This is a minimal example for fetching and rendering an entity (a post, article, or any piece of content) using Agora. It's headless - you bring your own UI.

To use this example:

1. Set `VITE_API_BASE_URL` to your Agora server's base URL (defaults to `http://localhost:4000/v7`).
2. Provide a `projectId` and a signed token for your user. The `useSignTestingJwt` helper signs a JWT locally for development.

```bash
pnpm add @agora-sdk/react-js
```

> ⚠️ `useSignTestingJwt` signs a JWT with your project's secret key on the client. It is **meant only for development and testing**. Never expose private keys in production; sign tokens on your server instead.

### Example `App.tsx`

```tsx
import {
  ReplykeProvider,
  EntityProvider,
  useEntity,
  useSignTestingJwt,
} from "@agora-sdk/react-js";
import { useEffect, useState } from "react";

const PROJECT_ID = import.meta.env.VITE_PUBLIC_PROJECT_ID;
const PRIVATE_KEY = import.meta.env.VITE_PUBLIC_SECRET_KEY;

const DUMMY_USER = { id: "user1", username: "lionel_messi10" };
const DUMMY_POST_ID = "post_1234";

function Post() {
  const { entity, updateEntity } = useEntity();

  if (!entity) return <p>Loading…</p>;

  return (
    <div>
      <h3>{entity.title}</h3>
      <p>{entity.content}</p>
      <small>Score: {entity.score}</small>
    </div>
  );
}

function App() {
  const signTestingJwt = useSignTestingJwt();
  const [signedToken, setSignedToken] = useState<string>();

  useEffect(() => {
    signTestingJwt({
      projectId: PROJECT_ID,
      privateKey: PRIVATE_KEY,
      payload: DUMMY_USER,
    }).then(setSignedToken);
  }, []);

  return (
    <ReplykeProvider projectId={PROJECT_ID} signedToken={signedToken}>
      <EntityProvider foreignId={DUMMY_POST_ID} createIfNotFound>
        <Post />
      </EntityProvider>
    </ReplykeProvider>
  );
}

export default App;
```

> Note: the provider and hook names retain their upstream `Replyke*` identifiers in code; only the package scope is rebranded to `@agora-sdk/*`. UI components (e.g. a prebuilt comment section) are not part of this SDK fork - it ships the headless API and hooks layer.

## Comparison With Alternatives

|                     | **Agora** | Replyke | Disqus        | Supabase + DIY | Custom Build |
| ------------------- | --------- | ------- | ------------- | -------------- | ------------ |
| Open source         | ✔         | Partial | ✖             | ✔              | -            |
| Full social toolkit | ✔         | ✔       | Comments only | ✖              | -            |
| Self host           | ✔         | ✖       | Limited       | ✔              | ✔            |
| React hooks         | ✔         | ✔       | ✖             | ✖              | -            |

## Documentation

Agora's API surface mirrors upstream Replyke. Until Agora-specific docs are published, the upstream reference at [https://docs.replyke.com](https://docs.replyke.com) is the closest guide - keeping in mind that the package scope here is `@agora-sdk/*` and base URLs are driven by `getApiBaseUrl()`. See [SYNCING.md](SYNCING.md) for how this fork tracks upstream.

### Claude Code integration

This repo ships a [Claude Code](https://claude.com/claude-code) plugin that teaches an AI agent how to build apps on the Agora SDK — the provider+hooks model, feeds/auth/chat/spaces, and the ways this fork diverges from upstream Replyke. The skills look things up via a bundled API surface and the consumer's own installed `.d.ts`, so they work without any extra MCP server or network access.

Install it from this repo:

```
/plugin marketplace add jenova-marie/agora-sdk
/plugin install agora-sdk@agora-sdk
```

The plugin lives in [`plugins/agora-sdk/`](plugins/agora-sdk/); the marketplace catalog is [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).

## Contributing

Bug reports are welcome - please open an issue. When contributing, keep changes that diverge from upstream surgical, so syncing stays cheap (see [SYNCING.md](SYNCING.md)).

## Community and Support

This is a fork maintained for internal use. For questions about the underlying framework, refer to the upstream [Replyke](https://github.com/replyke/monorepo) project.

## Development

This is a pnpm monorepo.

### Building

- `pnpm run build-all` - builds all packages in dependency order
- `pnpm --filter @agora-sdk/[package-name] run build` - build an individual package

### Publishing

- `pnpm run publish-prod` - publishes all packages to production
- `pnpm run publish-beta` - publishes all packages with the beta tag

## License

Licensed under [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).

This project is a fork of [Replyke](https://github.com/replyke/monorepo), repointed at an Agora server and rebranded to the `@agora-sdk/*` scope. See [SYNCING.md](SYNCING.md) for the upstream-merge workflow.
