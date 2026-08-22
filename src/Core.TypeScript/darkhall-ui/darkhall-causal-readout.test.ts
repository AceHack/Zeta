import { describe, expect, test } from "bun:test";
import {
  createBrowserCausalCorrectionLedger,
  foldBrowserCausalCorrection,
} from "../browser-node/browser-causal-correction-ledger";
import {
  DARK_HALL_CAUSAL_HANDOFF_READOUT_SCHEMA,
  DARK_HALL_CAUSAL_READOUT_SCHEMA,
  darkHallCausalHandoffReadout,
  darkHallCausalReadout,
} from "./darkhall-causal-readout";

describe("Dark Hall causal readout", () => {
  test("projects bounded ledger capacity and source-attributed corrections", () => {
    const created = createBrowserCausalCorrectionLedger(2);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const admitted = foldBrowserCausalCorrection(created.value, {
      sourceTabId: "tab-b",
      sequence: "9007199254740994",
      reinterpretsThrough: "9007199254740993",
      deltaRows: 2,
    });
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;

    expect(darkHallCausalReadout(admitted.value)).toEqual({
      schema: DARK_HALL_CAUSAL_READOUT_SCHEMA,
      sourceSchema: "zeta.browser-causal-correction-ledger.v1",
      executionDirection: "forward-only",
      appendOnly: true,
      rewritesHistory: false,
      maxCorrections: 2,
      remainingCapacity: 1,
      admission: "open",
      corrections: [
        {
          sourceTabId: "tab-b",
          sequence: "9007199254740994",
          reinterpretsThrough: "9007199254740993",
          deltaRows: 2,
        },
      ],
      feedback: null,
    });
  });

  test("reports no-forget pressure and does not expose retained correction objects", () => {
    const created = createBrowserCausalCorrectionLedger(1);
    if (!created.ok) throw new Error(created.feedback.detail);
    const admitted = foldBrowserCausalCorrection(created.value, {
      sourceTabId: "tab-a",
      sequence: "2",
      reinterpretsThrough: "1",
      deltaRows: 1,
    });
    if (!admitted.ok) throw new Error(admitted.feedback.detail);
    const rejected = foldBrowserCausalCorrection(admitted.value, {
      sourceTabId: "tab-b",
      sequence: "3",
      reinterpretsThrough: "2",
      deltaRows: 1,
    });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;

    const readout = darkHallCausalReadout(admitted.value, rejected.feedback);
    expect(readout.admission).toBe("backpressure");
    expect(readout.remainingCapacity).toBe(0);
    expect(readout.feedback).toMatchObject({
      severity: "backpressure",
      code: "causal-correction-capacity-exhausted",
    });

    (readout.corrections[0] as { sourceTabId: string }).sourceTabId = "mutated";
    expect(admitted.value.corrections[0]?.sourceTabId).toBe("tab-a");
  });

  test("projects the observed peer edge without upgrading an offer into delivery", () => {
    const feedback = {
      severity: "backpressure" as const,
      code: "causal-correction-capacity-exhausted" as const,
      detail: "capacity retained",
    };
    const readout = darkHallCausalHandoffReadout("tab-a", 2, 2, 3, {
      status: "backpressured",
      direction: "inbound",
      handoffId: "handoff/pressure",
      peerTabId: "tab-b",
      correctionCount: 2,
      admittedCorrections: 0,
      feedback,
    });

    expect(readout).toEqual({
      schema: DARK_HALL_CAUSAL_HANDOFF_READOUT_SCHEMA,
      localTabId: "tab-a",
      maxCorrections: 2,
      pendingHandoffs: 2,
      maxPendingHandoffs: 3,
      status: "backpressured",
      direction: "inbound",
      handoffId: "handoff/pressure",
      peerTabId: "tab-b",
      correctionCount: 2,
      admittedCorrections: 0,
      feedback,
    });
    (readout.feedback as { detail: string }).detail = "mutated";
    expect(feedback.detail).toBe("capacity retained");
  });
});
