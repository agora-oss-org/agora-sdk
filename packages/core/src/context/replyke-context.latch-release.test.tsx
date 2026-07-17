import { describe, it, expect, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";

// Deliberately NOT mocking "../config/runtime" here (unlike replyke-context.latch.test.tsx) —
// this test needs the REAL armAuthLatch/markAuthSettled/whenAuthSettled wiring to prove the
// latch actually opens end-to-end, not just that arming was attempted.
import { whenAuthSettled } from "../config/runtime";
import { setInitialized } from "../store/slices/authSlice";
import { ReplykeIntegrationProvider } from "./replyke-integration-context";
import { makeReplykeStore, mockAxiosPublic, resetAxiosMocks } from "../test-utils";

afterEach(() => {
  resetAxiosMocks();
});

/** Races whenAuthSettled() against a short timeout so a wedged latch fails fast instead of
 *  hanging the test run. */
async function raceAuthSettled(timeoutMs = 200): Promise<"settled" | "timeout"> {
  return Promise.race([
    whenAuthSettled().then(() => "settled" as const),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), timeoutMs)),
  ]);
}

describe("boot latch release (divergence #8)", () => {
  it("releases the latch when ReplykeIntegrationProvider mounts over a store where auth is already initialized", async () => {
    const axios = mockAxiosPublic();
    axios.mockResponse("get", { id: "project-1", integrations: [] });

    const store = makeReplykeStore();
    // Simulate auth already bootstrapped before this provider ever mounts (OAuth callback,
    // redux-persist rehydration, etc.) — AuthInitializer's `if (initialized) return;` guard
    // means initializeAuthThunk (and its `finally` that calls markAuthSettled) never runs.
    store.dispatch(setInitialized(true));

    render(
      <Provider store={store}>
        <ReplykeIntegrationProvider projectId="project-1">
          <div />
        </ReplykeIntegrationProvider>
      </Provider>,
    );

    const outcome = await raceAuthSettled();

    expect(outcome).toBe("settled");
  });
});
