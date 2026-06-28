import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import useSpacePermissions from "./useSpacePermissions";
import type { SpaceMemberPermissions } from "../../interfaces/models/Space";

function makePermissions(overrides: Partial<SpaceMemberPermissions> = {}): SpaceMemberPermissions {
  return {
    isAdmin: false,
    isModerator: false,
    isMember: true,
    status: "active",
    canPost: true,
    canModerate: false,
    canRead: true,
    ...overrides,
  };
}

describe("useSpacePermissions", () => {
  it("derives non-member defaults from the space's open posting/reading permissions when there are no memberPermissions", () => {
    const { result } = renderHook(() =>
      useSpacePermissions({
        memberPermissions: null,
        postingPermission: "anyone",
        readingPermission: "anyone",
      }),
    );

    expect(result.current).toEqual({
      isMember: false,
      isAdmin: false,
      isModerator: false,
      canPost: true,
      canModerate: false,
      canRead: true,
      isPending: false,
      isBanned: false,
    });
  });

  it("denies posting/reading for a non-member when the space restricts to members", () => {
    const { result } = renderHook(() =>
      useSpacePermissions({
        memberPermissions: undefined,
        postingPermission: "members",
        readingPermission: "members",
      }),
    );

    expect(result.current.canPost).toBe(false);
    expect(result.current.canRead).toBe(false);
  });

  it("passes server-computed booleans through directly when memberPermissions is present", () => {
    const { result } = renderHook(() =>
      useSpacePermissions({
        memberPermissions: makePermissions({ isAdmin: true, isModerator: true, canModerate: true }),
        postingPermission: "admins",
      }),
    );

    expect(result.current).toMatchObject({
      isMember: true,
      isAdmin: true,
      isModerator: true,
      canModerate: true,
      isPending: false,
      isBanned: false,
    });
  });

  it("derives isPending/isBanned from the membership status", () => {
    const { result: pendingResult } = renderHook(() =>
      useSpacePermissions({
        memberPermissions: makePermissions({ status: "pending", isMember: false, canPost: false, canRead: false }),
        postingPermission: "members",
      }),
    );
    expect(pendingResult.current.isPending).toBe(true);
    expect(pendingResult.current.isBanned).toBe(false);

    const { result: bannedResult } = renderHook(() =>
      useSpacePermissions({
        memberPermissions: makePermissions({ status: "banned", isMember: false, canPost: false, canRead: false }),
        postingPermission: "members",
      }),
    );
    expect(bannedResult.current.isBanned).toBe(true);
  });
});
