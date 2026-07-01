import { describe, expect, test } from "bun:test";
import { tierAllows, tierFromAttrs, resolveHostTier } from "./host-tier.ts";

describe("host-tier", () => {
  test("declared tier wins over detection", () => {
    const host = resolveHostTier({ ZETA_HOST_TIER: "slim" });
    expect(host.tier).toBe("slim");
    expect(host.source).toBe("declared");
    expect(tierAllows("slim", host)).toBe(true);
    expect(tierAllows("full", host)).toBe(false);
  });

  test("untagged manifest entry defaults to slim", () => {
    expect(tierFromAttrs({})).toBe("slim");
    expect(tierFromAttrs({ tier: "standard" })).toBe("standard");
  });
});
