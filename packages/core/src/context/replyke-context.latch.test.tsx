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
  mockedArm.mockClear();
});

/**
 * Records, at its OWN render time, how many times armAuthLatch had already been
 * called. Because React renders parents fully before their children, this only
 * observes a nonzero count if the parent armed the latch in its render body —
 * not in a useEffect, which fires after the whole subtree (including this
 * probe) has already rendered once.
 */
function makeArmCountProbe() {
  const observedCounts: number[] = [];
  const Probe = () => {
    observedCounts.push(mockedArm.mock.calls.length);
    return null;
  };
  return { Probe, observedCounts };
}

describe("boot latch arming (divergence #8)", () => {
  it("ReplykeProvider arms the latch synchronously during render, before children render", () => {
    const axios = mockAxiosPublic();
    axios.mockResponse("get", { id: "project-1", integrations: [] });
    const { Probe, observedCounts } = makeArmCountProbe();

    render(
      <ReplykeProvider projectId="project-1">
        <Probe />
      </ReplykeProvider>,
    );

    expect(mockedArm).toHaveBeenCalled();
    // The child probe must have already seen the arm call by the time IT rendered.
    expect(observedCounts.length).toBeGreaterThan(0);
    expect(observedCounts[0]).toBeGreaterThanOrEqual(1);
  });

  it("ReplykeIntegrationProvider arms the latch synchronously during render, before children render", () => {
    mockAxiosPublic();
    const { Probe, observedCounts } = makeArmCountProbe();

    render(
      <Provider store={makeReplykeStore()}>
        <ReplykeIntegrationProvider projectId="project-1">
          <Probe />
        </ReplykeIntegrationProvider>
      </Provider>,
    );

    expect(mockedArm).toHaveBeenCalled();
    expect(observedCounts.length).toBeGreaterThan(0);
    expect(observedCounts[0]).toBeGreaterThanOrEqual(1);
  });
});
