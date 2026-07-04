# `emailRedirectTo` — per-front-end native-auth email links — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The SDK sends an optional `emailRedirectTo` origin on the three native-auth email requests (sign-up, request-password-reset, send-verification-email) so the server's emailed links return the user to the front-end that initiated the request.

**Architecture:** A single resolver, `getEmailRedirectTo()` in `packages/core/src/config/runtime.ts` (the fork-owned runtime-config file), resolves `AGORA_EMAIL_REDIRECT_TO` env var → `window.location.origin` → `undefined`. The three call sites read it lazily at request time and **omit the field entirely** when nothing resolves (server then falls back to its own `AUTH_EMAIL_LINK_BASE`). **No provider prop, no wrapper edits** — this was an explicit decision ("minimal changes since this is a fork and we still merge upstream"): RN/Expo omit the field and get the server default. Server side is already shipped; do not re-implement anything there.

**Tech Stack:** TypeScript, React hooks, Redux Toolkit thunks, axios, vitest + jsdom + `@testing-library/react`, pnpm workspace.

## Global Constraints

- **Minimal diff.** Touch ONLY the files listed in the tasks. Do NOT add a `ReplykeProvider` prop, do NOT edit `core/src/context/replyke-context.tsx`, `react-js/src/index.tsx`, or the react-native/expo wrappers.
- **Env var name:** `AGORA_EMAIL_REDIRECT_TO` — read via the existing `getEnvVar()` in `core/src/utils/env.ts`, which auto-tries the `REACT_APP_` and `VITE_` prefixes. Do not modify `env.ts`.
- **Never send an empty/undefined field.** Use conditional spread `...(emailRedirectTo ? { emailRedirectTo } : {})` (JSON) and `if (emailRedirectTo) formData.append(...)` (FormData). Send the bare origin only — never `window.location.href`.
- **Apache-2.0 §4(b) headers.** Files newly diverging from upstream get the fork's standard 4-line `Modified from the original @replyke/core source.` header; files that already have one get their modification note extended. Never remove an existing header.
- **Changelog discipline (from CLAUDE.md):** every code-change commit must also update `CHANGELOG.md` `## [Unreleased]` — this plan folds all doc bookkeeping into Task 5, immediately after the code tasks, before anything else lands on top.
- **Test environment facts:** vitest runs jsdom with default URL `http://localhost:3000`, so `window.location.origin` **always resolves in tests** — assert against `window.location.origin` (never hardcode). Existing exact-body assertions in the two hook test files will start failing once the field is added; updating them is part of Tasks 3–4. To simulate the RN path use `vi.stubGlobal("window", undefined)` (only AFTER `renderHookWithAxios` has rendered — rendering needs the DOM) and clean up with `vi.unstubAllGlobals()`; env stubs use `vi.stubEnv(...)` + `vi.unstubAllEnvs()`.
- **Commands:** run core tests with `pnpm --filter @agora-sdk/core run test` (or a single file: `pnpm --filter @agora-sdk/core exec vitest run <path relative to packages/core>`). Typecheck with `pnpm run typecheck` from the repo root.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `getEmailRedirectTo()` resolver in `config/runtime.ts`

**Files:**
- Modify: `packages/core/src/config/runtime.ts`
- Create (test): `packages/core/src/config/runtime.test.ts`

**Interfaces:**
- Consumes: `getEnvVar(name: string, defaultValue?: string): string` from `packages/core/src/utils/env.ts` (already exists — auto-tries `REACT_APP_AGORA_EMAIL_REDIRECT_TO` and `VITE_AGORA_EMAIL_REDIRECT_TO` across `process.env` and Vite's `import.meta.env`).
- Produces: `getEmailRedirectTo(): string | undefined` exported from `packages/core/src/config/runtime.ts` — Tasks 2–4 import it from there (relative path `../../config/runtime` from both `store/slices/` and `hooks/auth/`).

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/config/runtime.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { getEmailRedirectTo } from "./runtime";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getEmailRedirectTo", () => {
  it("falls back to window.location.origin when no env var is set", () => {
    expect(getEmailRedirectTo()).toBe(window.location.origin);
  });

  it("prefers the VITE_-prefixed AGORA_EMAIL_REDIRECT_TO env var over the window origin", () => {
    vi.stubEnv("VITE_AGORA_EMAIL_REDIRECT_TO", "https://demo.agora-oss.org");
    expect(getEmailRedirectTo()).toBe("https://demo.agora-oss.org");
  });

  it("also resolves the REACT_APP_-prefixed variant", () => {
    vi.stubEnv("REACT_APP_AGORA_EMAIL_REDIRECT_TO", "https://cra.agora-oss.org");
    expect(getEmailRedirectTo()).toBe("https://cra.agora-oss.org");
  });

  it("returns undefined when there is no env var and no window (RN path)", () => {
    vi.stubGlobal("window", undefined);
    expect(getEmailRedirectTo()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/config/runtime.test.ts`
Expected: FAIL — `runtime.ts` has no export named `getEmailRedirectTo`.

- [ ] **Step 3: Implement the resolver**

In `packages/core/src/config/runtime.ts`:

(a) Extend the modification note on line 2 (keep the rest of the header intact):

```ts
// Modifications Copyright 2026 Jenova Marie — runtime-injectable API base URL and the
// email-link redirect origin sent with native-auth email requests.
```

(b) Add the import at the top (after the header comment block):

```ts
import { getEnvVar } from "../utils/env";
```

(c) Append at the end of the file:

```ts
/** Origin sent as `emailRedirectTo` with sign-up / request-password-reset /
 *  send-verification-email requests, so the server's emailed links return the user to the
 *  front-end that initiated them (multi-front-end deployments). Resolution: the
 *  AGORA_EMAIL_REDIRECT_TO env var (VITE_-/REACT_APP_-prefixed, via getEnvVar) →
 *  window.location.origin → undefined — callers must then OMIT the field so the server
 *  falls back to its own AUTH_EMAIL_LINK_BASE default (never send it empty). */
export function getEmailRedirectTo(): string | undefined {
  const fromEnv = getEnvVar("AGORA_EMAIL_REDIRECT_TO");
  if (fromEnv) return fromEnv;
  if (
    typeof window !== "undefined" &&
    window.location?.origin &&
    window.location.origin !== "null" // opaque origin (sandboxed iframe / file://)
  ) {
    return window.location.origin;
  }
  return undefined;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/config/runtime.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config/runtime.ts packages/core/src/config/runtime.test.ts
git commit -m "✨ feat(auth): add getEmailRedirectTo() runtime resolver (env var → window origin → omit)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: sign-up sends `emailRedirectTo` (JSON body + FormData branch)

**Files:**
- Modify: `packages/core/src/store/slices/authThunks.ts` (the `authService.signUpWithEmailAndPassword` function, ~lines 27–106; both the FormData branch and the JSON fallback)
- Test: `packages/core/src/store/slices/authThunks.test.ts` (extend the existing `signUpWithEmailAndPasswordThunk` describe block)

**Interfaces:**
- Consumes: `getEmailRedirectTo(): string | undefined` from `../../config/runtime` (Task 1).
- Produces: nothing new for later tasks — the sign-up POST body (JSON or FormData) now carries `emailRedirectTo` when a value resolves.

- [ ] **Step 1: Write the failing tests**

In `packages/core/src/store/slices/authThunks.test.ts`:

(a) Add `vi` to the vitest import on line 1:

```ts
import { describe, it, expect, afterEach, vi } from "vitest";
```

(b) Extend the existing `afterEach` (lines 17–19) so a stubbed `window` never leaks between tests:

```ts
afterEach(() => {
  resetAxiosMocks();
  vi.unstubAllGlobals();
});
```

(c) In the existing test `"stores the returned tokens/user and syncs the user slice"`, right after the existing URL assertion (`expect(axios.calls("post")[0].url).toBe("/project-1/auth/sign-up");`), add:

```ts
    expect(axios.calls("post")[0].body).toMatchObject({
      email: "a@b.com",
      emailRedirectTo: window.location.origin,
    });
```

(d) Add two new tests inside the `describe("signUpWithEmailAndPasswordThunk", ...)` block:

```ts
  it("appends emailRedirectTo to the FormData body when uploading an avatar", async () => {
    const store = makeReplykeStore();
    const axios = mockAxiosPublic();
    axios.mockResponse("post", {
      accessToken: "access-1",
      refreshToken: "refresh-1",
      user: { id: "user-1" },
    });

    await store.dispatch(
      signUpWithEmailAndPasswordThunk({
        projectId: "project-1",
        email: "a@b.com",
        password: "secret",
        avatarFile: new Blob(["img"], { type: "image/png" }),
      }),
    );

    const body = axios.calls("post")[0].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("emailRedirectTo")).toBe(window.location.origin);
  });

  it("omits emailRedirectTo when no origin resolves (RN path)", async () => {
    const store = makeReplykeStore();
    const axios = mockAxiosPublic();
    axios.mockResponse("post", {
      accessToken: "access-1",
      refreshToken: "refresh-1",
      user: { id: "user-1" },
    });
    vi.stubGlobal("window", undefined);

    await store.dispatch(
      signUpWithEmailAndPasswordThunk({
        projectId: "project-1",
        email: "a@b.com",
        password: "secret",
      }),
    );
    vi.unstubAllGlobals();

    expect(axios.calls("post")[0].body).not.toHaveProperty("emailRedirectTo");
  });
```

Note: the thunk's input type extends the `authService.signUpWithEmailAndPassword` data shape, which already includes `avatarFile?: File | Blob` — if TypeScript complains about `avatarFile` on the thunk arg, check the thunk's own arg type further down `authThunks.ts` and match its field name exactly (it forwards to the service).

- [ ] **Step 2: Run to verify the new assertions fail**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/store/slices/authThunks.test.ts`
Expected: FAIL — body has no `emailRedirectTo` (first two), FormData `get` returns `null` (second). The omission test may already pass — that's fine; it exists to pin the behavior.

- [ ] **Step 3: Implement**

In `packages/core/src/store/slices/authThunks.ts`:

(a) Extend the modification header (lines 1–5) to mention the new behavior — replace lines 2–4 with:

```ts
// Modifications Copyright 2026 Jenova Marie — sign-out now always clears local auth
// state even if the server revoke fails, signUpWithEmailAndPassword returns a
// SignUpResult instead of void to surface the email-confirmation flow, and sign-up
// sends `emailRedirectTo` so confirmation links return to the originating front-end.
```

(b) Add to the imports (next to the existing `../../config/axios` import):

```ts
import { getEmailRedirectTo } from "../../config/runtime";
```

(c) At the top of `authService.signUpWithEmailAndPassword` (first line of the function body, before the `if (data.avatarFile || data.bannerFile)` check):

```ts
    const emailRedirectTo = getEmailRedirectTo();
```

(d) In the FormData branch, after the `secureMetadata` append (line ~59):

```ts
      if (emailRedirectTo) formData.append("emailRedirectTo", emailRedirectTo);
```

(e) In the JSON fallback body (the object literal at lines ~91–102), after `secureMetadata: data.secureMetadata,`:

```ts
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
```

- [ ] **Step 4: Run the full file to verify everything passes**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/store/slices/authThunks.test.ts`
Expected: PASS (all pre-existing tests plus the new ones).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/store/slices/authThunks.ts packages/core/src/store/slices/authThunks.test.ts
git commit -m "✨ feat(auth): send emailRedirectTo on sign-up (JSON + FormData bodies)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `useRequestPasswordReset` sends `emailRedirectTo`

**Files:**
- Modify: `packages/core/src/hooks/auth/useRequestPasswordReset.ts`
- Test: `packages/core/src/hooks/auth/useRequestPasswordReset.test.ts`

**Interfaces:**
- Consumes: `getEmailRedirectTo(): string | undefined` from `../../config/runtime` (Task 1).
- Produces: the `POST /:projectId/auth/request-password-reset` body gains `emailRedirectTo` when a value resolves. Hook signature unchanged.

- [ ] **Step 1: Write the failing tests**

In `packages/core/src/hooks/auth/useRequestPasswordReset.test.ts`:

(a) Line 1 — add `vi`:

```ts
import { describe, it, expect, afterEach, vi } from "vitest";
```

(b) Extend the `afterEach`:

```ts
afterEach(() => {
  resetAxiosMocks();
  vi.unstubAllGlobals();
});
```

(c) In the first test, replace the body assertion (line 24, `expect(call.body).toEqual({ email: "alice@example.com" });`) with:

```ts
    expect(call.body).toEqual({
      email: "alice@example.com",
      emailRedirectTo: window.location.origin,
    });
```

(d) Add a new test to the describe block:

```ts
  it("omits emailRedirectTo when no origin resolves (RN path)", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() =>
      useRequestPasswordReset(),
    );
    axiosPublic.mockResponse("post", { success: true, message: "Email sent" });

    vi.stubGlobal("window", undefined); // AFTER render — rendering needs the DOM
    await result.current({ email: "alice@example.com" });
    vi.unstubAllGlobals();

    expect(axiosPublic.calls("post")[0].body).toEqual({
      email: "alice@example.com",
    });
  });
```

- [ ] **Step 2: Run to verify the changed assertion fails**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/hooks/auth/useRequestPasswordReset.test.ts`
Expected: FAIL — body is `{ email: "alice@example.com" }` without `emailRedirectTo`.

- [ ] **Step 3: Implement**

In `packages/core/src/hooks/auth/useRequestPasswordReset.ts`:

(a) Add the fork's §4(b) header as the first lines of the file (this file now diverges from upstream):

```ts
// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — sends `emailRedirectTo` so the emailed
// reset link returns the user to the front-end that initiated the request.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
```

(b) Add the import:

```ts
import { getEmailRedirectTo } from "../../config/runtime";
```

(c) Replace the request (lines ~22–25) with:

```ts
      const emailRedirectTo = getEmailRedirectTo();
      const response = await axios.post(
        `/${projectId}/auth/request-password-reset`,
        {
          email: email.trim(),
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
        }
      );
```

- [ ] **Step 4: Run the file to verify it passes**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/hooks/auth/useRequestPasswordReset.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/hooks/auth/useRequestPasswordReset.ts packages/core/src/hooks/auth/useRequestPasswordReset.test.ts
git commit -m "✨ feat(auth): send emailRedirectTo on request-password-reset

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `useSendVerificationEmail` sends `emailRedirectTo`

**Files:**
- Modify: `packages/core/src/hooks/auth/useSendVerificationEmail.ts`
- Test: `packages/core/src/hooks/auth/useSendVerificationEmail.test.ts`

**Interfaces:**
- Consumes: `getEmailRedirectTo(): string | undefined` from `../../config/runtime` (Task 1).
- Produces: the `POST /:projectId/auth/send-verification-email` body gains `emailRedirectTo` when a value resolves. Hook signature and `SendVerificationEmailProps` unchanged (the existing `redirectUrl` prop is upstream's separate field — leave it alone).

- [ ] **Step 1: Write the failing tests**

In `packages/core/src/hooks/auth/useSendVerificationEmail.test.ts`:

(a) Line 1 — add `vi`:

```ts
import { describe, it, expect, afterEach, vi } from "vitest";
```

(b) Extend the `afterEach`:

```ts
afterEach(() => {
  resetAxiosMocks();
  vi.unstubAllGlobals();
});
```

(c) In `"sends a verification email with default (empty) options"`, replace `expect(call.body).toEqual({});` (line 24) with:

```ts
    expect(call.body).toEqual({ emailRedirectTo: window.location.origin });
```

(d) In `"passes mode/tokenFormat/tokenLength/redirectUrl through"`, replace the body assertion (lines 42–47) with:

```ts
    expect(call.body).toEqual({
      mode: "link",
      tokenFormat: "alphanumeric",
      tokenLength: 32,
      redirectUrl: "https://app.example.com/verify",
      emailRedirectTo: window.location.origin,
    });
```

(e) Add a new test to the describe block:

```ts
  it("omits emailRedirectTo when no origin resolves (RN path)", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() =>
      useSendVerificationEmail(),
    );
    axiosPublic.mockResponse("post", { success: true });

    vi.stubGlobal("window", undefined); // AFTER render — rendering needs the DOM
    await result.current();
    vi.unstubAllGlobals();

    expect(axiosPublic.calls("post")[0].body).toEqual({});
  });
```

- [ ] **Step 2: Run to verify the changed assertions fail**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/hooks/auth/useSendVerificationEmail.test.ts`
Expected: FAIL — bodies lack `emailRedirectTo`.

- [ ] **Step 3: Implement**

In `packages/core/src/hooks/auth/useSendVerificationEmail.ts`:

(a) Add the §4(b) header as the first lines of the file:

```ts
// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — sends `emailRedirectTo` so the emailed
// confirmation link returns the user to the front-end that initiated the request.
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
```

(b) Add the import:

```ts
import { getEmailRedirectTo } from "../../config/runtime";
```

(c) Replace the request (lines ~21–24) with:

```ts
      const emailRedirectTo = getEmailRedirectTo();
      const response = await axios.post(
        `/${projectId}/auth/send-verification-email`,
        {
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
          ...props,
        }
      );
```

(Spreading `props` last keeps caller-supplied fields authoritative; `{ ...undefined }` is a legal no-op so the `props ?? {}` fallback is no longer needed.)

- [ ] **Step 4: Run the file to verify it passes**

Run: `pnpm --filter @agora-sdk/core exec vitest run src/hooks/auth/useSendVerificationEmail.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/hooks/auth/useSendVerificationEmail.ts packages/core/src/hooks/auth/useSendVerificationEmail.test.ts
git commit -m "✨ feat(auth): send emailRedirectTo on send-verification-email

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: fork bookkeeping (CHANGELOG, SYNCING.md #6, CLAUDE.md, README) + full verification

**Files:**
- Modify: `CHANGELOG.md` (repo root — `## [Unreleased]` section, currently at line 12)
- Modify: `SYNCING.md` (repo root — "What diverges from upstream" section)
- Modify: `CLAUDE.md` (repo root — the divergence list in "⚠️ This is a fork of Replyke")
- Modify: `README.md` (repo root — configuration section ~line 55 and the fork-divergence summary ~line 156)

**Interfaces:**
- Consumes: the shipped behavior from Tasks 1–4 (documentation of it).
- Produces: nothing for later tasks — this is the final task.

- [ ] **Step 1: Add the CHANGELOG entry**

In `CHANGELOG.md`, under `## [Unreleased]` (before the existing `### Changed` group), add:

```markdown
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
```

- [ ] **Step 2: Document divergence #6 in SYNCING.md**

(a) Change the heading on line 17 from `## What diverges from upstream (five things)` to:

```markdown
## What diverges from upstream (six things)
```

(b) After item 5 (the feed-ranking entry, ends line ~84, just before `### Previously diverged, now dissolved into upstream`), add:

```markdown
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
```

(c) In item 3's intro (line ~59, "Unlike #1 and #2, these are genuine behavioral forks…") no change is needed, but check that nothing else in the file says "five" — `grep -n "five" SYNCING.md` and fix any stragglers to "six".

- [ ] **Step 3: Update CLAUDE.md's divergence list**

In the repo-root `CLAUDE.md`:

(a) Change `**The only things that diverge from upstream — keep edits within these, don't add new fork points (five total):**` to `(six total):`.

(b) After item 5 (feed-ranking algorithms), add:

```markdown
6. **`emailRedirectTo` passthrough** (4 files — `core/src/config/runtime.ts`,
   `store/slices/authThunks.ts`, `hooks/auth/useRequestPasswordReset.ts`,
   `hooks/auth/useSendVerificationEmail.ts`, each carrying/extending the `Modified from the
   original @replyke/core source.` header): the three native-auth email requests send an
   `emailRedirectTo` origin (resolved by `getEmailRedirectTo()`: `AGORA_EMAIL_REDIRECT_TO` env var
   → `window.location.origin` → omitted) so emailed links return to the originating front-end.
   Additive; no `ReplykeProvider` prop by design. See SYNCING.md #6.
```

(c) Also fix the stale claim `There is no test suite or linter wired up in this repo.` — replace with:

```markdown
`pnpm --filter @agora-sdk/core run test` runs the core vitest suite (jsdom); `pnpm run test` runs
every package's. There is no linter wired up.
```

- [ ] **Step 4: Document the env var in README.md**

(a) In the configuration section, directly after the `baseUrl` paragraph (line ~55, the one starting `The SDK points at your Agora server through \`getApiBaseUrl()\`…`), add:

```markdown
For projects on **native auth**, the SDK also sends an `emailRedirectTo` origin with sign-up,
password-reset, and resend-verification requests so the server's emailed links return the user to
the front-end they were on — useful when several front-ends share one API. It resolves
automatically to `window.location.origin` on web; to override it (or on the rare web setup where
the link origin differs from the serving origin), set the **`AGORA_EMAIL_REDIRECT_TO`** env var
with your bundler's public prefix — `VITE_AGORA_EMAIL_REDIRECT_TO` (Vite) or
`REACT_APP_AGORA_EMAIL_REDIRECT_TO` (CRA). When neither resolves (React Native / Expo), the field
is omitted and the server uses its own `AUTH_EMAIL_LINK_BASE` default. Servers with
`AUTH_EMAIL_LINK_ALLOWED_ORIGINS` configured reject unknown origins with
`400 auth/email-redirect-not-allowed` — add the front-end's exact origin to that allowlist.
```

(b) Update the stale fork-divergence summary (line ~156) — it currently says "the four **fork divergences**" and lists them; reword to include the new one (and the entity-include one if it's also missing), e.g.:

```markdown
- the **fork divergences** from upstream Replyke — the `@agora-sdk/*` scope, the injected `baseUrl`
  prop, the `SignUpResult` signup flow, the entity `include` passthrough, the extra feed-ranking
  modes (`decay` / `gravity` / `wilson` / `bayesian`), and the `emailRedirectTo` email-link origin
  (auto-detected on web, `AGORA_EMAIL_REDIRECT_TO` env-var override). See [SYNCING.md](SYNCING.md).
```

Match the exact surrounding list formatting when applying — the goal is that the summary names all six divergences, not a specific wording.

- [ ] **Step 5: Full verification**

```bash
pnpm --filter @agora-sdk/core run test
pnpm run typecheck
```

Expected: all core tests PASS; typecheck clean. If typecheck requires built packages, run `pnpm run build-all` first.

- [ ] **Step 6: Commit**

```bash
git add CHANGELOG.md SYNCING.md CLAUDE.md README.md
git commit -m "📝 docs: record emailRedirectTo as fork divergence #6, document AGORA_EMAIL_REDIRECT_TO

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Spec deviations (agreed with the user, 2026-07-03)

- **No `ReplykeProvider` prop** (spec §3.3 dropped): resolution is env var → window origin only. RN/Expo omit the field and get the server's `AUTH_EMAIL_LINK_BASE`. Rationale: minimal upstream-merge surface; the prop can be layered on later purely additively (`prop → env → window`).
- **Env var added** (not in the spec): `AGORA_EMAIL_REDIRECT_TO`, per user request, read through the existing `getEnvVar()` helper.
- Spec §4's "surface `400 auth/email-redirect-not-allowed` clearly": the existing `handleError` util already extracts `response.data.error` into thrown messages, and the two hooks rethrow the axios error with `response.data.code` intact — no extra code, deliberately.
