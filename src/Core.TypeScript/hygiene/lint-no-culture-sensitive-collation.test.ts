/**
 * lint-no-culture-sensitive-collation.test.ts
 *
 * The point of these tests is that the guard CAN FAIL. A lint whose positive
 * cases are never exercised is a check that cannot fail, which is not a check —
 * this repo shipped `lint:markdown` linting zero files and exiting 0 for months
 * (#10712), and it would be a poor joke to ship another one in a PR whose whole
 * subject is checks that cannot fail.
 *
 * So: every banned API gets a mutant that MUST be caught, every near-miss that
 * must NOT be caught is pinned, the two empirical claims the linter's scope
 * rests on are measured here rather than asserted, and there is a live tripwire
 * over the real tracked tree at the bottom.
 */

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import baselineJson from "./lint-no-culture-sensitive-collation.baseline.json";
import {
  ALLOWLIST,
  MIN_FILES_EXPECTED,
  RULES,
  isExcluded,
  isScannableKind,
  ratchet,
  scanRepoDetailed,
  scanText,
  stripCommentsAndStrings,
  type Finding,
} from "./lint-no-culture-sensitive-collation.ts";

const F = "src/Core.TypeScript/example/thing.ts";

/** Code-unit order — the deterministic baseline these tests compare locale order against. */
function ordinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ── MUTATION TABLE — one live mutant per banned API ────────────────────────────
// Each row is a real call site. If the linter stops catching any of them, the
// corresponding row goes green-when-it-should-be-red and this test fails.
const MUTANTS: readonly { readonly api: string; readonly code: string }[] = [
  { api: "localeCompare", code: 'const s = xs.sort((a, b) => a.localeCompare(b));' },
  { api: "localeCompare", code: 'const s = xs.sort((a, b) => a.name.localeCompare(b.name, "en"));' },
  { api: "localeCompare", code: "const c = left . localeCompare ( right );" },
  { api: "Intl.Collator", code: 'const c = new Intl.Collator("en").compare;' },
  { api: "Intl.DateTimeFormat", code: 'const d = new Intl.DateTimeFormat("en-US").format(t);' },
  { api: "Intl.NumberFormat", code: 'const n = new Intl.NumberFormat().format(1.5);' },
  { api: "toLocaleLowerCase", code: "const k = id.toLocaleLowerCase();" },
  { api: "toLocaleUpperCase", code: "const k = id.toLocaleUpperCase();" },
  { api: "toLocaleString", code: "const s = count.toLocaleString();" },
  { api: "toLocaleDateString", code: "const s = new Date().toLocaleDateString();" },
  { api: "toLocaleTimeString", code: "const s = new Date().toLocaleTimeString();" },
];

describe("mutation table — introducing each banned API turns the lint red", () => {
  for (const m of MUTANTS) {
    test(`${m.api}: ${m.code}`, () => {
      const found = scanText(F, m.code);
      expect(found.length).toBeGreaterThan(0);
      expect(found.map((f) => f.api)).toContain(m.api);
    });
  }

  test("every rule in RULES has at least one mutant — no rule ships unexercised", () => {
    const covered = new Set(MUTANTS.map((m) => m.api));
    const uncovered = RULES.map((r) => r.api).filter((a) => !covered.has(a));
    expect(uncovered).toEqual([]);
  });

  test("removing the mutant turns it green again (the other half of the falsifier)", () => {
    expect(scanText(F, "const s = xs.sort((a, b) => stringCompare(a, b));")).toEqual([]);
  });
});

// ── NEAR-MISSES — the linter must not fire on these ───────────────────────────
describe("near-misses — prose about the ban is not a violation of it", () => {
  test("a line comment explaining why NOT to use localeCompare is not a finding", () => {
    expect(scanText(F, "// Ordinal comparison — NEVER localeCompare, which is culture-sensitive.")).toEqual([]);
  });

  test("a block/JSDoc comment mentioning it is not a finding", () => {
    const doc = [
      "/**",
      " * Ordinal (code-unit) order. Deliberately NOT `localeCompare`: that is",
      " * culture-sensitive, so two machines can disagree.",
      " */",
      "export function ordinalCompare(a: string, b: string): number {",
      "  return a < b ? -1 : a > b ? 1 : 0;",
      "}",
    ].join("\n");
    expect(scanText(F, doc)).toEqual([]);
  });

  test("the API name inside a string literal is not a call site", () => {
    expect(scanText(F, 'const banned = ["localeCompare", "toLocaleString"];')).toEqual([]);
    expect(scanText(F, "const msg = `do not use .localeCompare( here`;")).toEqual([]);
  });

  test("a LIVE call one line below a comment about it IS still caught", () => {
    const mixed = ["// we should not use localeCompare here", "xs.sort((a, b) => a.localeCompare(b));"].join("\n");
    const found = scanText(F, mixed);
    expect(found.length).toBe(1);
    expect(found[0]?.line).toBe(2); // line numbers survive comment stripping
  });

  test("a similarly-named but locale-free API is not caught", () => {
    expect(scanText(F, "const k = id.toLowerCase();")).toEqual([]);
    expect(scanText(F, "const s = n.toString();")).toEqual([]);
    expect(scanText(F, "const d = t.toISOString();")).toEqual([]);
  });
});

// ── The two empirical claims the linter's SCOPE rests on ──────────────────────
// These are measurements, not assertions. If either flips, the scope is wrong.
describe("scope claims, measured", () => {
  const PROBE = ["Zed", "alpha", "ä", "a", "B", "b", "\u{10000}", "Ｚ", "0", "_"];

  test("default Array.sort() is UTF-16 code-unit order, NOT culture-sensitive — so it is correctly NOT a target", () => {
    const dflt = [...PROBE].sort();
    const codeUnit = [...PROBE].sort(ordinal);
    const locale = [...PROBE].sort((a, b) => a.localeCompare(b));
    expect(dflt).toEqual(codeUnit); // ECMA-262 SortCompare: ToString + abstract relational comparison
    expect(dflt).not.toEqual(locale); // and it is genuinely a different order, so the claim is not vacuous
  });

  test("localeCompare genuinely diverges from the canonical order on REAL repo-shaped keys", () => {
    // Not a synthetic alphabet: repo-shaped file names, which is where it bites.
    const paths = [
      "src/Core.Abstractions/ICheckpointReader.cs",
      "src/Core.Abstractions/ICheckpointable.cs",
      "src/Core.Abstractions/ICheckpointStore.cs",
    ];
    const byLocale = [...paths].sort((a, b) => a.localeCompare(b));
    const byOrdinal = [...paths].sort(ordinal);
    expect(byLocale).not.toEqual(byOrdinal); // the defect is live on today's tree, not hypothetical
  });
});

// ── Comment/string stripper ───────────────────────────────────────────────────
describe("stripCommentsAndStrings preserves line structure", () => {
  test("line count is unchanged so reported line numbers are true", () => {
    const src = ["/* a", "   b */", "const x = `t", "u`;", "// c", "const y = 1;"].join("\n");
    expect(stripCommentsAndStrings(src).split("\n").length).toBe(src.split("\n").length);
  });

  test("code after a block comment on the same line survives", () => {
    const found = scanText(F, "/* note */ xs.sort((a, b) => a.localeCompare(b));");
    expect(found.length).toBe(1);
  });
});

// ── Scope + allowlist hygiene ─────────────────────────────────────────────────
describe("scope", () => {
  test("TS/JS kinds are scanned; F#, JSON, Lean and markdown are not", () => {
    expect(isScannableKind("a/b.ts")).toBe(true);
    expect(isScannableKind("a/b.tsx")).toBe(true);
    expect(isScannableKind("a/b.mjs")).toBe(true);
    expect(isScannableKind("a/b.fs")).toBe(false);
    expect(isScannableKind("a/b.json")).toBe(false);
    expect(isScannableKind("a/b.md")).toBe(false);
  });

  test("prior-art mirror, node_modules and frozen orphan-branch snapshots are excluded", () => {
    expect(isExcluded("references/prior-art/foo/bar.ts")).toBe(true);
    expect(isExcluded("x/node_modules/y/z.ts")).toBe(true);
    expect(isExcluded("docs/recovered-orphan-branches-2026-05/misc/a.ts")).toBe(true);
    expect(isExcluded("src/Core.TypeScript/bus/bus.ts")).toBe(false);
  });

  test("every allowlist entry carries a non-trivial reason — an unreasoned exemption is an unexamined bug", () => {
    for (const a of ALLOWLIST) {
      expect(a.reason.length).toBeGreaterThan(20);
    }
  });

  test("allowlisted files really are exempt", () => {
    const self = "src/Core.TypeScript/hygiene/lint-no-culture-sensitive-collation.ts";
    expect(scanText(self, "xs.sort((a, b) => a.localeCompare(b));")).toEqual([]);
  });
});

// ── The ratchet ───────────────────────────────────────────────────────────────
describe("ratchet — the baseline is a debt ceiling that may only fall", () => {
  const f = (file: string, n: number): Finding[] =>
    Array.from({ length: n }, (_, i) => ({ file, line: i + 1, api: "localeCompare", why: "w", text: "t" }));

  test("a file NOT in the baseline may have zero findings", () => {
    const v = ratchet(new Map([["a.ts", f("a.ts", 1)]]), {});
    expect(v.length).toBe(1);
    expect(v[0]?.kind).toBe("new-file");
  });

  test("a baselined file going OVER its count fails", () => {
    const base = { "a.ts": { count: 2, category: "c", reason: "r" } };
    expect(ratchet(new Map([["a.ts", f("a.ts", 3)]]), base)[0]?.kind).toBe("count-increase");
  });

  test("a baselined file at or UNDER its count passes — paying debt down is never a failure", () => {
    const base = { "a.ts": { count: 2, category: "c", reason: "r" } };
    expect(ratchet(new Map([["a.ts", f("a.ts", 2)]]), base)).toEqual([]);
    expect(ratchet(new Map([["a.ts", f("a.ts", 1)]]), base)).toEqual([]);
  });
});

// ── LIVE tripwire ─────────────────────────────────────────────────────────────
describe("LIVE tripwire — the tracked tree must stay at or under baseline", () => {
  test(
    "no file exceeds its baselined count",
    () => {
      const root = resolve(import.meta.dir, "..", "..", "..");
      const { filesScanned, byFile } = scanRepoDetailed(root);
      // Anti-vacuity: a scan of nothing passing is the failure mode this whole PR is about.
      expect(filesScanned).toBeGreaterThanOrEqual(MIN_FILES_EXPECTED);
      // And the scan must actually find the known debt — a stripper bug that
      // silently matched nothing would otherwise read as a clean tree.
      expect(byFile.size).toBeGreaterThan(0);

      const violations = ratchet(byFile, baselineJson.entries);
      expect(violations.map((v) => `${v.file} (${String(v.found)} > ${String(v.allowed)})`)).toEqual([]);
    },
    120_000,
  );

  test("every baseline row carries a category and a reason", () => {
    const bad = Object.entries(baselineJson.entries)
      .filter(([, e]) => e.category === "UNCATEGORIZED" || e.reason.startsWith("TODO") || e.reason.length < 20)
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });
});
