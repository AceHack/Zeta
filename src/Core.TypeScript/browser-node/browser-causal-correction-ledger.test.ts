import { describe, expect, test } from "bun:test";
import {
  createBrowserCausalCorrectionLedger,
  foldBrowserCausalCorrection,
  foldBrowserCausalCorrections,
  type BrowserCausalCorrectionLedger,
} from "./browser-causal-correction-ledger";
import type { BrowserCausalCorrectionNotice } from "./browser-tab-coordinator";

function ledger(maxCorrections = 8): BrowserCausalCorrectionLedger {
  const result = createBrowserCausalCorrectionLedger(maxCorrections);
  if (!result.ok) throw new Error(result.feedback.detail);
  return result.value;
}

const corrections = [
  { sourceTabId: "tab-a", sequence: "9007199254740994", reinterpretsThrough: "7", deltaRows: 2 },
  { sourceTabId: "tab-b", sequence: "11", reinterpretsThrough: "8", deltaRows: 1 },
  { sourceTabId: "tab-c", sequence: "9007199254740993", reinterpretsThrough: "9", deltaRows: 0 },
] as const satisfies readonly BrowserCausalCorrectionNotice[];

describe("browser causal correction ledger", () => {
  test("converges under delayed, duplicated, and reordered delivery", () => {
    const deliveries = [
      corrections,
      [corrections[2], corrections[0], corrections[1]],
      [corrections[1], corrections[1], corrections[0], corrections[2], corrections[0]],
    ] as const;

    const projections = deliveries.map((delivery) => {
      const result = foldBrowserCausalCorrections(ledger(), delivery);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.feedback.detail);
      return result.value.corrections;
    });

    const baseline = projections[0];
    if (baseline === undefined) throw new Error("missing baseline projection");
    expect(projections[1]).toEqual(baseline);
    expect(projections[2]).toEqual(baseline);
    expect(baseline.map((entry) => entry.sequence)).toEqual(["11", "9007199254740993", "9007199254740994"]);
  });

  test("treats exact redelivery as idempotent and conflicting identity reuse as heat", () => {
    const first = foldBrowserCausalCorrection(ledger(), corrections[0]);
    if (!first.ok) throw new Error(first.feedback.detail);
    expect(foldBrowserCausalCorrection(first.value, corrections[0])).toEqual({ ok: true, value: first.value });
    expect(
      foldBrowserCausalCorrection(first.value, {
        ...corrections[0],
        deltaRows: 3,
      }),
    ).toMatchObject({ ok: false, feedback: { severity: "heat", code: "causal-correction-conflict" } });
  });

  test("backpressures instead of forgetting and rejects backward or non-canonical order", () => {
    const first = foldBrowserCausalCorrection(ledger(1), corrections[0]);
    if (!first.ok) throw new Error(first.feedback.detail);
    expect(foldBrowserCausalCorrection(first.value, corrections[1])).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "causal-correction-capacity-exhausted" },
    });
    expect(first.value.corrections).toEqual([corrections[0]]);

    for (const invalid of [
      { sourceTabId: "tab-a", sequence: "9", reinterpretsThrough: "9", deltaRows: 1 },
      { sourceTabId: "tab-a", sequence: "08", reinterpretsThrough: "7", deltaRows: 1 },
      { sourceTabId: "tab-a", sequence: "10", reinterpretsThrough: "9", deltaRows: -1 },
    ]) {
      expect(foldBrowserCausalCorrection(ledger(), invalid)).toMatchObject({
        ok: false,
        feedback: { code: "causal-correction-invalid" },
      });
    }

    expect(
      foldBrowserCausalCorrection(
        {
          schema: "zeta.browser-causal-correction-ledger.v1",
          maxCorrections: 2,
          corrections: [corrections[0], corrections[1]],
        },
        corrections[2],
      ),
    ).toMatchObject({
      ok: false,
      feedback: { code: "causal-correction-ledger-configuration-invalid" },
    });
  });
});
