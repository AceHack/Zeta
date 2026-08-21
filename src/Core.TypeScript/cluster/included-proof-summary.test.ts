import { describe, expect, test } from "bun:test";
import { extractTrailingReport, renderSummary } from "./included-proof-summary.ts";

const NL = String.fromCharCode(10);

/** The real 2026-08-21 failure, trimmed: cdi + kubevirt asserted under the wrong contract. */
const RED_REPORT = {
  ok: false,
  applications: [
    { name: "alloy", ok: true, syncStatus: "Synced", healthStatus: "Healthy" },
    { name: "cdi", ok: false, syncStatus: "OutOfSync", healthStatus: "Missing", reason: "expected Synced/Healthy" },
    { name: "kubevirt", ok: false, syncStatus: "OutOfSync", healthStatus: "Missing", reason: "expected Synced/Healthy" },
  ],
  failure: {
    kind: "ApplicationUnhealthy",
    message: "one or more included dev ArgoCD Applications are not Synced/Healthy",
    detail: [
      { name: "cdi", ok: false, syncStatus: "OutOfSync", healthStatus: "Missing", reason: "expected Synced/Healthy" },
      { name: "kubevirt", ok: false, syncStatus: "OutOfSync", healthStatus: "Missing", reason: "expected Synced/Healthy" },
    ],
  },
};

const GREEN_REPORT = {
  ok: true,
  applications: [
    { name: "alloy", ok: true, syncStatus: "Synced", healthStatus: "Healthy" },
    { name: "cdi", ok: true, syncStatus: "OutOfSync", healthStatus: "Missing" },
  ],
};

function log(preamble: readonly string[], report: unknown): string {
  return preamble.join(NL) + NL + JSON.stringify(report, null, 2) + NL;
}

describe("extractTrailingReport", () => {
  test("finds the report after arbitrary progress output", () => {
    const text = log(
      ["creating cluster zeta-ci-included", "waiting for argocd...", "poll 12/160"],
      GREEN_REPORT,
    );
    expect(extractTrailingReport(text)?.ok).toBe(true);
  });

  test("returns null when the harness printed no verdict -- the timeout case", () => {
    // THE FALSIFIER for the silent-pass class: a truncated log must not read as green.
    const text = ["creating cluster", "poll 160/160", "##[error]The operation was canceled."].join(NL);
    expect(extractTrailingReport(text)).toBeNull();
  });

  test("an UNBALANCED brace inside a message never truncates the scan", () => {
    // Balanced braces in a string survive even a scanner that ignores string state, so the
    // falsifier has to be UNBALANCED: a lone `{` makes a naive counter run off the end and
    // report "no verdict" for a run that produced one.
    const withBrace = {
      ok: false,
      failure: { kind: "Bad", message: 'admission webhook denied: unexpected "{" near namespaces' },
    };
    const parsed = extractTrailingReport(log(["noise"], withBrace));
    expect(parsed?.failure?.message).toContain('"{"');
    expect(parsed?.ok).toBe(false);
  });

  test("takes the LAST report when the log carries more than one object", () => {
    const text = JSON.stringify({ ok: true }, null, 2) + NL + JSON.stringify(RED_REPORT, null, 2) + NL;
    expect(extractTrailingReport(text)?.ok).toBe(false);
  });

  test("an object without a boolean ok is not a report", () => {
    expect(extractTrailingReport(log(["x"], { cluster: "zeta-ci-included" }))).toBeNull();
  });
});

describe("renderSummary", () => {
  test("green says PASS and names the count -- and raises no annotation", () => {
    const { markdown, annotations } = renderSummary(GREEN_REPORT);
    expect(markdown).toContain("**PASS**");
    expect(markdown).toContain("2 asserted");
    expect(annotations).toEqual([]);
  });

  test("red names every failing Application in the table AND as an annotation", () => {
    const { markdown, annotations } = renderSummary(RED_REPORT);
    expect(markdown).toContain("**FAIL (ApplicationUnhealthy)**");
    expect(markdown).toContain("`cdi`");
    expect(markdown).toContain("`kubevirt`");
    // A green app must not be listed as a failure.
    expect(markdown).not.toContain("`alloy`");
    expect(annotations).toHaveLength(2);
    expect(annotations[0]).toStartWith("::error title=included proof: cdi::");
    expect(annotations[1]).toContain("kubevirt is OutOfSync/Missing");
  });

  test("a failing report with no `applications` field claims no total -- 0 is not a measurement", () => {
    // The real shape: argocd-health-test.ts omits `applications` on failure. Rendering
    // "0 Applications were asserted" from an absent field is a fabricated number, which is
    // the same class of wrongness this script exists to remove.
    const { markdown } = renderSummary({ ok: false, failure: RED_REPORT.failure });
    expect(markdown).toContain("`cdi`");
    expect(markdown).not.toContain("asserted in total");
  });

  test("a missing report renders UNREADABLE, never PASS", () => {
    // The whole point: a check that did not finish must never look like one that passed.
    const { markdown, annotations } = renderSummary(null);
    expect(markdown).toContain("**UNREADABLE**");
    expect(markdown).not.toContain("PASS");
    expect(annotations).toHaveLength(1);
  });

  test("a failure with no per-app detail still annotates rather than going quiet", () => {
    const { markdown, annotations } = renderSummary({ ok: false, failure: { message: "bootstrap never converged" } });
    expect(markdown).toContain("bootstrap never converged");
    expect(annotations).toHaveLength(1);
  });

  test("newlines in a message are encoded so the workflow command cannot truncate", () => {
    const { annotations } = renderSummary({
      ok: false,
      failure: { message: "line one" + NL + "line two" },
    });
    expect(annotations[0]).toContain("%0A");
    expect(annotations[0]).not.toContain(NL);
  });
});
