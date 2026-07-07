import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import { buildSpaceReputationParams } from "./spaceReputationParams";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildSpaceReputationParams", () => {
  describe("object form vs equivalent flat form", () => {
    it("produces identical output for a uuid + descendants", () => {
      const fromObject = buildSpaceReputationParams({
        spaceReputation: { spaceId: "abc-123", includeDescendants: true },
      });
      const fromFlat = buildSpaceReputationParams({
        spaceReputationId: "abc-123",
        spaceReputationDescendants: true,
      });

      expect(fromObject).toEqual({
        spaceReputationId: "abc-123",
        spaceReputationDescendants: true,
      });
      expect(fromObject).toEqual(fromFlat);
    });

    it("produces identical output for `none` with no descendants", () => {
      const fromObject = buildSpaceReputationParams({
        spaceReputation: { spaceId: "none" },
      });
      const fromFlat = buildSpaceReputationParams({
        spaceReputationId: "none",
      });

      expect(fromObject).toEqual({ spaceReputationId: "none" });
      expect(fromObject).toEqual(fromFlat);
    });

    it("produces identical output for `context`", () => {
      const fromObject = buildSpaceReputationParams({
        spaceReputation: { spaceId: "context" },
      });
      const fromFlat = buildSpaceReputationParams({
        spaceReputationId: "context",
      });

      expect(fromObject).toEqual({ spaceReputationId: "context" });
      expect(fromObject).toEqual(fromFlat);
    });
  });

  describe("output is always flat (never bracketed/nested)", () => {
    it("returns only the two flat keys", () => {
      const result = buildSpaceReputationParams({
        spaceReputation: { spaceId: "abc-123", includeDescendants: false },
      });

      expect(Object.keys(result).sort()).toEqual([
        "spaceReputationDescendants",
        "spaceReputationId",
      ]);
      expect(result).not.toHaveProperty("spaceReputation");
    });

    it("omits keys when unset (empty input → empty output)", () => {
      expect(buildSpaceReputationParams({})).toEqual({});
    });
  });

  describe("precedence — object wins when key present", () => {
    it("a full object overrides supplied flat props", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = buildSpaceReputationParams({
        spaceReputation: { spaceId: "from-object", includeDescendants: true },
        spaceReputationId: "from-flat",
        spaceReputationDescendants: false,
      });

      expect(result).toEqual({
        spaceReputationId: "from-object",
        spaceReputationDescendants: true,
      });
    });

    it("an empty object `{}` suppresses the flat props", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = buildSpaceReputationParams({
        // @ts-expect-error — intentionally partial: presence of the key alone wins
        spaceReputation: {},
        spaceReputationId: "from-flat",
        spaceReputationDescendants: true,
      });

      expect(result).toEqual({});
    });

    it("a partial object (no includeDescendants) suppresses the flat descendants prop", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = buildSpaceReputationParams({
        spaceReputation: { spaceId: "abc-123" },
        spaceReputationDescendants: true,
      });

      expect(result).toEqual({ spaceReputationId: "abc-123" });
    });

    it("falls back to flat props when the object key is absent", () => {
      const result = buildSpaceReputationParams({
        spaceReputationId: "abc-123",
        spaceReputationDescendants: true,
      });

      expect(result).toEqual({
        spaceReputationId: "abc-123",
        spaceReputationDescendants: true,
      });
    });
  });

  describe("dev warning when both forms supplied", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("fires once, never throws, and warns only when both forms are present", async () => {
      vi.resetModules();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      // Fresh module so the module-level "warned once" flag is reset.
      const { buildSpaceReputationParams: build } = await import(
        "./spaceReputationParams"
      );

      // First call with both forms → warns.
      expect(() =>
        build({
          spaceReputation: { spaceId: "abc-123" },
          spaceReputationId: "from-flat",
        })
      ).not.toThrow();
      expect(warnSpy).toHaveBeenCalledTimes(1);

      // Second call with both forms → does NOT warn again (one-time).
      build({
        spaceReputation: { spaceId: "def-456" },
        spaceReputationDescendants: true,
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("does not warn when only one form is supplied", async () => {
      vi.resetModules();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { buildSpaceReputationParams: build } = await import(
        "./spaceReputationParams"
      );

      build({ spaceReputation: { spaceId: "abc-123" } });
      build({ spaceReputationId: "abc-123" });

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("does not warn in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.resetModules();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { buildSpaceReputationParams: build } = await import(
        "./spaceReputationParams"
      );

      build({
        spaceReputation: { spaceId: "abc-123" },
        spaceReputationId: "from-flat",
      });

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("null flat input is treated as unset", () => {
    it("omits params when flat inputs are null", () => {
      expect(
        buildSpaceReputationParams({
          spaceReputationId: null,
          spaceReputationDescendants: null,
        })
      ).toEqual({});
    });

    it("keeps a real flat value while omitting a null sibling", () => {
      expect(
        buildSpaceReputationParams({
          spaceReputationId: "abc-123",
          spaceReputationDescendants: null,
        })
      ).toEqual({ spaceReputationId: "abc-123" });
    });

    it("a null flat input does not count as 'both forms' (no warning) when an object is present", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.resetModules();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { buildSpaceReputationParams: build } = await import(
        "./spaceReputationParams"
      );

      build({
        spaceReputation: { spaceId: "abc-123" },
        spaceReputationId: null,
        spaceReputationDescendants: null,
      });

      expect(warnSpy).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
      vi.resetModules();
    });
  });
});
