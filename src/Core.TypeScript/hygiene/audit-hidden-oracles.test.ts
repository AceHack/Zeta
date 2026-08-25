// src/Core.TypeScript/hygiene/audit-hidden-oracles.test.ts
//
// The detector's own falsifiers. Two directions, both mutated, both counted:
//
//   SENSITIVITY — strip the attribution off a constant that currently passes, and it MUST
//                 flag. A detector that flags nothing is worthless.
//   SPECIFICITY — attach an attribution to a constant that currently flags, and it MUST
//                 stop flagging. A detector that flags everything is equally worthless,
//                 and is worse in one respect: it teaches people to ignore it.
//
// The mutants are REAL REPO FILES, not fixtures. Fixtures would let the detector pass a
// test it could never pass in the field, which is the vacuity class this repo names most
// often. `mutation-metrics.test.ts`-style counts are printed by the last test in each
// block so the numbers in the PR body are reproducible rather than asserted.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  escapeRegExp,
  ATTRIBUTION_MARKERS,
  attributionWindow,
  BUDGET_WORDS,
  decidesVerdict,
  findGating,
  ordinal,
  runAudit,
  scanBaseline,
  scanText,
  trackedFiles,
  valueShape,
  type Candidate,
} from "./audit-hidden-oracles.ts";

const REPO = resolve(import.meta.dir, "..", "..", "..");

/** Strip every comment line and every trailing comment — the attribution mutation. */
function stripComments(text: string): string {
  return text
    .split("\n")
    .filter((l) => !/^\s*(?:\/\/|\*|\/\*|\/\/\/|\(\*)/.test(l))
    .map((l) => l.replace(/\s\/\/.*$/, ""))
    .join("\n");
}

describe("the recognizer halves, in isolation", () => {
  test("a bare gating constant is a candidate", () => {
    const src = ["const MAX_ROWS = 50;", "if (rows.length > MAX_ROWS) throw new Error('too many');"].join("\n");
    const out = scanText("x.ts", src);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe("MAX_ROWS");
    expect(out[0]?.attributed).toBe(false);
    expect(out[0]?.tier).toBe("verdict");
  });

  test("a constant that gates NOTHING is not a candidate — existence is not the defect", () => {
    const src = ["const MAX_ROWS = 50;", "console.log(MAX_ROWS);"].join("\n");
    expect(scanText("x.ts", src)).toEqual([]);
  });

  test("a `let` accumulator is not a budget — it holds a measurement, it does not impose one", () => {
    const src = ["let max = 0;", "for (const x of xs) if (x > max) max = x;"].join("\n");
    expect(scanText("x.ts", src)).toEqual([]);
  });

  test("a comparison inside a COMMENT is not a gate", () => {
    const src = ["const MAX_ROWS = 50;", "// note: rows.length > MAX_ROWS would be bad"].join("\n");
    expect(scanText("x.ts", src)).toEqual([]);
  });

  test("a name outside the budget roster is out of declared scope", () => {
    const src = ["const WIDGETS = 50;", "if (n > WIDGETS) throw new Error('x');"].join("\n");
    expect(scanText("x.ts", src)).toEqual([]);
    expect(BUDGET_WORDS).not.toContain("widgets");
  });

  test("decidesVerdict looks at the IMMEDIATELY following non-blank line, not N lines", () => {
    const gateThenThrow = ["if (n > LIMIT) {", "", "  throw new Error('over');", "}"];
    expect(decidesVerdict(gateThenThrow, 0)).toBe(true);
    const gateThenNothing = ["if (n > LIMIT) {", "  n = LIMIT;", "}", "throw new Error('unrelated');"];
    expect(decidesVerdict(gateThenNothing, 0)).toBe(false);
  });

  test("findGating skips the declaration line itself", () => {
    const lines = ["const MAX_X = 5;", "if (a >= MAX_X) {}"];
    expect(findGating(lines, "MAX_X").map((g) => g.line)).toEqual([1]);
  });
});

describe("SPECIFICITY — attribution is the discriminator, and it must be real attribution", () => {
  for (const marker of ATTRIBUTION_MARKERS) {
    test(`marker '${marker.id}' alone makes a gating constant PASS`, () => {
      const example: Record<string, string> = {
        "named-human": "// Aaron picked this ceiling 2026-08-17; it is the maintainer's to retune.",
        "work-item": "// Chosen under 081KT07NV0008QG0R001YDB73K after the sizing review.",
        "pr-or-issue": "// Landed in #11445 after the false-positive triage.",
        "doc-anchor": "// Per docs/governance/MANIFESTO.md the bound must be finite.",
        measured: "// Measured over 40 gate runs: p95 start latency 28 minutes.",
        adopted: "// Adopted from the F# derivation so the two agree on one dial.",
        "declared-dial": "// An arbitrary policy dial — retunable, nothing derives it.",
      };
      const comment = example[marker.id];
      expect(comment).toBeDefined();
      const src = [comment ?? "", "const MAX_ROWS = 50;", "if (rows > MAX_ROWS) throw new Error('x');"].join("\n");
      const out = scanText("x.ts", src);
      expect(out).toHaveLength(1);
      expect(out[0]?.attributionMarkers).toContain(marker.id);
      expect(out[0]?.attributed).toBe(true);
    });
  }

  test("a comment that merely RESTATES the value is not attribution", () => {
    const src = ["// 50 rows.", "const MAX_ROWS = 50;", "if (rows > MAX_ROWS) throw new Error('x');"].join("\n");
    expect(scanText("x.ts", src)[0]?.attributed).toBe(false);
  });

  test("a module-header paragraph naming the constant attributes it from any distance", () => {
    const src = [
      "// MAX_ROWS is adopted from the upstream protocol limit.",
      ...Array.from({ length: 200 }, () => "const filler = 1;"),
      "const MAX_ROWS = 50;",
      "if (rows > MAX_ROWS) throw new Error('x');",
    ].join("\n");
    expect(scanText("x.ts", src).find((c) => c.name === "MAX_ROWS")?.attributed).toBe(true);
  });

  test("the attribution window is the CONTIGUOUS block above — an unrelated far comment does not leak in", () => {
    const lines = [
      "// Aaron authorised the whole module.",
      "const unrelated = 1;",
      "",
      "const MAX_ROWS = 50;",
      "if (rows > MAX_ROWS) throw new Error('x');",
    ];
    // Line 3 is the declaration. The block above it is empty (line 1's comment is
    // separated by a CODE line), so the window must not reach the 'Aaron' line.
    expect(attributionWindow(lines, 3, "MAX_ROWS")).not.toContain("Aaron");
  });
});

describe("value shape — the authority lives where the number is WRITTEN", () => {
  test("a derived binding is not a candidate; the upstream constant is", () => {
    expect(valueShape("start + DISK_BOOT_TIMEOUT_SECONDS * 1000")).toBe("derived");
    expect(valueShape("Math.max(0, Math.floor(lookbackMs))")).toBe("derived");
    expect(valueShape("W * H * 4")).toBe("derived");
  });

  test("a literal expression is a candidate", () => {
    expect(valueShape("65536")).toBe("literal");
    expect(valueShape("200 * 1024 * 1024")).toBe("literal");
  });

  test("a DIGIT SEPARATOR is not an identifier — `1_000` is a literal, not a derived binding", () => {
    // The regression: `_` starts an identifier, so `1_000` lexed as the literal `1` plus an
    // identifier `_000`, and every underscore-separated constant was silently dropped from the
    // scan as "derived". 32 budget-named declarations repo-wide were invisible for this reason
    // alone, `SimLoop.defaultBudget`'s `MaxTicks = 1_000_000` among them.
    expect(valueShape("1_000")).toBe("literal");
    expect(valueShape("1_000_000")).toBe("literal");
    expect(valueShape("300_000L")).toBe("literal"); // F# int64 suffix
    expect(valueShape("60_000")).toBe("literal");
    // and the discrimination it must NOT lose: a real identifier still reads as derived
    expect(valueShape("BASE_TIMEOUT_MS * 1_000")).toBe("derived");
    expect(valueShape("Number(process.env.X ?? 30_000)")).toBe("defaulting");
  });

  test("a literal in the fallback position is a DIAL — the override is the exit", () => {
    expect(valueShape("Number(process.env.BYTELOCK_MIN_SUBSTRATES ?? 2)")).toBe("defaulting");
    expect(valueShape("config.oracleThreshold ?? 0.9")).toBe("defaulting");
    expect(valueShape("minIdx >= 0 ? Number(argv[minIdx + 1]) : 10")).toBe("defaulting");
  });

  test("the derived filter is not a blanket silencer — a derived value still gates, we just point elsewhere", () => {
    const src = ["const maxWait = base * 1000;", "if (t > maxWait) throw new Error('x');"].join("\n");
    expect(scanText("x.ts", src)).toEqual([]);
  });
});

describe("regressions found by READING the audit's own output", () => {
  test("an F# [<Literal>] attribute does not separate a doc comment from its binding", () => {
    // BusRegime.fs's HonestCeilingRho was reported bare while carrying a full
    // Tsirelson-fraction derivation, because `[<Literal>]` sat between the two.
    const src = [
      "    /// Chosen as the Tsirelson fraction of the CHSH range, matching (|S|-2)/2.",
      "    [<Literal>]",
      "    let HonestCeilingRho = 0.41421356237309515",
      "    let above = abs correlation > HonestCeilingRho",
    ].join("\n");
    const found = scanText("x.fs", src).find((c) => c.name === "HonestCeilingRho");
    expect(found?.attributed).toBe(true);
  });

  test("the live F# instance is genuinely attributed on main", () => {
    const rel = "src/Bayesian/BusRegime.fs";
    const found = scanText(rel, readFileSync(join(REPO, rel), "utf8")).find((c) => c.name === "HonestCeilingRho");
    expect(found?.attributed).toBe(true);
  });

  test("F# `let mutable` is an accumulator, not a budget", () => {
    const src = ["let mutable attempts = 0", "if attempts > 1024 then failwith \"too many\""].join("\n");
    expect(scanText("x.fs", src)).toEqual([]);
  });
});

describe("the positive control — a budget that names its provenance must not be flagged", () => {
  test("MAX_GRANT_SPAN_PHASES (key-custody) passes as attributed", () => {
    const rel = "src/Core.TypeScript/key-custody/key-custody.ts";
    const found = scanText(rel, readFileSync(join(REPO, rel), "utf8")).find(
      (c) => c.name === "MAX_GRANT_SPAN_PHASES",
    );
    expect(found).toBeDefined();
    expect(found?.attributed).toBe(true);
    // It is attributed three independent ways, which is why it is the control.
    expect([...(found?.attributionMarkers ?? [])].sort(ordinal)).toEqual(["adopted", "declared-dial", "named-human"]);
  });

  test("SENSITIVITY on the control: strip its provenance comment and it flags", () => {
    const rel = "src/Core.TypeScript/key-custody/key-custody.ts";
    const mutated = stripComments(readFileSync(join(REPO, rel), "utf8"));
    const found = scanText(rel, mutated).find((c) => c.name === "MAX_GRANT_SPAN_PHASES");
    expect(found).toBeDefined();
    expect(found?.attributed).toBe(false);
  });
});

describe("the live instance this defect class was named from", () => {
  test("required-check-started.ts's --min-age-min default is flagged, as a dial", () => {
    const rel = "src/Core.TypeScript/forge-host/github/required-check-started.ts";
    const found = scanText(rel, readFileSync(join(REPO, rel), "utf8")).find((c) => c.name === "minAgeMin");
    expect(found).toBeDefined();
    expect(found?.attributed).toBe(false);
    // Overridable from the command line — exit exists, so it is a dial rather than a
    // verdict. The DEFAULT is still nobody's on-the-record choice, which is the finding.
    expect(found?.tier).toBe("dial");
  });
});

describe("baselines — the same discriminator, in JSON", () => {
  test("a debt ledger that says what it is passes", () => {
    const rel = "src/Core.TypeScript/hygiene/lint-no-culture-sensitive-collation.baseline.json";
    expect(scanBaseline(rel, readFileSync(join(REPO, rel), "utf8")).attributed).toBe(true);
  });

  test("a bare array baseline has nowhere to carry provenance and is flagged", () => {
    expect(scanBaseline("x.baseline.json", '[{"file":"a"}]').attributed).toBe(false);
  });

  test("an empty doc string is not attribution", () => {
    expect(scanBaseline("x.baseline.json", '{"_doc":"   ","entries":[]}').attributed).toBe(false);
  });
});

// ── The measured mutation numbers ────────────────────────────────────────────────────

describe("MUTATION — measured over the whole repo, both directions", () => {
  const files = trackedFiles(REPO);
  const report = runAudit(REPO, files);

  test("liveness: the audit inspected something", () => {
    expect(report.filesScanned).toBeGreaterThanOrEqual(1);
    expect(report.candidatesSeen).toBeGreaterThanOrEqual(1);
  });

  test("SENSITIVITY = 100% — every attributed constant flags once its attribution is removed", () => {
    const byFile = new Map<string, Candidate[]>();
    for (const c of report.attributedPasses) byFile.set(c.file, [...(byFile.get(c.file) ?? []), c]);

    let total = 0;
    let flagged = 0;
    for (const [file, cands] of [...byFile.entries()].sort((a, b) => ordinal(a[0], b[0]))) {
      const mutated = scanText(file, stripComments(readFileSync(join(REPO, file), "utf8")));
      for (const c of cands) {
        total++;
        // Stripping comments can only remove attribution, never the gate — so the
        // constant must still be a candidate AND every same-named declaration in the
        // file must now be unattributed. (Line numbers shift unpredictably under a
        // comment strip, so this direction grades by name across all occurrences.)
        const after = mutated.filter((m) => m.name === c.name);
        if (after.length > 0 && after.every((m) => !m.attributed)) flagged++;
      }
    }
    process.stdout.write(`\n  SENSITIVITY: ${flagged}/${total} attribution-stripped constants flag\n`);
    expect(total).toBeGreaterThanOrEqual(1);
    expect(flagged).toBe(total);
  });

  test("SPECIFICITY = 100% — every flagged constant stops flagging once attribution is added", () => {
    const byFile = new Map<string, Candidate[]>();
    for (const c of report.findings) byFile.set(c.file, [...(byFile.get(c.file) ?? []), c]);

    let total = 0;
    let silenced = 0;
    for (const [file, cands] of [...byFile.entries()].sort((a, b) => ordinal(a[0], b[0]))) {
      const lines = readFileSync(join(REPO, file), "utf8").split("\n");
      for (const c of cands) {
        total++;
        // Inject the provenance a maintainer would have written, immediately above.
        const mutated = [...lines];
        mutated.splice(c.line - 1, 0, "// Adopted from the sizing review; Aaron's dial, retunable. See #11445.");
        // Match on LINE, not name: several files declare the same budget name more than
        // once (`maxDepth` three times in cockroach-up-projection.ts), and matching by
        // name silently graded the wrong mutant. One inserted line shifts it by one.
        const after = scanText(file, mutated.join("\n")).find((m) => m.name === c.name && m.line === c.line + 1);
        if (after !== undefined && after.attributed) silenced++;
      }
    }
    process.stdout.write(`  SPECIFICITY: ${silenced}/${total} flagged constants are silenced by attribution\n`);
    expect(total).toBeGreaterThanOrEqual(1);
    expect(silenced).toBe(total);
  });

  test("the detector does not flag everything — attributed constants exist and are not findings", () => {
    // The degenerate detector (flag every gating constant) would make this zero. It is
    // the cheapest possible check that the discriminator discriminates at all.
    expect(report.attributedPasses.length).toBeGreaterThanOrEqual(1);
    const names = new Set(report.findings.map((f) => `${f.file}:${f.line}`));
    for (const p of report.attributedPasses) expect(names.has(`${p.file}:${p.line}`)).toBe(false);
    process.stdout.write(
      `  CORPUS: ${report.candidatesSeen} gating constants, ${report.findings.length} unattributed, ` +
        `${report.attributedPasses.length} attributed\n`,
    );
  });
});

// CodeQL `js/incomplete-sanitization`: both regex builders escaped `$` and nothing else.
// `findGating` is exported and takes `name: string`, so the alphabet the file's own two
// declaration regexes happen to produce is not a guarantee anyone can rely on.
describe("escapeRegExp — a name is a LITERAL in the pattern, never a pattern", () => {
  test("every metacharacter survives as itself", () => {
    for (const ch of ".*+?^${}()|[]\\") {
      expect(new RegExp(escapeRegExp(ch)).test(ch)).toBe(true);
    }
  });

  test("a `.` in a name does not match any other character", () => {
    // The direction that matters for an AUDIT: `Budget.Max` as a raw pattern also matches
    // `BudgetXMax`, so a constant would be credited with gating evidence it never had.
    expect(findGating(["if (BudgetXMax > n) {"], "Budget.Max")).toEqual([]);
    expect(findGating(["if (Budget.Max > n) {"], "Budget.Max").length).toBe(1);
  });

  test("a name full of metacharacters does not throw or match everything", () => {
    expect(() => findGating(["if (x > 1) {"], "a[(")).not.toThrow();
    expect(findGating(["if (x > 1) {"], "a[(")).toEqual([]);
  });
});
