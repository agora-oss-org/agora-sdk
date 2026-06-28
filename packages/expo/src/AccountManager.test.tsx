import { describe, it, expect, vi, afterEach } from "vitest";

const getItemAsync = vi.fn();
const setItemAsync = vi.fn();
const deleteItemAsync = vi.fn();
const handleError = vi.fn();

vi.mock("expo-secure-store", () => ({
  getItemAsync: (...args: unknown[]) => getItemAsync(...args),
  setItemAsync: (...args: unknown[]) => setItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => deleteItemAsync(...args),
}));

vi.mock("@agora-sdk/core", () => ({
  useAccountSync: vi.fn(),
  useProject: vi.fn(),
  handleError: (...args: unknown[]) => handleError(...args),
}));

import { secureStoreStorage } from "./AccountManager";

afterEach(() => {
  vi.clearAllMocks();
});

// expo-secure-store rejects keys containing characters outside
// /^[A-Za-z0-9._-]+$/ (notably `:`) on iOS — the project-scoped key must
// satisfy this constraint.
const SECURE_STORE_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

describe("secureStoreStorage.getAccountMap", () => {
  it("parses and returns the stored account map using an allowed key", async () => {
    const map = { activeAccountId: "user-1", accounts: {} };
    getItemAsync.mockResolvedValue(JSON.stringify(map));

    await expect(secureStoreStorage.getAccountMap("project-1")).resolves.toEqual(map);
    const [key] = getItemAsync.mock.calls[0];
    expect(key).toBe("replyke-accounts_project-1");
    expect(key).toMatch(SECURE_STORE_KEY_PATTERN);
  });

  it("returns null when nothing is stored", async () => {
    getItemAsync.mockResolvedValue(null);
    await expect(secureStoreStorage.getAccountMap("project-1")).resolves.toBeNull();
  });

  it("swallows errors and returns null when the SecureStore read rejects", async () => {
    getItemAsync.mockRejectedValue(new Error("not available"));
    await expect(secureStoreStorage.getAccountMap("project-1")).resolves.toBeNull();
  });
});

describe("secureStoreStorage.setAccountMap", () => {
  it("writes the JSON-serialized map under an allowed key", async () => {
    setItemAsync.mockResolvedValue(undefined);
    const map = { activeAccountId: "user-1", accounts: {} };

    await secureStoreStorage.setAccountMap("project-1", map);

    const [key, value] = setItemAsync.mock.calls[0];
    expect(key).toBe("replyke-accounts_project-1");
    expect(key).toMatch(SECURE_STORE_KEY_PATTERN);
    expect(value).toBe(JSON.stringify(map));
  });

  it("reports the error via handleError instead of throwing when the write fails", async () => {
    setItemAsync.mockRejectedValue(new Error("disk full"));

    await secureStoreStorage.setAccountMap("project-1", { activeAccountId: null, accounts: {} });

    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError.mock.calls[0][1]).toBe("Failed to write account map to SecureStore");
  });
});

describe("secureStoreStorage.deleteAccountMap", () => {
  it("deletes the item under an allowed key", async () => {
    deleteItemAsync.mockResolvedValue(undefined);

    await secureStoreStorage.deleteAccountMap("project-1");

    const [key] = deleteItemAsync.mock.calls[0];
    expect(key).toBe("replyke-accounts_project-1");
    expect(key).toMatch(SECURE_STORE_KEY_PATTERN);
  });

  it("reports the error via handleError instead of throwing when the delete fails", async () => {
    deleteItemAsync.mockRejectedValue(new Error("not found"));

    await secureStoreStorage.deleteAccountMap("project-1");

    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError.mock.calls[0][1]).toBe("Failed to delete account map from SecureStore");
  });
});
