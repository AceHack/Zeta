import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runScheduledZetaDbNode } from "./scheduled-node";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("scheduled ZetaDB node", () => {
  test("persists one checkpoint and becomes an idempotent no-op on replay", async () => {
    const directory = mkdtempSync(join(tmpdir(), "zeta-scheduled-node-"));
    directories.push(directory);
    const journalPath = join(directory, "journal.json");
    const checkpointPath = join(directory, "checkpoint.json");
    writeFileSync(
      journalPath,
      JSON.stringify({
        schema: "zeta.db.scheduled-journal.v1",
        nodeId: "global/browser",
        deltas: [{ eventId: "event/1", rowKey: "system/node", payload: "ready", weight: 1 }],
      }),
    );
    const options = {
      journalPath,
      checkpointPath,
      executorId: "actions/1",
      maxDeltas: 8,
      maxEntries: 16,
      maxCheckpointBytes: 16 * 1024,
    };

    const first = await runScheduledZetaDbNode(options);
    const second = await runScheduledZetaDbNode({ ...options, executorId: "actions/2" });

    expect(first.ok && first.value).toMatchObject({ changed: true, tick: { revision: 1, accepted: 1 } });
    expect(second.ok && second.value).toMatchObject({
      changed: false,
      tick: { revision: 1, accepted: 0, duplicates: 1 },
    });
    expect(JSON.parse(readFileSync(checkpointPath, "utf8"))).toMatchObject({
      schema: "zeta.db.file-checkpoint.v1",
      nodeId: "global/browser",
      revision: 1,
    });
  });

  // ── 081KZM0FTJM: CONCURRENT convergence (distinct from sequential replay) ────
  //
  // The existing test above covers sequential idempotency — fold, then fold again,
  // second is a no-op. That is NOT the property the cross-substrate fold race needs.
  // The dogfooding target runs folds on GitHub runners AND local hardware AND browser
  // cells simultaneously, so what must hold is CONVERGENCE UNDER CONCURRENCY: two
  // executors folding disjoint deltas from the same base must reach the same
  // checkpoint regardless of which lands first.
  //
  // This is why the fix is convergence rather than a distributed lock (which would be
  // a central point of coordination, §1 scale-free, and would not survive a browser
  // tab going offline).
  test("081KZM0FTJM: two executors folding the same deltas converge SEMANTICALLY (but not byte-wise — see note)", async () => {
    const build = (deltas: readonly unknown[]) => {
      const directory = mkdtempSync(join(tmpdir(), "zeta-converge-"));
      directories.push(directory);
      const journalPath = join(directory, "journal.json");
      const checkpointPath = join(directory, "checkpoint.json");
      writeFileSync(
        journalPath,
        JSON.stringify({
          schema: "zeta.db.scheduled-journal.v1",
          nodeId: "global/browser",
          deltas,
        }),
      );
      return {
        journalPath,
        checkpointPath,
        executorId: "actions/x",
        maxDeltas: 8,
        maxEntries: 16,
        maxCheckpointBytes: 16 * 1024,
      };
    };

    const a = { eventId: "event/a", rowKey: "system/node", payload: "alpha", weight: 1 };
    const b = { eventId: "event/b", rowKey: "system/other", payload: "beta", weight: 1 };
    const ab = build([a, b]);
    const ba = build([b, a]);
    expect((await runScheduledZetaDbNode(ab)).ok).toBe(true);
    expect((await runScheduledZetaDbNode(ba)).ok).toBe(true);

    const decode = (path: string) => {
      const outer = JSON.parse(readFileSync(path, "utf8")) as { readonly payloadBase64: string };
      return JSON.parse(Buffer.from(outer.payloadBase64, "base64").toString("utf8")) as {
        readonly entries: readonly { readonly eventId: string }[];
        readonly rows?: readonly { readonly rowKey: string }[];
      };
    };
    const canonical = (xs: readonly Record<string, unknown>[], key: string) =>
      JSON.stringify([...xs].sort((p, q) => (String(p[key]) < String(q[key]) ? -1 : 1)));

    const A = decode(ab.checkpointPath);
    const B = decode(ba.checkpointPath);

    // ✅ SEMANTIC convergence holds: same delta SET ⇒ same folded state.
    expect(canonical(A.entries as never, "eventId")).toBe(canonical(B.entries as never, "eventId"));
    expect(canonical((A.rows ?? []) as never, "rowKey")).toBe(canonical((B.rows ?? []) as never, "rowKey"));

    // ⚠ KNOWN GAP (081KZM0FTJM) — the checkpoint is NOT byte-canonical: `entries`
    // persists in ARRIVAL ORDER, so identical state serialises to different bytes.
    // Harmless with a single writer; with the dogfooding target (runners + local +
    // browser cells folding concurrently) two substrates in the same state produce
    // DIFFERENT checkpoint files, so git sees a real diff, last-writer-wins clobbers,
    // and content-addressing cannot dedup them.
    //
    // This assertion PINS the current behaviour so the gap is visible and its fix is
    // detectable — it is deliberately NOT asserting that byte-divergence is correct.
    // Fixing it means canonically ordering `entries` before serialisation, which
    // changes the on-disk representation and is the zetadb owner's call.
    expect(readFileSync(ab.checkpointPath, "utf8")).not.toBe(readFileSync(ba.checkpointPath, "utf8"));
    expect(A.entries.map((e) => e.eventId)).toEqual(["event/a", "event/b"]);
    expect(B.entries.map((e) => e.eventId)).toEqual(["event/b", "event/a"]);
  });

  test("081KZM0FTJM: re-folding after a rebase is a no-op, not a double-apply", async () => {
    // The workflow's convergence loop re-runs the fold after `git pull --rebase`.
    // That is only safe if re-deriving over an already-folded checkpoint does not
    // double-count — i.e. the deltas carry dedup identity (discipline #6). If this
    // ever regresses, the retry loop would silently corrupt instead of converge.
    const directory = mkdtempSync(join(tmpdir(), "zeta-refold-"));
    directories.push(directory);
    const journalPath = join(directory, "journal.json");
    const checkpointPath = join(directory, "checkpoint.json");
    writeFileSync(
      journalPath,
      JSON.stringify({
        schema: "zeta.db.scheduled-journal.v1",
        nodeId: "global/browser",
        deltas: [{ eventId: "event/1", rowKey: "system/node", payload: "ready", weight: 1 }],
      }),
    );
    const options = {
      journalPath,
      checkpointPath,
      executorId: "actions/1",
      maxDeltas: 8,
      maxEntries: 16,
      maxCheckpointBytes: 16 * 1024,
    };

    await runScheduledZetaDbNode(options);
    const afterFirst = readFileSync(checkpointPath, "utf8");
    // Simulate the post-rebase re-fold the retry loop performs.
    const reFold = await runScheduledZetaDbNode({ ...options, executorId: "actions/retry" });
    expect(reFold.ok && reFold.value).toMatchObject({ changed: false });
    expect(readFileSync(checkpointPath, "utf8")).toBe(afterFirst);
  });

});
