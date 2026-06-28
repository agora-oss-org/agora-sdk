import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { renderHookWithAxios, resetAxiosMocks } from "../../test-utils";
import useUpdateDigestConfig from "./useUpdateDigestConfig";
import type { DigestConfig } from "../../interfaces/models/Space";

afterEach(() => {
  resetAxiosMocks();
});

describe("useUpdateDigestConfig", () => {
  it("updates the digest config for a space", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUpdateDigestConfig());

    const updated: DigestConfig = {
      digestEnabled: true,
      digestWebhookUrl: "https://example.com/webhook",
      digestWebhookSecret: "••••••••",
      digestScheduleHour: 14,
      digestTimezone: "America/New_York",
    };
    axiosPrivate.mockResponse("patch", updated);

    let returned: DigestConfig | undefined;
    await act(async () => {
      returned = await result.current({
        spaceId: "space-1",
        update: { digestEnabled: true, digestScheduleHour: 14, digestTimezone: "America/New_York" },
      });
    });

    expect(returned).toEqual(updated);

    const [call] = axiosPrivate.calls("patch");
    expect(call.url).toBe("/test-project/spaces/space-1/digest-config");
    expect(call.body).toEqual({
      digestEnabled: true,
      digestScheduleHour: 14,
      digestTimezone: "America/New_York",
    });
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUpdateDigestConfig());

    axiosPrivate.mockError("patch", 403, { message: "Forbidden" });

    await expect(
      result.current({ spaceId: "space-1", update: { digestEnabled: false } }),
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  it("throws before making a request when no space ID is passed", async () => {
    const { result, axiosPrivate } = renderHookWithAxios(() => useUpdateDigestConfig());

    await expect(
      result.current({ spaceId: "", update: { digestEnabled: false } }),
    ).rejects.toThrow("Please pass a spaceId");
    expect(axiosPrivate.calls("patch")).toHaveLength(0);
  });
});
