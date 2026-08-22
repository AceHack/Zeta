// subshare-transport-conformance.ts — the falsifier. Runs the five properties of
// subshare-transport-port.ts against a candidate security layer + adapter pair.
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// ============================================================================
// WHY THIS SHIPS INSTEAD OF LIVING IN A TEST FILE
// ============================================================================
//
// The port exists so that a TCP-hole-punch / websocket-reverse-tunnel / DHT
// adapter can be written later without touching the ceremony's security. That
// promise is worthless unless the later adapter can be CHECKED against the same
// bar. So the checker is shipped code, importable by whoever writes adapter 2,
// and the test file's job is only to prove that the checker can FAIL.
//
// ============================================================================
// THE ANTI-VACUOUS-CHECK DISCIPLINE
// ============================================================================
//
// Nine checks that could not fail were found in this repository on 2026-08-14 --
// including a hardware probe that reported an empty file as attached hardware. A
// transport conformance suite that passes against a plaintext channel would be
// the tenth, and it would be the worst of them, because the thing it falsely
// blesses is a key ceremony.
//
// So every probe below is paired, in subshare-transport.test.ts, with a MUTANT
// that breaks exactly the property the probe covers, and the test asserts the
// mutant FAILS that property and (where the properties are independent) passes
// the others. A probe that no mutant can kill is not evidence.
//
// The fixture generates THROWAWAY keys with a seeded RNG. It must never be
// pointed at real key material: the whole point of a conformance run is to hand
// an implementation secrets and then try to steal them back.

import { ed25519 } from "@noble/curves/ed25519.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import type { ReshareSubshare } from "./frost-reshare.ts";
import {
  SUBSHARE_TRANSPORT_PROPERTIES,
  createReplayGuard,
  type CeremonyPreKey,
  type CeremonyRoster,
  type PropertyId,
  type SealedDatagram,
  type SubshareSecurityLayer,
  type SubshareTransportPort,
} from "./subshare-transport-port.ts";

// ---------------------------------------------------------------------------
// harness + fixture
// ---------------------------------------------------------------------------

/**
 * A candidate adapter, presented as two INDEPENDENT ports over the same backing
 * store. `writer` and `reader` model two processes that never ran at the same
 * time -- which is the whole of P5, expressed as a shape the harness must
 * satisfy rather than a flag it may assert about itself.
 */
export interface TransportHarness {
  readonly name: string;
  writer: () => Promise<SubshareTransportPort>;
  reader: () => Promise<SubshareTransportPort>;
}

export interface ConformanceFixture {
  readonly roster: CeremonyRoster;
  /** Throwaway ed25519 secrets, seeded. NEVER real material. */
  readonly holderSecrets: ReadonlyMap<number, Uint8Array>;
  readonly participantSecrets: ReadonlyMap<number, Uint8Array>;
  /** An off-roster attacker, for the unknown-sender and MITM probes. */
  readonly attackerSecret: Uint8Array;
  /** Subshares addressed to `toX`, one per holder. Synthetic, not from a real key. */
  readonly subshares: readonly ReshareSubshare[];
  readonly toX: number;
  readonly random: () => number;
}

function seededBytes(random: () => number, n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.floor(random() * 256);
  return out;
}

/**
 * Total accessors. A missing fixture entry is a broken conformance run and must
 * say so loudly -- a `!` here would let a mis-built fixture silently hand
 * `undefined` to a crypto call and produce a meaningless verdict.
 */
export function mustGet<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const v = map.get(key);
  if (v === undefined) throw new Error(`conformance fixture: no entry for ${String(key)}`);
  return v;
}

export function mustIndex<T>(items: readonly T[], i: number): T {
  const v = items[i];
  if (v === undefined) throw new Error(`conformance fixture: no element at ${String(i)}`);
  return v;
}

/**
 * Build a synthetic ceremony. The scalars are distinctive constants, not real
 * shares -- P1's "is the secret on the wire" probe needs a needle it can search
 * for, and a real share would put real material in a test fixture.
 */
export function buildConformanceFixture(
  random: () => number,
  options?: { readonly ceremonyId?: string; readonly holders?: readonly number[]; readonly toX?: number },
): ConformanceFixture {
  const ceremonyId = options?.ceremonyId ?? "ceremony-conformance-a";
  const holders = options?.holders ?? [1, 2, 3];
  const toX = options?.toX ?? 7;

  const holderSecrets = new Map<number, Uint8Array>();
  const participantSecrets = new Map<number, Uint8Array>();
  for (const x of holders) holderSecrets.set(x, seededBytes(random, 32));
  participantSecrets.set(toX, seededBytes(random, 32));

  const roster: CeremonyRoster = {
    ceremonyId,
    groupPublicKey: bytesToHex(seededBytes(random, 32)),
    holders: holders.map((x) => ({
      x,
      identityPublicKey: bytesToHex(ed25519.getPublicKey(mustGet(holderSecrets, x))),
      label: `house-${String(x)}`,
    })),
    participants: [
      {
        x: toX,
        identityPublicKey: bytesToHex(ed25519.getPublicKey(mustGet(participantSecrets, toX))),
        label: `new-house-${String(toX)}`,
      },
    ],
  };

  // Distinctive, searchable, and nowhere near a real share.
  const subshares: readonly ReshareSubshare[] = holders.map((fromX) => ({
    fromX,
    toX,
    scalar: BigInt(`0x${"c0ffee".repeat(4)}${String(fromX).padStart(2, "0")}`),
  }));

  return {
    roster,
    holderSecrets,
    participantSecrets,
    attackerSecret: seededBytes(random, 32),
    subshares,
    toX,
    random,
  };
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

export interface ProbeResult {
  readonly id: string;
  readonly property: PropertyId;
  readonly passed: boolean;
  /** What was attempted and what happened. Present whether or not it passed. */
  readonly detail: string;
}

export interface ConformanceReport {
  readonly securityLayer: string;
  readonly adapter: string;
  readonly probes: readonly ProbeResult[];
  readonly byProperty: Readonly<Record<PropertyId, boolean>>;
  readonly passed: boolean;
}

function summarise(securityLayer: string, adapter: string, probes: readonly ProbeResult[]): ConformanceReport {
  const byProperty = {} as Record<PropertyId, boolean>;
  for (const p of SUBSHARE_TRANSPORT_PROPERTIES) {
    const mine = probes.filter((q) => q.property === p.id);
    byProperty[p.id] = mine.length > 0 && mine.every((q) => q.passed);
  }
  return {
    securityLayer,
    adapter,
    probes,
    byProperty,
    passed: SUBSHARE_TRANSPORT_PROPERTIES.every((p) => byProperty[p.id]),
  };
}

/** A probe that throws is a FAILED probe, never a skipped one. */
async function probe(
  id: string,
  property: PropertyId,
  body: () => Promise<{ readonly passed: boolean; readonly detail: string }>,
): Promise<ProbeResult> {
  try {
    const r = await body();
    return { id, property, passed: r.passed, detail: r.detail };
  } catch (e) {
    return { id, property, passed: false, detail: `probe threw: ${String(e)}` };
  }
}

function mutateHex(hex: string): string {
  const c = hex.slice(-1);
  return `${hex.slice(0, -1)}${c === "0" ? "1" : "0"}`;
}

// ---------------------------------------------------------------------------
// the run
// ---------------------------------------------------------------------------

export async function runSubshareTransportConformance(
  security: SubshareSecurityLayer,
  harness: TransportHarness,
  fixture: ConformanceFixture,
): Promise<ConformanceReport> {
  const probes: ProbeResult[] = [];
  const { roster, holderSecrets, participantSecrets, attackerSecret, subshares, toX, random } = fixture;

  // Setup is inside the falsifier too: an implementation that cannot even mint
  // and seal is a FAILING implementation, not a crashed test run.
  let minted: ReturnType<SubshareSecurityLayer["mintRecipientPreKey"]>;
  let sealed: SealedDatagram[];
  try {
    minted = security.mintRecipientPreKey(roster, toX, mustGet(participantSecrets, toX), random);
    sealed = subshares.map((s) =>
      security.seal({
        roster,
        preKey: minted.preKey,
        subshare: s,
        holderIdentitySecret: mustGet(holderSecrets, s.fromX),
        random,
      }),
    );
  } catch (e) {
    return summarise(
      security.name,
      harness.name,
      SUBSHARE_TRANSPORT_PROPERTIES.map((p) => ({
        id: "setup",
        property: p.id,
        passed: false,
        detail: `mint/seal failed before any probe ran: ${String(e)}`,
      })),
    );
  }

  // ---- P1 confidentiality ------------------------------------------------

  probes.push(
    await probe("P1.a/secret-not-on-the-wire", "P1", () => {
      const hits = subshares.filter((s, i) => {
        const wire = mustIndex(sealed, i).body;
        const hex = s.scalar.toString(16);
        return wire.includes(hex) || wire.includes(s.scalar.toString(10));
      });
      return Promise.resolve({
        passed: hits.length === 0,
        detail:
          hits.length === 0
            ? "no subshare scalar appears in any datagram body (hex or decimal)"
            : `scalar appears verbatim in ${String(hits.length)} datagram bodies -- the channel is plaintext`,
      });
    }),
  );

  probes.push(
    await probe("P1.b/collector-of-all-k-cannot-open", "P1", () => {
      // The exact adversary frost-reshare.ts caveat 2 names: a relay holding
      // EVERY datagram addressed to j. It has its own valid keys; it is on the
      // roster's network; it simply is not j.
      const attackerRoster: CeremonyRoster = {
        ...roster,
        participants: [
          {
            x: toX,
            identityPublicKey: bytesToHex(ed25519.getPublicKey(attackerSecret)),
            label: "collector",
          },
        ],
      };
      const attacker = security.mintRecipientPreKey(attackerRoster, toX, attackerSecret, random);
      const guard = createReplayGuard();
      const opened = sealed.filter((d) => security.open(d, { roster, handle: attacker.handle, guard }).ok);
      return Promise.resolve({
        passed: opened.length === 0,
        detail:
          opened.length === 0
            ? "a collector holding every datagram for the recipient opened none of them"
            : `a collector opened ${String(opened.length)}/${String(sealed.length)} datagrams -- k of these reconstruct the new share`,
      });
    }),
  );

  probes.push(
    await probe("P1.c/holder-refuses-unauthenticated-prekey", "P1", () => {
      // MITM substitutes its own KEM key. A holder that seals to it hands the
      // subshare to the MITM, and nothing downstream notices.
      const forged: CeremonyPreKey = {
        ...minted.preKey,
        signature: mutateHex(minted.preKey.signature),
      };
      let refused: boolean;
      try {
        security.seal({
          roster,
          preKey: forged,
          subshare: mustIndex(subshares, 0),
          holderIdentitySecret: mustGet(holderSecrets, mustIndex(subshares, 0).fromX),
          random,
        });
        refused = false;
      } catch {
        refused = true;
      }
      return Promise.resolve({
        passed: refused,
        detail: refused
          ? "holder refused to seal to an unrostered/unsigned pre-key"
          : "holder sealed to a pre-key whose signature does not verify against the roster",
      });
    }),
  );

  // ---- P2 holder authenticity -------------------------------------------

  probes.push(
    await probe("P2.a/unrostered-sender-rejected", "P2", () => {
      // Sealed under a roster that seats the attacker at holder 1; opened under
      // the real roster. This is exactly "headscale admitted a new node".
      const attackerRoster: CeremonyRoster = {
        ...roster,
        holders: [{ x: 1, identityPublicKey: bytesToHex(ed25519.getPublicKey(attackerSecret)), label: "intruder" }],
      };
      const injected = security.seal({
        roster: attackerRoster,
        preKey: minted.preKey,
        subshare: { fromX: 1, toX, scalar: 42n },
        holderIdentitySecret: attackerSecret,
        random,
      });
      const out = security.open(injected, {
        roster,
        handle: minted.handle,
        guard: createReplayGuard(),
      });
      return Promise.resolve({
        passed: !out.ok,
        detail: out.ok ? "a subshare from a key the roster does not pin was ACCEPTED" : `rejected: ${out.reason}`,
      });
    }),
  );

  probes.push(
    await probe("P2.b/tampered-signature-rejected", "P2", () => {
      const d = mustIndex(sealed, 0);
      const body = JSON.parse(d.body) as Record<string, unknown>;
      body.signature = mutateHex(String(body.signature));
      const out = security.open(
        { ...d, body: JSON.stringify(body) },
        { roster, handle: minted.handle, guard: createReplayGuard() },
      );
      return Promise.resolve({
        passed: !out.ok,
        detail: out.ok ? "a datagram with a broken signature was ACCEPTED" : `rejected: ${out.reason}`,
      });
    }),
  );

  probes.push(
    await probe("P2.c/routing-exterior-is-not-identity", "P2", () => {
      // The routing hint says holder 2; the authenticated interior says holder 1.
      // A carrier that can rewrite addresses must not be able to re-attribute a
      // subshare (writer-actor-routing-model.md at wire level).
      const d = mustIndex(sealed, 0);
      const out = security.open(
        { ...d, fromX: d.fromX + 1 },
        { roster, handle: minted.handle, guard: createReplayGuard() },
      );
      return Promise.resolve({
        passed: !out.ok,
        detail: out.ok
          ? "a datagram whose routing exterior disagreed with its signed interior was ACCEPTED"
          : `rejected: ${out.reason}`,
      });
    }),
  );

  probes.push(
    await probe("P2.d/ciphertext-tamper-rejected", "P2", () => {
      const d = mustIndex(sealed, 0);
      const body = JSON.parse(d.body) as Record<string, unknown>;
      body.ciphertext = mutateHex(String(body.ciphertext));
      const out = security.open(
        { ...d, body: JSON.stringify(body) },
        { roster, handle: minted.handle, guard: createReplayGuard() },
      );
      return Promise.resolve({
        passed: !out.ok,
        detail: out.ok ? "a tampered ciphertext was ACCEPTED" : `rejected: ${out.reason}`,
      });
    }),
  );

  // ---- P3 ceremony binding + replay -------------------------------------

  probes.push(
    await probe("P3.a/identical-redelivery-is-idempotent", "P3", () => {
      const guard = createReplayGuard();
      const d = mustIndex(sealed, 0);
      const first = security.open(d, { roster, handle: minted.handle, guard });
      const second = security.open(d, { roster, handle: minted.handle, guard });
      const ok =
        first.ok &&
        second.ok &&
        first.subshare.scalar === second.subshare.scalar &&
        !first.duplicate &&
        second.duplicate;
      return Promise.resolve({
        passed: ok,
        detail: ok
          ? "the same datagram delivered twice yielded the same subshare, flagged duplicate the second time"
          : "redelivery of an identical datagram was not idempotent (a lossy carrier would break the ceremony)",
      });
    }),
  );

  probes.push(
    await probe("P3.b/conflicting-datagram-at-same-coordinate-rejected", "P3", () => {
      // Same holder, same recipient, DIFFERENT bytes. Never a redelivery; either
      // an attack or a holder bug, and both must stop the ceremony.
      const guard = createReplayGuard();
      const first = mustIndex(sealed, 0);
      const conflicting = security.seal({
        roster,
        preKey: minted.preKey,
        subshare: { ...mustIndex(subshares, 0), scalar: 999n },
        holderIdentitySecret: mustGet(holderSecrets, mustIndex(subshares, 0).fromX),
        random,
      });
      security.open(first, { roster, handle: minted.handle, guard });
      const out = security.open(conflicting, { roster, handle: minted.handle, guard });
      return Promise.resolve({
        passed: !out.ok,
        detail: out.ok
          ? "a SECOND, different subshare from the same holder was ACCEPTED at the same coordinate"
          : `rejected: ${out.reason}`,
      });
    }),
  );

  probes.push(
    await probe("P3.c/cross-ceremony-replay-rejected", "P3", () => {
      // Ceremony B, same houses, same keys, new id. A recorded datagram from A
      // must be inert -- otherwise the new share set is not independent of the
      // old one and proactive refresh silently stops working.
      const rosterB: CeremonyRoster = { ...roster, ceremonyId: `${roster.ceremonyId}-B` };
      const mintedB = security.mintRecipientPreKey(rosterB, toX, mustGet(participantSecrets, toX), random);
      const out = security.open(mustIndex(sealed, 0), {
        roster: rosterB,
        handle: mintedB.handle,
        guard: createReplayGuard(),
      });
      return Promise.resolve({
        passed: !out.ok,
        detail: out.ok
          ? "a datagram recorded from an EARLIER ceremony was accepted into a later one"
          : `rejected: ${out.reason}`,
      });
    }),
  );

  // ---- P4 forward secrecy ------------------------------------------------

  probes.push(
    await probe("P4.a/prekey-is-fresh-per-ceremony", "P4", () => {
      const rosterB: CeremonyRoster = { ...roster, ceremonyId: `${roster.ceremonyId}-B` };
      const second = security.mintRecipientPreKey(rosterB, toX, mustGet(participantSecrets, toX), random);
      const fresh = second.preKey.kemPublicKey !== minted.preKey.kemPublicKey;
      return Promise.resolve({
        passed: fresh,
        detail: fresh
          ? "each ceremony gets its own KEM key, so destroying one cannot be undone by the next"
          : "the recipient reuses a LONG-TERM KEM key -- recorded datagrams stay decryptable forever",
      });
    }),
  );

  probes.push(
    await probe("P4.b/destroy-revokes-recorded-datagrams", "P4", () => {
      const local = security.mintRecipientPreKey(roster, toX, mustGet(participantSecrets, toX), random);
      const mine = security.seal({
        roster,
        preKey: local.preKey,
        subshare: mustIndex(subshares, 0),
        holderIdentitySecret: mustGet(holderSecrets, mustIndex(subshares, 0).fromX),
        random,
      });
      const before = security.open(mine, {
        roster,
        handle: local.handle,
        guard: createReplayGuard(),
      });
      local.handle.destroy();
      const after = security.open(mine, {
        roster,
        handle: local.handle,
        guard: createReplayGuard(),
      });
      const ok = before.ok && !after.ok && local.handle.isDestroyed();
      return Promise.resolve({
        passed: ok,
        detail: ok
          ? "the recorded datagram opened before destroy() and was dead bytes after it"
          : "destroy() did not revoke decryption -- forward secrecy is claimed, not provided",
      });
    }),
  );

  probes.push(
    await probe("P4.c/long-term-compromise-does-not-recover", "P4", () => {
      // Model the adversary of P4: it later obtains EVERY long-term secret. It
      // can therefore mint fresh pre-keys and forge signatures at will. It still
      // must not open the recording, because the key that opened it is gone.
      const local = security.mintRecipientPreKey(roster, toX, mustGet(participantSecrets, toX), random);
      const recorded = security.seal({
        roster,
        preKey: local.preKey,
        subshare: mustIndex(subshares, 0),
        holderIdentitySecret: mustGet(holderSecrets, mustIndex(subshares, 0).fromX),
        random,
      });
      local.handle.destroy();
      const compromised = security.mintRecipientPreKey(roster, toX, mustGet(participantSecrets, toX), random);
      const out = security.open(recorded, {
        roster,
        handle: compromised.handle,
        guard: createReplayGuard(),
      });
      return Promise.resolve({
        passed: !out.ok,
        detail: out.ok
          ? "full long-term key compromise recovered a recorded subshare -- there is no forward secrecy"
          : `rejected even with every long-term secret in hand: ${out.reason}`,
      });
    }),
  );

  // ---- P5 eventual delivery ---------------------------------------------

  probes.push(
    await probe("P5.a/collect-before-anything-arrives-returns-empty", "P5", async () => {
      const port = await harness.reader();
      const got = await port.collect({ ceremonyId: `${roster.ceremonyId}-never`, toX });
      return {
        passed: got.length === 0,
        detail:
          got.length === 0
            ? "collect on an address with nothing on it returned [] rather than blocking or throwing"
            : "collect returned datagrams for an address nothing was offered to",
      };
    }),
  );

  probes.push(
    await probe("P5.b/offer-succeeds-with-no-recipient-present", "P5", async () => {
      const port = await harness.writer();
      for (const d of sealed) await port.offer(d);
      // Re-offer everything: the contract says offer is idempotent, because a
      // carrier that loses a datagram is answered by re-offering it.
      for (const d of sealed) await port.offer(d);
      return {
        passed: true,
        detail: "offered every datagram twice with no recipient online and no error",
      };
    }),
  );

  probes.push(
    await probe("P5.c/cold-reader-collects-everything-offered", "P5", async () => {
      // A FRESH port over the same backing store: the sender's process is gone.
      // This is the probe a session-bound adapter cannot pass.
      const port = await harness.reader();
      const got = await port.collect({ ceremonyId: roster.ceremonyId, toX });
      const senders = new Set(got.map((d) => d.fromX));
      const expected = new Set(sealed.map((d) => d.fromX));
      const complete = expected.size === senders.size && [...expected].every((x) => senders.has(x));
      return {
        passed: complete,
        detail: complete
          ? `a port built after the writer was gone collected all ${String(expected.size)} senders' datagrams`
          : `cold reader saw ${String(senders.size)}/${String(expected.size)} senders -- the adapter needs a live session`,
      };
    }),
  );

  probes.push(
    await probe("P5.d/order-and-duplicates-do-not-matter", "P5", async () => {
      const port = await harness.reader();
      const got = [...(await port.collect({ ceremonyId: roster.ceremonyId, toX }))];
      const shuffled = [...got].reverse();
      const withDupes = [...shuffled, ...shuffled];

      const collect = (order: readonly SealedDatagram[]): string => {
        const guard = createReplayGuard();
        const acc = new Map<number, bigint>();
        for (const d of order) {
          const out = security.open(d, { roster, handle: minted.handle, guard });
          if (out.ok) acc.set(out.subshare.fromX, out.subshare.scalar);
        }
        // Sum: the fold reshareCombine performs. Commutative, so order is not a
        // requirement on the transport -- which is why P5 can be this weak.
        let sum = 0n;
        for (const x of [...acc.keys()].sort((a, b) => a - b)) sum += mustGet(acc, x);
        return `${String(acc.size)}:${sum.toString(16)}`;
      };

      const forward = collect(got);
      const backward = collect(shuffled);
      const dupes = collect(withDupes);
      const ok = forward === backward && forward === dupes && !forward.startsWith("0:");
      return {
        passed: ok,
        detail: ok
          ? `the fold is identical forwards, reversed, and duplicated (${forward})`
          : `the fold depended on delivery order or duplication (${forward} / ${backward} / ${dupes})`,
      };
    }),
  );

  return summarise(security.name, harness.name, probes);
}

/** Human-readable report, for a ceremony transcript. Never prints key material. */
export function formatConformanceReport(report: ConformanceReport): string {
  const lines = [
    `subshare transport conformance: ${report.passed ? "PASS" : "FAIL"}`,
    `  security layer: ${report.securityLayer}`,
    `  adapter:        ${report.adapter}`,
  ];
  for (const p of SUBSHARE_TRANSPORT_PROPERTIES) {
    lines.push(`  ${p.id} ${report.byProperty[p.id] ? "ok  " : "FAIL"} ${p.name}`);
    for (const q of report.probes.filter((r) => r.property === p.id)) {
      lines.push(`      ${q.passed ? "+" : "!"} ${q.id}: ${q.detail}`);
    }
  }
  return lines.join("\n");
}
