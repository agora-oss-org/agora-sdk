# JWT-Required Reads (Divergence #8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every SDK request carry the JWT bearer token (and survive token expiry) at the transport layer, so the SDK works against an Agora server that requires auth on all content routes — with near-zero new divergence from upstream Replyke.

**Architecture:** All auth handling moves into the shared transport modules (`config/runtime.ts`, `config/axios.ts`, `store/api/baseApi.ts`, `config/useAxiosPrivate.ts`), which are already fork divergences. `runtime.ts` gains a registry (access-token getter, token refresher, single-flight refresh mutex, auth-boot latch); the axios module installs token-attach + 401-refresh-retry interceptors on **both** instances; `initializeAuthThunk` registers the store-bound callbacks and releases the latch; the providers arm the latch during render. No per-hook edits.

**Tech Stack:** TypeScript, axios interceptors, Redux Toolkit (thunks + RTK Query `fetchBaseQuery`), vitest + jsdom + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-07-17-jwt-required-reads-design.md`. Two approved refinements over the spec text:
1. The access-token getter and refresher are registered inside `initializeAuthThunk` (which has the live store's `getState`/`dispatch` and the `projectId` in scope) instead of `store/index.ts`. This also covers **integration mode** (consumer-owned Redux store never touches the `replykeStore` singleton) and removes the plan's only not-already-diverged file.
2. `ReplykeIntegrationProvider` also arms the boot latch (same one-line render call as `ReplykeProvider`), so integration mode gets the same boot-race protection.

## Global Constraints

- **Fork discipline:** every modified file keeps/extends its `Modified from the original @replyke/core source.` Apache-2.0 §4(b) header; files gaining one for the first time get the full 4-line header shown in Task 4. Keep edits surgical — do not reformat surrounding upstream code.
- **Never** reintroduce an eager `BASE_URL` constant; the base URL stays lazy per-request (existing divergence #1).
- The refresh trigger status is **401** (Agora contract), never 403 (existing divergence #3).
- URLs containing `/auth/` are exempt from BOTH the latch and the 401-refresh — the boot refresh flows through the public instance *before* the latch resolves (deadlock otherwise), and a failed sign-in's 401 must never trigger a refresh.
- A 401 is refreshed/retried at most once per request, coordinated via the per-request `sent` flag (shared with `useAxiosPrivate`'s handler) and the global single-flight mutex in `runtime.ts`.
- Default latch state is **OPEN** (unarmed): core-only consumers and every existing test that never mounts a provider are unaffected.
- Tests: run a single file with `pnpm --filter @agora-sdk/core exec vitest run src/<path>`; the whole core suite with `pnpm --filter @agora-sdk/core run test`. There is no linter.
- CHANGELOG.md `[Unreleased]` must be updated in the same commit as the code change it describes (repo rule); the plan folds all doc edits into Task 7 — fine because tasks 1–6 land as one PR, but each commit message must reference divergence #8.

---

### Task 1: Auth transport registry in `config/runtime.ts`

**Files:**
- Modify: `packages/core/src/config/runtime.ts` (append after `getEmailRedirectTo`, update header comment)
- Modify: `packages/core/src/test-utils/axiosHarness.tsx` (reset transport state in `resetAxiosMocks`)
- Test: `packages/core/src/config/runtime.test.ts` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Tasks 2, 3, 4, 5, 6):
  - `registerAccessTokenGetter(fn: () => string | null): void`
  - `getAccessToken(): string | null` — `null` when no getter registered
  - `registerTokenRefresher(fn: () => Promise<string | undefined>): void`
  - `hasTokenRefresher(): boolean`
  - `refreshAccessToken(refresher?: () => Promise<string | undefined>): Promise<string | undefined>` — single-flight; never rejects; `undefined` on failure/no refresher
  - `armAuthLatch(): void` — one-shot per session
  - `markAuthSettled(): void`
  - `whenAuthSettled(): Promise<void>` — resolves immediately if never armed
  - `__resetAuthTransportForTests(): void`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/config/runtime.test.ts` (extend the existing imports from `./runtime`, and add `vi` usage — the file already imports `vi`):

```ts
import {
  registerAccessTokenGetter,
  getAccessToken,
  registerTokenRefresher,
  hasTokenRefresher,
  refreshAccessToken,
  armAuthLatch,
  markAuthSettled,
  whenAuthSettled,
  __resetAuthTransportForTests,
} from "./runtime";

// (merge into the existing `import { getEmailRedirectTo } from "./runtime";` line)

describe("auth transport registry (divergence #8)", () => {
  afterEach(() => {
    __resetAuthTransportForTests();
  });

  it("getAccessToken returns null when no getter is registered", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("returns the registered getter's current token", () => {
    let token: string | null = "token-1";
    registerAccessTokenGetter(() => token);
    expect(getAccessToken()).toBe("token-1");
    token = null;
    expect(getAccessToken()).toBeNull();
  });

  it("hasTokenRefresher flips when a refresher is registered", () => {
    expect(hasTokenRefresher()).toBe(false);
    registerTokenRefresher(async () => undefined);
    expect(hasTokenRefresher()).toBe(true);
  });

  it("refreshAccessToken resolves undefined when nothing is registered", async () => {
    await expect(refreshAccessToken()).resolves.toBeUndefined();
  });

  it("shares one in-flight refresh across concurrent callers", async () => {
    let resolveRefresh!: (t: string | undefined) => void;
    const refresher = vi.fn(
      () => new Promise<string | undefined>((r) => (resolveRefresh = r)),
    );
    registerTokenRefresher(refresher);

    const p1 = refreshAccessToken();
    const p2 = refreshAccessToken();
    resolveRefresh("fresh");

    expect(await p1).toBe("fresh");
    expect(await p2).toBe("fresh");
    expect(refresher).toHaveBeenCalledTimes(1);
  });

  it("resolves undefined (never rejects) when the refresher throws", async () => {
    registerTokenRefresher(() => Promise.reject(new Error("boom")));
    await expect(refreshAccessToken()).resolves.toBeUndefined();
  });

  it("allows a new refresh after the previous one settles", async () => {
    const refresher = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");
    registerTokenRefresher(refresher);

    expect(await refreshAccessToken()).toBe("first");
    expect(await refreshAccessToken()).toBe("second");
    expect(refresher).toHaveBeenCalledTimes(2);
  });

  it("prefers an explicitly passed refresher over the registered one", async () => {
    registerTokenRefresher(async () => "registered");
    expect(await refreshAccessToken(async () => "explicit")).toBe("explicit");
  });
});

describe("auth-settled latch (divergence #8)", () => {
  afterEach(() => {
    __resetAuthTransportForTests();
  });

  it("whenAuthSettled resolves immediately when the latch was never armed", async () => {
    await expect(whenAuthSettled()).resolves.toBeUndefined();
  });

  it("parks callers after arming until markAuthSettled", async () => {
    armAuthLatch();
    let settled = false;
    const waiter = whenAuthSettled().then(() => {
      settled = true;
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(settled).toBe(false);

    markAuthSettled();
    await waiter;
    expect(settled).toBe(true);
  });

  it("is one-shot: re-arming after settle does not close the latch again", async () => {
    armAuthLatch();
    markAuthSettled();
    armAuthLatch();
    await expect(whenAuthSettled()).resolves.toBeUndefined();
  });

  it("markAuthSettled is a safe no-op when the latch was never armed", async () => {
    markAuthSettled();
    await expect(whenAuthSettled()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/config/runtime.test.ts`
Expected: FAIL — `runtime.ts` has no export named `registerAccessTokenGetter` (module resolution error).

- [ ] **Step 3: Implement the registry in `runtime.ts`**

Extend the file header's modifications line (line 2–3) to read:

```ts
// Modifications Copyright 2026 Jenova Marie — runtime-injectable API base URL, the
// email-link redirect origin sent with native-auth email requests, and the auth
// transport registry (token getter / single-flight refresh / boot latch — divergence #8).
```

Append at end of `packages/core/src/config/runtime.ts`:

```ts
// ── Auth transport registry (divergence #8) ──────────────────────────────────
// The Agora server requires a JWT on all content routes (no public reads). The transport
// layer (config/axios.ts, store/api/baseApi.ts) needs the current access token and a way
// to refresh it, but importing the store from here would be circular
// (store → slices → config/axios → runtime), so initializeAuthThunk registers callbacks.

let accessTokenGetter: (() => string | null) | null = null;

/** Register how the transport layer reads the current access token.
 *  Registered by initializeAuthThunk with the live store's getState. */
export function registerAccessTokenGetter(fn: () => string | null): void {
  accessTokenGetter = fn;
}

/** Current access token, or null when signed out / nothing registered yet. */
export function getAccessToken(): string | null {
  return accessTokenGetter ? accessTokenGetter() : null;
}

let tokenRefresher: (() => Promise<string | undefined>) | null = null;

/** Register how the transport layer refreshes the access token. Registered by
 *  initializeAuthThunk (the one place with projectId + dispatch in scope before any
 *  content request can fire). Must resolve undefined when refresh is impossible. */
export function registerTokenRefresher(fn: () => Promise<string | undefined>): void {
  tokenRefresher = fn;
}

export function hasTokenRefresher(): boolean {
  return tokenRefresher !== null;
}

// Single-flight: every 401 handler (the module interceptors in config/axios.ts,
// useAxiosPrivate's hook-level handler, and baseApi's retry) shares ONE in-flight
// refresh, so concurrent 401s can never race concurrent refresh-token rotations
// (the server's reuse detection would revoke the session).
let inflightRefresh: Promise<string | undefined> | null = null;

/** Run one shared token refresh. Concurrent callers get the same promise. Resolves
 *  undefined — never rejects — when no refresher is available or the refresh fails. */
export function refreshAccessToken(
  refresher?: () => Promise<string | undefined>,
): Promise<string | undefined> {
  if (!inflightRefresh) {
    const fn = refresher ?? tokenRefresher;
    if (!fn) return Promise.resolve(undefined);
    inflightRefresh = fn()
      .catch(() => undefined)
      .finally(() => {
        inflightRefresh = null;
      });
  }
  return inflightRefresh;
}

// ── Auth-settled boot latch (divergence #8) ──────────────────────────────────
// Content requests fired during boot (hooks mount and fetch before initializeAuthThunk
// has exchanged the stored refresh token) park here until auth init settles. Default is
// OPEN so core-only usage and tests that never mount a provider are unaffected; the
// providers arm it during render (parents render before children, so this beats any
// child hook's first request effect), and initializeAuthThunk releases it in `finally`.

let authLatch: { promise: Promise<void>; resolve: () => void } | null = null;
let authLatchUsed = false;

/** Arm the boot latch (one-shot per session). Called by the providers during render. */
export function armAuthLatch(): void {
  if (authLatchUsed) return;
  authLatchUsed = true;
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  authLatch = { promise, resolve };
}

/** Release the boot latch (success or failure). Called from initializeAuthThunk's finally. */
export function markAuthSettled(): void {
  authLatch?.resolve();
  authLatch = null;
}

/** Resolves when boot auth has settled — immediately if the latch was never armed. */
export function whenAuthSettled(): Promise<void> {
  return authLatch ? authLatch.promise : Promise.resolve();
}

/** Test-only: clear registered callbacks, any in-flight refresh, and the latch. */
export function __resetAuthTransportForTests(): void {
  accessTokenGetter = null;
  tokenRefresher = null;
  inflightRefresh = null;
  authLatch?.resolve();
  authLatch = null;
  authLatchUsed = false;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/config/runtime.test.ts`
Expected: PASS (all pre-existing `getEmailRedirectTo` tests still green).

- [ ] **Step 5: Reset transport state in the shared test harness**

In `packages/core/src/test-utils/axiosHarness.tsx`, add to the imports:

```ts
import { __resetAuthTransportForTests } from "../config/runtime";
```

and add one line at the top of the existing `resetAxiosMocks()` body:

```ts
export function resetAxiosMocks(): void {
  __resetAuthTransportForTests();
  vi.restoreAllMocks();
  // ... rest unchanged
```

- [ ] **Step 6: Run the whole core suite to check nothing leaks**

Run: `pnpm --filter @agora-sdk/core run test`
Expected: PASS — the registry defaults (open latch, no getter/refresher) are inert.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/config/runtime.ts packages/core/src/config/runtime.test.ts packages/core/src/test-utils/axiosHarness.tsx
git commit -m "feat(core): auth transport registry — token getter, single-flight refresh, boot latch (divergence #8)"
```

---

### Task 2: Module-level auth interceptors in `config/axios.ts`

**Files:**
- Modify: `packages/core/src/config/axios.ts` (full replacement shown below — the file is 25 lines today)
- Test: `packages/core/src/config/axios.test.ts` (append)

**Interfaces:**
- Consumes (Task 1): `getAccessToken`, `whenAuthSettled`, `hasTokenRefresher`, `refreshAccessToken`.
- Produces: `withAuthTransport(instance: AxiosInstance): AxiosInstance` — exported for tests; both singleton instances (`default` export and `axiosPrivate`) now carry the auth interceptors. Response-handler contract relied on by Task 5: it marks `prevRequest.sent = true` before refreshing, and is **transparent** (passes the rejection through untouched) when `hasTokenRefresher()` is false.

**Interceptor ordering facts (do not "fix" them):** axios runs request interceptors LIFO (last registered runs first) and response interceptors FIFO. `withRuntimeBaseUrl` must be applied **before** `withAuthTransport` at create time so `handlers[0]` on the request side stays the base-URL stamper (the existing test asserts this) and the module 401-handler runs before `useAxiosPrivate`'s.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/config/axios.test.ts`. Replace the import block at the top of the file with:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";

import axiosPublic, { axiosPrivate, withAuthTransport } from "./axios";
import {
  getApiBaseUrl,
  registerAccessTokenGetter,
  registerTokenRefresher,
  armAuthLatch,
  markAuthSettled,
  __resetAuthTransportForTests,
} from "./runtime";
import {
  stubAxiosAdapter,
  okAxiosResponse,
  axiosErrorWithStatus,
  type AxiosAdapter,
} from "../test-utils";
```

then append the new describe block:

```ts
describe("withAuthTransport (divergence #8)", () => {
  afterEach(() => {
    __resetAuthTransportForTests();
    vi.restoreAllMocks();
  });

  /** Fresh instance so the module singletons' interceptor arrays stay untouched. */
  function makeInstance(adapter: AxiosAdapter) {
    const instance = withAuthTransport(axios.create());
    stubAxiosAdapter(instance, adapter);
    return instance;
  }

  const okAdapter = () =>
    vi.fn(async (config: InternalAxiosRequestConfig) =>
      okAxiosResponse({ ok: true }, 200, config),
    );

  /** 401s any request not yet retried; succeeds on the retry. */
  const refreshableAdapter = () =>
    vi.fn(async (config: InternalAxiosRequestConfig & { sent?: boolean }) => {
      if (config.sent) return okAxiosResponse({ ok: true }, 200, config);
      throw axiosErrorWithStatus(401, undefined, config);
    });

  it("attaches the registered token to non-auth requests", async () => {
    registerAccessTokenGetter(() => "store-token");
    const adapter = okAdapter();
    const instance = makeInstance(adapter);

    await instance.get("/project-1/entities");

    expect(adapter.mock.calls[0][0].headers.Authorization).toBe("Bearer store-token");
  });

  it("sends no Authorization header when there is no token", async () => {
    const adapter = okAdapter();
    const instance = makeInstance(adapter);

    await instance.get("/project-1/entities");

    expect(adapter.mock.calls[0][0].headers.Authorization).toBeUndefined();
  });

  it("leaves an explicit Authorization header untouched", async () => {
    registerAccessTokenGetter(() => "store-token");
    const adapter = okAdapter();
    const instance = makeInstance(adapter);

    await instance.get("/project-1/entities", {
      headers: { Authorization: "Bearer explicit" },
    });

    expect(adapter.mock.calls[0][0].headers.Authorization).toBe("Bearer explicit");
  });

  it("never attaches the token to /auth/ requests", async () => {
    registerAccessTokenGetter(() => "store-token");
    const adapter = okAdapter();
    const instance = makeInstance(adapter);

    await instance.post("/project-1/auth/sign-in", {});

    expect(adapter.mock.calls[0][0].headers.Authorization).toBeUndefined();
  });

  it("parks non-auth requests on the armed latch while /auth/ requests fly (deadlock guard)", async () => {
    armAuthLatch();
    const adapter = okAdapter();
    const instance = makeInstance(adapter);

    const parked = instance.get("/project-1/entities");
    await new Promise((r) => setTimeout(r, 0));
    expect(adapter).not.toHaveBeenCalled();

    await instance.post("/project-1/auth/request-new-access-token", {});
    expect(adapter).toHaveBeenCalledTimes(1);

    markAuthSettled();
    await parked;
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it("refreshes once and retries with the new token on 401", async () => {
    let token = "stale";
    registerAccessTokenGetter(() => token);
    const refresher = vi.fn(async () => {
      token = "fresh";
      return "fresh" as string | undefined;
    });
    registerTokenRefresher(refresher);
    const adapter = refreshableAdapter();
    const instance = makeInstance(adapter);

    const response = await instance.get("/project-1/entities");

    expect(response.data).toEqual({ ok: true });
    expect(refresher).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[1][0].headers.Authorization).toBe("Bearer fresh");
  });

  it("shares one refresh across concurrent 401s on different instances (single-flight)", async () => {
    registerAccessTokenGetter(() => "stale");
    let resolveRefresh!: (t: string | undefined) => void;
    const refresher = vi.fn(
      () => new Promise<string | undefined>((r) => (resolveRefresh = r)),
    );
    registerTokenRefresher(refresher);
    const instanceA = makeInstance(refreshableAdapter());
    const instanceB = makeInstance(refreshableAdapter());

    const p1 = instanceA.get("/project-1/entities");
    const p2 = instanceB.get("/project-1/comments");
    await new Promise((r) => setTimeout(r, 0));
    expect(refresher).toHaveBeenCalledTimes(1);

    resolveRefresh("fresh");
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.data).toEqual({ ok: true });
    expect(r2.data).toEqual({ ok: true });
  });

  it("rejects with the original 401 when the refresh yields no token", async () => {
    registerTokenRefresher(async () => undefined);
    const instance = makeInstance(refreshableAdapter());

    await expect(instance.get("/project-1/entities")).rejects.toMatchObject({
      response: { status: 401 },
    });
  });

  it("is transparent on 401 when no refresher is registered (does not consume the sent flag)", async () => {
    const adapter = refreshableAdapter();
    const instance = makeInstance(adapter);

    await expect(instance.get("/project-1/entities")).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect((adapter.mock.calls[0][0] as { sent?: boolean }).sent).toBeUndefined();
  });

  it("passes /auth/ 401s through even with a refresher registered (failed sign-in)", async () => {
    const refresher = vi.fn(async () => "fresh" as string | undefined);
    registerTokenRefresher(refresher);
    const instance = makeInstance(refreshableAdapter());

    await expect(instance.post("/project-1/auth/sign-in", {})).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(refresher).not.toHaveBeenCalled();
  });

  it("is installed on both singleton instances", () => {
    // 2 request interceptors each: base-URL stamper (handlers[0], asserted above) + auth.
    for (const instance of [axiosPublic, axiosPrivate]) {
      const req = (instance.interceptors.request as unknown as { handlers: unknown[] }).handlers;
      const res = (instance.interceptors.response as unknown as { handlers: unknown[] }).handlers;
      expect(req.length).toBe(2);
      expect(res.length).toBe(1);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/config/axios.test.ts`
Expected: FAIL — no export named `withAuthTransport`.

- [ ] **Step 3: Implement `withAuthTransport`**

Replace the full contents of `packages/core/src/config/axios.ts` with:

```ts
// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — base URL injected at runtime (see config/runtime.ts)
// and module-level auth transport (divergence #8): the Agora server requires a JWT on all content
// routes, so both instances attach the current access token, park boot-time requests on the auth
// latch, and retry once through the shared single-flight refresh on 401.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.

import axios from "axios";
import {
  getApiBaseUrl,
  getAccessToken,
  whenAuthSettled,
  hasTokenRefresher,
  refreshAccessToken,
} from "./runtime";

// Base URL is read LAZILY per request (the consuming app sets it via <ReplykeProvider baseUrl>),
// so a request interceptor stamps `baseURL` on every call rather than baking it at module load.
const withRuntimeBaseUrl = (instance: ReturnType<typeof axios.create>) => {
  instance.interceptors.request.use((config) => {
    config.baseURL = getApiBaseUrl();
    return config;
  });
  return instance;
};

// /auth/ requests are exempt from the latch AND the 401-refresh: the boot refresh itself flows
// through the public instance BEFORE the latch resolves (gating it would deadlock the SDK), and
// a failed sign-in's 401 must never trigger a refresh.
const isAuthPath = (url: string | undefined): boolean => (url ?? "").includes("/auth/");

/** Agora divergence #8 — token attach + boot latch + reactive 401 refresh, at module level so
 *  hooks on the public instance (and code outside useAxiosPrivate's lifecycle) are covered.
 *  Exported for tests. */
export const withAuthTransport = (instance: ReturnType<typeof axios.create>) => {
  instance.interceptors.request.use(async (config) => {
    if (isAuthPath(config.url)) return config;
    await whenAuthSettled();
    if (!config.headers["Authorization"]) {
      const token = getAccessToken();
      if (token) config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const prevRequest = error?.config;
      if (
        error?.response?.status === 401 &&
        prevRequest &&
        !prevRequest.sent &&
        !isAuthPath(prevRequest.url) &&
        // Transparent until initializeAuthThunk registers a refresher (boot, core-only, tests) —
        // useAxiosPrivate's hook-level handler still owns the retry in that window.
        hasTokenRefresher()
      ) {
        // `sent` is shared with useAxiosPrivate's handler: one refresh+retry per request, ever.
        prevRequest.sent = true;
        const newAccessToken = await refreshAccessToken();
        if (!newAccessToken) return Promise.reject(error);
        prevRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
        return instance(prevRequest);
      }
      return Promise.reject(error);
    },
  );

  return instance;
};

// withRuntimeBaseUrl FIRST so its handler stays request handlers[0] (asserted in tests) and the
// auth request interceptor (LIFO) runs before it; withAuthTransport's response handler then runs
// before useAxiosPrivate's (FIFO).
const axiosInstance = withAuthTransport(withRuntimeBaseUrl(axios.create()));

export const axiosPrivate = withAuthTransport(
  withRuntimeBaseUrl(axios.create({ headers: { "Content-Type": "application/json" } })),
);

export default axiosInstance;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/config/axios.test.ts`
Expected: PASS — including the three pre-existing tests (base-URL stamp via `handlers[0]`, JSON content type, distinct instances).

- [ ] **Step 5: Run the whole core suite**

Run: `pnpm --filter @agora-sdk/core run test`
Expected: PASS. The new module interceptors are inert in existing tests: the latch is unarmed, no getter/refresher is registered (so the request interceptor attaches nothing and the response handler is transparent), and `resetAxiosMocks()` clears interceptors as before. If a test file fails on its FIRST test with an unexpected `Authorization` header or a double-refresh, that test is registering a getter/refresher without resetting — fix the test's `afterEach` to call `resetAxiosMocks()`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/config/axios.ts packages/core/src/config/axios.test.ts
git commit -m "feat(core): module-level JWT attach + boot latch + 401 refresh on both axios instances (divergence #8)"
```

---

### Task 3: Register the transport callbacks in `initializeAuthThunk`

**Files:**
- Modify: `packages/core/src/store/slices/authThunks.ts` (imports, `initializeAuthThunk`, header comment)
- Test: `packages/core/src/store/slices/authThunks.test.ts` (append)

**Interfaces:**
- Consumes (Task 1): `registerAccessTokenGetter`, `registerTokenRefresher`, `markAuthSettled`.
- Produces: after any `initializeAuthThunk` dispatch — in standard AND integration mode — `getAccessToken()` reads the live store and `refreshAccessToken()` dispatches `requestNewAccessTokenThunk` (resolving the new access token, or `undefined` when signed out / refresh fails). The latch is released in `finally`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/store/slices/authThunks.test.ts`. Add to the imports:

```ts
import {
  getAccessToken,
  hasTokenRefresher,
  refreshAccessToken,
  whenAuthSettled,
  armAuthLatch,
} from "../../config/runtime";
```

(No manual `__resetAuthTransportForTests` needed — the file's existing `afterEach` already calls `resetAxiosMocks()`, which Task 1 taught to reset the transport registry.)

Append the describe block:

```ts
describe("initializeAuthThunk — transport wiring (divergence #8)", () => {
  it("registers the access-token getter against the live store", async () => {
    const store = makeReplykeStore();
    mockAxiosPublic();

    await store.dispatch(initializeAuthThunk({ projectId: "project-1" }));

    expect(getAccessToken()).toBeNull();
    store.dispatch(setTokens({ accessToken: "access-9", refreshToken: "refresh-9" }));
    expect(getAccessToken()).toBe("access-9");
  });

  it("registers a refresher that resolves undefined when signed out", async () => {
    const store = makeReplykeStore();
    mockAxiosPublic();

    await store.dispatch(initializeAuthThunk({ projectId: "project-1" }));

    expect(hasTokenRefresher()).toBe(true);
    await expect(refreshAccessToken()).resolves.toBeUndefined();
  });

  it("registers a refresher that exchanges the refresh token and updates the store", async () => {
    const store = makeReplykeStore();
    const axios = mockAxiosPublic();

    await store.dispatch(initializeAuthThunk({ projectId: "project-1" }));

    store.dispatch(setTokens({ accessToken: "stale", refreshToken: "refresh-1" }));
    axios.mockResponse("post", {
      accessToken: "fresh",
      refreshToken: "refresh-2",
      user: { id: "user-1" },
    });

    await expect(refreshAccessToken()).resolves.toBe("fresh");
    expect(store.getState().replyke.auth.accessToken).toBe("fresh");
    expect(axios.calls("post")[0].url).toBe("/project-1/auth/request-new-access-token");
  });

  it("releases the boot latch even when the boot refresh fails", async () => {
    armAuthLatch();
    const store = makeReplykeStore();
    const axios = mockAxiosPublic();
    store.dispatch(setTokens({ accessToken: null, refreshToken: "refresh-1" }));
    axios.mockError("post", 500);

    await store.dispatch(initializeAuthThunk({ projectId: "project-1" }));

    await expect(whenAuthSettled()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/store/slices/authThunks.test.ts`
Expected: the four new tests FAIL (`hasTokenRefresher()` is `false`, `getAccessToken()` stays `null`, the latch test times out or stays pending). All pre-existing tests still PASS.

- [ ] **Step 3: Implement**

In `packages/core/src/store/slices/authThunks.ts`, change the runtime import (currently `import { getEmailRedirectTo } from "../../config/runtime";`) to:

```ts
import {
  getEmailRedirectTo,
  registerAccessTokenGetter,
  registerTokenRefresher,
  markAuthSettled,
} from "../../config/runtime";
```

Extend the header comment's modifications sentence with:

```ts
// ... and initializeAuthThunk wires the auth transport (divergence #8): it registers the
// access-token getter + shared refresher and releases the boot latch in `finally`.
```

Replace `initializeAuthThunk` with:

```ts
export const initializeAuthThunk = createAsyncThunk(
  "auth/initialize",
  async (
    data: { projectId: string; signedToken?: string | null },
    { dispatch, getState }
  ) => {
    // Agora divergence #8: register the transport callbacks HERE — this thunk runs in both
    // standard mode (ReplykeProvider) and integration mode (consumer-owned store), with the
    // live store's getState/dispatch and the projectId in scope, before the boot latch opens.
    registerAccessTokenGetter(
      () => (getState() as RootState).replyke.auth.accessToken
    );
    registerTokenRefresher(async () => {
      const result = await dispatch(
        requestNewAccessTokenThunk({ projectId: data.projectId })
      );
      return requestNewAccessTokenThunk.fulfilled.match(result)
        ? (result.payload as string | undefined)
        : undefined;
    });

    try {
      // Step 1: If we have a signed token, verify external user
      if (data.signedToken) {
        await dispatch(
          verifyExternalUserThunk({
            projectId: data.projectId,
            userJwt: data.signedToken,
          })
        );
      }

      // Step 2: Try to refresh access token
      await dispatch(
        requestNewAccessTokenThunk({ projectId: data.projectId })
      );
    } catch (error) {
      handleError(error, "Auth initialization failed:");
    } finally {
      dispatch(setInitialized(true));
      // Agora divergence #8: release the boot latch — parked content requests may now fly.
      markAuthSettled();
    }
  }
);
```

(The only changes from upstream's body: the `getState` destructure, the two `register*` calls, and `markAuthSettled()` in `finally`. `getState`'s return is `unknown` in this thunk's typing — the `as RootState` cast matches the pattern already used at the top of `signOutThunk`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/store/slices/authThunks.test.ts`
Expected: PASS, including all pre-existing thunk tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/store/slices/authThunks.ts packages/core/src/store/slices/authThunks.test.ts
git commit -m "feat(core): initializeAuthThunk wires the auth transport registry + boot latch (divergence #8)"
```

---

### Task 4: Providers arm the boot latch during render

**Files:**
- Modify: `packages/core/src/context/replyke-context.tsx`
- Modify: `packages/core/src/context/replyke-integration-context.tsx`
- Test: Create `packages/core/src/context/replyke-context.latch.test.tsx`

**Interfaces:**
- Consumes (Task 1): `armAuthLatch`.
- Produces: nothing new — behavioral guarantee that the latch is armed before any child hook's request effect can fire (parents render before children).

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/context/replyke-context.latch.test.tsx`. It lives in its own file because the partial `vi.mock` of `config/runtime` is hoisted file-wide and must not leak into the existing provider tests:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";

vi.mock("../config/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/runtime")>();
  return { ...actual, armAuthLatch: vi.fn() };
});

import { armAuthLatch } from "../config/runtime";
import { ReplykeProvider } from "./replyke-context";
import { ReplykeIntegrationProvider } from "./replyke-integration-context";
import { makeReplykeStore, mockAxiosPublic, resetAxiosMocks } from "../test-utils";

const mockedArm = vi.mocked(armAuthLatch);

afterEach(() => {
  resetAxiosMocks();
});

describe("boot latch arming (divergence #8)", () => {
  it("ReplykeProvider arms the latch during render", () => {
    const axios = mockAxiosPublic();
    axios.mockResponse("get", { id: "project-1", integrations: [] });

    render(
      <ReplykeProvider projectId="project-1">
        <div />
      </ReplykeProvider>,
    );

    expect(mockedArm).toHaveBeenCalled();
  });

  it("ReplykeIntegrationProvider arms the latch during render", () => {
    mockedArm.mockClear();
    mockAxiosPublic();

    render(
      <Provider store={makeReplykeStore()}>
        <ReplykeIntegrationProvider projectId="project-1">
          <div />
        </ReplykeIntegrationProvider>
      </Provider>,
    );

    expect(mockedArm).toHaveBeenCalled();
  });
});
```

Note: if `ReplykeIntegrationProvider`'s props differ from `{ projectId, children }` (check the file — it may also want `signedToken`), adjust the JSX to its actual required props; do not change the provider's props for the test.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/context/replyke-context.latch.test.tsx`
Expected: FAIL — `armAuthLatch` never called.

- [ ] **Step 3: Implement**

In `packages/core/src/context/replyke-context.tsx`, change the runtime import and add one call next to the existing render-time `setApiBaseUrl`:

```tsx
import { setApiBaseUrl, armAuthLatch } from "../config/runtime";
```

`replyke-context.tsx` carries fork edits (the `baseUrl` prop) but no §4(b) header yet — add one at the very top while touching it:

```tsx
// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — runtime-injectable base URL via the `baseUrl` prop
// (divergence #1) and arming the auth boot latch during render (divergence #8).
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
```

```tsx
  // Set the runtime base URL during render so it's in place before useProjectData's effect (and
  // every other hook) fires its first request. Idempotent module-singleton set.
  setApiBaseUrl(baseUrl);
  // Agora divergence #8: arm the auth boot latch during render — parents render before children,
  // so this beats any child hook's first request effect. initializeAuthThunk releases it.
  armAuthLatch();
```

In `packages/core/src/context/replyke-integration-context.tsx`, add the import

```tsx
import { armAuthLatch } from "../config/runtime";
```

and the same two-comment-line + `armAuthLatch();` call as the first statement inside the `ReplykeIntegrationProvider` component body. Since this file is being modified from upstream for the first time, add the header at the very top:

```tsx
// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — arms the auth boot latch during render (divergence #8).
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/context/replyke-context.latch.test.tsx src/context/replyke-context.test.tsx src/context/replyke-integration-context.test.tsx`
Expected: PASS — new test green, existing provider tests untouched.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/context/replyke-context.tsx packages/core/src/context/replyke-integration-context.tsx packages/core/src/context/replyke-context.latch.test.tsx
git commit -m "feat(core): providers arm the auth boot latch during render (divergence #8)"
```

---

### Task 5: `useAxiosPrivate` — no more "Bearer null", shared single-flight

**Files:**
- Modify: `packages/core/src/config/useAxiosPrivate.ts`
- Test: `packages/core/src/config/useAxiosPrivate.test.ts` (append one test; existing tests must stay green unchanged)

**Interfaces:**
- Consumes (Task 1): `refreshAccessToken(fn)` — with the hook's context-bound `requestNewAccessToken` passed explicitly, sharing the global in-flight slot with Task 2's module handler and Task 6's RTK retry.
- Produces: unchanged hook signature `useAxiosPrivate(): AxiosInstance`.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe("useAxiosPrivate", ...)` block in `packages/core/src/config/useAxiosPrivate.test.ts`:

```ts
  it("does not attach a garbage header when signed out (accessToken null)", async () => {
    mockedUseAuth.mockReturnValue({
      accessToken: null,
      requestNewAccessToken: vi.fn(),
    } as never);
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
      okAxiosResponse({ ok: true }, 200, config),
    );
    stubAxiosAdapter(axiosPrivate, adapter);

    renderHook(() => useAxiosPrivate());
    await axiosPrivate.get("/x");

    // Agora divergence (#8): upstream sent "Bearer null" here and relied on the server
    // treating an invalid token as anonymous. The Agora server 401s garbage tokens.
    expect(adapter.mock.calls[0][0].headers.Authorization).toBeUndefined();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/config/useAxiosPrivate.test.ts`
Expected: the new test FAILS with `Authorization` === `"Bearer null"`; all others PASS.

- [ ] **Step 3: Implement**

In `packages/core/src/config/useAxiosPrivate.ts`:

1. Extend the header comment (after the 401-vs-403 paragraph) with:

```ts
// Divergence #8 additions: no "Bearer null" header when signed out (the Agora server 401s
// garbage tokens instead of treating them as anonymous), and the reactive refresh routes
// through the shared single-flight in config/runtime.ts so this handler, the module-level
// one in config/axios.ts, and RTK Query can never race concurrent refresh-token rotations.
```

2. Replace the import of nothing-from-runtime: add

```ts
import { refreshAccessToken } from "./runtime";
```

3. Delete the module-level mutex lines:

```ts
// Module-level mutex: prevents concurrent token rotations from racing
let refreshPromise: Promise<string | undefined> | null = null;
```

4. Replace the request interceptor callback with:

```ts
      (config) => {
        if (config.headers["Authorization"]) return config;
        if (accessToken) config.headers["Authorization"] = `Bearer ${accessToken}`;
        return config;
      },
```

5. In the response interceptor, replace the mutex block

```ts
          // Use mutex to prevent concurrent rotation races
          if (!refreshPromise) {
            refreshPromise = requestNewAccessToken?.()?.finally(() => {
              refreshPromise = null;
            }) ?? Promise.resolve(undefined);
          }

          const newAccessToken = await refreshPromise;
```

with:

```ts
          // Shared single-flight (config/runtime.ts): one refresh at a time process-wide.
          const newAccessToken = await refreshAccessToken(
            () => requestNewAccessToken?.() ?? Promise.resolve(undefined)
          );
```

Everything else (401 trigger, `sent` flag, retry, eject-on-unmount) stays byte-identical.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/config/useAxiosPrivate.test.ts`
Expected: PASS — including the pre-existing concurrent-401 single-refresh test (now backed by the runtime single-flight) and the refresh-failure test.

- [ ] **Step 5: Run the whole core suite**

Run: `pnpm --filter @agora-sdk/core run test`
Expected: PASS. Watch specifically for hook tests that previously observed `"Bearer null"` implicitly (none assert it today, but signed-out fixtures now send no header).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/config/useAxiosPrivate.ts packages/core/src/config/useAxiosPrivate.test.ts
git commit -m "fix(core): useAxiosPrivate — drop 'Bearer null', share the single-flight refresh (divergence #8)"
```

---

### Task 6: RTK Query `baseApi` — latch + 401 refresh-retry

**Files:**
- Modify: `packages/core/src/store/api/baseApi.ts`
- Test: Create `packages/core/src/store/api/baseApi.test.ts`

**Interfaces:**
- Consumes (Task 1): `whenAuthSettled`, `hasTokenRefresher`, `refreshAccessToken`.
- Produces: `dynamicBaseQuery` gains an export (for tests only); `baseApi` behavior otherwise unchanged.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/store/api/baseApi.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import type { BaseQueryApi } from "@reduxjs/toolkit/query";

import { dynamicBaseQuery } from "./baseApi";
import {
  registerTokenRefresher,
  armAuthLatch,
  markAuthSettled,
  __resetAuthTransportForTests,
} from "../../config/runtime";

function makeApi(accessToken: string | null): BaseQueryApi {
  return {
    getState: () => ({ replyke: { auth: { accessToken } } }),
    dispatch: vi.fn(),
    signal: new AbortController().signal,
    abort: vi.fn(),
    extra: undefined,
    endpoint: "test",
    type: "query",
    forced: false,
    queryCacheKey: "test",
  } as never;
}

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  __resetAuthTransportForTests();
  vi.unstubAllGlobals();
});

describe("dynamicBaseQuery (divergence #8)", () => {
  it("retries once through the shared refresh on 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    vi.stubGlobal("fetch", fetchMock);
    const refresher = vi.fn(async () => "fresh" as string | undefined);
    registerTokenRefresher(refresher);

    const result = await dynamicBaseQuery("/x", makeApi("stale"), {});

    expect(refresher).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual({ ok: true });
  });

  it("surfaces the 401 without retrying when no refresher is registered", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "unauthorized" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    const result = await dynamicBaseQuery("/x", makeApi(null), {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.error).toMatchObject({ status: 401 });
  });

  it("surfaces the 401 when the refresh yields no token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "unauthorized" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    registerTokenRefresher(async () => undefined);

    const result = await dynamicBaseQuery("/x", makeApi("stale"), {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.error).toMatchObject({ status: 401 });
  });

  it("parks on the armed boot latch until auth settles", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }, 200));
    vi.stubGlobal("fetch", fetchMock);
    armAuthLatch();

    const pending = dynamicBaseQuery("/x", makeApi(null), {});
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();

    markAuthSettled();
    const result = await pending;
    expect(result.data).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/store/api/baseApi.test.ts`
Expected: FAIL — `dynamicBaseQuery` is not exported.

- [ ] **Step 3: Implement**

In `packages/core/src/store/api/baseApi.ts`:

1. Change the runtime import to:

```ts
import {
  getApiBaseUrl,
  whenAuthSettled,
  hasTokenRefresher,
  refreshAccessToken,
} from "../../config/runtime";
```

2. Extend the header comment (line 2–3) with `; divergence #8: park on the auth boot latch and retry once through the shared refresh on 401`.

3. Replace the `dynamicBaseQuery` definition with:

```ts
// Base URL is injected at runtime (config/runtime.ts), so resolve it per request rather than at
// store-creation time: build fetchBaseQuery on each call with the current base URL. Typed as
// fetchBaseQuery's own return so injected endpoints keep their request/response/meta inference.
// Agora divergence #8: park on the boot latch until auth init settles, and retry once through
// the shared single-flight refresh on 401 (RTK Query had no reactive refresh path of its own).
// Exported for tests.
export const dynamicBaseQuery: ReturnType<typeof fetchBaseQuery> = async (
  args,
  api,
  extraOptions
) => {
  await whenAuthSettled();
  const run = () =>
    fetchBaseQuery({ baseUrl: getApiBaseUrl(), prepareHeaders })(args, api, extraOptions);

  let result = await run();
  if (result.error?.status === 401 && hasTokenRefresher()) {
    const newAccessToken = await refreshAccessToken();
    // prepareHeaders re-reads the rotated token from state on the re-run.
    if (newAccessToken) result = await run();
  }
  return result;
};
```

(`const dynamicBaseQuery` becomes `export const dynamicBaseQuery`; everything below — `createApi`, tag types, exports — is unchanged.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/store/api/baseApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the API-slice test files to check for regressions**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/store/api/`
Expected: PASS — the latch is unarmed and no refresher registered in those suites, so `dynamicBaseQuery`'s additions are inert.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/store/api/baseApi.ts packages/core/src/store/api/baseApi.test.ts
git commit -m "feat(core): RTK Query baseQuery parks on the boot latch and retries once on 401 (divergence #8)"
```

---

### Task 7: Documentation — SYNCING.md #8, CLAUDE.md, CHANGELOG

**Files:**
- Modify: `SYNCING.md` (add divergence #8; update the two count references)
- Modify: `CLAUDE.md` (add #8 to the divergence list; update the two "seven" references)
- Modify: `CHANGELOG.md` (`[Unreleased]` entry)

**Interfaces:** none — prose only. Cross-check file lists against what Tasks 1–6 actually touched before writing.

- [ ] **Step 1: SYNCING.md**

Change the heading `## What diverges from upstream (seven things)` to `(eight things)`. Append after divergence 7's block (before the "Previously diverged, now dissolved" section):

```markdown
8. **JWT-required reads (transport-layer auth)** — hand edits in 7 files (the five transport/auth
   files already carried §4(b) headers, extended; the two provider files are newly marked).
   The Agora server requires a valid JWT on **all content routes** (hard
   sign-in wall — upstream Replyke serves reads publicly); only `/auth/*` and the project-config
   fetch stay unauthenticated. Spec: `docs/superpowers/specs/2026-07-17-jwt-required-reads-design.md`.
   - `core/src/config/runtime.ts`: auth transport registry — access-token getter, token
     refresher, process-wide single-flight refresh mutex, and a boot latch
     (`armAuthLatch`/`markAuthSettled`/`whenAuthSettled`, default open).
   - `core/src/config/axios.ts`: module-level `withAuthTransport` on **both** instances —
     attaches the store token, parks non-`/auth/` requests on the boot latch, retries once
     through the shared refresh on 401. `/auth/` URLs are exempt from the **latch** (the boot
     refresh flows through the public instance before the latch resolves — gating it deadlocks
     the SDK) and from the **401-refresh** (a failed sign-in's 401 must never trigger a refresh),
     but they still **carry the token**: the server puts `requireAuth` on `/auth/change-password`,
     `/auth/request-account-deletion`, and `/auth/confirm-account-deletion`, which the SDK calls
     through the tokenless public instance (they 401'd before this change). Known limitation:
     because the 401-refresh guard stays a blanket `/auth/` match, those authed auth routes get
     the token but not refresh-and-retry — an expired token at call time surfaces the 401.
   - `core/src/store/slices/authThunks.ts`: `initializeAuthThunk` registers the getter/refresher
     (covers standard AND integration mode) and releases the latch in `finally`.
   - `core/src/context/replyke-context.tsx` + `core/src/context/replyke-integration-context.tsx`:
     arm the latch during render (parents render before children ⇒ beats any child fetch effect).
   - `core/src/config/useAxiosPrivate.ts`: no more `"Bearer null"` when signed out; its reactive
     refresh routes through the shared single-flight (the per-request `sent` flag is shared with
     the module-level handler so a 401 is retried at most once).
   - `core/src/store/api/baseApi.ts`: `dynamicBaseQuery` parks on the latch and retries once on
     401 (RTK Query previously had no reactive refresh).

   Server counterpart: content routes flip `optionalAuth` → `requireAuth`; documented in the
   Agora server's `docs/MANIFEST.md`. **Don't drop the interceptors when merging upstream** —
   upstream will keep assuming public reads.
```

Also extend the "Why this stays cheap" paragraph's review-surface sentence to mention the transport files: change `the 2 auth-flow files (divergence #3) and EntityListSortByOptions.ts (divergence #5)` to `the 2 auth-flow files (divergence #3), EntityListSortByOptions.ts (divergence #5), and the transport files (divergence #8: runtime.ts, axios.ts, useAxiosPrivate.ts, baseApi.ts)`.

- [ ] **Step 2: CLAUDE.md**

- Line ~10: `the seven divergences` → `the eight divergences`.
- Line ~20: `(seven total)` → `(eight total)`.
- Append to the numbered divergence list after #7:

```markdown
8. **JWT-required reads / transport-layer auth** (7 files, 5 already diverged): the Agora server
   requires a JWT on all content routes (hard sign-in wall; upstream serves reads publicly).
   `config/runtime.ts` gains a token-getter/refresher registry + single-flight refresh + boot
   latch; `config/axios.ts` attaches the token and retries 401s once on **both** instances
   (`/auth/` URLs are exempt from the latch and the 401-refresh, but still carry the token —
   `change-password` and the account-deletion routes require it server-side);
   `initializeAuthThunk` registers the callbacks and releases the latch;
   both providers arm the latch during render; `useAxiosPrivate` drops `"Bearer null"` and shares
   the single-flight; `baseApi` parks on the latch and retries once on 401. See SYNCING.md #8.
```

- [ ] **Step 3: CHANGELOG.md**

Under `## [Unreleased]` add:

```markdown
### Changed
- **All reads now require a JWT (divergence #8)** — the Agora server hides all content behind a
  bearer token (upstream Replyke serves reads publicly), so the SDK now handles auth at the
  transport layer: both axios instances attach the current access token (covering the ~14 read
  hooks that used the tokenless public instance and previously broke even for signed-in users),
  boot-time requests park on an auth latch until the stored session is restored (fixes a
  first-paint 401 race), all 401 handlers share one single-flight refresh, RTK Query gains a
  401 → refresh → retry path, and `useAxiosPrivate` no longer sends `"Bearer null"` when signed
  out. `/auth/*` requests and the project-config fetch remain unauthenticated. No public API
  changes; apps gate UI on the existing `useAuth()` state. See SYNCING.md #8 and
  `docs/superpowers/specs/2026-07-17-jwt-required-reads-design.md`.
```

- [ ] **Step 4: Commit**

```bash
git add SYNCING.md CLAUDE.md CHANGELOG.md
git commit -m "docs: record divergence #8 — JWT-required reads, transport-layer auth"
```

---

### Task 8: Full verification

**Files:** none new.

- [ ] **Step 1: Full core test suite**

Run: `pnpm --filter @agora-sdk/core run test`
Expected: PASS, zero skips introduced by this work.

- [ ] **Step 2: Build all four packages**

Run: `pnpm run build-all`
Expected: exits 0 (core → react-js → react-native → expo, ESM + CJS each).

- [ ] **Step 3: Typecheck**

Run: `pnpm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Whole-workspace tests**

Run: `pnpm run test`
Expected: PASS (react-js/react-native/expo suites unaffected — they consume core's providers, which behave identically once `initializeAuthThunk` settles).

- [ ] **Step 5: Header audit**

Run: `grep -L "Modified from" packages/core/src/config/runtime.ts packages/core/src/config/axios.ts packages/core/src/config/useAxiosPrivate.ts packages/core/src/store/slices/authThunks.ts packages/core/src/store/api/baseApi.ts packages/core/src/context/replyke-context.tsx packages/core/src/context/replyke-integration-context.tsx`
Expected: no output (every file carries the §4(b) header).

- [ ] **Step 6: Final commit (if any stragglers) and wrap-up**

```bash
git status --short   # expect clean
```

If anything is uncommitted, commit it with an appropriate `feat(core)`/`docs` message referencing divergence #8.
