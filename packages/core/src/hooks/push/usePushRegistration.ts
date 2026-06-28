import { useCallback } from "react";
import useProject from "../projects/useProject";
import { useUser } from "../user";
import {
  useRegisterPushDeviceMutation,
  useDeregisterPushDeviceMutation,
} from "../../store/api/pushApi";
import { handleError } from "../../utils/handleError";
import type { PushTokenAdapter } from "../../interfaces/PushTokenAdapter";

export interface UsePushRegistrationValues {
  /**
   * Requests permission, retrieves a token/subscription via the adapter,
   * and registers it server-side. Resolves to `false` (without throwing)
   * when permission is denied or the adapter can't produce an identifier —
   * both expected outcomes. Throws on a failed API call.
   */
  register: () => Promise<boolean>;
  unregister: () => Promise<void>;
  registering: boolean;
  unregistering: boolean;
}

/**
 * Explicit, developer-triggered push registration — unlike account-token
 * restoration, requesting OS/browser push permission should never happen
 * silently on mount. Callers pass the adapter for their platform
 * (`expoPushTokenAdapter`, `reactNativePushTokenAdapter`, `webPushTokenAdapter`).
 */
function usePushRegistration(
  adapter: PushTokenAdapter
): UsePushRegistrationValues {
  const { projectId } = useProject();
  const { user } = useUser();
  const [registerPushDevice, { isLoading: registering }] =
    useRegisterPushDeviceMutation();
  const [deregisterPushDevice, { isLoading: unregistering }] =
    useDeregisterPushDeviceMutation();

  const register = useCallback(async (): Promise<boolean> => {
    if (!projectId || !user) {
      throw new Error("No project ID or authenticated user available");
    }

    try {
      const granted = await adapter.requestPermission();
      if (!granted) return false;

      const identifier = await adapter.getDeviceIdentifier({ projectId });
      if (!identifier) return false;

      await registerPushDevice({ projectId, ...identifier }).unwrap();
      return true;
    } catch (error) {
      handleError(error, "Failed to register for push notifications");
      throw error;
    }
  }, [projectId, user, adapter, registerPushDevice]);

  const unregister = useCallback(async (): Promise<void> => {
    if (!projectId || !user) {
      throw new Error("No project ID or authenticated user available");
    }

    try {
      const identifier = await adapter.getDeviceIdentifier({ projectId });
      if (!identifier) return;

      await deregisterPushDevice({ projectId, ...identifier }).unwrap();
    } catch (error) {
      handleError(error, "Failed to unregister from push notifications");
      throw error;
    }
  }, [projectId, user, adapter, deregisterPushDevice]);

  return { register, unregister, registering, unregistering };
}

export default usePushRegistration;
