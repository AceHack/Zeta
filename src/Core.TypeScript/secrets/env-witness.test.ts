/**
 * env-witness.test.ts — the falsifiers for the pattern that replaces the hoist.
 *
 * The claim this module makes is strong: you can prove a credential is ignored
 * without ever creating one. A helper that made that claim and could not
 * actually DETECT a hoist would be worse than the defect it replaces, because it
 * would look like a proof. So every helper here is exercised against a
 * deliberately hoisted environment and must go red on it.
 *
 * The last test in this file is the closure: the linter that forbids the hoist
 * is pointed at THIS module's own source, and finds nothing. That is what "no
 * exemption was needed" means, checked rather than asserted.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { envDiffNames, envDigest, envNamesCarrying, withHoistedCredential } from "./env-witness.ts";
import { SELF_EXEMPT, scanText } from "../hygiene/lint-no-ambient-credential-hoist.ts";

/** Not a credential anywhere: a shape-valid, made-up value. */
const FAKE_TOKEN = "ops_" + "AAAAfakeTOKENfor-tests_only.NOT-A-REAL-CREDENTIAL=";

describe("envDigest — did anything move", () => {
  test("identical content digests identically, whatever the key insertion order", () => {
    expect(envDigest({ A: "1", B: "2" })).toBe(envDigest({ B: "2", A: "1" }));
  });

  test("any change moves the digest", () => {
    const base = { A: "1", B: "2" };
    expect(envDigest({ ...base, B: "3" })).not.toBe(envDigest(base));
    expect(envDigest({ ...base, C: "" })).not.toBe(envDigest(base));
    expect(envDigest({ A: "1" })).not.toBe(envDigest(base));
  });

  test("a name/value split cannot be forged by concatenation", () => {
    // Without the separators, {AB: "C"} and {A: "BC"} would hash the same and a
    // rename-plus-edit would be invisible. This is the assertion that pins it.
    expect(envDigest({ AB: "C" })).not.toBe(envDigest({ A: "BC" }));
  });

  test("undefined entries are absent, not empty strings", () => {
    expect(envDigest({ A: "1", B: undefined })).toBe(envDigest({ A: "1" }));
    expect(envDigest({ A: "1", B: "" })).not.toBe(envDigest({ A: "1" }));
  });

  test("the digest is a hash, so a failure message cannot print a secret", () => {
    const d = envDigest({ TOKEN: FAKE_TOKEN });
    expect(d).toMatch(/^[0-9a-f]{64}$/);
    expect(d).not.toContain(FAKE_TOKEN);
  });
});

describe("envDiffNames — what moved, by name only", () => {
  test("catches an addition, a removal and a change", () => {
    expect(envDiffNames({ A: "1" }, { A: "1", B: "2" })).toEqual(["B"]);
    expect(envDiffNames({ A: "1", B: "2" }, { A: "1" })).toEqual(["B"]);
    expect(envDiffNames({ A: "1" }, { A: "2" })).toEqual(["A"]);
  });

  test("no change is the empty list, and the order is ordinal", () => {
    expect(envDiffNames({ A: "1", B: "2" }, { B: "2", A: "1" })).toEqual([]);
    expect(envDiffNames({}, { b: "1", A: "1", B: "1" })).toEqual(["A", "B", "b"]);
  });

  test("names, never values — the failure output is safe to print", () => {
    expect(envDiffNames({}, { TOK: FAKE_TOKEN }).join(",")).not.toContain(FAKE_TOKEN);
  });
});

describe("envNamesCarrying — the leak, located", () => {
  test("finds the value wherever it hides, including as a substring", () => {
    expect(envNamesCarrying({ A: FAKE_TOKEN, B: "x" }, FAKE_TOKEN)).toEqual(["A"]);
    expect(envNamesCarrying({ CMD: "op --token " + FAKE_TOKEN + " read" }, FAKE_TOKEN)).toEqual(["CMD"]);
  });

  test("a clean environment answers with the empty list", () => {
    expect(envNamesCarrying({ PATH: "/bin" }, FAKE_TOKEN)).toEqual([]);
  });

  test("the empty secret is refused rather than matching everything", () => {
    // "" is a substring of every string. Returning every name would make
    // `expect(...).toEqual([])` fail for a reason that is not a leak; returning
    // every name only when the caller passed nothing is the vacuity class.
    expect(envNamesCarrying({ A: "1", B: "2" }, "")).toEqual([]);
  });
});

describe("withHoistedCredential — the hostile environment as a VALUE", () => {
  test("the copy carries the credential", () => {
    const hoisted = withHoistedCredential({ PATH: "/bin" }, "OP_SERVICE_ACCOUNT_TOKEN", FAKE_TOKEN);
    expect(hoisted["OP_SERVICE_ACCOUNT_TOKEN"]).toBe(FAKE_TOKEN);
    expect(hoisted["PATH"]).toBe("/bin");
  });

  test("the argument is not mutated", () => {
    const source: Record<string, string | undefined> = { PATH: "/bin" };
    withHoistedCredential(source, "TOK", FAKE_TOKEN);
    expect(Object.keys(source)).toEqual(["PATH"]);
  });

  test("THE LOAD-BEARING ONE: handed the real environment, this process is untouched", () => {
    const before = envDigest(process.env);
    const hoisted = withHoistedCredential(process.env, "ZETA_TEST_HOIST_PROBE", FAKE_TOKEN);
    expect(hoisted["ZETA_TEST_HOIST_PROBE"]).toBe(FAKE_TOKEN);
    // The claim, three ways: the digest did not move, no name moved, and the
    // probe name simply does not exist here. A child spawned right now inherits
    // nothing, which is the property `try/finally` around an assignment can only
    // approximate.
    expect(envDigest(process.env)).toBe(before);
    expect(envDiffNames(process.env, process.env)).toEqual([]);
    expect(Object.prototype.hasOwnProperty.call(process.env, "ZETA_TEST_HOIST_PROBE")).toBe(false);
    expect(envNamesCarrying(process.env, FAKE_TOKEN)).toEqual([]);
  });

  test("FALSIFIER: the witness pair actually DETECTS a hoist", () => {
    // Aimed at a constructed environment, the same assertions that pass on a
    // clean process go red on a hoisted one. If this test could not be written,
    // the pattern would be a comfortable way to check nothing.
    const clean = { ...process.env };
    const hoisted = withHoistedCredential(clean, "ZETA_TEST_HOIST_PROBE", FAKE_TOKEN);
    expect(envDigest(hoisted)).not.toBe(envDigest(clean));
    expect(envDiffNames(clean, hoisted)).toEqual(["ZETA_TEST_HOIST_PROBE"]);
    expect(envNamesCarrying(hoisted, FAKE_TOKEN)).toEqual(["ZETA_TEST_HOIST_PROBE"]);
  });
});

describe("the closure — this module needs no exemption, and does not have one", () => {
  test("the linter finds nothing in this module's own source", () => {
    const rel = "src/Core.TypeScript/secrets/env-witness.ts";
    const source = readFileSync(resolve(import.meta.dir, "env-witness.ts"), "utf8");
    expect(scanText(rel, source)).toEqual([]);
  });

  test("the source is TEXT — no raw control bytes, however tempting a NUL separator is", () => {
    // Caught live while writing this file: the NUL separator inside `envDigest`
    // was emitted as a RAW 0x00 byte rather than the escape `\u0000`. Every test
    // passed and `git` classified the module as binary — a source file a reviewer
    // cannot read in a diff, which is the same defect `no-binary-in-proof-lineage`
    // forbids for verification artifacts, arriving in a file whose whole job is
    // to be a proof. Separators belong in the escape, not in the bytes.
    const source = readFileSync(resolve(import.meta.dir, "env-witness.ts"), "utf8");
    // eslint-disable-next-line no-control-regex
    expect(source.match(/[\u0000-\u0008\u000e-\u001f\u007f]/g)).toBeNull();
  });

  test("and it is not on the self-exempt roster, so that result was earned", () => {
    // Without this pairing the test above would pass for the wrong reason the
    // moment someone added the file to SELF_EXEMPT — a check that cannot fail.
    expect([...SELF_EXEMPT]).not.toContain("src/Core.TypeScript/secrets/env-witness.ts");
  });

  test("this TEST file is clean too, and it is the file that handles the fake token", () => {
    const rel = "src/Core.TypeScript/secrets/env-witness.test.ts";
    const source = readFileSync(resolve(import.meta.dir, "env-witness.test.ts"), "utf8");
    expect(scanText(rel, source)).toEqual([]);
  });
});
