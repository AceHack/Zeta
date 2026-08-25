import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReservedCapacityAdmissionPolicy } from "./admission-policy";
import { canonicalEventIdRetentionPolicy } from "./retention-policy";
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

  test("executes an injected reservation policy and preserves its accounting", async () => {
    const directory = mkdtempSync(join(tmpdir(), "zeta-scheduled-reservation-"));
    directories.push(directory);
    const journalPath = join(directory, "journal.json");
    const checkpointPath = join(directory, "checkpoint.json");
    writeFileSync(
      journalPath,
      JSON.stringify({
        schema: "zeta.db.scheduled-journal.v1",
        nodeId: "global/browser",
        deltas: [
          { eventId: "event/1", rowKey: "system/a", payload: "a", weight: 1 },
          { eventId: "event/2", rowKey: "system/b", payload: "b", weight: 1 },
        ],
      }),
    );
    const created = createReservedCapacityAdmissionPolicy({ retainedEvents: 1, checkpointBytes: 0 });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await runScheduledZetaDbNode({
      journalPath,
      checkpointPath,
      executorId: "actions/reserved-capacity",
      maxDeltas: 8,
      maxEntries: 2,
      maxCheckpointBytes: 16 * 1024,
      admissionPolicy: created.value,
    });

    expect(result.ok && result.value).toMatchObject({
      changed: true,
      tick: {
        admission: "backpressured",
        accepted: 1,
        feedback: [
          {
            admissionReceipt: {
              policyId: "reserved-capacity",
              resource: "retained-events",
              hardLimit: 2,
              effectiveLimit: 1,
              reserved: 1,
            },
          },
        ],
      },
    });
  });

  test("executes an explicit retained-set policy at the scheduled runtime boundary", async () => {
    const directory = mkdtempSync(join(tmpdir(), "zeta-scheduled-retention-"));
    directories.push(directory);
    const journalPath = join(directory, "journal.json");
    const checkpointPath = join(directory, "checkpoint.json");
    const writeJournal = (eventIds: readonly string[]): void => {
      writeFileSync(
        journalPath,
        JSON.stringify({
          schema: "zeta.db.scheduled-journal.v1",
          nodeId: "global/browser",
          deltas: eventIds.map((eventId) => ({ eventId, rowKey: `row/${eventId}`, payload: eventId, weight: 1 })),
        }),
      );
    };
    const options = {
      journalPath,
      checkpointPath,
      executorId: "actions/retention",
      maxDeltas: 8,
      maxEntries: 2,
      maxCheckpointBytes: 16 * 1024,
      retentionPolicy: canonicalEventIdRetentionPolicy,
    };

    writeJournal(["e3", "e4"]);
    expect((await runScheduledZetaDbNode(options)).ok).toBe(true);
    writeJournal(["e1", "e2"]);
    const result = await runScheduledZetaDbNode(options);

    expect(result.ok && result.value).toMatchObject({
      changed: true,
      tick: {
        revision: 2,
        rows: [
          { rowKey: "row/e1", payload: "e1", weight: 1 },
          { rowKey: "row/e2", payload: "e2", weight: 1 },
        ],
        retentionReceipt: {
          policyId: "canonical-event-id",
          retainedEventIds: ["e1", "e2"],
          displacedEventIds: ["e3", "e4"],
        },
        feedback: [
          {
            code: "database-retention-displaced",
            retentionHeatReceipt: { displacedEventIds: ["e3", "e4"] },
          },
        ],
      },
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
  test("081KZM0FTJM: two executors folding the same deltas converge BYTE-FOR-BYTE", async () => {
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

    // ✅ BYTE convergence — the gap this test used to PIN. `entries` persisted in
    // ARRIVAL ORDER, so two substrates in identical state emitted different checkpoint
    // files: git saw a real diff, last-writer-wins clobbered, and content-addressing
    // could not dedup them. Canonical entry order (ordinal by eventId) makes the image
    // a pure function of the delta SET, so a lost push race re-derives to the same
    // bytes instead of fighting. This assertion FAILS without that canonical order.
    expect(readFileSync(ab.checkpointPath, "utf8")).toBe(readFileSync(ba.checkpointPath, "utf8"));
    expect(A.entries.map((e) => e.eventId)).toEqual(["event/a", "event/b"]);
    expect(B.entries.map((e) => e.eventId)).toEqual(["event/a", "event/b"]);
  });

  // The serialisation half alone is not enough: the FOLD has to be commutative too, or
  // two substrates reach different VERDICTS on the same delta set and never get as far
  // as comparing bytes. The retract-then-emit update is the case that bites — it is how
  // every row is edited (see the Dark Hall `replace` command), and under the old
  // per-rowKey fold the retraction had to arrive first or the tick was refused with
  // `database-row-conflict`. Canonical order does not preserve that: `score/emit` sorts
  // BEFORE `score/retract`. Summing weights per (rowKey, payload) instead, and checking
  // well-formedness once at the end, makes the verdict order-independent.
  test("081KZM0FTJM: a retract-then-emit update folds to one row in EITHER order", async () => {
    const retract = { eventId: "score/retract", rowKey: "game/score", payload: "9000", weight: -1 };
    const emit = { eventId: "score/emit", rowKey: "game/score", payload: "9001", weight: 1 };
    const seed = { eventId: "score/seed", rowKey: "game/score", payload: "9000", weight: 1 };

    const fold = async (deltas: readonly unknown[]) => {
      const directory = mkdtempSync(join(tmpdir(), "zeta-update-"));
      directories.push(directory);
      const journalPath = join(directory, "journal.json");
      const checkpointPath = join(directory, "checkpoint.json");
      writeFileSync(
        journalPath,
        JSON.stringify({ schema: "zeta.db.scheduled-journal.v1", nodeId: "global/browser", deltas }),
      );
      const result = await runScheduledZetaDbNode({
        journalPath,
        checkpointPath,
        executorId: "actions/x",
        maxDeltas: 8,
        maxEntries: 16,
        maxCheckpointBytes: 16 * 1024,
      });
      return { result, bytes: readFileSync(checkpointPath, "utf8") };
    };

    const retractFirst = await fold([seed, retract, emit]);
    const emitFirst = await fold([seed, emit, retract]);

    expect(retractFirst.result.ok).toBe(true);
    // Without the (rowKey, payload) fold this side is a `database-row-conflict`: the
    // emit lands on a live "9000" row and the differing payload is rejected outright.
    expect(emitFirst.result.ok).toBe(true);
    expect(retractFirst.result.ok && retractFirst.result.value.tick.rows).toEqual([
      { rowKey: "game/score", payload: "9001", weight: 1 },
    ]);
    expect(emitFirst.bytes).toBe(retractFirst.bytes);
  });

  // The write path canonicalises, but a checkpoint can also arrive from a peer, an old
  // revision, or a hand edit. Canonical form is only an invariant if the READ path
  // refuses everything else — otherwise a non-canonical file survives untouched on any
  // node whose next tick happens to be a no-op, and the divergence outlives the fix.
  test("081KZM0FTJM: refuses a checkpoint whose entries are not in canonical order", async () => {
    const directory = mkdtempSync(join(tmpdir(), "zeta-noncanonical-"));
    directories.push(directory);
    const journalPath = join(directory, "journal.json");
    const checkpointPath = join(directory, "checkpoint.json");
    const a = { eventId: "event/a", rowKey: "system/node", payload: "alpha", weight: 1 };
    const b = { eventId: "event/b", rowKey: "system/other", payload: "beta", weight: 1 };
    writeFileSync(
      journalPath,
      JSON.stringify({ schema: "zeta.db.scheduled-journal.v1", nodeId: "global/browser", deltas: [a, b] }),
    );
    // Entries reversed — semantically identical, lexically not the canonical form.
    const image = {
      schema: "zeta.db.image.v1",
      nodeId: "global/browser",
      revision: 1,
      entries: [b, a],
      rows: [
        { rowKey: "system/node", payload: "alpha", weight: 1 },
        { rowKey: "system/other", payload: "beta", weight: 1 },
      ],
    };
    writeFileSync(
      checkpointPath,
      JSON.stringify({
        schema: "zeta.db.file-checkpoint.v1",
        nodeId: "global/browser",
        revision: 1,
        payloadBase64: Buffer.from(JSON.stringify(image), "utf8").toString("base64"),
      }),
    );

    const result = await runScheduledZetaDbNode({
      journalPath,
      checkpointPath,
      executorId: "actions/1",
      maxDeltas: 8,
      maxEntries: 16,
      maxCheckpointBytes: 16 * 1024,
    });
    expect(result).toMatchObject({ ok: false, feedback: { code: "database-image-non-canonical" } });
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
