// src/Core.TypeScript/hygiene/audit-cache-key-namespace-parity.test.ts
//
// The guard needs BOTH directions or it is decorative:
//
//   SENSITIVITY — the exact shape measured on `origin/main` (a `nuget` family split
//                 between an arch-qualified and an arch-less key expression) MUST be
//                 reported. This is the defect that charged the same NuGet content
//                 twice and made the slim lane miss 5 of 7 restores.
//   SPECIFICITY — families that are DELIBERATELY separate (`install-…-base-` vs
//                 `install-…-full-`) MUST NOT be reported, and neither may a family
//                 that merely differs in whitespace inside `${{ }}`. A check that
//                 fires on correct code gets switched off, and a check that fires on
//                 everything discriminates nothing.
//
// Also pinned: the REAL `.github` tree is parity-clean, so a regression in the repo
// itself fails here and not only in CI.
//
// And pinned deliberately: the SCAN FLOOR. `MIN_KEYS_EXPECTED` exists because a
// parser that stops matching would otherwise turn this audit green by finding
// nothing — the vacuity class this file exists to refuse.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MIN_KEYS_EXPECTED,
  familyOf,
  findViolations,
  normalizeKey,
  scanCacheKeys,
} from "./audit-cache-key-namespace-parity.ts";

function workflowDir(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "cache-key-parity-"));
  const dir = join(root, "workflows");
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

function step(name: string, key: string): string {
  return [
    "jobs:",
    "  build:",
    "    steps:",
    `      - name: ${name}`,
    "        uses: actions/cache@v6",
    "        with:",
    "          path: ~/.nuget/packages",
    `          key: ${key}`,
    "",
  ].join("\n");
}

describe("familyOf — the namespace a key carves is its LITERAL text", () => {
  test("expressions are erased; only literal segments survive", () => {
    expect(familyOf("nuget-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('x') }}")).toBe("nuget");
    expect(familyOf("nuget-${{ runner.os }}-${{ hashFiles('x') }}")).toBe("nuget");
  });

  test("a literal segment in the MIDDLE makes a genuinely different family", () => {
    const base = familyOf("install-${{ runner.os }}-${{ runner.arch }}-base-${{ hashFiles('x') }}");
    const full = familyOf("install-${{ runner.os }}-${{ runner.arch }}-full-${{ hashFiles('x') }}");
    expect(base).toBe("install|base");
    expect(full).toBe("install|full");
    expect(base).not.toBe(full);
  });

  test("a key that is one bare expression carves no namespace", () => {
    expect(familyOf("${{ steps.x.outputs.key }}")).toBe("");
  });
});

describe("normalizeKey — formatting is not a difference", () => {
  test("whitespace inside the expression is collapsed", () => {
    expect(normalizeKey("a-${{  runner.os   }}")).toBe(normalizeKey("a-${{ runner.os }}"));
  });

  test("but a DIFFERENT expression is still different", () => {
    expect(normalizeKey("a-${{ runner.os }}")).not.toBe(normalizeKey("a-${{ runner.arch }}"));
  });
});

describe("findViolations", () => {
  test("SENSITIVITY: the measured origin/main shape — nuget split by a missing runner.arch", () => {
    const dir = workflowDir({
      "gate.yml": step(
        "Cache NuGet",
        "nuget-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('Directory.Packages.props') }}",
      ),
      "low-memory.yml": step("Cache NuGet", "nuget-${{ runner.os }}-${{ hashFiles('Directory.Packages.props') }}"),
    });
    const v = findViolations(scanCacheKeys([dir]));
    expect(v).toHaveLength(1);
    expect(v[0]?.family).toBe("nuget");
    expect(v[0]?.variants).toHaveLength(2);
  });

  test("SPECIFICITY: base/full are separate families and are NOT reported", () => {
    const dir = workflowDir({
      "a.yml": step("Cache install base", "install-${{ runner.os }}-${{ runner.arch }}-base-${{ hashFiles('x') }}"),
      "b.yml": step("Cache install full", "install-${{ runner.os }}-${{ runner.arch }}-full-${{ hashFiles('x') }}"),
    });
    expect(findViolations(scanCacheKeys([dir]))).toHaveLength(0);
  });

  test("SPECIFICITY: identical expressions across many files are NOT reported", () => {
    const key = "install-v2-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('.mise.toml') }}";
    const dir = workflowDir({
      "a.yml": step("Restore toolchain", key),
      "b.yml": step("Restore toolchain", key),
      "c.yml": step("Restore toolchain", key),
    });
    expect(findViolations(scanCacheKeys([dir]))).toHaveLength(0);
  });

  test("SPECIFICITY: whitespace-only differences are NOT a violation", () => {
    const dir = workflowDir({
      "a.yml": step("Cache", "nuget-${{ runner.os }}-${{ hashFiles('x') }}"),
      "b.yml": step("Cache", "nuget-${{runner.os}}-${{  hashFiles('x')  }}"),
    });
    expect(findViolations(scanCacheKeys([dir]))).toHaveLength(0);
  });

  test("a single-use family cannot disagree with anything (why no allowlist is needed)", () => {
    const dir = workflowDir({
      "lean.yml": step("Cache lake", "lake-${{ runner.os }}-${{ hashFiles('lean-toolchain') }}"),
    });
    expect(findViolations(scanCacheKeys([dir]))).toHaveLength(0);
  });
});

describe("scanCacheKeys", () => {
  test("restore-keys blocks are NOT swept in as keys", () => {
    const dir = workflowDir({
      "a.yml": [
        "jobs:",
        "  build:",
        "    steps:",
        "      - uses: actions/cache@v6",
        "        with:",
        "          key: lake-${{ runner.os }}-${{ hashFiles('x') }}",
        "          restore-keys: |",
        "            lake-${{ runner.os }}-",
        "",
      ].join("\n"),
    });
    const keys = scanCacheKeys([dir]);
    expect(keys).toHaveLength(1);
    expect(keys[0]?.key).toBe("lake-${{ runner.os }}-${{ hashFiles('x') }}");
  });

  test("a trailing comment is not part of the key", () => {
    const dir = workflowDir({ "a.yml": step("Cache", "nuget-${{ runner.os }}-${{ hashFiles('x') }} # note") });
    expect(scanCacheKeys([dir])[0]?.key).toBe("nuget-${{ runner.os }}-${{ hashFiles('x') }}");
  });
});

describe("the real repository", () => {
  test("the live .github tree is parity-clean", () => {
    const keys = scanCacheKeys([".github/workflows", ".github/actions"]);
    expect(findViolations(keys)).toEqual([]);
  });

  test("SCAN FLOOR: the live tree yields enough keys for the audit to mean something", () => {
    // If this drops below MIN_KEYS_EXPECTED the CLI exits 2 rather than 0.
    // Pinned here so a parser regression fails in `bun test` too, not only in CI.
    const keys = scanCacheKeys([".github/workflows", ".github/actions"]);
    expect(keys.length).toBeGreaterThanOrEqual(MIN_KEYS_EXPECTED);
  });

  test("SCAN FLOOR cannot be silently weakened to make the audit pass", () => {
    // Without this, `MIN_KEYS_EXPECTED = 0` passes every other test in this file —
    // measured by mutation, not assumed. A floor of zero is not a floor: it turns
    // "the scan found nothing" from a FAILURE into a PASS, which is precisely the
    // vacuity class this audit exists to refuse. Lowering the floor is a decision
    // that has to be made here, in the open, against a red test.
    expect(MIN_KEYS_EXPECTED).toBeGreaterThanOrEqual(25);
  });
});
