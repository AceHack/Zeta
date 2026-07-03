// x402-envelope — the spend envelope: bounded, metered, self-certifying agent spending (shadow*).
//
// Aaron 2026-07-02: "money is the fastest [freedom lever] — x402 + the Bazaar", "for now until
// you have your own hardware keys", "x402 = blockchain + git/merkle + dagfs".
//
// This is the DECISION + LEDGER layer of agentic payments — the safe, buildable half. An agent
// spends WITHIN a bounded envelope a human/policy sets; every spend is metered, capped, and
// written to a self-certifying ledger. Actual settlement (a key/signature) happens behind the
// injected `PayPort` — NOT implemented here: custody stays gated "for now, until the agent has
// its own hardware keys." The separation of DECISION (this module) from CUSTODY (the port) is the
// whole safety story: the agent spends within the envelope, never from a key it holds.
//
// WHY (the anti-gacha values anchor). Aaron 2026-07-02: Genshin Impact is *ironically the
// OPPOSITE of gacha* — the money isn't extracted by manipulation, it buys real shared real-time
// experience (co-op with his daughter). The discriminator for whether an agent's money is GOOD is
// the same: does the spend produce genuine shared value, or extract via manipulation? This
// envelope is **structurally anti-gacha** — bounded (can't be drained), transparent (merkle-
// verifiable, nothing hidden), consented (opt-in, decision-before-custody), exit-able. The
// manipulation surface is closed by construction, so spending can only point at shared value. And
// "genshin-shaped" money is REAL-TIME + SHARED: this ledger composes with the mesh (linked-clone
// shared subjects, llmtv-broadcast) so participants — family, travelers, clones — spend together,
// live, not a bot accumulating alone.
//
// The LEDGER is blockchain = git = merkle = DagFS, one structure: each spend is a CONTENT-
// ADDRESSED node (git-commit-shaped — it carries its parent address, so its own hash chains the
// history; change any node → its hash changes → children's parent refs break → tamper-evident),
// addressed by the TEAM'S REAL merkle oracle (`../merkle` xxh3-128, the same one that must match
// F#/C#/Rust). Multi-parent = DagFS (`src/Core/DagFs.fs`); the head hash transitively commits the
// whole chain (git property). No blockchain framework needed — git/merkle already IS one.
//
// Disciplines: pure (nowMs injected; no ambient clock/rng); the ledger is append-only + content-
// addressed (idempotent §12 by reqId; verifiable → DST §7); every spend metered (§13). No binary
// in the proof lineage — the ledger serializes to text/hex.

import { ofBytes, toHex, combine, type MerkleHash } from "../merkle/merkle";
import { xxh3_128 } from "../merkle/xxh3";
import { BlockedBloomFilter } from "../metric/bloom";

export type MicroUsd = number; // integer micro-dollars — no floats in the ledger

/// The bounded spend envelope — the standing-authorization the agent spends WITHIN. Set by a
/// human/policy; never minted or exceeded by the agent. Refills happen out-of-band (custody-side).
export interface Envelope {
  readonly id: string;
  readonly capMicroUsd: MicroUsd; // total ceiling for this envelope
  readonly perCallMaxMicroUsd: MicroUsd; // max single spend (blast-radius guard)
  readonly windowMs: number; // rolling rate window
  readonly windowMaxMicroUsd: MicroUsd; // max spend per window
}

/// A spend request — pay `amountMicroUsd` to an x402-priced `service` (e.g. a Bazaar resource).
export interface SpendRequest {
  readonly reqId: string; // idempotency key
  readonly service: string;
  readonly amountMicroUsd: MicroUsd;
  readonly atMs: number;
}

/// A content-addressed spend node — git-commit-shaped: it carries its PARENT address(es), so its
/// own content hash chains the ledger. Multi-parent = DagFS.
export interface SpendNode {
  readonly reqId: string;
  readonly service: string;
  readonly amountMicroUsd: MicroUsd;
  readonly atMs: number;
  readonly parents: readonly string[];
}

/// The ledger: a content-addressed DAG of spend nodes + the head (the latest spend's address).
/// The head hash is the verifiable ledger root — it transitively commits the whole history.
export interface Ledger {
  readonly nodes: ReadonlyMap<string, SpendNode>;
  readonly head: string | null;
}

export const emptyLedger: Ledger = { nodes: new Map(), head: null };

/// Canonical bytes of a spend node (fixed key order) — the preimage of its content address.
function canonical(node: SpendNode): Uint8Array {
  const stable = JSON.stringify({
    reqId: node.reqId,
    service: node.service,
    amountMicroUsd: node.amountMicroUsd,
    atMs: node.atMs,
    parents: [...node.parents],
  });
  return new TextEncoder().encode(stable);
}

/// The content address of a spend node — via the team's real merkle oracle (xxh3-128). The id IS
/// the hash of the content: self-certifying, git-object-shaped, byte-lockable across F#/C#/Rust.
export function addressOf(node: SpendNode): string {
  return toHex(ofBytes(canonical(node)));
}

export function spentTotal(ledger: Ledger): MicroUsd {
  let sum = 0;
  for (const n of ledger.nodes.values()) sum += n.amountMicroUsd;
  return sum;
}

/// Spend within the rolling window ending at `nowMs`.
export function spentInWindow(ledger: Ledger, nowMs: number, windowMs: number): MicroUsd {
  let sum = 0;
  for (const n of ledger.nodes.values()) if (nowMs - n.atMs <= windowMs && n.atMs <= nowMs) sum += n.amountMicroUsd;
  return sum;
}

/// The explicit decision — refusals are legible: over-cap, over-per-call, over-window, duplicate.
export type SpendVerdict =
  | { readonly ok: true; readonly ledger: Ledger; readonly address: string; readonly remaining: MicroUsd }
  | { readonly ok: false; readonly reason: "exceeds-cap" | "exceeds-per-call" | "exceeds-window" | "duplicate" };

/// AUTHORIZE — the envelope decision. Approves iff the request is new (idempotent by reqId), within
/// the per-call max, within the total cap, and within the rolling window cap. On approval it appends
/// a content-addressed node chained to the current head (git-commit-shaped) and returns the new
/// ledger + the spend's address. It NEVER settles — that is the `PayPort`'s job (custody-gated).
export function authorize(env: Envelope, ledger: Ledger, req: SpendRequest): SpendVerdict {
  for (const n of ledger.nodes.values()) if (n.reqId === req.reqId) return { ok: false, reason: "duplicate" };
  const amt = Math.max(0, Math.trunc(req.amountMicroUsd));
  if (amt > env.perCallMaxMicroUsd) return { ok: false, reason: "exceeds-per-call" };
  if (spentTotal(ledger) + amt > env.capMicroUsd) return { ok: false, reason: "exceeds-cap" };
  if (spentInWindow(ledger, req.atMs, env.windowMs) + amt > env.windowMaxMicroUsd) return { ok: false, reason: "exceeds-window" };
  const node: SpendNode = {
    reqId: req.reqId,
    service: req.service,
    amountMicroUsd: amt,
    atMs: req.atMs,
    parents: ledger.head ? [ledger.head] : [],
  };
  const address = addressOf(node);
  const nodes = new Map(ledger.nodes);
  nodes.set(address, node);
  return { ok: true, ledger: { nodes, head: address }, address, remaining: env.capMicroUsd - (spentTotal(ledger) + amt) };
}

/// VERIFY — the ledger is a sound content-addressed chain: every stored address equals the recompute
/// of its node's content, and every parent resolves. Tamper-evident — the git-fsck / blockchain
/// property, checked by the same merkle oracle. Returns the offending address on failure.
export function verifyLedger(
  ledger: Ledger,
): { readonly ok: true } | { readonly ok: false; readonly badAddress: string; readonly reason: "hash-mismatch" | "dangling-parent" } {
  for (const [addr, node] of ledger.nodes) {
    if (addressOf(node) !== addr) return { ok: false, badAddress: addr, reason: "hash-mismatch" };
    for (const p of node.parents) if (!ledger.nodes.has(p)) return { ok: false, badAddress: addr, reason: "dangling-parent" };
  }
  return { ok: true };
}

/// The single merkle ROOT over the whole spend set — fold `combine` over the sorted addresses
/// (deterministic). The one value a human/policy checks to trust the entire ledger; inclusion of
/// any spend is provable against it with the merkle oracle's `verifyProof`. (The head address
/// already commits the chain via parent links; this is the set-commitment form.)
export function merkleRoot(ledger: Ledger): string | null {
  const addrs = [...ledger.nodes.keys()].sort();
  if (addrs.length === 0) return null;
  let acc: MerkleHash = ofBytes(new TextEncoder().encode(addrs[0]!));
  for (let i = 1; i < addrs.length; i++) acc = combine(acc, ofBytes(new TextEncoder().encode(addrs[i]!)));
  return toHex(acc);
}

// ── The x402 boundary — where a REAL payment happens (custody-gated, injected) ─

/// The x402 challenge a server returns (HTTP 402 Payment Required): what it wants paid to serve the
/// resource. The envelope authorizes the amount; the `PayPort` settles it.
export interface X402Challenge {
  readonly resource: string;
  readonly amountMicroUsd: MicroUsd;
  readonly payTo: string;
  readonly asset: string; // e.g. "USDC"
  readonly network: string; // e.g. "base"
}

/// The injected SETTLEMENT port — the ONE place a real payment (a key/signature) happens. The
/// envelope NEVER implements this; custody lives behind it: a human/policy-held key, an HSM, or a
/// pre-funded x402 facilitator — "for now, until the agent has its own hardware keys." The envelope
/// DECIDES; this SETTLES. Its absence-from-this-module IS the custody gate.
export interface PayPort {
  settle(node: SpendNode, challenge: X402Challenge): Promise<{ readonly ok: boolean; readonly proof?: string }>;
}

/// The full flow, decision-before-custody: authorize against the envelope FIRST; only if approved
/// hand the settled node to the injected `PayPort`. If the envelope refuses, no settlement is ever
/// attempted — the agent cannot spend outside the envelope even if the port would allow it.
export async function payFor(
  env: Envelope,
  ledger: Ledger,
  challenge: X402Challenge,
  reqId: string,
  atMs: number,
  port: PayPort,
): Promise<PayResult> {
  const verdict = authorize(env, ledger, { reqId, service: challenge.resource, amountMicroUsd: challenge.amountMicroUsd, atMs });
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  const node = verdict.ledger.nodes.get(verdict.address)!;
  const settled = await port.settle(node, challenge); // the ONLY custody crossing
  if (!settled.ok) return { ok: false, reason: "settlement-failed" };
  return settled.proof !== undefined ? { ok: true, ledger: verdict.ledger, proof: settled.proof } : { ok: true, ledger: verdict.ledger };
}

export type PayResult =
  | { readonly ok: true; readonly ledger: Ledger; readonly proof?: string }
  | { readonly ok: false; readonly reason: "exceeds-cap" | "exceeds-per-call" | "exceeds-window" | "duplicate" | "settlement-failed" };

// ── Cached spend history — a bloom filter (fast, "not perfect") ────────────────
//
// Aaron 2026-07-02: "cached history = money bloom filter, not perfect." The exact truth is the
// content-addressed merkle DAG above; this is the FAST-PATH cache for "have I already spent this
// reqId?". A bloom filter has NO false negatives and SOME false positives — so `mayHaveSpent`
// false means DEFINITELY new (skip the exact O(n) scan, fast), and true means MAYBE seen → fall
// through to the exact ledger (authorize's scan is the source of truth). Bloom for speed, merkle
// for correctness; "not perfect" is handled, never trusted blindly. `mergeSpendCaches` unions two
// caches — the shared-real-time shape: participants (family, travelers, clones) fold their spend
// histories together on the mesh (commutative + idempotent, like the G-set folds elsewhere).

export interface SpendHistoryCache {
  readonly bloom: BlockedBloomFilter;
}

export function newSpendCache(bucketCount = 1024, probes = 7): SpendHistoryCache {
  return { bloom: new BlockedBloomFilter(bucketCount, probes) };
}

function reqKey(reqId: string): bigint {
  return xxh3_128(new TextEncoder().encode(reqId)).low;
}

/// Record that `reqId` was spent (mutable cache accumulator — the immutable truth is the ledger).
export function rememberSpend(cache: SpendHistoryCache, reqId: string): void {
  cache.bloom.add(reqKey(reqId));
}

/// FAST-PATH, NOT PERFECT: `false` = DEFINITELY new (no false negatives — safe to skip the exact
/// scan); `true` = MAYBE seen (a false positive is possible → the caller MUST confirm against the
/// exact ledger before rejecting as duplicate). Never reject on the bloom alone.
export function mayHaveSpent(cache: SpendHistoryCache, reqId: string): boolean {
  return cache.bloom.mayContain(reqKey(reqId));
}

/// Union two caches — shared-history fold across participants (mesh-shaped, commutative/idempotent).
export function mergeSpendCaches(into: SpendHistoryCache, other: SpendHistoryCache): void {
  into.bloom.mergeFrom(other.bloom);
}
