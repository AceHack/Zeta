import { describe, expect, test } from "bun:test";
import {
  BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA,
  browserCausalHandoffCheckpointNodeId,
  decodeBrowserCausalHandoffCheckpoint,
  emptyBrowserCausalHandoffCheckpoint,
  encodeBrowserCausalHandoffCheckpoint,
} from "./browser-causal-handoff-checkpoint";

describe("browser causal handoff checkpoint", () => {
  test("encodes pending peers in ordinal order and round-trips canonical bytes", () => {
    const encoded = encodeBrowserCausalHandoffCheckpoint({
      schema: BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA,
      maxPendingHandoffs: 2,
      generation: 2,
      pending: [
        { targetTabId: "tab-c", handoffId: "replay/2@tab-a", correctionCount: 3 },
        { targetTabId: "tab-b", handoffId: "replay/1@tab-a", correctionCount: 3 },
      ],
    });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    const decoded = decodeBrowserCausalHandoffCheckpoint(encoded.value);
    expect(decoded).toEqual({
      ok: true,
      value: {
        schema: BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA,
        maxPendingHandoffs: 2,
        generation: 2,
        pending: [
          { targetTabId: "tab-b", handoffId: "replay/1@tab-a", correctionCount: 3 },
          { targetTabId: "tab-c", handoffId: "replay/2@tab-a", correctionCount: 3 },
        ],
      },
    });
    expect(browserCausalHandoffCheckpointNodeId("node-a")).toBe("zeta.browser-checkpoint:causal-handoffs:6:node-a");
  });

  test("rejects duplicate targets, generation drift, and capacity overflow", () => {
    expect(
      encodeBrowserCausalHandoffCheckpoint({
        schema: BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA,
        maxPendingHandoffs: 2,
        generation: 1,
        pending: [
          { targetTabId: "tab-b", handoffId: "replay/1@tab-a", correctionCount: 1 },
          { targetTabId: "tab-b", handoffId: "replay/1@tab-a", correctionCount: 1 },
        ],
      }),
    ).toMatchObject({ ok: false, feedback: { code: "causal-handoff-checkpoint-state-invalid" } });
    expect(
      encodeBrowserCausalHandoffCheckpoint({
        schema: BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA,
        maxPendingHandoffs: 1,
        generation: 1,
        pending: [{ targetTabId: "tab-b", handoffId: "replay/2@tab-a", correctionCount: 1 }],
      }),
    ).toMatchObject({ ok: false, feedback: { code: "causal-handoff-checkpoint-state-invalid" } });
    expect(
      encodeBrowserCausalHandoffCheckpoint({
        schema: BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA,
        maxPendingHandoffs: 0,
        generation: 1,
        pending: [{ targetTabId: "tab-b", handoffId: "replay/1@tab-a", correctionCount: 1 }],
      }),
    ).toMatchObject({ ok: false, feedback: { code: "causal-handoff-checkpoint-capacity-exhausted" } });
  });

  test("rejects non-canonical ordering and unsupported schemas", () => {
    const nonCanonical = new TextEncoder().encode(
      JSON.stringify({
        schema: BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA,
        maxPendingHandoffs: 2,
        generation: 2,
        pending: [
          { targetTabId: "tab-c", handoffId: "replay/2@tab-a", correctionCount: 1 },
          { targetTabId: "tab-b", handoffId: "replay/1@tab-a", correctionCount: 1 },
        ],
      }),
    );
    expect(decodeBrowserCausalHandoffCheckpoint(nonCanonical)).toMatchObject({
      ok: false,
      feedback: { code: "causal-handoff-checkpoint-non-canonical" },
    });
    expect(decodeBrowserCausalHandoffCheckpoint(new TextEncoder().encode('{"schema":"future"}'))).toMatchObject({
      ok: false,
      feedback: { code: "causal-handoff-checkpoint-schema-unsupported" },
    });
    expect(emptyBrowserCausalHandoffCheckpoint(-1)).toMatchObject({
      ok: false,
      feedback: { code: "causal-handoff-checkpoint-state-invalid" },
    });
  });
});
