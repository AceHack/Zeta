import { describe, expect, test } from "bun:test";
import { checkParity, parsePowershellNeedles } from "./audit-transient-retry-parity.ts";

const PS = `
# The comment quotes 'trust-metadata-api service unavailable' as prose, deliberately.
$script:TransientToolNeedles = @(
  'trust-metadata-api service unavailable',
  '503 Service Unavailable'
)
`;

describe("parse is anchored to the ARRAY, not the file", () => {
  test("extracts exactly the array entries", () => {
    expect(parsePowershellNeedles(PS)).toEqual(["trust-metadata-api service unavailable", "503 Service Unavailable"]);
  });
  test("a file with only the prose mention and NO array returns null, not a false match", () => {
    // The guard-satisfied-by-its-own-comment failure, pinned.
    const proseOnly = "# we retry on 'trust-metadata-api service unavailable' somewhere else\n";
    expect(parsePowershellNeedles(proseOnly)).toBeNull();
  });
  test("an unterminated array returns null", () => {
    expect(parsePowershellNeedles("$script:TransientToolNeedles = @(\n  'a',")).toBeNull();
  });
});

describe("refusals", () => {
  test("a needle in the shell that is NOT tested is refused, and named as the dangerous direction", () => {
    const f = checkParity({ tested: ["a-needle-long"], shell: ["a-needle-long", "sneaky-extra"] });
    expect(f.kind).toBe("refused");
    if (f.kind === "refused") {
      expect(f.why).toContain("UNTESTED");
      expect(f.why).toContain("sneaky-extra");
    }
  });
  test("a needle tested but missing from the shell is also refused", () => {
    const f = checkParity({ tested: ["a", "b"], shell: ["a"] });
    expect(f.kind).toBe("refused");
    if (f.kind === "refused") expect(f.why).toContain("Mirror it");
  });
  test("a missing array is refused as a check that cannot fail", () => {
    const f = checkParity({ tested: ["a"], shell: null });
    expect(f.kind).toBe("refused");
    if (f.kind === "refused") expect(f.why).toContain("cannot fail");
  });
  test("an empty tested roster is refused rather than passing vacuously", () => {
    const f = checkParity({ tested: [], shell: [] });
    expect(f.kind).toBe("refused");
    if (f.kind === "refused") expect(f.why).toContain("vacuously");
  });
});

describe("agreement passes, order-independently", () => {
  test("same set in a different order is ok", () => {
    const f = checkParity({ tested: ["a", "b"], shell: ["b", "a"] });
    expect(f.kind).toBe("ok");
    if (f.kind === "ok") expect(f.count).toBe(2);
  });
});
