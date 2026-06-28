import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// See packages/core/vitest.setup.ts for why this is needed: this config
// doesn't set `globals: true`, so `@testing-library/react`'s auto-cleanup
// never self-registers and rendered trees leak across test files.
afterEach(() => {
  cleanup();
});
