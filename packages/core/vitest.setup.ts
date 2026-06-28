import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// `@testing-library/react`'s auto-cleanup only self-registers when it detects
// a *global* `afterEach` (e.g. via vitest's `globals: true`). This config
// doesn't set that, and every test file imports `afterEach` locally instead —
// so without this, no rendered tree is ever unmounted between tests. Hooks
// that attach long-lived listeners (e.g. `useAccountSync`'s
// `window.addEventListener("storage", ...)`) leak across test files as a
// result: a still-mounted component from an earlier test reacts to state
// changes triggered by a later one, often against mocks that test's own
// `afterEach` has already torn down.
afterEach(() => {
  cleanup();
});
