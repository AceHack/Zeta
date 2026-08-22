// announce-metric-chain — the hop count made one-sided: inflatable by anyone, deflatable by
// nobody (shadow*). The chosen mechanism for RESIDUAL 2 of the `docs/BUGS.md` Reticulum-announce
// entry. Design + the rejected alternatives + the cost table:
// `docs/research/2026-08-22-hop-count-is-not-a-claim-mutation-entitlement-decides-the-mechanism.md`.
//
// NOT ON THE WIRE YET, and that is deliberate. This module is the mechanism plus its falsifiers;
// wiring it into `Announce`/`claimBytes` changes the signed bytes and is a wire migration with a
// stated cost, taken as its own step. Under `.claude/rules/toy-is-free-metered-must-be-earned.md`
// this is **metered, unwired**: the central claims below are measured by
// `announce-metric-chain.test.ts` (deflation refused, inflation free, an eight-hop honest relay
// still verifies), and no production path reads it. Saying so is the point — an unlabelled module
// nothing calls is how a mechanism gets believed before it is chosen.
//
// ─── THE PROBLEM ────────────────────────────────────────────────────────────────────────────────
//
// `reticulum-announce-auth.ts` signs the identity claim `(dest, zid)` and deliberately does NOT
// sign `hops`, because every honest relay increments it — a signature over `hops` breaks on the
// first honest relay and would have to be disabled to ship, and a check that must be disabled to
// ship is not a check. The consequence is that a captured GENUINE announce can be replayed with a
// LOWERED hop count: `observeAnnounce` keeps the lowest hop count, so the liar wins the route.
//
// ─── WHY A SEQUENCE NUMBER ALONE DOES NOT CLOSE IT ──────────────────────────────────────────────
//
// The BUGS entry offered "per-link authentication, OR a signed monotonic sequence". The `OR` is
// wrong and it took writing the attack out to see it. A sequence number is a property of the
// EPOCH, not of the path: the attacker replays the CURRENT epoch — same `seq`, same signature,
// same everything except a lowered `hops`. Nothing about `seq` discriminates that copy from the
// genuine one, because the genuine one carries the same `seq`. A sequence number closes
// stale-epoch replay (resurrecting a path the origin has since abandoned), which is a real and
// different residual; it does not close deflation within the live epoch.
//
// So the two are not alternatives — they are two halves, and this module carries both:
//
//   ACROSS epochs (rollback)      → the signed monotone `seq`, folded as a max-join (`raiseFloor`)
//   WITHIN an epoch (deflation)   → the one-way chain (`advanceMetric` / `verifyMetric`)
//
// ─── THE CHAIN ──────────────────────────────────────────────────────────────────────────────────
//
// Lamport's one-way chain (1981), applied to a routing metric exactly as SEAD does (Hu, Johnson &
// Perrig 2002). Per epoch the origin draws a secret seed and publishes `anchor = h^maxHops(seed)`
// INSIDE the signed claim bytes. The announce at hop count `k` carries `value_k = h^k(seed)`.
//
//   verify at hop k:   h^(maxHops − k)(value_k) == anchor
//   honest relay:      value_(k+1) = h(value_k)          ← ONE hash. That is the entire relay cost.
//   inflate to k' > k: free (hash again) — and harmless; see the asymmetry note below.
//   deflate to k' < k: needs a PREIMAGE of `value_k` under h^(k−k'). Preimage resistance refuses it.
//
// The signature covers `(dest, zid, seq, anchor, maxHops)` — all origin-fixed for the epoch — and
// never `value`, which the path mutates. So an honest relay breaks nothing, which is the property
// that killed the naive "just sign hops" fix.
//
// ─── THE ASYMMETRY IS THE WHOLE DESIGN ──────────────────────────────────────────────────────────
//
// The requirement is NOT "the hop count is correct". It cannot be: a relay can always inflate, and
// inflation is indistinguishable from a slow link or from simply declining to relay — no mechanism
// prevents a node from being a bad path. The requirement is one-sided:
//
//     a claimed hop count may never be LOWER than the shortest path the claimant actually holds.
//
// Deflation is what captures routing preference; inflation is self-harm. A one-way hash chain is
// exactly a one-sided integrity mechanism, which is why it fits a metric where a signature does not.
//
// ─── WHAT IT DOES NOT CLOSE, MEASURED NOT GUESSED ───────────────────────────────────────────────
//
// 1. ONE-HOP SHAVE. A node at true distance d hears `value_(d−1)` from its upstream and may
//    re-announce at d−1, impersonating its own informant's distance. It can never claim better
//    than the best value delivered TO it, so the guarantee is "no closer than your closest
//    genuine informant" — which turns a GLOBAL route-capture primitive (claim 0 from anywhere)
//    into a LOCAL one-hop tie-break. Closing the last hop needs per-link authentication; that is
//    named in the design doc with its O(hops) cost and declined for now.
// 2. FRESH-EPOCH REPLAY TO A NODE THAT HAS NOT SEEN IT. The floor refuses OLD epochs; a node that
//    has never seen epoch n accepts a replay of epoch n. Unavoidable without a clock, and a clock
//    is refused here on purpose (see below).
// 3. This is a METRIC integrity mechanism. It says nothing about identity — that is the signature's
//    job, already shipped — and nothing about whether the route works.
//
// ─── WHY NO WALL CLOCK, AND WHY THE FLOOR IS NOT ONE ────────────────────────────────────────────
//
// `.claude/rules/local-time-never-enters-the-shared-fold.md`: local receive-time may steer local
// action and must never filter the evidence entering a shared fold, because two nodes with
// different receive-times would then fold different sets and diverge. That rules out the obvious
// freshness window ("drop announces older than N seconds") and it is why the canonical wormhole
// defence — temporal packet leashes (Hu, Perrig & Johnson 2003) — is NOT what this module does:
// a temporal leash needs tightly synchronised clocks, which is precisely the dependency the rule
// forbids.
//
// The epoch floor is not a clock and the distinction is mechanical, not rhetorical: `seq` is the
// ORIGIN's own counter, carried inside the signed bytes, so it is part of the evidence rather than
// a fact about the receiver. `raiseFloor` is `max`, which is commutative, associative and
// idempotent — a join-semilattice, i.e. a CRDT — so any permutation of the same evidence set
// reaches the same floor, and a lost epoch leaves an older floor rather than a divergent one.
// `announce-metric-chain.test.ts` pins that by folding every permutation and asserting byte
// identity, which is the falsifier for the claim that this respects the rule.
//
// ─── ORDER OF COMPOSITION IS LOAD-BEARING, SO IT IS ENCODED, NOT DESCRIBED ──────────────────────
//
// The floor may be raised ONLY by an announce whose signature already verified. Reversed, the
// floor is a censorship primitive: an unauthenticated peer sends `seq = 2^31` for a victim's zid,
// every honest announce is then below the floor, and the victim is silenced permanently by one
// packet — a worse hole than the one being fixed. `admitMetric` takes the verification verdict as
// an argument for exactly this reason; it cannot be called in the wrong order without saying so.
//
// Disciplines: pure, total, no ambient clock / keystore / socket (noninterference §13); TEXT wire
// (hex, no binary in the proof lineage); DST-replayable (the seed is derived, never drawn);
// verdicts name the NEUTRAL FACT and never an intent (dual-use §). Anchors (Beacon): Leslie
// Lamport, "Password Authentication with Insecure Communication" (CACM 24(11):770–772, 1981) —
// the one-way chain; Yih-Chun Hu, David B. Johnson & Adrian Perrig, "SEAD: Secure Efficient
// Distance Vector Routing for Mobile Wireless Ad Hoc Networks" (WMCSA 2002; Ad Hoc Networks
// 1(1):175–192, 2003) — the chain used as a one-sided metric bound, which is this construction;
// Yih-Chun Hu, Adrian Perrig & David B. Johnson, "Packet Leashes" (INFOCOM 2003) — the wormhole
// class and the clock dependency declined here; Stephen Kent, Charles Lynn & Karen Seo, "Secure
// Border Gateway Protocol (S-BGP)" (IEEE JSAC 18(4):582–592, 2000) and RFC 8205 (BGPsec) — the
// per-hop-signature alternative and its cost.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/// The epoch declaration — every field is origin-fixed for the epoch and therefore SIGNABLE.
/// This is what joins `(dest, zid)` inside the signature's canonical bytes when the wire migration
/// happens; nothing here is mutated in transit.
export interface MetricEpoch {
  /// The origin's own monotone counter. Agreed phase / logical order — NOT a timestamp, and
  /// never compared against a local now.
  readonly seq: number;
  /// `h^maxHops(seed)`, hex. The public end of the chain.
  readonly anchor: string;
  /// The chain length the origin built. This is the origin's DECLARATION of how far its announce
  /// may travel; a receiver's own `maxHops` blast guard is a separate, local policy question and
  /// the two are deliberately not conflated.
  readonly maxHops: number;
}

/// Why a metric was refused. Each names the NEUTRAL FACT (dual-use §) — a refusal is a
/// measurement, never a verdict about the sender. A relay running an older wire and an attacker
/// shaving hops produce the same word, and the caller's policy decides what it means.
export type MetricRefuseReason =
  | "malformed-epoch" // the epoch declaration is not the vocabulary
  | "malformed-metric" // the carried value is not a hex chain element
  | "hops-out-of-chain" // hop count outside 0..maxHops — no chain element can exist for it
  | "metric-unverifiable" // hashing forward from the value does not reach the anchor
  | "stale-epoch"; // seq below the floor already established for this identity

export type MetricVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: MetricRefuseReason };

/// The chain length cap. Not a security parameter — a bound on the verifier's work (a receiver at
/// hop 0 hashes `maxHops` times) and on what a malformed epoch can ask it to do. RNS's default
/// announce horizon is 8; 64 leaves generous headroom while keeping a hostile epoch declaration
/// from turning verification into a denial of service.
export const MAX_CHAIN = 64;

const HEX64 = /^[0-9a-f]{64}$/;

function h(hex: string): string {
  return createHash("sha256").update(hex, "utf8").digest("hex");
}

/// Derive an epoch's secret seed. DETERMINISTIC — no rng, so a DST replay of the same node at the
/// same seq produces the same chain (and the same wire bytes). `secret` is the node's own key
/// material and never leaves it; the seed must be unguessable because `value_0` IS the seed, and
/// anyone who can guess it can claim hop 0 for that identity.
export function deriveSeed(secret: string, zid: string, seq: number): string {
  return createHmac("sha256", secret).update(`zeta.announce-metric.v1|${zid}|${seq}`, "utf8").digest("hex");
}

/// Build one epoch: the signable declaration plus the chain values the origin will hand out.
/// `values[k]` is what an announce at hop count `k` carries; `values[0]` is what the origin emits.
/// Cost to the ORIGIN: `maxHops` hashes, once per epoch.
export function metricEpoch(seed: string, seq: number, maxHops: number): { readonly epoch: MetricEpoch; readonly values: readonly string[] } {
  if (!Number.isSafeInteger(maxHops) || maxHops < 0 || maxHops > MAX_CHAIN) {
    throw new Error(`metricEpoch: maxHops must be an integer in 0..${MAX_CHAIN} (got ${String(maxHops)})`);
  }
  if (!Number.isSafeInteger(seq) || seq < 0) {
    throw new Error(`metricEpoch: seq must be a non-negative safe integer (got ${String(seq)})`);
  }
  const values: string[] = [h(seed)]; // value_0 — one hash of the seed, so the raw HMAC never ships
  for (let k = 1; k <= maxHops; k++) values.push(h(values[k - 1]!));
  return { epoch: { seq, anchor: values[maxHops]!, maxHops }, values };
}

/// The relay's entire cost: ONE hash. No key material, no state, no signature, no round trip —
/// which is the whole reason this mechanism was chosen over per-hop signatures. A relay that
/// cannot afford one SHA-256 per forwarded announce cannot afford to be a relay.
export function advanceMetric(value: string): string {
  return h(value);
}

function wellFormedEpoch(e: MetricEpoch): boolean {
  const x = e as { seq?: unknown; anchor?: unknown; maxHops?: unknown } | null | undefined;
  if (typeof x !== "object" || x === null) return false;
  if (typeof x.seq !== "number" || !Number.isSafeInteger(x.seq) || x.seq < 0) return false;
  if (typeof x.maxHops !== "number" || !Number.isSafeInteger(x.maxHops) || x.maxHops < 0 || x.maxHops > MAX_CHAIN) return false;
  return typeof x.anchor === "string" && HEX64.test(x.anchor);
}

/// Constant-time hex compare. The anchor is public, so this is not load-bearing today; it is here
/// because the comparison sits one refactor away from a secret-dependent one, and a `===` that
/// LOOKS fine is how that refactor passes review.
function hexEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/// Verify a carried metric against the epoch's signed anchor. Pure, total, never throws — a
/// hostile wire gets a verdict.
///
/// Noninterference §13: a function of (epoch, hops, value) alone. It opens no keystore, reads no
/// clock and touches no socket, which is also what makes it DST-replayable.
export function verifyMetric(epoch: MetricEpoch, hops: number, value: string): MetricVerdict {
  if (!wellFormedEpoch(epoch)) return { ok: false, reason: "malformed-epoch" };
  if (typeof value !== "string" || !HEX64.test(value)) return { ok: false, reason: "malformed-metric" };
  if (typeof hops !== "number" || !Number.isSafeInteger(hops) || hops < 0 || hops > epoch.maxHops) {
    return { ok: false, reason: "hops-out-of-chain" };
  }
  let cur = value;
  for (let i = 0; i < epoch.maxHops - hops; i++) cur = h(cur);
  return hexEq(cur, epoch.anchor) ? { ok: true } : { ok: false, reason: "metric-unverifiable" };
}

/// The rollback floor: identity → the highest epoch `seq` VERIFIED for it. Not a clock and not a
/// receive-time — the origin's own counter, read out of evidence the signature covers.
export type EpochFloor = ReadonlyMap<string, number>;

export const emptyFloor: EpochFloor = new Map<string, number>();

/// Is this epoch current enough to fold? `seq === floor` is ADMITTED, and that is not slack: the
/// same epoch legitimately arrives many times over many paths with different hop counts, and that
/// is precisely the mechanism by which the path table discovers the best route. Only a STRICTLY
/// older epoch is refused.
export function admitEpoch(floor: EpochFloor, zid: string, seq: number): boolean {
  const cur = floor.get(zid);
  return cur === undefined || seq >= cur;
}

/// Raise the floor — a max-join. Commutative, associative, idempotent (a join-semilattice, i.e. a
/// CRDT), so any permutation of the same evidence set converges to the same floor and a lost epoch
/// degrades to an older floor rather than to a divergent one. Returns the SAME reference when
/// nothing moves, so an idempotent re-fold is byte-identical by construction rather than by
/// inspection.
export function raiseFloor(floor: EpochFloor, zid: string, seq: number): EpochFloor {
  const cur = floor.get(zid);
  if (cur !== undefined && cur >= seq) return floor;
  const next = new Map(floor);
  next.set(zid, seq);
  return next;
}

export interface MetricAdmission {
  readonly floor: EpochFloor;
  readonly verdict: MetricVerdict;
}

/// The whole gate, with the composition order ENCODED rather than described.
///
/// `signatureVerified` is a required argument, not an assumption. The floor may only be raised by
/// an announce whose signature already verified as speaking for `zid`; reversed, one unauthenticated
/// packet carrying `seq = 2^31` silences that identity forever — a censorship primitive strictly
/// worse than the deflation it was meant to fix. Passing `false` therefore refuses and leaves the
/// floor BYTE-IDENTICAL (same reference), exactly as a refused announce leaves the path table.
export function admitMetric(
  floor: EpochFloor,
  zid: string,
  epoch: MetricEpoch,
  hops: number,
  value: string,
  signatureVerified: boolean,
): MetricAdmission {
  if (!wellFormedEpoch(epoch)) return { floor, verdict: { ok: false, reason: "malformed-epoch" } };
  // An unverified announce may never move the floor — it may not even be measured against it,
  // because "was refused as stale" is itself information an attacker could farm.
  if (!signatureVerified) return { floor, verdict: { ok: false, reason: "metric-unverifiable" } };
  if (!admitEpoch(floor, zid, epoch.seq)) return { floor, verdict: { ok: false, reason: "stale-epoch" } };
  const verdict = verifyMetric(epoch, hops, value);
  if (!verdict.ok) return { floor, verdict };
  return { floor: raiseFloor(floor, zid, epoch.seq), verdict };
}
