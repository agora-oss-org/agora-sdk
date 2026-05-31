# Authentication

After `ReplykeProvider` mounts, users are **unauthenticated by default**. Authenticate via any combination of: built-in email/password, OAuth, or external JWT (`signedToken` prop). Multi-account switching is built in on every platform.

The primary hook is `useAuth()` (`@agora-sdk/core`, re-exported by every platform package). Its `UseAuthValues` return:

```ts
{
  initialized: boolean;                 // false until session restore is attempted — gate UI on this
  accessToken: string | null;
  refreshToken: string | null;
  setRefreshToken: (t) => void;
  signUpWithEmailAndPassword: (props) => Promise<SignUpResult>;   // ⚠️ see below
  signInWithEmailAndPassword: (props) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (props) => Promise<void>;
  requestNewAccessToken: () => Promise<string | undefined>;
}
```

## ⚠️ `SignUpResult` (Agora divergence — get this right or signup breaks)

Upstream Replyke's `signUpWithEmailAndPassword` resolves to `void`. **Agora returns a discriminated union** because the server may require email confirmation:

```ts
export type SignUpResult =
  | { status: "signed_in"; user: any }            // auto-confirm: tokens + user already in state
  | { status: "confirmation_required"; email: string };  // user created but NOT signed in
```

Handle both branches — when confirmation is required the thunk does **not** set tokens/user; show a "check your email" state and let the user sign in after clicking the emailed link:

```tsx
const { signUpWithEmailAndPassword } = useAuth();

async function onSubmit(form) {
  try {
    const result = await signUpWithEmailAndPassword({
      email: form.email,
      password: form.password,
      username: form.username,   // optional; also: name, avatar, bio, location,
                                 // birthdate, metadata, secureMetadata, avatarFile, bannerFile
    });

    if (result.status === "confirmation_required") {
      showCheckYourEmail(result.email);   // do NOT treat as signed in
    } else {
      // result.status === "signed_in" — user is authenticated, tokens are in state
      goToApp();
    }
  } catch (e) {
    showError(e.message);   // hook throws on rejected thunk
  }
}
```

`SignUpWithEmailAndPasswordProps` accepts: `email`, `password`, and optional `name`, `username`, `avatar`, `bio`, `location {latitude, longitude}`, `birthdate`, `metadata`, `secureMetadata`, `avatarFile`/`avatarOptions`, `bannerFile`/`bannerOptions`.

## Sign-in / sign-out / change password

```tsx
await signInWithEmailAndPassword({ email, password });   // resolves void; throws on failure
await changePassword({ password, newPassword });
await signOut();
```

**Sign-out behavior (Agora divergence):** `signOut()` always clears local auth state even if the server-side token revoke fails (e.g. a 401 from a stale refresh token). Upstream bailed on a failed revoke and left the user "signed in" locally with a dead token. So treat `signOut()` as reliably ending the local session.

## OAuth (web — `@agora-sdk/react-js`)

Redirect-based flow via `useOAuthSignIn()` → `UseOAuthSignInReturn`:

```tsx
import { useOAuthSignIn } from "@agora-sdk/react-js";

// On a sign-in button:
const { initiateOAuth, linkOAuthProvider, handleOAuthCallback, isLoading, error } = useOAuthSignIn();
await initiateOAuth({ provider: "google", redirectAfterAuth: "https://myapp.com/auth/callback" });

// Link a provider to the already-authenticated user instead:
await linkOAuthProvider({ provider: "github", redirectAfterAuth: "https://myapp.com/settings" });

// On the callback page, extract tokens from the URL fragment on mount:
useEffect(() => { handleOAuthCallback(); }, []);
```

Providers: `google`, `github`, `apple`, `facebook` (per server config). `redirectAfterAuth` defaults to `window.location.href`. The OAuth host is resolved from the injected `baseUrl` at call time — another reason to set `baseUrl` correctly.

## Multi-account

All platforms support several simultaneous signed-in accounts with switching. Hooks (from core): `useAccounts()`, `useSwitchAccount()`, `useAddAccount()`, `useRemoveAccount()`, `useSignOutAll()`, plus `useAccountSync()` (the persistence engine — usually implicit). Storage is per-platform: `localStorage` (web) / Keychain (RN) / SecureStore (Expo), keyed `replyke-accounts:{projectId}`. For these hooks' exact return shapes, see [api-surface.md](api-surface.md) › Multi-account, or offline `cat node_modules/@agora-sdk/core/dist/esm/hooks/auth/index.d.ts`.

> Account-corruption guard (Agora divergence): `useAccountSync` only persists an account when the access token's `sub` claim matches the current `user.id`, avoiding a window during OAuth where two account ids could share one refresh token. You don't call anything differently — just know switching/sign-out are reliable because of it.

## External auth & dev tokens

- **External JWT:** pass `signedToken` to `ReplykeProvider` to authenticate users from your own auth system. Prose at MCP/docs `/v7/authentication` (upstream — same flow in Agora).
- **Dev only:** `useSignTestingJwt()` mints a JWT for local testing. **Never ship it to production.**

Other auth hooks: `useRequestPasswordReset()`, `useSendVerificationEmail()`, `useVerifyEmail()`, `useOAuthIdentities()`.
