/**
 * Falsifiers for code-scanning alert observation.
 *
 * Each test pins a specific wrong reading that was actually produced by an
 * ad-hoc query on 2026-09-09/10, not a hypothetical one.
 */

import { describe, expect, test } from "bun:test";

import {
  alertEvidence,
  alertRefForPr,
  renderAlertEvidence,
  type GhAlert,
} from "./code-scanning-observations.ts";

const alert = (n: number, state: string, id = "js/http-to-file-access"): GhAlert => ({
  number: n,
  state,
  rule: { id },
});

describe("the ref is the merge ref and cannot be spelled otherwise", () => {
  test("names refs/pull/N/merge", () => {
    expect(alertRefForPr(17177)).toBe("refs/pull/17177/merge");
  });

  // The exact defect: /head returns [] for every PR, which reads as "no findings".
  test("never names /head", () => {
    expect(alertRefForPr(17177)).not.toContain("/head");
  });

  test("refuses a non-positive or non-integer number rather than building a wrong ref", () => {
    expect(() => alertRefForPr(0)).toThrow(/positive integer/);
    expect(() => alertRefForPr(-3)).toThrow(/positive integer/);
    expect(() => alertRefForPr(1.5)).toThrow(/positive integer/);
  });
});

describe("an empty alert list is unknown until the analysis is known to have run", () => {
  test("empty + analysis success is none", () => {
    const e = alertEvidence({ analysisConclusion: "success", analysisName: "Analyze (js)", alerts: [] });
    expect(e.kind).toBe("none");
  });

  // The outage of 2026-09-09: CodeQL failed at its install step, alert list empty.
  test("empty + analysis FAILURE is unknown, never none", () => {
    const e = alertEvidence({ analysisConclusion: "failure", analysisName: "Analyze (csharp)", alerts: [] });
    expect(e.kind).toBe("unknown");
    if (e.kind === "unknown") expect(e.reason).toContain("Analyze (csharp)");
  });

  test("empty + analysis never ran is unknown", () => {
    const e = alertEvidence({ analysisConclusion: null, analysisName: "Analyze (js)", alerts: [] });
    expect(e.kind).toBe("unknown");
    if (e.kind === "unknown") expect(e.reason).toContain("not-run");
  });

  test("a cancelled analysis is unknown — cancelled establishes no verdict", () => {
    expect(alertEvidence({ analysisConclusion: "cancelled", analysisName: "A", alerts: [] }).kind).toBe("unknown");
  });
});

describe("open alerts are reported and closed ones are not", () => {
  test("counts only open", () => {
    const e = alertEvidence({
      analysisConclusion: "success",
      analysisName: "Analyze (js)",
      alerts: [alert(929, "open"), alert(930, "fixed"), alert(931, "dismissed")],
    });
    expect(e.kind).toBe("findings");
    if (e.kind === "findings") expect(e.open.map((a) => a.number)).toEqual([929]);
  });

  // CONTROL: a fold that reported everything as findings would pass the test
  // above. This fails if closed alerts stop being filtered.
  test("CONTROL — all-closed is none, not findings", () => {
    const e = alertEvidence({
      analysisConclusion: "success",
      analysisName: "Analyze (js)",
      alerts: [alert(930, "fixed"), alert(931, "dismissed")],
    });
    expect(e.kind).toBe("none");
  });
});

describe("rendering keeps unknown distinct from none", () => {
  test("unknown never renders as a clean result", () => {
    const s = renderAlertEvidence({ kind: "unknown", reason: "Analyze (js) concluded 'failure'" });
    expect(s).toContain("UNKNOWN");
    expect(s).not.toContain("none");
  });

  test("none says the analysis ran, so it cannot be mistaken for silence", () => {
    expect(renderAlertEvidence({ kind: "none" })).toContain("analysis ran");
  });
});
