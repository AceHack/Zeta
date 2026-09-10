// lint-overrides-take-effect.test.ts -- falsifiers for the override enforcer.
//
// Every assertion below is paired with a MUTATION: the input that must make it
// FAIL. A guard that accepts both the good and the bad input is not a guard,
// and this file is where that would show.
//
// Tests are flat rather than grouped so each one names its own subject.

import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  bunLockResolutions,
  evaluate,
  main,
  packageLockResolutions,
  readOverrides,
  type LockfileView,
} from "./lint-overrides-take-effect";

/** hygiene -> Core.TypeScript -> src -> repo root. */
const REPO_ROOT = dirname(dirname(dirname(import.meta.dir)));

/** A lockfile view backed by a fixed map, so the judgement is testable offline. */
function view(path: string, table: Record<string, string[]>): LockfileView {
  return { path, resolve: (n) => table[n] ?? [] };
}

/** A bun.lock fragment carrying one package twice: plain, and behind an alias. */
const BUN_LOCK_SAMPLE = [
  '  "packages": {',
  '    "smol-toml": ["smol-toml@1.7.1", "", {}, "sha512-x"],',
  '    "table/ajv": ["ajv@8.20.0", "", {}, "sha512-y"],',
  '    "ajv": ["ajv@6.12.6", "", {}, "sha512-z"],',
  "  }",
].join("\n");

/** package-lock.json shape: the same package resolved at two nesting depths. */
const NPM_LOCK_ENTRIES: readonly (readonly [string, string])[] = [
  ["node_modules/smol-toml", "1.7.1"],
  ["node_modules/table/node_modules/ajv", "8.20.0"],
  ["node_modules/ajv", "6.12.6"],
];

function npmLockText(): string {
  const packages: Record<string, unknown> = {};
  packages[""] = { name: "root" };
  for (const pair of NPM_LOCK_ENTRIES) packages[pair[0]] = { version: pair[1] };
  return JSON.stringify({ packages });
}

// ---------------------------------------------------------------- readOverrides

test("readOverrides reads a flat overrides map", () => {
  const text = JSON.stringify({ overrides: { a: "1.0.0" } });
  expect(readOverrides(text)).toEqual({ a: "1.0.0" });
});

test("readOverrides treats an absent block as empty, not as an error", () => {
  expect(readOverrides(JSON.stringify({ name: "x" }))).toEqual({});
});

// ------------------------------------------------------------ bunLockResolutions

test("bunLockResolutions finds a top-level resolution", () => {
  expect(bunLockResolutions(BUN_LOCK_SAMPLE, "smol-toml")).toEqual(["1.7.1"]);
});

// THE REASON IT MATCHES THE RESOLUTION AND NOT THE KEY: an alias entry
// ("table/ajv") carries a SECOND resolution of the same package, and a split
// resolution is exactly where an unhonoured override hides. Keying on the map
// key alone would report only 6.12.6 and call this lockfile clean.
test("bunLockResolutions finds resolutions hidden behind an alias key", () => {
  expect(bunLockResolutions(BUN_LOCK_SAMPLE, "ajv")).toEqual(["6.12.6", "8.20.0"]);
});

test("bunLockResolutions returns nothing for a package the lockfile lacks", () => {
  expect(bunLockResolutions(BUN_LOCK_SAMPLE, "nope")).toEqual([]);
});

test("bunLockResolutions escapes a scoped name rather than interpreting it", () => {
  const scoped = JSON.stringify(["@scope/pkg@2.0.0", "", {}, "sha512-q"]);
  expect(bunLockResolutions(scoped, "@scope/pkg")).toEqual(["2.0.0"]);
});

// -------------------------------------------------------- packageLockResolutions

test("packageLockResolutions matches the final path segment, so nested copies count", () => {
  expect(packageLockResolutions(npmLockText(), "ajv")).toEqual(["6.12.6", "8.20.0"]);
});

// MUTATION GUARD: a substring match would make "toml" collide with "smol-toml"
// and report a version for a package that is not there.
test("packageLockResolutions does not match a name that is a suffix of another", () => {
  expect(packageLockResolutions(npmLockText(), "toml")).toEqual([]);
});

// -------------------------------------------------------------------- evaluate

test("evaluate is clean when every lockfile resolves exactly the declared version", () => {
  const locks = [view("bun.lock", { "smol-toml": ["1.7.1"] }), view("package-lock.json", { "smol-toml": ["1.7.1"] })];
  expect(evaluate({ "smol-toml": "1.7.1" }, locks)).toEqual([]);
});

// MUTATION of the test above: one lockfile still carries the old version. This
// is the fix-only-the-scanner-can-see shape and it must be refused.
test("evaluate REFUSES when only one lockfile honours the override", () => {
  const locks = [view("bun.lock", { "smol-toml": ["1.6.1"] }), view("package-lock.json", { "smol-toml": ["1.7.1"] })];
  const findings = evaluate({ "smol-toml": "1.7.1" }, locks);
  expect(findings).toHaveLength(1);
  expect(findings[0]?.kind).toBe("lockfile-drift");
  expect(findings[0]?.lockfile).toBe("bun.lock");
  expect(findings[0]?.message).toContain("1.6.1");
});

test("evaluate REFUSES a split resolution even when one of the two is correct", () => {
  const locks = [view("bun.lock", { ajv: ["6.12.6", "8.20.0"] }), view("package-lock.json", { ajv: ["8.20.0"] })];
  const findings = evaluate({ ajv: "8.20.0" }, locks);
  expect(findings.map((f) => f.lockfile)).toEqual(["bun.lock"]);
});

test("evaluate REFUSES an override naming a package no lockfile carries", () => {
  const locks = [view("bun.lock", {}), view("package-lock.json", {})];
  const findings = evaluate({ ghost: "1.0.0" }, locks);
  expect(findings).toHaveLength(2);
  for (const f of findings) expect(f.message).toContain("resolves NO version");
});

// The measured bun trap from PR #17124: bun IGNORES nested overrides while npm
// honours them, so a nested key produces a lockfile pair that disagrees by
// construction. Refused before it ever reaches a lockfile.
test("evaluate REFUSES a nested override key", () => {
  const locks = [view("bun.lock", {}), view("package-lock.json", {})];
  const nested: Record<string, string> = { "cosmiconfig>js-yaml": "4.3.2" };
  const findings = evaluate(nested, locks);
  expect(findings).toHaveLength(1);
  expect(findings[0]?.kind).toBe("nested-key");
});

test("evaluate REFUSES a range, which does not pin", () => {
  const locks = [view("bun.lock", { qs: ["6.16.0"] }), view("package-lock.json", { qs: ["6.16.0"] })];
  for (const bad of ["^6.16.0", "~6.16.0", ">=6.16.0", "latest", "*", "6.x"]) {
    const findings = evaluate({ qs: bad }, locks);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("not-exact");
  }
});

test("evaluate accepts a prerelease, which is still exact", () => {
  const locks = [view("bun.lock", { x: ["1.0.0-rc.1"] }), view("package-lock.json", { x: ["1.0.0-rc.1"] })];
  expect(evaluate({ x: "1.0.0-rc.1" }, locks)).toEqual([]);
});

// ------------------------------------------------- the live tree, and UNKNOWN

// A probe that could not run carries zero information about its subject, so a
// missing package.json must NOT read as a pass.
test("main exits 2, not 0, when there is no package.json to read", () => {
  expect(main(join(import.meta.dir, "no-such-dir-for-overrides-test"))).toBe(2);
});

test("this repo own overrides are honoured by both lockfiles", () => {
  expect(main(REPO_ROOT)).toBe(0);
});

// The test above would pass vacuously against a repo that declared no overrides
// and shipped no lockfiles. This names the subject so that cannot happen quietly.
test("the repo actually declares overrides and ships both lockfiles", () => {
  const overrides = readOverrides(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  expect(Object.keys(overrides).length).toBeGreaterThan(0);
  expect(existsSync(join(REPO_ROOT, "bun.lock"))).toBe(true);
  expect(existsSync(join(REPO_ROOT, "package-lock.json"))).toBe(true);
});

// CVE-2026-85730: smol-toml at or below 1.7.0 never returns on a comment that
// ends the document inside an array (measured: 1.6.1 pinned a core at 100% and
// was still running at the 15s timeout; 1.7.1 throws TomlError in under a
// second). markdownlint-cli2 0.23.2 declares an EXACT 1.7.0, so this override is
// the only thing carrying the tree past the advisory. Lowering or deleting it
// fails here rather than waiting for the next Dependabot scan.
test("the smol-toml override stays at the CVE-2026-85730 patched version", () => {
  const overrides = readOverrides(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  expect(overrides["smol-toml"]).toBe("1.7.1");
});
