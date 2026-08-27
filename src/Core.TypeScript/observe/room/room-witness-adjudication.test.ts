/** Local witness-adjudication conformance: retain unknowns/conflicts and never mint a hidden winner. */
import { describe, expect, test } from "bun:test";

import { InMemoryStoragePort, ZetaStorageCell } from "../../browser-node/zeta-storage-cell";
import {
  addressRoomWitnessAdjudication,
  makeRoomWitnessAdjudication,
  persistRoomWitnessAdjudication,
} from "./room-witness-adjudication";

const prior = {
  eventId: "event:heart-beat:0",
  auditContentKey: "audit:key:0",
  receiptContentKey: "receipt:key:0",
} as const;

describe("room witness adjudication", () => {
  test("retains unknown authority as a content-addressed request for a local witness", async () => {
    const record = makeRoomWitnessAdjudication(prior, "unresolved", []);
    expect(record.ok).toBe(true);
    if (!record.ok) return;
    expect(record.value.disposition).toBe("request-local-witness");
    const storage = new ZetaStorageCell({ primary: new InMemoryStoragePort(), nodeId: "test" });
    const persisted = await persistRoomWitnessAdjudication(storage, record.value);
    expect(persisted.ok).toBe(true);
    if (!persisted.ok) return;
    expect(
      storage.verify(persisted.value.contentKey, JSON.stringify({ ...record.value, witnessRefs: [] }) + "\n"),
    ).toBe(true);
  });

  test("canonicalizes visible conflicts without choosing a winning witness", () => {
    const left = makeRoomWitnessAdjudication(prior, "disputed", ["witness:b", "witness:a", "witness:b"]);
    const right = makeRoomWitnessAdjudication(prior, "disputed", ["witness:a", "witness:b"]);
    expect(left.ok).toBe(true);
    expect(right.ok).toBe(true);
    if (!left.ok || !right.ok) return;
    expect(left.value.disposition).toBe("retain-conflict");
    expect(left.value.witnessRefs).toEqual(["witness:a", "witness:b"]);
    expect(addressRoomWitnessAdjudication(left.value).contentKey).toBe(
      addressRoomWitnessAdjudication(right.value).contentKey,
    );
  });

  test("refuses the two false collapses: claimed witnesses under unknown authority and a one-sided conflict", () => {
    expect(makeRoomWitnessAdjudication(prior, "unresolved", ["witness:a"])).toEqual({
      ok: false,
      reason: "unresolved authority must not claim a visible witness reference",
    });
    expect(makeRoomWitnessAdjudication(prior, "disputed", ["witness:a"])).toEqual({
      ok: false,
      reason: "disputed authority requires at least two distinct visible witness references",
    });
  });
});
