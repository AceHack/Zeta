import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CANONICAL_PIN_FILE,
  RESTATEMENT_FILE,
  checkPins,
  featureBand,
  isExactVersion,
  parseGlobalJsonSdk,
  parseMisePin,
} from "./audit-dotnet-pin-parity.ts";

const MISE = (v: string) => `[tools]\n# dotnet = "9.9.9" is a comment, not a declaration\ndotnet = "${v}"\ngo = "1.26.4"\n`;
const GJSON = (v: string) => JSON.stringify({ sdk: { version: v, rollForward: "latestPatch" } });

describe("parseMisePin", () => {
  test("finds the declaration and NOT a commented one", () => {
    // The real .mise.toml carries long `#` blocks that mention dotnet-install by name;
    // an unanchored regex would pick a comment up. This is the falsifier for that.
    expect(parseMisePin(MISE("10.0.303"))).toEqual(["10.0.303"]);
  });

  test("reports every declaration, so a duplicate is caught rather than shadowed", () => {
    expect(parseMisePin(`dotnet = "10.0.303"\ndotnet = "10.0.302"\n`)).toEqual(["10.0.303", "10.0.302"]);
  });
});

describe("parseGlobalJsonSdk", () => {
  test("tolerates the `//` note key global.json carries", () => {
    const text = `{"//":"derived from .mise.toml","sdk":{"version":"10.0.303","rollForward":"latestPatch"}}`;
    expect(parseGlobalJsonSdk(text)).toEqual({ version: "10.0.303", rollForward: "latestPatch" });
  });
});

describe("isExactVersion / featureBand", () => {
  test("exactness", () => {
    expect(isExactVersion("10.0.303")).toBe(true);
    expect(isExactVersion("10.0")).toBe(false);
    expect(isExactVersion("10")).toBe(false);
    expect(isExactVersion("~10.0.303")).toBe(false);
    expect(isExactVersion("10.0.303-preview.1")).toBe(false);
  });

  test("band groups the patch line, separates the feature line", () => {
    expect(featureBand("10.0.303")).toBe("10.0.3xx");
    expect(featureBand("10.0.302")).toBe("10.0.3xx");
    expect(featureBand("10.0.400")).toBe("10.0.4xx");
    expect(featureBand("10.0.111")).toBe("10.0.1xx");
  });
});

describe("checkPins — the failures it must actually catch", () => {
  test("agreement passes", () => {
    const fs = checkPins(MISE("10.0.303"), GJSON("10.0.303"));
    expect(fs.every((f) => f.ok)).toBe(true);
  });

  test("DISAGREEMENT fails — this is the state main was in before this check existed", () => {
    // Not hypothetical: the tree carried mise=10.0.302 while a newer patch (10.0.303,
    // a 10-CVE security roll) was live, and nothing in the tree could say so.
    const fs = checkPins(MISE("10.0.303"), GJSON("10.0.302"));
    expect(fs.some((f) => !f.ok)).toBe(true);
    expect(fs.find((f) => !f.ok)?.message).toContain("PIN DISAGREEMENT");
  });

  test("a RANGE in the canonical file fails — determinism is the reason", () => {
    const fs = checkPins(MISE("10.0"), GJSON("10.0"));
    expect(fs.some((f) => !f.ok)).toBe(true);
    expect(fs.find((f) => !f.ok)?.message).toContain("not an exact");
  });

  test("two dotnet declarations fail rather than silently taking the first", () => {
    const fs = checkPins(`dotnet = "10.0.303"\ndotnet = "10.0.302"\n`, GJSON("10.0.303"));
    expect(fs.some((f) => !f.ok)).toBe(true);
    expect(fs.find((f) => !f.ok)?.message).toContain("exactly ONE");
  });

  test("a missing sdk.version fails rather than passing vacuously", () => {
    const fs = checkPins(MISE("10.0.303"), `{}`);
    expect(fs.some((f) => !f.ok)).toBe(true);
  });

  test("unparseable global.json fails rather than throwing past the runner", () => {
    const fs = checkPins(MISE("10.0.303"), `{ not json`);
    expect(fs.some((f) => !f.ok)).toBe(true);
  });
});

describe("the REAL tree", () => {
  test("the checked-in .mise.toml and global.json agree", () => {
    const fs = checkPins(readFileSync(CANONICAL_PIN_FILE, "utf8"), readFileSync(RESTATEMENT_FILE, "utf8"));
    const bad = fs.filter((f) => !f.ok).map((f) => f.message);
    expect(bad).toEqual([]);
  });
});
