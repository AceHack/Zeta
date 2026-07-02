import { describe, expect, test } from "bun:test";
import { whenMatches } from "./when.ts";

describe("setup-realizers/when", () => {
  test("empty when= matches every host", () => {
    expect(whenMatches(undefined)).toBe(true);
    expect(whenMatches("")).toBe(true);
  });

  test("linux clause matches on linux platform", () => {
    if (process.platform === "linux") {
      expect(whenMatches("linux")).toBe(true);
    } else {
      expect(whenMatches("linux")).toBe(false);
    }
  });

  test("unknown clause does not match", () => {
    expect(whenMatches("unknown-clause")).toBe(false);
  });
});
