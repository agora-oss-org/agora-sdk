import { Platform } from "react-native";
import messaging from "@react-native-firebase/messaging";
import type { PushTokenAdapter, PushDeviceIdentifier } from "@agora-sdk/core";

// @react-native-firebase/messaging covers both platforms with one library:
// getToken() returns the FCM registration token (android), and
// getAPNSToken() returns the raw APNs device token (ios) — exactly what
// Replyke's server needs to dispatch directly via FCM/APNs with the
// project's own credentials, with no second APNs-specific library required.
export const reactNativePushTokenAdapter: PushTokenAdapter = {
  async requestPermission(): Promise<boolean> {
    const status = await messaging().requestPermission();
    return (
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL
    );
  },

  async getDeviceIdentifier(): Promise<PushDeviceIdentifier | null> {
    if (Platform.OS === "ios") {
      const apnsToken = await messaging().getAPNSToken();
      return apnsToken ? { platform: "ios", token: apnsToken } : null;
    }

    const fcmToken = await messaging().getToken();
    return fcmToken ? { platform: "android", token: fcmToken } : null;
  },
};
