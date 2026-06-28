import * as Keychain from "react-native-keychain";
import { useAccountSync, useProject, handleError } from "@agora-sdk/core";
import type { AccountStorage, AccountMap } from "@agora-sdk/core";

const STORAGE_SERVICE_PREFIX = "replyke-accounts:";

export const keychainStorage: AccountStorage = {
  async getAccountMap(projectId: string): Promise<AccountMap | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: `${STORAGE_SERVICE_PREFIX}${projectId}`,
      });
      if (credentials) {
        return JSON.parse(credentials.password);
      }
      return null;
    } catch {
      return null;
    }
  },

  async setAccountMap(projectId: string, map: AccountMap): Promise<void> {
    try {
      const service = `${STORAGE_SERVICE_PREFIX}${projectId}`;
      await Keychain.setGenericPassword(service, JSON.stringify(map), {
        service,
      });
    } catch (error) {
      handleError(error, "Failed to write account map to Keychain");
    }
  },

  async deleteAccountMap(projectId: string): Promise<void> {
    try {
      await Keychain.resetGenericPassword({
        service: `${STORAGE_SERVICE_PREFIX}${projectId}`,
      });
    } catch (error) {
      handleError(error, "Failed to delete account map from Keychain");
    }
  },
};

function AccountManager() {
  const { projectId } = useProject();
  useAccountSync(keychainStorage, projectId!);
  return null;
}

export default AccountManager;
