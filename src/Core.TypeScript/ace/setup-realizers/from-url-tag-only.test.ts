import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { isUnhashedPin, requireSha256 } from "./from-url.ts";

const HEX = "a".repeat(64);

/**
 * Parse a manifest row exactly as the realizer does: the URL is POSITIONAL
 * (`tokens[1]`), everything after it is `key=value`. This helper exists because the
 * first version of these tests handed `url` in as an ATTR — a shape the caller never
 * produces — so they passed while every real tag-only row would have thrown at install
 * time. Green in test, red in production. The shape under test must be the shape that
 * ships, so the row below is read from the committed file rather than written here.
 */
function parseRow(line: string): { url: string; attrs: Record<string, string> } {
  const tokens = line.trim().split(/\s+/u);
  const attrs: Record<string, string> = {};
  for (const t of tokens.slice(2)) {
    const eq = t.indexOf("=");
    if (eq > 0) attrs[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return { url: tokens[1] ?? "", attrs };
}

describe("the COMMITTED manifest — the shape that actually ships", () => {
  const manifest = readFileSync("tools/setup/manifests/from-url", "utf8");
  const rows = manifest
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("#"));

  test("every row in the real manifest resolves without throwing", () => {
    // The regression that motivated this file: `requireSha256` read `attrs.url`, which
    // is always undefined for a real row, so the tag check saw "" and refused.
    expect(rows.length).toBeGreaterThan(0);
    for (const line of rows) {
      const { url, attrs } = parseRow(line);
      expect(() => requireSha256(attrs["dest"] ?? line.split(/\s+/u)[0] ?? "row", attrs as never, url)).not.toThrow();
    }
  });

  test("at least one committed row is tag-only, so this file is not vacuous", () => {
    // Without a real tag-only row present, the loop above would pass over digests alone
    // and prove nothing about the branch it was written for.
    const tagOnly = rows.filter((l) => parseRow(l).attrs["sha256"] === "tag-only");
    expect(tagOnly.length).toBeGreaterThan(0);
    for (const line of tagOnly) {
      const { url, attrs } = parseRow(line);
      expect(isUnhashedPin(requireSha256("row", attrs as never, url))).toBe(true);
    }
  });
});

describe("the gate itself", () => {
  test("a 64-hex digest still works", () => {
    expect(requireSha256("d", { sha256: HEX } as never, "https://x/v1/a")).toBe(HEX);
  });
  test("a missing pin is still refused", () => {
    expect(() => requireSha256("d", {} as never, "https://x/v1/a")).toThrow(/sha256= pin required/u);
  });
  test("tag-only WITHOUT a reason is refused", () => {
    expect(() => requireSha256("d", { sha256: "tag-only" } as never, "https://x/v1.8.0/a.jar")).toThrow(/tagonly=<reason>/u);
  });
  test("tag-only on a MOVING alias is refused — with a VALID reason, so the tag is what fails", () => {
    // The reason must satisfy the shared quality floor here, or this test would pass for
    // the wrong cause and prove nothing about the tag requirement.
    expect(() => requireSha256("d", { sha256: "tag-only", tagonly: "upstream-recuts-this-prerelease-asset-so-no-digest-is-stable" } as never, "https://x/latest/a.jar")).toThrow(/version-shaped tag/u);
  });
  test("tag-only with a reason and a real tag is accepted", () => {
    expect(isUnhashedPin(requireSha256("d", { sha256: "tag-only", tagonly: "upstream-recuts-this-prerelease-asset-so-no-digest-is-stable" } as never, "https://x/v1.8.0/a.jar"))).toBe(true);
  });
  test("a malformed digest is still refused", () => {
    expect(() => requireSha256("d", { sha256: "nothex" } as never, "https://x/v1/a")).toThrow(/64 hex chars/u);
  });
  test("isTagOnly is false for a real digest", () => {
    expect(isUnhashedPin(HEX)).toBe(false);
  });
});
