import { describe, it, expect, vi, afterEach } from "vitest";

import { handleError } from "./handleError";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleError", () => {
  it("logs and returns baseMessage + error + details for an axios error response", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = {
      response: { data: { error: "Bad request", details: "email is required" } },
    };

    const result = handleError(err, "Failed to sign up:");

    expect(result).toBe("Failed to sign up: - Bad request - email is required");
    expect(consoleSpy).toHaveBeenCalledWith("Failed to sign up: - Bad request - email is required");
  });

  it("omits the details segment when the response has only an error message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = { response: { data: { error: "Bad request" } } };

    expect(handleError(err, "Failed:")).toBe("Failed: - Bad request");
  });

  it("falls back to baseMessage alone when response.data has neither error nor details", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = { response: { data: {} } };

    // responseData is truthy (an empty object), so the err.message fallback
    // branch is intentionally skipped — this pins down that current behavior.
    expect(handleError(err, "Failed:")).toBe("Failed:");
  });

  it("falls back to err.message for a network error with no response", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = { message: "Network Error" };

    expect(handleError(err, "Request failed:")).toBe("Request failed: - Network Error");
  });

  it("falls back to err.message for a plain Error with no response", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("Something broke");

    expect(handleError(err, "Operation failed:")).toBe("Operation failed: - Something broke");
  });

  it("falls back to 'Unknown error' when the thrown value has no message and no response", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(handleError({}, "Operation failed:")).toBe("Operation failed: - Unknown error");
  });

  it("works without a baseMessage, leaving a leading separator", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(handleError({ message: "boom" })).toBe(" - boom");
  });
});
