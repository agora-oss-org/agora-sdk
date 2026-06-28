import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  makeRtkQueryStore,
  stubFetchMock,
  unstubFetchMock,
  jsonResponse,
  type FetchMockHandle,
  type RtkQueryStore,
} from "../../test-utils";
import { userApi } from "./userApi";

let fetchHandle: FetchMockHandle;
let store: RtkQueryStore;

beforeEach(() => {
  fetchHandle = stubFetchMock(async () => jsonResponse({}, 404));
  store = makeRtkQueryStore();
});

afterEach(() => {
  unstubFetchMock();
});

describe("userApi", () => {
  it("updateUser sends a plain JSON PATCH when there are no file fields", async () => {
    fetchHandle.fetchMock.mockResolvedValueOnce(jsonResponse({ id: "user-1", name: "New" }));

    await store.dispatch(
      userApi.endpoints.updateUser.initiate({
        projectId: "test-project",
        userId: "user-1",
        update: { name: "New" },
      }),
    );

    const call = fetchHandle.calls()[0];
    expect(call.method).toBe("PATCH");
    expect(call.url).toContain("/test-project/users/user-1");
  });

  it("updateUser sends FormData when avatar is a file", async () => {
    fetchHandle.fetchMock.mockImplementationOnce(async (...args: unknown[]) => {
      const req = args[0] as Request;
      // The monorepo root typechecks all packages together, so react-native's global FormData
      // (which lacks .get) can shadow the DOM one; read entries through a structural type.
      const body = (await req.formData()) as unknown as {
        get(name: string): unknown;
      };
      expect(body.get("name")).toBe("New");
      expect(body.get("avatarFile")).toBeInstanceOf(File);
      expect(JSON.parse(body.get("avatarFile.options") as string)).toEqual({ mode: "original-aspect" });
      return jsonResponse({ id: "user-1", name: "New" });
    });

    await store.dispatch(
      userApi.endpoints.updateUser.initiate({
        projectId: "test-project",
        userId: "user-1",
        update: {
          name: "New",
          avatar: {
            file: new File(["x"], "avatar.png", { type: "image/png" }),
            options: { mode: "original-aspect" } as never,
          },
        },
      }),
    );

    expect(fetchHandle.calls()[0].method).toBe("PATCH");
  });

  it("updateUser sends FormData when a banner file is present, even without an avatar file", async () => {
    fetchHandle.fetchMock.mockImplementationOnce(async (...args: unknown[]) => {
      const req = args[0] as Request;
      // The monorepo root typechecks all packages together, so react-native's global FormData
      // (which lacks .get) can shadow the DOM one; read entries through a structural type.
      const body = (await req.formData()) as unknown as {
        get(name: string): unknown;
      };
      expect(body.get("bannerFile")).toBeInstanceOf(File);
      return jsonResponse({ id: "user-1" });
    });

    await store.dispatch(
      userApi.endpoints.updateUser.initiate({
        projectId: "test-project",
        userId: "user-1",
        update: {
          banner: {
            file: new File(["x"], "banner.png", { type: "image/png" }),
            options: { mode: "original-aspect" } as never,
          },
        },
      }),
    );

    expect(fetchHandle.calls()).toHaveLength(1);
  });

  it("serializes location/metadata/secureMetadata as JSON strings in the FormData path", async () => {
    fetchHandle.fetchMock.mockImplementationOnce(async (...args: unknown[]) => {
      const req = args[0] as Request;
      // The monorepo root typechecks all packages together, so react-native's global FormData
      // (which lacks .get) can shadow the DOM one; read entries through a structural type.
      const body = (await req.formData()) as unknown as {
        get(name: string): unknown;
      };
      expect(JSON.parse(body.get("location") as string)).toEqual({ latitude: 1, longitude: 2 });
      expect(JSON.parse(body.get("metadata") as string)).toEqual({ foo: "bar" });
      return jsonResponse({ id: "user-1" });
    });

    await store.dispatch(
      userApi.endpoints.updateUser.initiate({
        projectId: "test-project",
        userId: "user-1",
        update: {
          location: { latitude: 1, longitude: 2 },
          metadata: { foo: "bar" },
          banner: {
            file: new File(["x"], "banner.png"),
            options: { mode: "original-aspect" } as never,
          },
        },
      }),
    );

    expect(fetchHandle.calls()).toHaveLength(1);
  });

  it("returns the updated user on success", async () => {
    fetchHandle.fetchMock.mockResolvedValueOnce(jsonResponse({ id: "user-1", name: "New" }));

    const result = await store.dispatch(
      userApi.endpoints.updateUser.initiate({
        projectId: "test-project",
        userId: "user-1",
        update: { name: "New" },
      }),
    );

    expect(result.data).toEqual({ id: "user-1", name: "New" });
  });

  it("surfaces a non-2xx response as a mutation error", async () => {
    fetchHandle.fetchMock.mockResolvedValueOnce(jsonResponse({ message: "boom" }, 500));

    const result = await store.dispatch(
      userApi.endpoints.updateUser.initiate({
        projectId: "test-project",
        userId: "user-1",
        update: { name: "New" },
      }),
    );

    expect((result.error as { status: number } | undefined)?.status).toBe(500);
  });
});
