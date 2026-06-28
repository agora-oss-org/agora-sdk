import { describe, it, expect, vi, afterEach } from "vitest";

const requestPermissionsAsync = vi.fn();
const getDevicePushTokenAsync = vi.fn();

vi.mock("expo-notifications", () => ({
  requestPermissionsAsync: (...args: unknown[]) => requestPermissionsAsync(...args),
  getDevicePushTokenAsync: (...args: unknown[]) => getDevicePushTokenAsync(...args),
}));

import { expoPushTokenAdapter } from "./PushTokenAdapter";

afterEach(() => {
  vi.clearAllMocks();
});

describe("expoPushTokenAdapter.requestPermission", () => {
  it("returns true when permission is granted", async () => {
    requestPermissionsAsync.mockResolvedValue({ status: "granted" });
    await expect(expoPushTokenAdapter.requestPermission()).resolves.toBe(true);
  });

  it("returns false when permission is denied", async () => {
    requestPermissionsAsync.mockResolvedValue({ status: "denied" });
    await expect(expoPushTokenAdapter.requestPermission()).resolves.toBe(false);
  });
});

describe("expoPushTokenAdapter.getDeviceIdentifier", () => {
  it("returns an ios identifier from the raw device push token", async () => {
    getDevicePushTokenAsync.mockResolvedValue({ type: "ios", data: "apns-token-1" });

    await expect(
      expoPushTokenAdapter.getDeviceIdentifier({ projectId: "project-1" }),
    ).resolves.toEqual({ platform: "ios", token: "apns-token-1" });
  });

  it("returns an android identifier from the raw device push token", async () => {
    getDevicePushTokenAsync.mockResolvedValue({ type: "android", data: "fcm-token-1" });

    await expect(
      expoPushTokenAdapter.getDeviceIdentifier({ projectId: "project-1" }),
    ).resolves.toEqual({ platform: "android", token: "fcm-token-1" });
  });

  it("returns null for an unrecognized token type", async () => {
    getDevicePushTokenAsync.mockResolvedValue({ type: "web", data: {} });

    await expect(
      expoPushTokenAdapter.getDeviceIdentifier({ projectId: "project-1" }),
    ).resolves.toBeNull();
  });
});
