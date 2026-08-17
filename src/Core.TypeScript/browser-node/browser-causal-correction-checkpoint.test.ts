import { describe, expect, test } from "bun:test";
import { createBrowserCausalCorrectionLedger, foldBrowserCausalCorrections } from "./browser-causal-correction-ledger";
import {
  BROWSER_CAUSAL_CORRECTION_CHECKPOINT_SCHEMA,
  MAX_BROWSER_CAUSAL_CORRECTION_CHECKPOINT_BYTES,
  browserCausalCorrectionCheckpointNodeId,
  decodeBrowserCausalCorrectionCheckpoint,
  encodeBrowserCausalCorrectionCheckpoint,
} from "./browser-causal-correction-checkpoint";

function ledger() {
  const created = createBrowserCausalCorrectionLedger(3);
  if (!created.ok) throw new Error(created.feedback.detail);
  const folded = foldBrowserCausalCorrections(created.value, [
    { sourceTabId: "tab-c", sequence: "9", reinterpretsThrough: "7", deltaRows: 2 },
    { sourceTabId: "tab-a", sequence: "4", reinterpretsThrough: "3", deltaRows: 1 },
  ]);
  if (!folded.ok) throw new Error(folded.feedback.detail);
  return folded.value;
}

describe("browser causal correction checkpoint", () => {
  test("round-trips canonical ordered correction evidence", () => {
    const encoded = encodeBrowserCausalCorrectionCheckpoint(ledger());

    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(new TextDecoder().decode(encoded.value)).toBe(
      `{"schema":"${BROWSER_CAUSAL_CORRECTION_CHECKPOINT_SCHEMA}","maxCorrections":3,"corrections":[{"sourceTabId":"tab-a","sequence":"4","reinterpretsThrough":"3","deltaRows":1},{"sourceTabId":"tab-c","sequence":"9","reinterpretsThrough":"7","deltaRows":2}]}`,
    );
    expect(decodeBrowserCausalCorrectionCheckpoint(encoded.value)).toEqual({ ok: true, value: ledger() });
  });

  test("derives unambiguous record identities from the full room node id", () => {
    expect(browserCausalCorrectionCheckpointNodeId("a:bc")).not.toBe(browserCausalCorrectionCheckpointNodeId("ab:c"));
    expect(browserCausalCorrectionCheckpointNodeId("node-a")).toBe(
      "zeta.browser-checkpoint:causal-corrections:6:node-a",
    );
  });

  test("rejects malformed, non-canonical, and over-budget state without throwing", () => {
    const malformed = new TextEncoder().encode(
      JSON.stringify({
        schema: BROWSER_CAUSAL_CORRECTION_CHECKPOINT_SCHEMA,
        maxCorrections: 1,
        corrections: [
          { sourceTabId: "tab-a", sequence: "4", reinterpretsThrough: "3", deltaRows: 1 },
          { sourceTabId: "tab-b", sequence: "5", reinterpretsThrough: "4", deltaRows: 1 },
        ],
      }),
    );
    expect(decodeBrowserCausalCorrectionCheckpoint(malformed)).toMatchObject({
      ok: false,
      feedback: { code: "causal-checkpoint-state-invalid", severity: "backpressure" },
    });

    const nonCanonical = new TextEncoder().encode(
      JSON.stringify({
        corrections: ledger().corrections,
        maxCorrections: ledger().maxCorrections,
        schema: BROWSER_CAUSAL_CORRECTION_CHECKPOINT_SCHEMA,
      }),
    );
    expect(decodeBrowserCausalCorrectionCheckpoint(nonCanonical)).toMatchObject({
      ok: false,
      feedback: { code: "causal-checkpoint-non-canonical" },
    });
    expect(
      decodeBrowserCausalCorrectionCheckpoint(new Uint8Array(MAX_BROWSER_CAUSAL_CORRECTION_CHECKPOINT_BYTES + 1)),
    ).toMatchObject({
      ok: false,
      feedback: { code: "causal-checkpoint-too-large", severity: "backpressure" },
    });
  });

  test("turns hostile runtime objects into typed feedback", () => {
    const hostile = new Proxy(ledger(), {
      get(): never {
        throw new Error("blocked");
      },
    });

    expect(encodeBrowserCausalCorrectionCheckpoint(hostile)).toMatchObject({
      ok: false,
      feedback: { code: "causal-checkpoint-encode-failed", severity: "heat" },
    });
  });

  test("refuses unknown state instead of silently dropping it", () => {
    expect(encodeBrowserCausalCorrectionCheckpoint({ ...ledger(), transient: true } as never)).toMatchObject({
      ok: false,
      feedback: { code: "causal-checkpoint-state-invalid" },
    });
    expect(
      encodeBrowserCausalCorrectionCheckpoint({
        ...ledger(),
        corrections: [{ ...ledger().corrections[0]!, transient: true }],
      } as never),
    ).toMatchObject({
      ok: false,
      feedback: { code: "causal-checkpoint-state-invalid" },
    });
  });
});
