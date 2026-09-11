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
import { audit, gateYmlJobIds, selectorsIn, selectorFor, NOT_GATED } from "./gate-leg-wiring.ts";

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
