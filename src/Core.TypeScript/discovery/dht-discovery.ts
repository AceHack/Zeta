// dht-discovery — global path discovery over the mesh: Kademlia on destination hashes (shadow*).
//
// Aaron 2026-07-02: "our discovery is going to grow into multiple local and global DHT-like
// mechanisms over Reticulum — a system that can always discover itself if it's in broadcast
// range anywhere, even over the global internet." Announce (reticulum-transport.ts) gives
// LOCAL presence — you learn who is in earshot. This is the layer ABOVE it: a Kademlia DHT
// keyed on the self-certifying destination hash, so a node can FIND a destination that is
// beyond direct announce range by walking the network toward it.
//
// Kademlia (Maymounkov & Mazières, 2002): node id = the destination hash; distance = XOR;
// a k-bucket routing table holds, per distance shell, the k most-recently-seen nodes; a
// lookup iteratively queries the closest-known nodes for ones closer still, converging on
// the k closest to the target. XOR distance makes "closest" a metric and makes the routing
// table O(log n) deep.
//
// ADDRESS INTEGRITY (2026-08-22): a `DhtNode` carries `dest` and `zid`, and until now nothing on
// the receive path checked that they were the same claim. `observeNode` folded whatever it was
// handed and `lookup` folded peer-supplied `foundNodes` straight into its shortlist, so a peer
// answering a findNode could seed a querier's routing table with ARBITRARY (dest, zid) pairs —
// the Site-(A) defect of the Reticulum announce entry in `docs/BUGS.md`, on the Kademlia wire.
// The pair is now welded: `dest` must equal `destinationHash(zid)` or the record is refused,
// UNCONDITIONALLY (no length exemption — the escape hatch that made the announce-side guard
// skippable is the mistake not to repeat). See `classifyDhtNode`.
//
// What that buys and what it does NOT, stated plainly so the guard is not read as more than it
// is: `destinationHash` hashes a PUBLIC identifier, so anyone can mint a pair-consistent record
// for any zid they have ever seen. This is integrity of the ADDRESS — it stops an attacker
// DECOUPLING an identity from its id, which is what makes "node id = destination hash" mean
// anything at all — and it is not authenticity of the IDENTITY. Two things therefore remain open
// and are filed rather than hidden: (1) the DHT wire has no signature layer, so a peer may still
// relay a pair-consistent record for an identity it does not hold (`reticulum-announce-auth.ts`
// is the membrane shape that would close it); (2) `DhtNode.route` is outside the pair entirely,
// so a route hint remains attacker-supplied even for a correctly-bound (dest, zid).
//
// (2) HAS A DESIGN, and it is NOT the hop-count mechanism — read this before writing (1). Sort wire
// fields by WHO IS ENTITLED TO MUTATE THEM: `hops` on the announce wire is PATH-mutable (every
// relay bumps it), which is why no origin signature can cover it and why it needs a one-way chain.
// `route` is ORIGIN-mutable — a relay never touches it — so it IS signable, and needs the signature
// plus a monotone `seq`, no chain. The trap is specific and worth naming here rather than in a doc:
// when this wire gets its signature layer, the natural move is to copy `reticulum-announce-auth.ts`,
// which signs `(dest, zid)` and NOTHING ELSE. That is correct for the announce wire and WRONG here,
// because this record carries an origin-mutable field the announce does not — copying it would
// leave `route` outside the signature. A `RouteHint` shape check is deliberately not the fix: it
// removes malformed routes, not attacker-supplied ones.
// `docs/research/2026-08-22-hop-count-is-not-a-claim-mutation-entitlement-decides-the-mechanism.md` §6.
//
// Disciplines: PURE, DST-replayable — the lookup driver takes an INJECTED query function
// (no ambient network), so convergence is tested deterministically over a fake global graph;
// the real async transport wraps `query` at the edge (noninterference §13). Node ids are the
// deterministic destination hashes (no rng — Kademlia's random ids become byte-locked here).
// TEXT wire (findNode/foundNodes are JSON). The routing table grows/refreshes idempotently.

import type { RouteHint } from "./discovery-beacon";
import type { ErasureProfile } from "../algebra/erasure-class";
import { destinationHash } from "./reticulum-transport";

/// A node known to the DHT — its self-certifying destination hash, the identity behind it, an
/// optional route hint (how to physically reach it), and when it was last heard (MRU / TTL).
export interface DhtNode {
  readonly dest: string; // destination hash = node id (hex; see reticulum-transport.destinationHash)
  readonly zid: string;
  readonly route?: RouteHint;
  readonly lastSeenMs: number;
}

/// Why a `DhtNode` record was refused. Each names the NEUTRAL FACT, never an intent — a refusal
/// is a measurement, not a verdict about the peer that sent it (dual-use §: the caller's policy
/// decides whether this is an attack, a stale record, or a peer running an older wire). Deliberately
/// the same vocabulary as `reticulum-announce-auth`'s `dest-not-bound`, because it is the same fact.
export type DhtNodeRefuseReason =
  | "malformed-node" // not the `DhtNode` vocabulary (a hostile wire gets a verdict, never a throw)
  | "dest-not-bound"; // dest !== destinationHash(zid) — the address does not commit to the identity

export type DhtNodeVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: DhtNodeRefuseReason };

/// The address-integrity check, total and pure. `destinationHash` is a hash of a PUBLIC identifier,
/// so this recognises that a record is INTERNALLY consistent; it does not authenticate the sender.
///
/// Noninterference §13: a function of the record alone — it opens no keystore, reads no clock and
/// touches no socket, which is what keeps it DST-replayable. In particular `lastSeenMs` is checked
/// for SHAPE and is never compared against a now: local receive-time must not decide what enters a
/// shared fold (`.claude/rules/local-time-never-enters-the-shared-fold.md`).
export function classifyDhtNode(node: DhtNode): DhtNodeVerdict {
  const n = node as { dest?: unknown; zid?: unknown; lastSeenMs?: unknown } | null | undefined;
  if (typeof n !== "object" || n === null) return { ok: false, reason: "malformed-node" };
  if (typeof n.dest !== "string" || typeof n.zid !== "string") return { ok: false, reason: "malformed-node" };
  if (typeof n.lastSeenMs !== "number" || !Number.isFinite(n.lastSeenMs)) return { ok: false, reason: "malformed-node" };
  // Unconditional. No `length === 32` exemption: on the announce wire exactly that exemption let
  // any dest of another length skip the check entirely, and an attacker could take it as easily
  // as a test could.
  if (n.dest !== destinationHash(n.zid)) return { ok: false, reason: "dest-not-bound" };
  return { ok: true };
}

/// True when `dest` commits to `zid`. The predicate form of `classifyDhtNode`, for call sites that
/// want the fact without the reason.
export function isAddressBound(node: DhtNode): boolean {
  return classifyDhtNode(node).ok;
}

/// The admissible subset of a peer-supplied node list, with the refusals reported rather than
/// swallowed — `lookup` uses this on every `foundNodes` answer. Returning the refusals keeps the
/// mechanism neutral: this module never decides what a refusal MEANS.
export function admissibleNodes(nodes: readonly DhtNode[]): {
  readonly admitted: readonly DhtNode[];
  readonly refused: readonly { readonly node: DhtNode; readonly reason: DhtNodeRefuseReason }[];
} {
  const admitted: DhtNode[] = [];
  const refused: { node: DhtNode; reason: DhtNodeRefuseReason }[] = [];
  for (const n of nodes) {
    const verdict = classifyDhtNode(n);
    if (verdict.ok) admitted.push(n);
    else refused.push({ node: n, reason: verdict.reason });
  }
  return { admitted, refused };
}

const HEX_BITS = 4;

function hexVal(ch: string): number {
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48; // 0-9
  if (code >= 97 && code <= 102) return code - 87; // a-f
  if (code >= 65 && code <= 70) return code - 55; // A-F
  return 0;
}

/// XOR distance between two equal-length hex ids, as a fixed-width hex string. Same width →
/// lexicographic comparison of the result IS numeric comparison of the distance (the metric).
export function xorDistance(a: string, b: string): string {
  const n = Math.min(a.length, b.length);
  let out = "";
  for (let i = 0; i < n; i++) out += (hexVal(a[i]!) ^ hexVal(b[i]!)).toString(16);
  return out;
}

/// True if `a` is strictly closer to `target` than `b` (smaller XOR distance).
export function closerTo(target: string, a: string, b: string): boolean {
  return xorDistance(a, target) < xorDistance(b, target);
}

/// The k-bucket index for a node relative to self: the number of leading zero BITS in the XOR
/// distance (the length of the shared id prefix). Nodes far from self share few prefix bits →
/// low bucket index; nodes near self → high index. Range 0..(4·idLen − 1).
export function bucketIndex(self: string, node: string): number {
  const d = xorDistance(self, node);
  let bits = 0;
  for (let i = 0; i < d.length; i++) {
    const nibble = hexVal(d[i]!);
    if (nibble === 0) {
      bits += HEX_BITS;
      continue;
    }
    // leading zero bits within this nonzero nibble
    let mask = 1 << (HEX_BITS - 1);
    while (mask > 0 && (nibble & mask) === 0) {
      bits += 1;
      mask >>= 1;
    }
    return bits;
  }
  return bits; // identical ids (distance 0) — self
}

export interface RoutingTable {
  readonly self: string;
  readonly k: number;
  readonly buckets: ReadonlyMap<number, readonly DhtNode[]>;
}

export function emptyTable(self: string, k = 20): RoutingTable {
  return { self, k, buckets: new Map() };
}

/// Fold a node into the routing table: MRU order within its k-bucket (a re-heard node moves to
/// the end = freshest), and if the bucket is full the OLDEST (least-recently-seen) is evicted —
/// Kademlia's preference for long-lived nodes. Never inserts self. Idempotent per (dest, time):
/// re-observing refreshes rather than duplicates.
///
/// Thermodynamic class: ERASING. The `slice` below drops the least-recently-seen entry and this
/// module holds no second copy — no spill file, no parent edge, no orphaned object. That makes it
/// the genuine article among the sites a lifecycle list would have called "eviction": the disk
/// spine's quota eviction turns out to RELOCATE (the payload is written out and still loads), and
/// this one really does destroy. "Eviction" was never the category; whether the payload is handed
/// back is. See `dhtErasureProfiles`.
export function observeNode(table: RoutingTable, node: DhtNode, nowMs: number): RoutingTable {
  // ADDRESS-INTEGRITY guard, unconditional and first: a record whose `dest` does not commit to its
  // `zid` never reaches the fold, so no bucket can hold an identity at an id it does not hash to.
  // A refused record leaves the table BYTE-IDENTICAL — the same object reference is returned.
  if (!isAddressBound(node)) return table;
  if (node.dest === table.self) return table;
  const idx = bucketIndex(table.self, node.dest);
  const bucket = table.buckets.get(idx) ?? [];
  const withoutNode = bucket.filter((n) => n.dest !== node.dest);
  const refreshed: DhtNode = { ...node, lastSeenMs: nowMs };
  let next = [...withoutNode, refreshed]; // append = most-recently-seen at the end
  // The erasure, in one line: the front of the bucket is dropped and nothing retains it.
  if (next.length > table.k) next = next.slice(next.length - table.k); // evict oldest (front)
  const buckets = new Map(table.buckets);
  buckets.set(idx, next);
  return { ...table, buckets };
}

/// Every node currently known, flattened across buckets.
export function allNodes(table: RoutingTable): readonly DhtNode[] {
  const out: DhtNode[] = [];
  for (const bucket of table.buckets.values()) out.push(...bucket);
  return out;
}

/// The `count` known nodes closest (by XOR distance) to `target`. Deterministic tie-break by
/// dest hash so the order is stable (DST).
export function closest(table: RoutingTable, target: string, count: number): readonly DhtNode[] {
  return [...allNodes(table)]
    .sort((a, b) => {
      const da = xorDistance(a.dest, target);
      const db = xorDistance(b.dest, target);
      if (da < db) return -1;
      if (da > db) return 1;
      return a.dest < b.dest ? -1 : a.dest > b.dest ? 1 : 0;
    })
    .slice(0, count);
}

/// Drop nodes unheard past the TTL (pure; `nowMs` injected).
///
/// Thermodynamic class: ERASING, for the same reason and with a different trigger — a wall-clock
/// deadline rather than a capacity bound. Worth one line of comment because the two are constantly
/// filed together as "eviction" and they answer to different inputs: this one erases on the
/// injected `nowMs`, which is exactly the sort of ambient-time dependence the noninterference
/// discipline asks to be declared rather than assumed.
export function expireNodes(table: RoutingTable, nowMs: number, ttlMs: number): RoutingTable {
  const buckets = new Map<number, readonly DhtNode[]>();
  for (const [idx, bucket] of table.buckets) {
    const live = bucket.filter((n) => nowMs - n.lastSeenMs <= ttlMs);
    if (live.length > 0) buckets.set(idx, live);
  }
  return { ...table, buckets };
}

/// The DHT wire vocabulary: ask a node for its closest-known to a target; it answers with them.
export type DhtMessage =
  | { readonly t: "findNode"; readonly target: string; readonly from: DhtNode }
  | { readonly t: "foundNodes"; readonly target: string; readonly nodes: readonly DhtNode[] };

const SCHEMA = "zeta.dht.v1";

export function encode(msg: DhtMessage): string {
  return JSON.stringify({ schema: SCHEMA, msg });
}

export function decode(text: string): DhtMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as { schema?: unknown; msg?: unknown };
  if (p.schema !== SCHEMA || typeof p.msg !== "object" || p.msg === null) return null;
  const m = p.msg as { t?: unknown };
  if (m.t === "findNode" || m.t === "foundNodes") return p.msg as DhtMessage;
  return null;
}

/// A node's answer to a findNode: its own `count` closest-known to the target. This is what a
/// queried peer runs; the querier folds the results and asks the newly-learned closer nodes.
///
/// No guard here on purpose: everything in the table already passed `observeNode`'s check, so a
/// filter at this exit could never fail and would be a check that cannot fail. The guard belongs
/// at the two entries (`observeNode`, `lookup`'s fold of a peer answer), which is where an
/// unbound record can actually arrive.
export function answerFindNode(table: RoutingTable, target: string, count: number): readonly DhtNode[] {
  return closest(table, target, count);
}

/// The iterative lookup — the heart of Kademlia. Starting from our own closest-known, query the
/// α closest un-queried nodes for ones closer still, fold their answers, and repeat until a round
/// surfaces nothing closer (converged). Returns the k closest to `target` we could reach.
///
/// Peer answers are NOT trusted shape-first: every node a queried peer returns passes
/// `admissibleNodes` before it can enter the shortlist, so an answering peer cannot seed a
/// querier's routing table with a (dest, zid) pair that does not hash together.
///
/// `query(node, target)` is INJECTED and SYNCHRONOUS for the pure algorithm — in tests it reads
/// a fake global graph; the real async transport (findNode → foundNodes round trip) wraps it at
/// the edge. This keeps convergence deterministic and DST-replayable. `alpha` is the parallelism
/// width (Kademlia's concurrency knob; default 3).
export function lookup(
  table: RoutingTable,
  target: string,
  query: (node: DhtNode, target: string) => readonly DhtNode[],
  k = table.k,
  alpha = 3,
): readonly DhtNode[] {
  const queried = new Set<string>();
  const known = new Map<string, DhtNode>();
  for (const n of closest(table, target, k)) known.set(n.dest, n);

  const rank = (nodes: Iterable<DhtNode>): DhtNode[] =>
    [...nodes].sort((a, b) => {
      const da = xorDistance(a.dest, target);
      const db = xorDistance(b.dest, target);
      if (da < db) return -1;
      if (da > db) return 1;
      return a.dest < b.dest ? -1 : a.dest > b.dest ? 1 : 0;
    });

  for (;;) {
    const shortlist = rank(known.values()).slice(0, k);
    const toQuery = shortlist.filter((n) => !queried.has(n.dest)).slice(0, alpha);
    if (toQuery.length === 0) break; // every close node queried — converged

    const beforeClosest = shortlist[0]?.dest;
    for (const n of toQuery) {
      queried.add(n.dest);
      // The SECOND exit, and the one that actually matters here: `query` returns a PEER's claim
      // about other nodes, so this is where a malicious answer would enter the shortlist. Same
      // guard, same place in the order — refuse before folding, never after.
      for (const found of admissibleNodes(query(n, target)).admitted) {
        if (found.dest !== table.self && !known.has(found.dest)) known.set(found.dest, found);
      }
    }
    const afterClosest = rank(known.values())[0]?.dest;
    // keep going as long as new nodes appeared to query; convergence is the toQuery-empty break.
    // (afterClosest tracked only to document progress; the queried-set guarantees termination.)
    void beforeClosest;
    void afterClosest;
  }

  return rank(known.values()).slice(0, k);
}

/// Did the lookup actually reach the target (an exact destination match among the closest)?
export function found(nodes: readonly DhtNode[], target: string): DhtNode | undefined {
  return nodes.find((n) => n.dest === target);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// THE DECLARATION, beside the operations it classifies (`../algebra/erasure-class`).
//
// A DHT routing table cannot be swept exhaustively: node ids are destination hashes over a space
// no test enumerates, `k` is a deployment parameter, and `nowMs` is a real clock. So the evidence
// here is a BOUNDED MODEL SWEEP — the real functions, run on every point of a domain whose node
// pool and `k` are pinned small — and the pinning is named in the model string rather than
// glossed over. What that does not cover: behaviour at production `k`, id-space collisions at 160
// bits, and any bucket-splitting policy a future revision adds.
//
// RE-DERIVED 2026-08-22, and said plainly rather than presented as unchanged measurements. Until
// then every model here pinned "id space to 2 hex characters" and used deliberately UNBOUND ids
// (`{dest: "10", zid: "zid-10"}`) — pairs that `classifyDhtNode` now refuses, so those models
// described a domain the code can no longer reach. Each was re-run over a BOUND pool: four real
// `(destinationHash(zid), zid)` pairs, ids therefore 32 hex characters and not choosable.
//
// Three of the four numbers came back IDENTICAL (6 / 4 / 85), and that is a result, not an
// omission to check: what the sweep counts is how many observation HISTORIES collapse onto one
// table, and that count is fixed by the bucket/MRU combinatorics over four distinct nodes sharing
// one bucket at k = 2. Binding restricts WHICH (dest, zid) pairs exist; it does not change how a
// full bucket forgets or how an idempotent refresh collapses two histories. The old model was
// isomorphic to the new one on exactly the structure being measured, which is why the old numbers
// were right about erasure while being wrong about the domain.
//
// The FIFTH row is new, and it is the one the binding actually changed: it sweeps the domain that
// now CONTAINS refusals, and measures the guard itself as an erasure.
//
// The declaration is exported so the law pack can check it against a measurement rather than
// trusting the comment above it. Both directions: a "reversible" op made lossy fails, and an
// "erasing" op made bijective fails too.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

export const dhtErasureProfiles: readonly ErasureProfile[] = [
  {
    representation: "dht-discovery routing table (k-bucket, MRU)",
    operation: "observeNode",
    observation: "the routing table returned by observeNode",
    recoveryChannel:
      "nothing for the evicted node — when a bucket is full the least-recently-seen entry is " +
      "sliced off and no structure in this module retains it. Kademlia's preference for " +
      "long-lived nodes is implemented by forgetting new ones, and the forgetting is real. But " +
      "the eviction is NOT the whole cost: see the companion row below, which restricts the " +
      "sweep to histories where no bucket ever fills and still measures 4 (2.000 bits). Eviction " +
      "accounts for the difference from 6 (2.585) and no more — the rest was already in the " +
      "idempotent refresh, which is the same finding as `plus` erasing inside an ordinary fold",
    classification: "erasing",
    evidence: {
      kind: "bounded-model-sweep",
      model:
        "the id space is BOUND — every node is a real (destinationHash(zid), zid) pair, so " +
        "ids are 32 hex characters and cannot be chosen. k pinned to 2; the 4-node universe is the " +
        "first four zids of the form `dht-peer-<i>` whose dest shares bucket 3 with " +
        "self = destinationHash(\"dht-self\"), so one bucket holds all four and k = 2 forces eviction; " +
        "every table reachable by observing 0-3 of them at one pinned timestamp",
      largestFibre: 6,
      bitsErasedPpm: 2_584_963,
    },
  },
  {
    representation: "dht-discovery routing table (k-bucket, MRU)",
    operation: "observeNode",
    observation: "the routing table returned by observeNode, over histories in which no bucket ever fills",
    recoveryChannel:
      "nothing about WHICH history produced the table — a re-heard node is moved to the front of " +
      "the bucket rather than duplicated, so `[a, a, b]` and `[a, b]` are one post-state with no " +
      "eviction anywhere in sight. The refresh is idempotent, and idempotence is erasure: two " +
      "pre-images, one image, log2(2) bits gone in the ordinary arithmetic of the fold",
    classification: "erasing",
    evidence: {
      kind: "bounded-model-sweep",
      model:
        "the id space is BOUND — every node is a real (destinationHash(zid), zid) pair, so " +
        "ids are 32 hex characters and cannot be chosen. k pinned to 2; the 4-node universe is the " +
        "first four zids of the form `dht-peer-<i>` whose dest shares bucket 3 with " +
        "self = destinationHash(\"dht-self\"), so one bucket holds all four and k = 2 forces eviction; " +
        "the pool then restricted to the first 2 of them so a bucket of capacity 2 never " +
        "overflows; every history of 0-3 observations at one pinned timestamp",
      largestFibre: 4,
      bitsErasedPpm: 2_000_000,
    },
  },
  {
    representation: "dht-discovery routing table (k-bucket, MRU)",
    operation: "observeNode",
    observation:
      "the routing table returned by observeNode, over histories that include records whose dest does not commit to their zid",
    recoveryChannel:
      "nothing about the REFUSALS — an unbound record leaves the table byte-identical, so the " +
      "guard keeps no record that it fired and every history made only of refused records lands " +
      "on the same empty table. This row exists because address integrity CHANGED the reachable " +
      "state space and the honest way to say so is to measure it: the fibre is exactly 85, which " +
      "is the count of sequences of length 0-3 over the 4 impostors and not a fitted number. It " +
      "is also this guard's own falsifier — remove the check and the impostors fold instead of " +
      "being refused, the collapse stops, and the same sweep measures 11",
    classification: "erasing",
    evidence: {
      kind: "bounded-model-sweep",
      model:
        "the bound 4-node universe above, UNION 4 impostors — each carrying one universe node's " +
        "dest under a DIFFERENT universe node's zid, which is the forgery the guard exists to " +
        "refuse; every history of 0-3 observations over the 8 at one pinned timestamp (585)",
      largestFibre: 85,
      bitsErasedPpm: 6_409_391,
    },
  },
  {
    representation: "dht-discovery routing table (k-bucket, MRU)",
    operation: "expireNodes",
    observation: "the routing table returned by expireNodes",
    recoveryChannel:
      "nothing for an expired node, and nothing about WHEN it was last heard either — the " +
      "surviving entries carry their own lastSeenMs but the table records no deadline, so the " +
      "post-state does not say which ttl produced it",
    classification: "erasing",
    evidence: {
      kind: "bounded-model-sweep",
      model:
        "the id space is BOUND — every node is a real (destinationHash(zid), zid) pair, so " +
        "ids are 32 hex characters and cannot be chosen. k pinned to 2; the 4-node universe is the " +
        "first four zids of the form `dht-peer-<i>` whose dest shares bucket 3 with " +
        "self = destinationHash(\"dht-self\"), so one bucket holds all four and k = 2 forces eviction; " +
        "every table reachable by observing 0-3 of them at one pinned timestamp, expired past a pinned ttl",
      largestFibre: 85,
      bitsErasedPpm: 6_409_391,
    },
  },
  {
    representation: "dht-discovery routing table (k-bucket, MRU)",
    operation: "emptyTable",
    observation: "the routing table returned by emptyTable",
    recoveryChannel:
      "both arguments — the table records `self` and `k` verbatim, so the constructor is a " +
      "bijection onto the tables it can produce. Included because the drift guard's criterion is " +
      "mechanical (every exported function returning a RoutingTable) rather than a judgement " +
      "about which ones look interesting, and because it is not vacuous: stop recording `k` on " +
      "the table and this row goes from fibre 1 to fibre 3 on the next run",
    classification: "reversible",
    evidence: {
      kind: "bounded-model-sweep",
      model: "self drawn from {00, 01, ff} x k drawn from {1, 2, 20}",
      largestFibre: 1,
      bitsErasedPpm: 0,
    },
  },
];
