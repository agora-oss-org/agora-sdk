# OAuth authentication — integration notes & black-boxing proposals

A field report written while wiring the live comments widget into **`agora-www`** — the marketing
site, a static **Astro multi-page app (MPA)**, distinct from the `agora-demo` SPA harness. It records
the auth integration that eventually worked, the two failure modes we burned an afternoon on, and
concrete proposals to make the OAuth flow **black-box** so the next integrator doesn't repeat them.

Observed against **`@agora-sdk/core@1.3.0`** + **`@agora-sdk/react-js@1.3.0`** (the built output in
`node_modules`; source paths below are the corresponding `packages/*/src`).

---

## TL;DR

Email/password auth is genuinely black-box: call the hook, `await`, done. **OAuth is not** — it
leaks two internal invariants the caller has to reverse-engineer:

1. **`handleOAuthCallback()` is fire-and-forget with deferred persistence.** It stages tokens in
   Redux, kicks off an *async* user fetch, and returns `true` synchronously — but the session isn't
   written to `localStorage` until `useAccountSync`'s effects run *several render cycles later*. Any
   caller that navigates right after the call (the obvious thing to do, and what the JSDoc example
   implies is safe) **destroys the React tree before persistence runs and silently loses the freshly
   minted session.** This only bites cross-document (MPA) integrations; the SPA demo never navigates,
   so it never sees it.

2. **`useAuth().signOut()` doesn't reliably end the session.** With more than one stored account it
   "switches to a remaining account" instead of logging out, and can't clear a stale/corrupt
   accounts map. `useSignOutAll()` is the real logout, but nothing signals that the active-account
   variant is the wrong default for a single-session app.

Both are fixable in app code (we did), but neither *should* require reading the SDK source. Proposals
in §7.

---

## 1. The integration shape is the whole story (MPA vs SPA)

The SDK's only worked example is `agora-demo`, a **Vite SPA**:

- `Login.tsx` → `initiateOAuth({ provider: "github", redirectAfterAuth: window.location.origin })`
  — the provider returns to the **app's own origin**, i.e. the same document.
- `Shell.tsx` calls `handleOAuthCallback()` once on mount and **never navigates**. `ReplykeProvider`
  stays mounted for the entire flow; when the async user fetch resolves and `useAccountSync` persists,
  the auth gate (`if (!accessToken) return <Login/>`) simply re-renders into the app.

Because the provider is never torn down, the deferred-persistence behavior is invisible — the effects
always get their cycles.

`agora-www` is an **Astro MPA**, and the natural OAuth shape there is different:

- `initiateOAuth({ ..., redirectAfterAuth: \`${origin}/auth/callback\` })` → a **dedicated callback
  document** (`/auth/callback`), separate from the homepage that hosts the thread.
- The callback page parses the tokens, then **full-page-navigates** (`window.location.replace('/')`)
  back to the thread.

That cross-document hop is a hard teardown of the React tree + Redux store between "tokens received"
and "thread mounts." **Every problem below lives in that gap** — a gap the SPA shape doesn't have.
This MPA shape is completely ordinary (Next.js `app/auth/callback/page.tsx`, Remix routes, SvelteKit,
any SSR/MPA framework all land here), so it deserves first-class support.

---

## 2. Symptom

Clicking "Continue with GitHub/Google" ran the full provider round-trip and returned the user to the
homepage **logged out**. No error surfaced in the UI — the auth panel just re-appeared as if nothing
happened.

---

## 3. Diagnostic fingerprint (server logs)

The server log of one failed attempt — useful as a reproduction signature:

```
POST /v7/<proj>/oauth/authorize             → 200    ✅ initiateOAuth
GET  /v7/<proj>/oauth/callback              → 302    ✅ provider returned, tokens minted & redirected
POST /v7/<proj>/auth/request-new-access-token → 401   ❌ "auth: refresh rejected — unknown token"
POST /v7/<proj>/auth/request-new-access-token → 401   ❌ "auth: refresh rejected — unknown token"
   ...auth: refresh rotated  {profileId: ...}          ✅ a DIFFERENT refresh token succeeds
POST /v7/<proj>/auth/request-new-access-token → 200
```

The handshake itself (`authorize` → provider → `callback`) **succeeds**. The tell is the
`unknown token` 401s afterward: **two different refresh tokens are in play** — a stale one
(rejected) racing the fresh OAuth one. The lone rotated `200` is the *dying callback document's* own
thunk completing into a tree that's already being torn down; its rotated replacement token is never
saved. Net: the user lands on a page whose only persisted credential is the stale account → 401 →
logged out.

---

## 4. Root cause #1 — the persist → navigate race

### What `handleOAuthCallback()` actually does

`react-js/src/hooks/useOAuthSignIn.ts` → `handleOAuthCallback()` delegates to
`core/src/hooks/auth/oauthCore.ts` → `handleOAuthRedirect()`, whose success path is:

```ts
dispatch(setTokens({ accessToken, refreshToken }));   // 1. Redux (in-memory) only
dispatch(setInitialized(true));
if (projectId) dispatch(requestNewAccessTokenThunk({ projectId })); // 2. ASYNC, NOT awaited
return { success: true, error: null };                 // 3. returns synchronously
```

So on return, the tokens exist **only in the Redux store**. The user profile is still being fetched
over the network (the `request-new-access-token` call — ~1.4s in our logs).

### Where persistence actually happens

Persistence is owned by a *different component* reacting to that state via effects —
`core/src/hooks/auth/useAccountSync.ts` (mounted by `AccountManager`):

- **Phase B** upserts the account entry, but guards on `refreshToken && user?.id` — it can't run until
  the async user fetch from step 2 *resolves and dispatches `setUser`*.
- **Phase C** writes the map to `localStorage` on a *further* render triggered by Phase B's dispatch.

So the write to storage lands **two-plus render cycles** after `handleOAuthCallback()` returns, gated
on a network round-trip.

### The race

The MPA callback page does the obvious thing:

```tsx
const ok = handleOAuthCallback();
if (ok) window.location.replace('/');   // fires ~0ms later
```

`window.location.replace` tears down the React tree + Redux store **while the user fetch is still in
flight** — long before Phase B/C can persist. The fresh session never reaches `localStorage`. The
homepage boots, `useAccountSync` Phase A loads the only thing in storage (a stale account from a prior
session), and refreshes with it → `unknown token` 401 → logged out.

**Why the demo is immune:** it never navigates, so the provider lives long enough for the effects to
fire. The bug is latent in the SDK and only observable across a document boundary.

### The trap in the docs

`react-js/src/hooks/useOAuthSignIn.ts` JSDoc says:

```
* On the callback page (component mount):
*   useEffect(() => { handleOAuthCallback(); }, []);
```

That's correct *only* if you never unmount the provider afterward. It reads as "call it on the
callback page and you're done," which is precisely the cross-document case where you must **not**
navigate until persistence completes.

---

## 5. Root cause #2 — stale accounts & `signOut()` not ending the session

The accounts map is multi-account (`localStorage["replyke-accounts:<projectId>"]`, shape
`{ activeAccountId, accounts: { [userId]: { refreshToken, tokenExpiresAt, user } } }`). Two
consequences bit us:

- **Stale entries are sticky.** A refresh token whose server-side family has expired/rotated away
  stays in the map and throws `unknown token` 401 every time it becomes active. There's no built-in
  prune-on-failure.
- **`useAuth().signOut()` is active-account-only.** Per `core/src/hooks/auth/useRemoveAccount.ts`,
  removing the active account "switches to a remaining account" and re-authenticates with *its*
  refresh token rather than ending the session — so with a leftover stale account, "Sign out" can
  hop onto the dead account instead of logging out, and never clears a corrupt map.

`useSignOutAll()` (→ `signOutAllThunk`, wipes the whole map) is the reliable logout. The demo's
`Shell.tsx` already uses it and documents why — but a first-time integrator reaches for the obvious
`useAuth().signOut()` first.

---

## 6. The system that eventually worked

Two app-side changes. Neither touches the SDK; both compensate for the invariants above.

### 6.1 Gate the cross-document navigation on actual persistence

Instead of navigating on `handleOAuthCallback()`'s synchronous return, wait until the session is
**actually in `localStorage`** (the exact state the next document reads on boot). Deterministic — no
arbitrary timeout.

```tsx
function Callback({ projectId }: { projectId: string }) {
  const { handleOAuthCallback, error } = useOAuthSignIn();
  const { accessToken } = useAuth();
  const { user } = useUser();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  // 1) Parse tokens once. This only stages them + starts the async user fetch.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!handleOAuthCallback()) setFailed(true);
  }, [handleOAuthCallback]);

  // 2) Navigate ONLY after the SDK has persisted the account to localStorage.
  useEffect(() => {
    if (failed || !accessToken || !user?.id) return; // user fetch still in flight
    let cancelled = false;
    const key = `replyke-accounts:${projectId}`;
    const go = () => {
      if (cancelled) return;
      try {
        const map = JSON.parse(localStorage.getItem(key) ?? 'null');
        if (map?.accounts?.[user.id]?.refreshToken) return window.location.replace('/#comments');
      } catch { /* retry */ }
      requestAnimationFrame(go);
    };
    go();
    return () => { cancelled = true; };
  }, [accessToken, user, projectId, failed]);
  // ...spinner / error UI
}
```

**This reaches into SDK internals** — the storage key prefix and the map shape — which is exactly the
coupling §7 asks the SDK to remove.

### 6.2 Use `signOutAll()` for logout

```tsx
const { signOutAll } = useSignOutAll();
// ...
<button onClick={() => void signOutAll().catch(() => {})}>Sign out</button>
```

Reliable full logout; also the recovery path for an already-corrupt map.

---

## 7. Proposals to make OAuth black-box

Tagged per `PROPOSED.md` conventions. The goal: an MPA integrator should never touch `localStorage`
keys, count render cycles, or read `useAccountSync`.

### P1 — Make `handleOAuthCallback()` awaitable, resolving *after* persistence 🔴 · Priority: High · Effort: Small

Return a `Promise<{ success, error }>` that resolves only once the user fetch **and** the
`localStorage` write have completed. Then the entire MPA callback page collapses to the thing everyone
already tries to write:

```tsx
useEffect(() => {
  handleOAuthCallback().then(r => window.location.replace(r.success ? '/' : '/?authError=1'));
}, []);
```

This is the single highest-leverage change — it dissolves Root cause #1 entirely and removes the
internal-coupling in §6.1. (Keep the sync return as a deprecated overload for compatibility.)

### P2 — Don't make persistence depend on a separately-mounted effect chain 🔴 · Priority: High · Effort: Medium

Persistence currently requires `AccountManager`/`useAccountSync` to be mounted *and* to survive
several post-dispatch render cycles. Persist within the auth thunk/dispatch path (via an injected
storage adapter) so a session is durable the instant it's established, independent of component
lifecycle. Removes the teardown race at the root rather than asking callers to wait it out.

### P3 — Ship a first-class MPA callback helper 🟢 · Priority: Medium · Effort: Small

A headless helper / component that does the right thing for the cross-document case:

```tsx
<OAuthCallbackHandler onSuccess={() => location.replace('/')} onError={(e) => /* ... */} />
// or: const { status } = useOAuthCallback({ redirectTo: '/' });  // 'pending' | 'success' | 'error'
```

Internally awaits P1. Gives Next.js/Remix/Astro integrators a copy-paste path with no internals.

### P4 — Expose an explicit auth-ready signal 🟢 · Priority: Medium · Effort: Small

`signedIn = Boolean(accessToken && user)` is a derived guess every integrator re-derives. Expose a
first-class `status: 'initializing' | 'authenticated' | 'unauthenticated'` (and/or `isPersisted`) so
gating UI and navigation doesn't depend on reading two slices and knowing they settle on different
ticks.

### P5 — Clarify `signOut()` vs `signOutAll()` 🟢 · Priority: Medium · Effort: Small

The active-account-only switch behavior of `useAuth().signOut()` is surprising as the default
"log out" verb. Options: make the single-session case the obvious default, rename for intent
(`switchAwayFromActiveAccount`), and/or document the multi-account model where the hook is first
encountered. At minimum, cross-link `useSignOutAll` from `useAuth`.

### P6 — Self-heal stale accounts 🟢 · Priority: Low · Effort: Small

When a stored refresh token is rejected `unknown token`, prune that account from the map instead of
leaving it to throw on every activation. Eliminates the boot-time 401 for a returning user whose only
session has gone stale.

### P7 — Fix the docs trap 🟢 · Priority: High · Effort: Tiny

The `useOAuthSignIn` JSDoc example implies it's safe to navigate immediately after
`handleOAuthCallback()`. Until P1 lands, the example should explicitly warn that the call is
fire-and-forget with deferred persistence and that **cross-document navigation must wait** for the
authenticated/persisted state — with the MPA pattern from §6.1 shown.

---

## Appendix — source references

| Concern | File |
| --- | --- |
| Web OAuth hook + JSDoc trap (§4) | `packages/react-js/src/hooks/useOAuthSignIn.ts` |
| Fire-and-forget token handling (§4) | `packages/core/src/hooks/auth/oauthCore.ts` → `handleOAuthRedirect` |
| Deferred persistence (Phases A–D) (§4) | `packages/core/src/hooks/auth/useAccountSync.ts` |
| Storage key + map shape (§6.1) | `packages/react-js/src/AccountManager.tsx` |
| Active-account-only sign-out (§5) | `packages/core/src/hooks/auth/useRemoveAccount.ts` |
| Reliable full logout (§5, §6.2) | `packages/core/src/hooks/auth/useSignOutAll.ts` |
| SPA reference integration | `agora-demo/src/Login.tsx`, `agora-demo/src/Shell.tsx` |
| MPA integration that worked | `agora-www/src/components/comments/OAuthCallback.tsx`, `.../Thread.tsx` |
