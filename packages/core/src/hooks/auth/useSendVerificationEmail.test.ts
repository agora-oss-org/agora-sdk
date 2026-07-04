import { describe, it, expect, afterEach, vi } from "vitest";

import { renderHookWithAxios, resetAxiosMocks } from "../../test-utils";
import useSendVerificationEmail from "./useSendVerificationEmail";

afterEach(() => {
  resetAxiosMocks();
  vi.unstubAllGlobals();
});

describe("useSendVerificationEmail", () => {
  it("sends a verification email with default (empty) options", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() =>
      useSendVerificationEmail(),
    );

    axiosPublic.mockResponse("post", { success: true });

    const returned = await result.current();

    expect(returned).toEqual({ success: true });

    const [call] = axiosPublic.calls("post");
    expect(call.url).toBe("/test-project/auth/send-verification-email");
    expect(call.body).toEqual({ emailRedirectTo: window.location.origin });
  });

  it("passes mode/tokenFormat/tokenLength/redirectUrl through", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() =>
      useSendVerificationEmail(),
    );

    axiosPublic.mockResponse("post", { success: true });

    await result.current({
      mode: "link",
      tokenFormat: "alphanumeric",
      tokenLength: 32,
      redirectUrl: "https://app.example.com/verify",
    });

    const [call] = axiosPublic.calls("post");
    expect(call.body).toEqual({
      mode: "link",
      tokenFormat: "alphanumeric",
      tokenLength: 32,
      redirectUrl: "https://app.example.com/verify",
      emailRedirectTo: window.location.origin,
    });
  });

  it("rejects when the server returns an error response", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() =>
      useSendVerificationEmail(),
    );

    axiosPublic.mockError("post", 500, { message: "Internal error" });

    await expect(result.current()).rejects.toMatchObject({
      response: { status: 500 },
    });
  });

  it("throws before making a request when there is no project", async () => {
    const { result, axiosPublic } = renderHookWithAxios(
      () => useSendVerificationEmail(),
      { projectId: "" },
    );

    await expect(result.current()).rejects.toThrow("No projectId available.");
    expect(axiosPublic.calls("post")).toHaveLength(0);
  });

  it("omits emailRedirectTo when no origin resolves (RN path)", async () => {
    const { result, axiosPublic } = renderHookWithAxios(() =>
      useSendVerificationEmail(),
    );
    axiosPublic.mockResponse("post", { success: true });

    vi.stubGlobal("window", undefined); // AFTER render — rendering needs the DOM
    await result.current();
    vi.unstubAllGlobals();

    expect(axiosPublic.calls("post")[0].body).toEqual({});
  });
});
