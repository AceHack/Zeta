import { describe, expect, test } from "bun:test";
import {
  BROWSER_CHECKPOINT_RECORD_SCHEMA,
  decideBrowserCheckpointRemoval,
  decideBrowserCheckpointSave,
  validateBrowserCheckpointRecord,
  type BrowserCheckpointRecord,
} from "./browser-checkpoint-port";

function checkpoint(nodeId: string, revision: number, bytes: readonly number[]): BrowserCheckpointRecord {
  return {
    schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
    nodeId,
    revision,
    payload: new Uint8Array(bytes),
  };
}

describe("browser checkpoint port", () => {
  test("validates and copies checkpoint bytes", () => {
    const value = checkpoint("node-a", 7, [1, 2, 3]);
    const result = validateBrowserCheckpointRecord(value);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    value.payload[0] = 99;
    expect([...result.value.payload]).toEqual([1, 2, 3]);
  });

  test("rejects malformed records as typed feedback", () => {
    const result = validateBrowserCheckpointRecord({
      schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
      nodeId: "node-a",
      revision: -1,
      payload: [1, 2, 3],
    });

    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "checkpoint-record-invalid",
        detail:
          "A browser checkpoint must carry the current schema, a node identifier, a non-negative safe revision, and bytes.",
      },
    });
  });

  test("writes the first and every newer revision", () => {
    expect(decideBrowserCheckpointSave(null, checkpoint("node-a", 1, [1]))).toEqual({
      ok: true,
      value: { action: "write", record: checkpoint("node-a", 1, [1]) },
    });
    expect(decideBrowserCheckpointSave(checkpoint("node-a", 1, [1]), checkpoint("node-a", 2, [2]))).toEqual({
      ok: true,
      value: { action: "write", record: checkpoint("node-a", 2, [2]) },
    });
  });

  test("makes an identical revision idempotent and copies its bytes", () => {
    const candidate = checkpoint("node-a", 4, [4, 5]);
    const result = decideBrowserCheckpointSave(checkpoint("node-a", 4, [4, 5]), candidate);

    expect(result).toEqual({
      ok: true,
      value: { action: "idempotent", record: checkpoint("node-a", 4, [4, 5]) },
    });
    if (!result.ok) return;
    candidate.payload[0] = 99;
    expect([...result.value.record.payload]).toEqual([4, 5]);
  });

  test("backpressures older revisions and same-revision byte conflicts", () => {
    const older = decideBrowserCheckpointSave(checkpoint("node-a", 5, [5]), checkpoint("node-a", 4, [4]));
    const changed = decideBrowserCheckpointSave(checkpoint("node-a", 5, [5]), checkpoint("node-a", 5, [6]));

    expect(older.ok).toBe(false);
    expect(changed.ok).toBe(false);
    if (older.ok || changed.ok) return;
    expect(older.feedback.code).toBe("checkpoint-revision-conflict");
    expect(older.feedback.severity).toBe("backpressure");
    expect(changed.feedback.code).toBe("checkpoint-revision-conflict");
    expect(changed.feedback.severity).toBe("backpressure");
  });

  test("rejects a stored row from another node", () => {
    const result = decideBrowserCheckpointSave(checkpoint("node-b", 1, [1]), checkpoint("node-a", 2, [2]));

    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "checkpoint-record-invalid",
        detail: "Stored checkpoint node node-b does not match candidate node node-a.",
      },
    });
  });

  test("removes only records at or below the requested revision", () => {
    expect(decideBrowserCheckpointRemoval(null, "node-a", 3)).toEqual({
      ok: true,
      value: { action: "missing" },
    });
    expect(decideBrowserCheckpointRemoval(checkpoint("node-a", 3, [3]), "node-a", 3)).toEqual({
      ok: true,
      value: { action: "remove", record: checkpoint("node-a", 3, [3]) },
    });

    const stale = decideBrowserCheckpointRemoval(checkpoint("node-a", 4, [4]), "node-a", 3);
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.feedback.code).toBe("checkpoint-revision-conflict");
    expect(stale.feedback.severity).toBe("backpressure");
  });

  test("validates removal identity and revision without throwing", () => {
    const invalidRevision = decideBrowserCheckpointRemoval(null, "node-a", -1);
    const wrongNode = decideBrowserCheckpointRemoval(checkpoint("node-b", 1, [1]), "node-a", 1);

    expect(invalidRevision.ok).toBe(false);
    expect(wrongNode.ok).toBe(false);
    if (invalidRevision.ok || wrongNode.ok) return;
    expect(invalidRevision.feedback.code).toBe("checkpoint-record-invalid");
    expect(wrongNode.feedback.code).toBe("checkpoint-record-invalid");
  });
});
