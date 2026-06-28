import { describe, it, expect, vi, afterEach } from "vitest";

const {
  requestPermission,
  getToken,
  getAPNSToken,
  PlatformMock,
  messagingFn,
} = vi.hoisted(() => {
  const requestPermission = vi.fn();
  const getToken = vi.fn();
  const getAPNSToken = vi.fn();
  const PlatformMock: { OS: "ios" | "android" } = { OS: "ios" };

  const messagingFn: any = vi.fn(() => ({
    requestPermission,
    getToken,
    getAPNSToken,
  }));
  messagingFn.AuthorizationStatus = {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  };

  return { requestPermission, getToken, getAPNSToken, PlatformMock, messagingFn };
});

vi.mock("react-native", () => ({ Platform: PlatformMock }));
vi.mock("@react-native-firebase/messaging", () => ({ default: messagingFn }));

import { reactNativePushTokenAdapter } from "./PushTokenAdapter";

afterEach(() => {
  vi.clearAllMocks();
});

describe("reactNativePushTokenAdapter.requestPermission", () => {
  it("returns true when authorized", async () => {
    requestPermission.mockResolvedValue(1); // AUTHORIZED
    await expect(reactNativePushTokenAdapter.requestPermission()).resolves.toBe(true);
  });

  it("returns true when provisionally authorized", async () => {
    requestPermission.mockResolvedValue(2); // PROVISIONAL
    await expect(reactNativePushTokenAdapter.requestPermission()).resolves.toBe(true);
  });

  it("returns false when denied", async () => {
    requestPermission.mockResolvedValue(0); // DENIED
    await expect(reactNativePushTokenAdapter.requestPermission()).resolves.toBe(false);
  });
});

describe("reactNativePushTokenAdapter.getDeviceIdentifier", () => {
  it("returns the raw APNs token on iOS", async () => {
    PlatformMock.OS = "ios";
    getAPNSToken.mockResolvedValue("apns-token-1");

    await expect(
      reactNativePushTokenAdapter.getDeviceIdentifier({ projectId: "project-1" }),
    ).resolves.toEqual({ platform: "ios", token: "apns-token-1" });
    expect(getToken).not.toHaveBeenCalled();
  });

  it("returns null on iOS when no APNs token is available", async () => {
    PlatformMock.OS = "ios";
    getAPNSToken.mockResolvedValue(null);

    await expect(
      reactNativePushTokenAdapter.getDeviceIdentifier({ projectId: "project-1" }),
    ).resolves.toBeNull();
  });

  it("returns the FCM token on Android", async () => {
    PlatformMock.OS = "android";
    getToken.mockResolvedValue("fcm-token-1");

    await expect(
      reactNativePushTokenAdapter.getDeviceIdentifier({ projectId: "project-1" }),
    ).resolves.toEqual({ platform: "android", token: "fcm-token-1" });
    expect(getAPNSToken).not.toHaveBeenCalled();
  });

  it("returns null on Android when no FCM token is available", async () => {
    PlatformMock.OS = "android";
    getToken.mockResolvedValue(null);

    await expect(
      reactNativePushTokenAdapter.getDeviceIdentifier({ projectId: "project-1" }),
    ).resolves.toBeNull();
  });
});
