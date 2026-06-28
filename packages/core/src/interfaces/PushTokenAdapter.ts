export type PushDevicePlatform = "ios" | "android" | "web";

export interface PushWebSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// Mirrors the server's register/deregister device body exactly (a token for
// ios/android, a Web Push subscription object for web) so a platform
// adapter's result can be spread straight into the API call.
export type PushDeviceIdentifier =
  | { platform: "ios" | "android"; token: string }
  | { platform: "web"; subscription: PushWebSubscriptionPayload };

export interface PushDeviceContext {
  projectId: string;
}

// One implementation per platform package (expo, react-native, react-js),
// parallel to AccountStorage. getDeviceIdentifier takes a context (mirroring
// AccountStorage's projectId param) because the web implementation needs the
// project's VAPID public key, fetched over the network, before it can build
// a subscription.
export interface PushTokenAdapter {
  requestPermission(): Promise<boolean>;
  getDeviceIdentifier(
    context: PushDeviceContext
  ): Promise<PushDeviceIdentifier | null>;
}
