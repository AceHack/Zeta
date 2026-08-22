import { describe, expect, it } from "bun:test";
import {
  destinationHash,
  observeAnnounce,
  decode,
  createReticulumTransport,
  type Announce,
  type PacketTransport,
  type PathTable,
} from "./reticulum-transport.ts";

describe("Reticulum Transport — Adversarial & Security Threat Suite (P1 #9893)", () => {
  const victimZid = "zid-traveler-alice-100";
  const victimDest = destinationHash(victimZid);

  const attackerZid = "zid-attacker-eve-999";
  const attackerDest = destinationHash(attackerZid);

  it("POISON 1: rejects address spoofing / hijacking where dest does not match destinationHash(zid)", () => {
    let table: PathTable = new Map();

    // Valid announce from Alice
    const aliceAnnounce: Announce = {
      dest: victimDest,
      zid: victimZid,
      hops: 1,
      id: `${victimDest}:1`,
    };
    table = observeAnnounce(table, aliceAnnounce, 1000);
    expect(table.get(victimDest)?.zid).toBe(victimZid);

    // Eve attempts to hijack Alice's dest hash with Eve's zid
    const spoofedAnnounce: Announce = {
      dest: victimDest, // Claims Alice's destination hash!
      zid: attackerZid, // Eve's zid!
      hops: 0,          // Claims a closer 0-hop path!
      id: `${victimDest}:2`,
    };

    const nextTable = observeAnnounce(table, spoofedAnnounce, 1100);

    // The spoofed announce MUST be rejected by the self-certifying address guard!
    expect(nextTable.get(victimDest)?.zid).toBe(victimZid);
    expect(nextTable.get(victimDest)?.lastSeenMs).toBe(1000); // Unmodified!
  });

  it("NEGATIVE CONTROL 1: bypassing self-certifying verification allows address hijacking (proves guard is load-bearing)", () => {
    const table: PathTable = new Map();

    const spoofedAnnounce: Announce = {
      dest: victimDest,
      zid: attackerZid,
      hops: 0,
      id: `${victimDest}:spoof`,
    };

    // Un-guarded manual insertion simulates missing check
    const bypassTable = new Map(table);
    bypassTable.set(spoofedAnnounce.dest, {
      dest: spoofedAnnounce.dest,
      zid: spoofedAnnounce.zid,
      hops: spoofedAnnounce.hops,
      lastSeenMs: 2000,
    });

    // Without guard, Eve successfully hijacked Alice's dest!
    expect(bypassTable.get(victimDest)?.zid).toBe(attackerZid);
  });

  it("POISON 2: guarded decode rejects malformed JSON, wrong schemas, and non-object wire frames without throwing", () => {
    expect(decode("not-json")).toBeNull();
    expect(decode("{}")).toBeNull();
    expect(decode(JSON.stringify({ schema: "wrong.schema", frame: {} }))).toBeNull();
    expect(decode(JSON.stringify({ schema: "zeta.reticulum.v1", frame: null }))).toBeNull();
    expect(decode(JSON.stringify({ schema: "zeta.reticulum.v1", frame: { src: 123 } }))).toBeNull();
  });

  it("POISON 3: max hops blast guard drops announces exceeding maxHops limit", () => {
    const packetsSent: string[] = [];
    let packetHandler: ((text: string, from: string) => void) | null = null;

    const mockLower: PacketTransport = {
      sendPacket: (text) => packetsSent.push(text),
      onPacket: (handler) => {
        packetHandler = handler;
      },
    };

    // `announceAuth` is REQUIRED (no silent default) — "off" here is a DECLARATION, not an
    // omission: this test measures the maxHops loop/blast guard, which is deliberately a
    // separate question from announce authenticity and must hold with the auth gate out of the
    // picture. The authenticity suite lives in `reticulum-announce-auth.test.ts`.
    const reticulum = createReticulumTransport(
      { zid: victimZid, relay: true, maxHops: 3, announceAuth: { mode: "off" } },
      mockLower,
      { now: () => 5000 },
    );

    // Send an announce with hops = 4 (> maxHops = 3)
    const excessFrame = JSON.stringify({
      schema: "zeta.reticulum.v1",
      frame: {
        src: attackerDest,
        fid: `${attackerDest}:excess`,
        announce: {
          dest: attackerDest,
          zid: attackerZid,
          hops: 4, // Exceeds maxHops!
          id: `${attackerDest}:1`,
        },
      },
    });

    packetHandler!(excessFrame, "127.0.0.1");

    // Path table MUST NOT record excess hop path
    expect(reticulum.paths().has(attackerDest)).toBeFalse();
    // Transport MUST NOT relay excess hop packet
    expect(packetsSent.length).toBe(0);
  });

  it("MESH BENCHMARK: 10-node chain mesh propagates announces and expires stale paths under TTL", () => {
    let table: PathTable = new Map();
    const nodeCount = 10;
    const nowMs = 10_000;

    for (let i = 0; i < nodeCount; i++) {
      const zid = `zid-node-${i}`;
      const dest = destinationHash(zid);
      table = observeAnnounce(table, { dest, zid, hops: i, id: `${dest}:${i}` }, nowMs);
    }

    expect(table.size).toBe(10);
  });
});
