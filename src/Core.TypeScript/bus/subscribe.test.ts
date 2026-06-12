import { describe, expect, test, mock } from "bun:test";
import { subscribeOnce } from "./subscribe";
import type { MessageEnvelope } from "./types";
import { chmodSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BUS_DIR, ensureDir } from "./bus";

describe("bus subscribeOnce (B-0459 slice 1)", () => {
  const seenFile = join(BUS_DIR, "seen-test-surface.json");

  // Helper to clear state
  function clearState() {
    try { rmSync(seenFile); } catch {}
  }

  test("calls handler for unseen envelopes and records seen state", async () => {
    clearState();

    const env1: MessageEnvelope = {
      id: "env-1",
      from: "otto",
      to: "test-surface" as any,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10000).toISOString(),
      topic: "work-assignment",
      payload: { rowId: "B-1234", priority: "P1", rationale: "test" },
    };

    const fakeList = mock(() => {
      return [env1];
    });

    const handler = mock(async (_env: MessageEnvelope) => {});

    await subscribeOnce("work-assignment", "test-surface", handler, { list: fakeList as any });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(env1);

    // Call again, should not trigger handler because it was recorded in seen-test-surface.json
    await subscribeOnce("work-assignment", "test-surface", handler, { list: fakeList as any });
    expect(handler).toHaveBeenCalledTimes(1); // Still 1
  });

  test("propagates seen-file write failures to caller", async () => {
    const surface = "test-write-fail";
    const failSeenFile = join(BUS_DIR, `seen-${surface}.json`);

    // Pre-create the seen file as readable-but-not-writable so the read
    // succeeds (empty array) and the write throws EACCES. This catches
    // the failure mode where a write error would have been silently
    // logged, leaving subscribeOnce believing persistence succeeded.
    ensureDir();
    writeFileSync(failSeenFile, "[]");
    chmodSync(failSeenFile, 0o444);

    try {
      const env: MessageEnvelope = {
        id: "env-write-fail",
        from: "otto",
        to: surface as any,
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10000).toISOString(),
        topic: "work-assignment",
        payload: { rowId: "B-3333", priority: "P2", rationale: "test3" },
      };

      const fakeList = mock(() => [env]);
      const handler = mock(async (_env: MessageEnvelope) => {});

      await expect(
        subscribeOnce("work-assignment", surface, handler, { list: fakeList as any }),
      ).rejects.toThrow();
    } finally {
      chmodSync(failSeenFile, 0o644);
      try { rmSync(failSeenFile); } catch {}
    }
  });

  test("does not mark as seen if handler throws", async () => {
    clearState();

    const env2: MessageEnvelope = {
      id: "env-2",
      from: "otto",
      to: "test-surface" as any,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10000).toISOString(),
      topic: "work-assignment",
      payload: { rowId: "B-2222", priority: "P2", rationale: "test2" },
    };

    const fakeList = mock(() => [env2]);
    const handlerFailing = mock(async () => { throw new Error("fail"); });

    await subscribeOnce("work-assignment", "test-surface", handlerFailing, { list: fakeList as any });

    expect(handlerFailing).toHaveBeenCalledTimes(1);

    // Call again, should retry because it failed and wasn't marked seen
    await subscribeOnce("work-assignment", "test-surface", handlerFailing, { list: fakeList as any });
    expect(handlerFailing).toHaveBeenCalledTimes(2);
  });
});
