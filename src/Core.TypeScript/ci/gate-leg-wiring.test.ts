/**
 * gate-leg-wiring.test.ts — the audit's REFUSALS are the falsifiers.
 *
 * An audit that only ever passes is the thing it exists to catch, so every finding
 * class below is produced from a mutated workflow rather than asserted from the
 * checked-in one. The checked-in pair is then checked as the control.
 */
import { expect, test, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { audit, gateYmlJobIds, selectorsIn, selectorFor, selectorLines, NOT_GATED } from "./gate-leg-wiring.ts";
import { renderLegsJson } from "./affected-legs.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const YML = readFileSync(join(REPO_ROOT, ".github/workflows/gate.yml"), "utf-8");
const GRAPH = readFileSync(join(REPO_ROOT, "src/Core.TypeScript/ace/build-graph.json"), "utf-8");

describe("the checked-in pair agrees", () => {
  test("no findings", () => {
    expect(audit(YML, GRAPH)).toEqual([]);
  });

  test("and the audit is looking at something — not an empty parse", () => {
    // The control this file would be worthless without: a parser that found zero jobs
    // and zero selectors also reports zero findings.
    expect(gateYmlJobIds(YML).length).toBeGreaterThan(20);
    expect(selectorsIn(YML).size).toBeGreaterThan(20);
  });
});

describe("each finding class is produced by a mutant", () => {
  test("unknown-slug — a typo makes a job silently un-selectable", () => {
    const mutant = YML.replace(
      selectorFor("gate_lint_markdown"),
      selectorFor("gate_lint_markdwon"),
    );
    expect(mutant).not.toBe(YML);
    const kinds = audit(mutant, GRAPH).map((f) => f.kind);
    expect(kinds).toContain("unknown-slug");
  });

  test("wrong-slug — a job gated on ANOTHER job's leg, which is the unsafe one", () => {
    const mutant = YML.replace(
      selectorFor("gate_lint_markdown"),
      selectorFor("gate_lint_python"),
    );
    expect(mutant).not.toBe(YML);
    const f = audit(mutant, GRAPH).find((x) => x.kind === "wrong-slug");
    expect(f?.job).toBe("lint-markdown");
  });

  test("ungated — a job the graph can select that nothing gates", () => {
    const mutant = YML.split("\n")
      .filter((l) => !l.includes(selectorFor("gate_lint_markdown")))
      .join("\n");
    expect(mutant).not.toBe(YML);
    const f = audit(mutant, GRAPH).find((x) => x.kind === "ungated");
    expect(f?.job).toBe("lint-markdown");
  });

  test("stale-exemption — an entry that outlived its reason", () => {
    // Gate `cross-verify` while it is still on the roster: the roster must notice it is
    // now claiming to withhold something that is already wired.
    const mutant = YML.replace(
      "  cross-verify:\n",
      `  cross-verify:\n    if: ${selectorFor("gate_cross_verify")}\n`,
    );
    expect(mutant).not.toBe(YML);
    const f = audit(mutant, GRAPH).find((x) => x.kind === "stale-exemption");
    expect(f?.job).toBe("cross-verify");
  });

  test("legless-exemption — an entry for a job the graph cannot select at all", () => {
    // Strip `gate/cross-verify` from every target: the exemption now withholds nothing.
    const g = JSON.parse(GRAPH) as { targets: { legs?: string[] }[] };
    for (const t of g.targets) {
      if (t.legs !== undefined) t.legs = t.legs.filter((l) => l !== "gate/cross-verify");
    }
    const f = audit(YML, JSON.stringify(g)).find((x) => x.kind === "legless-exemption");
    expect(f?.job).toBe("cross-verify");
  });
});

describe("the exemption roster", () => {
  test("every entry names a real job", () => {
    const jobs = new Set(gateYmlJobIds(YML));
    for (const e of NOT_GATED) expect(jobs.has(e.job)).toBe(true);
  });

  test("every entry carries a reason, and the reason is not a shrug", () => {
    // A roster whose entries say nothing is a roster that grows. Each one must name a
    // measured fact and a LIFTS WHEN or the work-item tracking it.
    for (const e of NOT_GATED) {
      expect(e.why.length).toBeGreaterThan(60);
      expect(e.why).toMatch(/LIFTS WHEN|081[A-Z0-9]{23}/u);
    }
  });

  test("it is SMALL — the roster is the only place this audit can be weakened", () => {
    expect(NOT_GATED.length).toBeLessThanOrEqual(4);
  });
});

describe("the COMPARISON is the string form — the boolean one silently skips", () => {
  // THE DEFECT THIS CLOSES, and it shipped to main.
  //
  // `fromJSON(...).some_leg != false` reads correctly in English. GitHub Actions
  // compares different types by casting BOTH TO NUMBER: `null` -> 0 and `false` -> 0,
  // so an ABSENT leg evaluates `0 != 0` -> false and the job SKIPS. That is the exact
  // inverse of the fail-closed behaviour the expression was written to express.
  //
  // Measured on main pushes 2026-09-11, where `legs` is `{}` BY DESIGN (the non-PR
  // fast path's run-everything value): `build-and-test`, `lint (semgrep)` and
  // `test (TS hermetic)` -- three jobs in the uncompensatable floor -- all reported
  // `skipped`. Nothing failed. Nothing was loud. The gate simply stopped covering the
  // tree while continuing to report success, which is this repo's worst class.
  test("no selector in gate.yml uses the boolean comparison", () => {
    expect(audit(YML, GRAPH).filter((f) => f.kind === "boolean-comparison")).toEqual([]);
  });

  test("every selector uses `!= 'false'` against the string values", () => {
    const lines = selectorLines(YML);
    expect(lines.length).toBeGreaterThan(20);
    for (const { line } of lines) expect(line).toContain("!= 'false'");
  });

  test("MUTANT: reintroducing `!= false` is refused, and the finding names the job", () => {
    const mutant = YML.replace(selectorFor("gate_lint_markdown"), `${"fromJSON(needs.path-filter.outputs.legs).gate_lint_markdown"} != false`);
    expect(mutant).not.toBe(YML);
    const f = audit(mutant, GRAPH).find((x) => x.kind === "boolean-comparison");
    expect(f?.job).toBe("lint-markdown");
  });

  test("a COMMENT mentioning the broken form is documentation, not a selector", () => {
    // gate.yml deliberately explains the bug in prose, in several places. An audit that
    // refused prose would be unwritable alongside its own explanation — and the file
    // currently carries 23 such mentions.
    expect(YML).toContain("!= false");
    expect(audit(YML, GRAPH).filter((f) => f.kind === "boolean-comparison")).toEqual([]);
  });

  test("THE EMITTED VALUES ARE STRINGS — the comparison is only safe against those", () => {
    // The two halves have to agree or the fix is half-applied: string comparison against
    // boolean values would make a `false` leg read as `false != 'false'` -> 0 != NaN ->
    // TRUE, and every skipped job would start running. Safe, but the selection is gone.
    const legs = JSON.parse(
      renderLegsJson({ mode: "selective", legs: ["gate/lint-markdown"] }, [
        "gate/lint-markdown",
        "gate/lint-typescript",
      ]).slice("legs=".length),
    ) as Record<string, unknown>;
    expect(legs["gate_lint_markdown"]).toBe("true");
    expect(legs["gate_lint_typescript"]).toBe("false");
    for (const v of Object.values(legs)) expect(typeof v).toBe("string");
  });
});
