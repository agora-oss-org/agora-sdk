import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The testable surface here is plain async functions (the Keychain
    // storage adapter), not a rendered UI tree, so no DOM environment.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
