/**
 * Heartbeat room-evidence emitter conformance.
 *
 * Style: tests inspect persisted Git-shaped artifacts and refuse malformed discovery state; they do
 * not promote a deterministic heartbeat generator into a witness or a solved-room claim.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { emitHeartbeatRoomEvidence, heartbeatGenesisBinding, heartbeatObservationReceipt } from "./emit-room-evidence";
import { decodeRoomEvidenceAuditEvent } from "../observe/room/durable-room-evidence-audit";

const SOURCE_SHA_A = "0123456789abcdef0123456789abcdef01234567";
const SOURCE_SHA_B = "89abcdef0123456789abcdef0123456789abcdef";
const roots: string[] = [];

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "zeta-heartbeat-room-evidence-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("heartbeat durable room-evidence emission", () => {
  test("persists the first heartbeat as sequence zero with explicitly unresolved local authority", async () => {
    const root = await fixtureRoot();
    const emitted = await emitHeartbeatRoomEvidence({
      agent: "alexa",
      runId: "run:001",
      repoRoot: root,
      sourceSha: SOURCE_SHA_A,
      dryRun: false,
    });

    expect(emitted.ok).toBe(true);
    if (!emitted.ok) return;
    expect(emitted.value.duplicate).toBe(false);
    expect(emitted.value.event.delta.emitterSeq).toBe(0);
    expect(emitted.value.event.delta.genesisBinding).toEqual(heartbeatGenesisBinding("alexa"));
    expect(emitted.value.event.genesisWitness).toBeUndefined();
    expect(emitted.value.adjudicationContentKey).toMatch(/^[0-9a-f]{32}$/);
    if (emitted.value.adjudicationContentKey === undefined) throw new Error("sequence-zero adjudication content key is missing");
    expect(emitted.value.event.receipt.solved).toBe(false);
    expect(emitted.value.event.receipt.uncertainty).toEqual({ meanPpm: 0, precisionPpm: 1 });

    const index = JSON.parse(await readFile(join(root, "docs/room-evidence/index.json"), "utf8")) as {
      entries: Array<{
        eventId: string;
        file: string;
        auditContentKey: string;
        receiptContentKey: string;
        adjudication?: { file: string; contentKey: string };
      }>;
    };
    expect(index.entries).toHaveLength(1);
    const entry = index.entries[0]!;
    expect(entry.eventId).toBe(emitted.value.event.delta.eventId);
    const event = decodeRoomEvidenceAuditEvent(await readFile(join(root, "docs/room-evidence", entry.file), "utf8"));
    expect(event.ok).toBe(true);
    if (!event.ok) return;
    expect(event.value.delta.eventId).toBe(entry.eventId);
    expect(await readFile(join(root, "docs/room-evidence/content", `${entry.auditContentKey}.json`), "utf8")).toContain(
      entry.eventId,
    );
    expect(
      await readFile(join(root, "docs/room-evidence/content", `${entry.receiptContentKey}.json`), "utf8"),
    ).toContain("heartbeat-run:alexa:run:001");
    expect(await readFile(join(root, "docs/room-evidence/adjudications", `${entry.eventId}.json`), "utf8")).toContain(
      "request-local-witness",
    );
    expect(entry.adjudication).toEqual({
      file: `adjudications/${entry.eventId}.json`,
      contentKey: emitted.value.adjudicationContentKey,
    });
  });

  test("same workflow run is an idempotent discovery replay rather than a second evidence fact", async () => {
    const root = await fixtureRoot();
    const first = await emitHeartbeatRoomEvidence({
      agent: "alexa",
      runId: "run:002",
      repoRoot: root,
      sourceSha: SOURCE_SHA_A,
      dryRun: false,
    });
    const repeat = await emitHeartbeatRoomEvidence({
      agent: "alexa",
      runId: "run:002",
      repoRoot: root,
      sourceSha: SOURCE_SHA_A,
      dryRun: false,
    });

    expect(first.ok).toBe(true);
    expect(repeat.ok).toBe(true);
    if (!first.ok || !repeat.ok) return;
    expect(repeat.value.duplicate).toBe(true);
    expect(repeat.value.event.delta.eventId).toBe(first.value.event.delta.eventId);
    const index = JSON.parse(await readFile(join(root, "docs/room-evidence/index.json"), "utf8")) as {
      entries: unknown[];
    };
    expect(index.entries).toHaveLength(1);
  });

  test("a later heartbeat advances only the logical sequence and binds its predecessor", async () => {
    const root = await fixtureRoot();
    const first = await emitHeartbeatRoomEvidence({
      agent: "alexa",
      runId: "run:003",
      repoRoot: root,
      sourceSha: SOURCE_SHA_A,
      dryRun: false,
    });
    const second = await emitHeartbeatRoomEvidence({
      agent: "alexa",
      runId: "run:004",
      repoRoot: root,
      sourceSha: SOURCE_SHA_B,
      dryRun: false,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.event.delta.emitterSeq).toBe(1);
    expect(second.value.event.delta.previousEventHash).toBe(first.value.event.delta.eventId);
    expect(second.value.event.delta.genesisBinding).toBeUndefined();
  });

  test("a tampered manifest content key refuses a new heartbeat instead of overwriting discovery evidence", async () => {
    const root = await fixtureRoot();
    const first = await emitHeartbeatRoomEvidence({
      agent: "alexa",
      runId: "run:005",
      repoRoot: root,
      sourceSha: SOURCE_SHA_A,
      dryRun: false,
    });
    expect(first.ok).toBe(true);
    const indexPath = join(root, "docs/room-evidence/index.json");
    const index = JSON.parse(await readFile(indexPath, "utf8")) as {
      entries: Array<{ auditContentKey: string }>;
    };
    index.entries[0]!.auditContentKey = "00000000000000000000000000000000";
    await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

    const next = await emitHeartbeatRoomEvidence({
      agent: "alexa",
      runId: "run:006",
      repoRoot: root,
      sourceSha: SOURCE_SHA_B,
      dryRun: false,
    });
    expect(next).toEqual({ ok: false, reason: expect.stringContaining("audit content key does not bind") });
  });

  test("receipt construction refuses a wall-clock-shaped source identifier and keeps only a source revision", () => {
    expect(() => heartbeatObservationReceipt("alexa", "run:007", "2026-08-27T00:00:00Z", 0)).toThrow("source SHA");
  });
});
