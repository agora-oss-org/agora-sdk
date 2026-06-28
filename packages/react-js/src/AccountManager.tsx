import { useAccountSync, useProject, handleError } from "@agora-sdk/core";
import type { AccountStorage, AccountMap } from "@agora-sdk/core";

const STORAGE_KEY_PREFIX = "replyke-accounts:";

export const webAccountStorage: AccountStorage = {
  async getAccountMap(projectId: string): Promise<AccountMap | null> {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setAccountMap(projectId: string, map: AccountMap): Promise<void> {
    try {
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${projectId}`,
        JSON.stringify(map)
      );
    } catch (error) {
      handleError(error, "Failed to write account map to localStorage");
    }
  },

  async deleteAccountMap(projectId: string): Promise<void> {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${projectId}`);
  },
};

function AccountManager() {
  const { projectId } = useProject();
  useAccountSync(webAccountStorage, projectId!);
  return null;
}

export default AccountManager;
