import * as Notifications from "expo-notifications";
import type { PushTokenAdapter, PushDeviceIdentifier } from "@agora-sdk/core";

// Deliberately uses getDevicePushTokenAsync (the raw native APNs/FCM token),
// not getExpoPushTokenAsync (Expo's own push-relay token) — Replyke's server
// dispatches directly to APNs/FCM using the project's own credentials, so it
// needs the token those services recognize, not an Expo-relay token.
export const expoPushTokenAdapter: PushTokenAdapter = {
  async requestPermission(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  },

  async getDeviceIdentifier(): Promise<PushDeviceIdentifier | null> {
    const devicePushToken = await Notifications.getDevicePushTokenAsync();
    if (devicePushToken.type === "ios" || devicePushToken.type === "android") {
      return { platform: devicePushToken.type, token: devicePushToken.data };
    }
    return null;
  },
};
