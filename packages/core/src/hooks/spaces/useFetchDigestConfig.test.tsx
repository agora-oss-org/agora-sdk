import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks } from "../../test-utils";
import useFetchDigestConfig from "./useFetchDigestConfig";
import type { DigestConfig } from "../../interfaces/models/Space";

afterEach(() => {
  resetAxiosMocks();
});

function makeConfig(overrides: Partial<DigestConfig> = {}): DigestConfig {
  return {
    digestEnabled: true,
    digestWebhookUrl: "https://example.com/webhook",
    digestWebhookSecret: "••••••••",
    digestScheduleHour: 9,
    digestTimezone: "UTC",
    ...overrides,
  };
}

describe("useFetchDigestConfig", () => {
  it("fetches the digest config for a space", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useFetchDigestConfig());

    const config = makeConfig();
    axiosPrivate.mockResponse("get", config);

    let returned: DigestConfig | undefined;
    await act(async () => {
      returned = await result.current({ spaceId: "space-1" });
    });

    expect(returned).toEqual(config);

    const [call] = axiosPrivate.calls("get");
    expect(call.url).toBe("/test-project/spaces/space-1/digest-config");
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useFetchDigestConfig());

    axiosPrivate.mockError("get", 403, { message: "Forbidden" });

    await expect(
      result.current({ spaceId: "space-1" }),
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  it("throws before making a request when no space ID is passed", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useFetchDigestConfig());

    await expect(result.current({ spaceId: "" })).rejects.toThrow(
      "Please pass a spaceId",
    );
    expect(axiosPrivate.calls("get")).toHaveLength(0);
  });
});
