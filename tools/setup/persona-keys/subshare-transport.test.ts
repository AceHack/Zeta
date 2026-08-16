// subshare-transport.test.ts — proves the conformance suite CAN FAIL, then
// proves the shipped implementation passes it, then runs a real three-house
// reshare end to end over a store-and-forward spool.
// Run: bun test subshare-transport.test.ts
//
// The order matters. Nine checks that could not fail were found in this repo on
// 2026-08-14, so the mutants come FIRST: if a probe cannot be killed, it is not
// evidence, and a green suite over a plaintext channel is the specific outcome
// this file exists to make impossible.
//
// One mutant per property, each breaking exactly one thing:
//
//   M1 plaintextLayer          -> the scalar rides in the clear      -> P1 dies
//   M2 noSenderAuthLayer       -> signature/roster checks skipped    -> P2 dies
//   M3 noReplayGuardLayer      -> the seen-log is ignored            -> P3 dies
//   M4 longTermKeyLayer        -> one KEM key forever, destroy no-op -> P4 dies
//   M5 sessionBoundHarness     -> a cold reader sees nothing         -> P5 dies
//
// No real key material appears anywhere here: every key is generated from a
// seeded LCG inside the fixture, and no test prints a secret.

import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ed25519 } from "@noble/curves/ed25519.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import { frostKeygen, frostThresholdSign, frostVerify } from "./frost.ts";
import {
  reshareCombine,
  reshareContribute,
  verifyResharePreservesGroupKey,
  type ReshareContribution,
  type ReshareSubshare,
} from "./frost-reshare.ts";
import {
  datagramDigest,
  envelopeSecurityLayer,
  mintRecipientPreKey,
  open as envelopeOpen,
  seal as envelopeSeal,
} from "./subshare-envelope.ts";
import { createMemoryTransport, createSpoolTransport } from "./subshare-spool-adapter.ts";
import {
  buildConformanceFixture,
  formatConformanceReport,
  mustGet,
  mustIndex,
  runSubshareTransportConformance,
  type ConformanceReport,
  type TransportHarness,
} from "./subshare-transport-conformance.ts";
import {
  SUBSHARE_TRANSPORT_PROPERTIES,
  createReplayGuard,
  type CeremonyRoster,
  type MintedPreKey,
  type OpenContext,
  type PropertyId,
  type SealRequest,
  type SealedDatagram,
  type SubshareSecurityLayer,
  type SubshareTransportPort,
} from "./subshare-transport-port.ts";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

/** Memory harness: writer and reader are DIFFERENT instances over one store. */
function memoryHarness(): TransportHarness {
  const backing: Record<string, string> = {};
  const make = (): SubshareTransportPort => {
    const t = createMemoryTransport(backing);
    return {
      adapterName: t.adapterName,
      capabilities: t.capabilities,
      offer: async (d) => {
        await t.offer(d);
        // Publish to the shared backing store, so a later instance sees it.
        Object.assign(backing, t.snapshot());
      },
      collect: (a) => t.collect(a),
    };
  };
  return { name: "memory-spool", writer: () => Promise.resolve(make()), reader: () => Promise.resolve(make()) };
}

// ===========================================================================
// the mutants -- each must DIE on exactly one property
// ===========================================================================

/** M1: confidentiality removed. The datagram carries the scalar in the clear. */
const plaintextLayer: SubshareSecurityLayer = {
  name: "MUTANT-plaintext",
  mintRecipientPreKey,
  seal: (r: SealRequest): SealedDatagram => ({
    schema: "zeta.frost.subshare-datagram.v1",
    ceremonyId: r.roster.ceremonyId,
    fromX: r.subshare.fromX,
    toX: r.subshare.toX,
    body: JSON.stringify({
      schema: "zeta.frost.subshare-datagram.v1",
      ceremonyId: r.roster.ceremonyId,
      fromX: r.subshare.fromX,
      toX: r.subshare.toX,
      scalarHex: r.subshare.scalar.toString(16),
    }),
  }),
  open: (d: SealedDatagram) => {
    const b = JSON.parse(d.body) as { scalarHex: string; fromX: number; toX: number };
    return { ok: true, duplicate: false, subshare: { fromX: b.fromX, toX: b.toX, scalar: BigInt(`0x${b.scalarHex}`) } };
  },
};

/** M2: sender authentication removed. Signature and roster are not consulted. */
const noSenderAuthLayer: SubshareSecurityLayer = {
  name: "MUTANT-no-sender-auth",
  mintRecipientPreKey,
  seal: envelopeSeal,
  open: (d, ctx) => {
    // Accept the ROUTING EXTERIOR as the sender's identity -- the exact mistake
    // "a node is not a holder" warns about -- and skip the signature entirely.
    const permissive: CeremonyRoster = {
      ...ctx.roster,
      holders: (JSON.parse(d.body) as { senderIdentityKey?: string }).senderIdentityKey
        ? [
            {
              x: d.fromX,
              identityPublicKey: (JSON.parse(d.body) as { senderIdentityKey: string }).senderIdentityKey,
              label: "trusted-because-it-arrived",
            },
          ]
        : ctx.roster.holders,
    };
    return envelopeOpen(
      { ...d, fromX: (JSON.parse(d.body) as { fromX: number }).fromX },
      { ...ctx, roster: permissive },
    );
  },
};

/** M3: replay resistance removed. The guard is created fresh on every open. */
const noReplayGuardLayer: SubshareSecurityLayer = {
  name: "MUTANT-no-replay-guard",
  mintRecipientPreKey,
  seal: envelopeSeal,
  open: (d, ctx: OpenContext) => envelopeOpen(d, { ...ctx, guard: createReplayGuard() }),
};

/**
 * M4: forward secrecy removed. The recipient keeps ONE long-term KEM key that it
 * can re-derive on demand, so destroy() is theatre and a recorded datagram is
 * decryptable forever.
 *
 * The mutant has to re-derive rather than wrap, because in the real
 * implementation the decapsulation capability is bound to the handle OBJECT
 * (a WeakMap keyed by identity), so a spread-copy of a handle cannot borrow it.
 * That is a genuine property of the design and the mutant must not be allowed to
 * fail for that reason instead of the reason under test -- a mutant that dies of
 * the wrong cause is not evidence either.
 */
function longTermKeyLayer(): SubshareSecurityLayer {
  // One fixed KEM seed for all time: "we have an encryption key, we use it".
  const FIXED_SEED = new Uint8Array(32).fill(0x5a);
  const fixedRandom = (): (() => number) => {
    let i = 0;
    return () => mustIndex(Array.from(FIXED_SEED), i++ % FIXED_SEED.length) / 256;
  };
  const identities = new Map<number, Uint8Array>();

  const liveHandle = (roster: CeremonyRoster, toX: number): MintedPreKey =>
    mintRecipientPreKey(roster, toX, mustGet(identities, toX), fixedRandom());

  return {
    name: "MUTANT-long-term-recipient-key",
    mintRecipientPreKey: (roster, toX, secret) => {
      identities.set(toX, secret);
      const derived = mintRecipientPreKey(roster, toX, secret, fixedRandom());
      return {
        preKey: derived.preKey,
        handle: {
          ceremonyId: roster.ceremonyId,
          toX,
          isDestroyed: () => false,
          destroy: () => {
            /* a destroy that destroys nothing -- the seed is still on disk */
          },
        },
      };
    },
    seal: envelopeSeal,
    // Ignores the handle it was given and re-derives the long-term key.
    open: (d, ctx) => envelopeOpen(d, { ...ctx, handle: liveHandle(ctx.roster, ctx.handle.toX).handle }),
  };
}

/** M5: eventual delivery removed. Only a port that did the offering can collect. */
function sessionBoundHarness(): TransportHarness {
  let live: SubshareTransportPort | undefined;
  const backing: Record<string, string> = {};
  return {
    name: "MUTANT-session-bound",
    writer: () => {
      const t = createMemoryTransport(backing);
      live = {
        adapterName: "session",
        capabilities: { ...t.capabilities, liveSession: true },
        offer: (d) => t.offer(d),
        collect: (a) => t.collect(a),
      };
      return Promise.resolve(live);
    },
    reader: () =>
      Promise.resolve({
        adapterName: "session",
        capabilities: {
          liveSession: true,
          orderedDelivery: true,
          deduplicates: true,
          metadataConcealment: false,
          offlineCapable: false,
        },
        offer: () => Promise.reject(new Error("no live session")),
        // The defining behaviour of a session transport: nothing survives it.
        collect: () => Promise.resolve([]),
      }),
  };
}

// ===========================================================================
// 1. the suite can fail
// ===========================================================================

interface MutantCase {
  readonly mutant: string;
  readonly property: PropertyId;
  /** The exact probes that MUST die. Naming them stops a mutant from "passing"
   *  the falsifiability test by failing some unrelated probe by accident. */
  readonly deadProbes: readonly string[];
  readonly run: () => Promise<ConformanceReport>;
}

describe("the conformance suite is falsifiable", () => {
  const cases: readonly MutantCase[] = [
    {
      mutant: "M1 plaintext channel",
      property: "P1",
      deadProbes: ["P1.a/secret-not-on-the-wire", "P1.b/collector-of-all-k-cannot-open"],
      run: () => runSubshareTransportConformance(plaintextLayer, memoryHarness(), buildConformanceFixture(lcg(11))),
    },
    {
      mutant: "M2 no sender authentication",
      property: "P2",
      deadProbes: ["P2.a/unrostered-sender-rejected"],
      run: () => runSubshareTransportConformance(noSenderAuthLayer, memoryHarness(), buildConformanceFixture(lcg(12))),
    },
    {
      mutant: "M3 no replay guard",
      property: "P3",
      deadProbes: ["P3.a/identical-redelivery-is-idempotent", "P3.b/conflicting-datagram-at-same-coordinate-rejected"],
      run: () => runSubshareTransportConformance(noReplayGuardLayer, memoryHarness(), buildConformanceFixture(lcg(13))),
    },
    {
      mutant: "M4 long-term recipient key",
      property: "P4",
      deadProbes: [
        "P4.a/prekey-is-fresh-per-ceremony",
        "P4.b/destroy-revokes-recorded-datagrams",
        "P4.c/long-term-compromise-does-not-recover",
      ],
      run: () => runSubshareTransportConformance(longTermKeyLayer(), memoryHarness(), buildConformanceFixture(lcg(14))),
    },
    {
      mutant: "M5 session-bound transport",
      property: "P5",
      deadProbes: ["P5.c/cold-reader-collects-everything-offered"],
      run: () =>
        runSubshareTransportConformance(envelopeSecurityLayer, sessionBoundHarness(), buildConformanceFixture(lcg(15))),
    },
  ];

  for (const c of cases) {
    test(`${c.mutant} FAILS ${c.property}, at the named probes`, async () => {
      const report = await c.run();
      expect(report.byProperty[c.property]).toBe(false);
      expect(report.passed).toBe(false);
      for (const id of c.deadProbes) {
        const probe = report.probes.find((p) => p.id === id);
        if (probe === undefined) throw new Error(`probe ${id} did not run:\n${formatConformanceReport(report)}`);
        if (probe.passed) throw new Error(`probe ${id} survived ${c.mutant}: ${probe.detail}`);
      }
    });
  }

  test("every property has at least one probe that a mutant killed", async () => {
    const killed = new Set<PropertyId>();
    for (const c of cases) {
      const report = await c.run();
      for (const p of SUBSHARE_TRANSPORT_PROPERTIES) if (!report.byProperty[p.id]) killed.add(p.id);
    }
    // If a property is never killed by any mutant, its probes are decoration.
    for (const p of SUBSHARE_TRANSPORT_PROPERTIES) expect(killed.has(p.id)).toBe(true);
  });
});

// ===========================================================================
// 2. the shipped implementation passes it
// ===========================================================================

describe("the shipped envelope + spool adapter conform", () => {
  test("memory spool: all five properties", async () => {
    const report = await runSubshareTransportConformance(
      envelopeSecurityLayer,
      memoryHarness(),
      buildConformanceFixture(lcg(21)),
    );
    if (!report.passed) throw new Error(formatConformanceReport(report));
    expect(report.passed).toBe(true);
  });

  test("filesystem spool: all five properties, across two independent ports", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeta-subshare-spool-"));
    try {
      const harness: TransportHarness = {
        name: `spool:${root}`,
        // Two distinct port instances over one directory -- two processes, no session.
        writer: () => Promise.resolve(createSpoolTransport(root)),
        reader: () => Promise.resolve(createSpoolTransport(root)),
      };
      const report = await runSubshareTransportConformance(
        envelopeSecurityLayer,
        harness,
        buildConformanceFixture(lcg(22)),
      );
      if (!report.passed) throw new Error(formatConformanceReport(report));
      expect(report.passed).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

// ===========================================================================
// 3. the property the port refuses to require: no live session
// ===========================================================================

describe("the port does not assume a session", () => {
  test("no property is marked as provided by a live connection", () => {
    // If this ever flips, adapter 2 (DHT, no session) is constrained and Aaron
    // must be told which property forced it.
    for (const p of SUBSHARE_TRANSPORT_PROPERTIES) {
      expect(p.requirement.includes("live session")).toBe(p.id === "P5");
    }
    const p5 = SUBSHARE_TRANSPORT_PROPERTIES.find((p) => p.id === "P5");
    expect(p5?.providedBy).toBe("port");
    // The four security properties live above the port, so every adapter
    // inherits them and none may reimplement them.
    for (const p of SUBSHARE_TRANSPORT_PROPERTIES.filter((q) => q.id !== "P5")) {
      expect(p.providedBy).toBe("above-port");
    }
  });

  test("a spool written by one port is readable by another after the first is gone", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeta-subshare-cold-"));
    try {
      const fixture = buildConformanceFixture(lcg(31));
      const minted = mintRecipientPreKey(
        fixture.roster,
        fixture.toX,
        mustGet(fixture.participantSecrets, fixture.toX),
        fixture.random,
      );
      {
        const writer = createSpoolTransport(root);
        for (const s of fixture.subshares) {
          await writer.offer(
            envelopeSeal({
              roster: fixture.roster,
              preKey: minted.preKey,
              subshare: s,
              holderIdentitySecret: mustGet(fixture.holderSecrets, s.fromX),
              random: fixture.random,
            }),
          );
        }
      } // writer out of scope: "the other house went offline"

      const reader = createSpoolTransport(root);
      const got = await reader.collect({ ceremonyId: fixture.roster.ceremonyId, toX: fixture.toX });
      expect(got.length).toBe(fixture.subshares.length);
      const guard = createReplayGuard();
      for (const d of got) {
        const out = envelopeOpen(d, { roster: fixture.roster, handle: minted.handle, guard });
        expect(out.ok).toBe(true);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

// ===========================================================================
// 4. end to end: a real reshare over the transport, group key preserved
// ===========================================================================

describe("three-house reshare over a store-and-forward spool", () => {
  test("the group public key survives, and every house only ever saw its own material", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeta-subshare-ceremony-"));
    try {
      const rng = lcg(41);
      const kg = frostKeygen(2, 3, lcg(42));
      const contributingSet = [1, 2];
      const newIndices = [1, 2, 3];
      const newThreshold = 2;
      const ceremonyId = "ceremony-e2e-1";

      // Long-term identity keys, pinned in the roster. Throwaway, seeded.
      const holderSecrets = new Map(contributingSet.map((x) => [x, seeded(rng)]));
      const participantSecrets = new Map(newIndices.map((x) => [x, seeded(rng)]));
      const roster: CeremonyRoster = {
        ceremonyId,
        groupPublicKey: bytesToHex(kg.groupPublicKey),
        holders: contributingSet.map((x) => ({
          x,
          identityPublicKey: bytesToHex(ed25519.getPublicKey(mustGet(holderSecrets, x))),
          label: `house-${String(x)}`,
        })),
        participants: newIndices.map((x) => ({
          x,
          identityPublicKey: bytesToHex(ed25519.getPublicKey(mustGet(participantSecrets, x))),
          label: `new-house-${String(x)}`,
        })),
      };

      // --- phase 1: each new participant publishes a signed, per-ceremony pre-key
      const minted = new Map(
        newIndices.map((x) => [x, mintRecipientPreKey(roster, x, mustGet(participantSecrets, x), rng)]),
      );

      // --- phase 2: each holder contributes and seals, then offers to the spool
      const contributions: ReshareContribution[] = [];
      const writer = createSpoolTransport(root);
      for (const x of contributingSet) {
        const share = kg.shares.find((s) => s.x === x);
        if (share === undefined) throw new Error("fixture: missing share");
        const bundle = reshareContribute(share, contributingSet, newIndices, newThreshold, rng);
        contributions.push(bundle.contribution);
        for (const sub of bundle.subshares) {
          await writer.offer(
            envelopeSeal({
              roster,
              preKey: mustGet(minted, sub.toX).preKey,
              subshare: sub,
              holderIdentitySecret: mustGet(holderSecrets, x),
              random: rng,
            }),
          );
        }
      }

      // The public check anyone can run, on public artifacts only.
      expect(verifyResharePreservesGroupKey(kg.groupPublicKey, contributions)).toBe(true);

      // --- phase 3: each participant collects (cold reader), opens, combines
      const newShares = [];
      for (const x of newIndices) {
        const reader = createSpoolTransport(root);
        const collected = [...(await reader.collect({ ceremonyId, toX: x }))].reverse(); // order must not matter
        const guard = createReplayGuard();
        const handle = mustGet(minted, x).handle;
        const mine: ReshareSubshare[] = [];
        for (const d of [...collected, ...collected]) {
          // deliver everything twice
          const out = envelopeOpen(d, { roster, handle, guard });
          expect(out.ok).toBe(true);
          if (out.ok && !out.duplicate) mine.push(out.subshare);
        }
        expect(mine.length).toBe(contributingSet.length);
        newShares.push(reshareCombine(x, contributions, mine));

        // --- phase 4: destroy the per-ceremony key. Everything the spool still
        // holds for x becomes dead bytes at this line.
        handle.destroy();
        const afterDestroy = envelopeOpen(mustIndex(collected, 0), {
          roster,
          handle,
          guard: createReplayGuard(),
        });
        expect(afterDestroy.ok).toBe(false);
      }

      // The whole point: the trust anchor did not move.
      const sig = frostThresholdSign(
        kg.groupPublicKey,
        newShares.slice(0, 2),
        new TextEncoder().encode("zeta-subshare-transport-e2e"),
        lcg(43),
      );
      expect(frostVerify(kg.groupPublicKey, new TextEncoder().encode("zeta-subshare-transport-e2e"), sig)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function seeded(random: () => number): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = Math.floor(random() * 256);
  return out;
}

// ===========================================================================
// 5. the spool leaks nothing a carrier compromise could use
// ===========================================================================

describe("what a compromised carrier sees", () => {
  test("a datagram on disk contains no scalar, and its digest is stable", () => {
    const fixture = buildConformanceFixture(lcg(51));
    const minted = mintRecipientPreKey(
      fixture.roster,
      fixture.toX,
      mustGet(fixture.participantSecrets, fixture.toX),
      fixture.random,
    );
    const s = mustIndex(fixture.subshares, 0);
    const d = envelopeSeal({
      roster: fixture.roster,
      preKey: minted.preKey,
      subshare: s,
      holderIdentitySecret: mustGet(fixture.holderSecrets, s.fromX),
      random: fixture.random,
    });
    expect(d.body.includes(s.scalar.toString(16))).toBe(false);
    expect(d.body.includes(s.scalar.toString(10))).toBe(false);
    // Content addressing is what makes offer idempotent in the spool.
    expect(datagramDigest(d.body)).toBe(datagramDigest(d.body));
  });
});
