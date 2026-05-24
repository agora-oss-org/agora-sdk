import * as SecureStore from "expo-secure-store";
import { useAccountSync, useProject, handleError } from "@agora-sdk/core";
import type { AccountStorage, AccountMap } from "@agora-sdk/core";

const STORAGE_KEY_PREFIX = "replyke-accounts:";

const secureStoreStorage: AccountStorage = {
  async getAccountMap(projectId: string): Promise<AccountMap | null> {
    try {
      const raw = await SecureStore.getItemAsync(
        `${STORAGE_KEY_PREFIX}${projectId}`
      );
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setAccountMap(projectId: string, map: AccountMap): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        `${STORAGE_KEY_PREFIX}${projectId}`,
        JSON.stringify(map)
      );
    } catch (error) {
      handleError(error, "Failed to write account map to SecureStore");
    }
  },

  async deleteAccountMap(projectId: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(
        `${STORAGE_KEY_PREFIX}${projectId}`
      );
    } catch (error) {
      handleError(error, "Failed to delete account map from SecureStore");
    }
  },
};

function AccountManager() {
  const { projectId } = useProject();
  useAccountSync(secureStoreStorage, projectId!);
  return null;
}

export default AccountManager;
