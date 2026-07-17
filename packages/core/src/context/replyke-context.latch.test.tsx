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
