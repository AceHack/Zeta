// gossip-salon — the salon on the wire: telemetry as gossip, circulating (shadow*, 2026-07-04).
//
// TS twin of F# GossipTelemetry.fs, plus the wire it was missing. Aaron: "it's like going to
// the salon and the telemetry is gossip about all the other participants of the mesh… regular
// telemetry otel kind of stuff but also gossip about kept/unkept self claims" — and, on the
// CRDT laws: "this is basically our guaranteed delivery over udp/analog mesh too eventually."
//
// This module makes that literal: the salon state is a G-set (hear-twice = hear-once; merge
// commutative/associative/idempotent), and the gossiper re-broadcasts EVERYTHING IT KNOWS on a
// timer — epidemic anti-entropy (Demers 1987). Every dirty-transport failure mode is absorbed
// by an algebra law: duplication → idempotence, reordering → commutativity, loss → somebody
// re-gossips, partition → merge is the same op as hearing. At-least-once + idempotent fold =
// exactly-once effect. No ACKs, no sequence numbers, no coordinator.
//
// SOUNDNESS (same as F#): merges are MONOTONE TOWARD IN-CONE. A gossiped crossing can only add
// an observed fast path (falsifies out-of-cone evidence — sound); unheard pairs stay unmeasured
// (gossip cannot manufacture evidence); kept-claims are neutral facts (who said what,
// contradictions kept side by side; verdicts belong to the caller's oracle).
//
// Pure fold + codec + a small gossiper loop over injected transport/scheduler (§13: no ambient
// entropy; DST-clean).

import { foldSample, regimeOf, emptyMeter, type BusMeter, type Regime } from "./bus-meter";

const TAG = "salon/1";

/// One observed crossing between two nodes, as witnessed by `observer`.
export interface Crossing {
  readonly kind: "crossing";
  readonly a: string;
  readonly b: string;
  readonly rttMs: number;
  readonly observer: string;
}

/// A kept/unkept self-claim, carried as a neutral fact.
export interface KeptClaim {
  readonly kind: "kept";
  readonly node: string;
  readonly kept: boolean;
  readonly relayer: string;
}

export type Rumor = Crossing | KeptClaim;

/// Unordered pair key: (a,b) ≡ (b,a). Ordinal comparison, per the culture-invariant rule.
export function pairKey(a: string, b: string): string {
  return a <= b ? `${a} ${b}` : `${b} ${a}`;
}

/// The salon's folded state. Sets keyed by canonical rumor strings — grow-only, dedup by value.
export interface Salon {
  /// pairKey → set of "rttMs observer"
  readonly crossings: ReadonlyMap<string, ReadonlySet<string>>;
  /// set of "node kept relayer"
  readonly claims: ReadonlySet<string>;
}

export const emptySalon: Salon = { crossings: new Map(), claims: new Set() };

/// Fold one rumor in. Idempotent: hearing the same rumor twice changes nothing.
export function hear(salon: Salon, rumor: Rumor): Salon {
  if (rumor.kind === "crossing") {
    const key = pairKey(rumor.a, rumor.b);
    const entry = `${String(Math.max(0, Math.round(rumor.rttMs)))} ${rumor.observer}`;
    const existing = salon.crossings.get(key);
    if (existing?.has(entry)) return salon;
    const crossings = new Map(salon.crossings);
    crossings.set(key, new Set([...(existing ?? []), entry]));
    return { crossings, claims: salon.claims };
  }
  const entry = `${rumor.node} ${rumor.kept ? "1" : "0"} ${rumor.relayer}`;
  if (salon.claims.has(entry)) return salon;
  return { crossings: salon.crossings, claims: new Set([...salon.claims, entry]) };
}

/// CRDT merge (set union both sides): commutative, associative, idempotent.
export function merge(x: Salon, y: Salon): Salon {
  const crossings = new Map(x.crossings);
  for (const [key, set] of y.crossings) {
    const existing = crossings.get(key);
    crossings.set(key, existing ? new Set([...existing, ...set]) : set);
  }
  return { crossings, claims: new Set([...x.claims, ...y.claims]) };
}

/// Everything the salon knows, as rumors — what the gossiper re-broadcasts (anti-entropy).
export function rumorsOf(salon: Salon): Rumor[] {
  const out: Rumor[] = [];
  for (const [key, set] of salon.crossings) {
    const [a, b] = key.split(" ") as [string, string];
    for (const entry of set) {
      const sep = entry.indexOf(" ");
      out.push({ kind: "crossing", a, b, rttMs: Number(entry.slice(0, sep)), observer: entry.slice(sep + 1) });
    }
  }
  for (const entry of salon.claims) {
    const [node, kept, relayer] = entry.split(" ") as [string, string, string];
    out.push({ kind: "kept", node, kept: kept === "1", relayer });
  }
  return out;
}

/// The meter for a pair from everything heard about it; null = never heard (stays unmeasured —
/// gossip cannot manufacture out-of-cone).
///
/// SOUNDNESS FIX (2026-07-04, caught by the prune-preservation theorem): the live bus-meter's
/// fold has an aging window (SAMPLE_CAP) — correct for "what is my bus doing NOW", UNSOUND for
/// the salon's historical question ("did a fast path ever exist"): with more entries than the
/// window, the fastest crossing could age out and the salon would MANUFACTURE out-of-cone
/// evidence. Fold largest-first so the window always retains the minimum.
export function meterOfPair(salon: Salon, a: string, b: string): BusMeter | null {
  const set = salon.crossings.get(pairKey(a, b));
  if (!set) return null;
  const rtts = [...set].map((entry) => Number(entry.slice(0, entry.indexOf(" ")))).sort((x, y) => y - x);
  let meter = emptyMeter;
  for (const rtt of rtts) meter = foldSample(meter, rtt);
  return meter;
}

/// Regime of a pair from the salon's knowledge (unheard → "unmeasured").
export function regimeOfPair(salon: Salon, a: string, b: string, deadlineMs: number): Regime {
  const meter = meterOfPair(salon, a, b);
  return meter === null ? "unmeasured" : regimeOf(meter, deadlineMs);
}

/// PRUNE — bounded salon memory, monotone-safe (the stated debt from the guaranteed-delivery
/// ferry: G-sets grow forever). For the light-cone question, ONLY the minimum RTT per pair ever
/// matters (`regimeOf` reads the fastest crossing), so keeping the K smallest-RTT entries per
/// pair preserves `regimeOfPair` EXACTLY, for every deadline — provable, and proven in the
/// tests. The fastest crossing — the evidence-killer — is the one thing never forgotten.
///
/// Deliberate asymmetry with the local bus-meter: the LIVE meter ages samples out (it answers
/// "what is my bus doing NOW"), but a salon crossing is a historical witness fact — "a fast
/// path EXISTED" kills out-of-cone evidence forever, so aging fast crossings out of the salon
/// would be UNSOUND. Prune keeps the fast, drops the redundant-slow. Claims are not pruned
/// (small, and erasing who-said-what would be the salon forgetting testimony).
export const DEFAULT_KEEP_PER_PAIR = 16;

export function pruneCrossings(salon: Salon, keepPerPair: number = DEFAULT_KEEP_PER_PAIR): Salon {
  const keep = Math.max(1, keepPerPair); // never prune below 1: the minimum must survive
  let changed = false;
  const crossings = new Map<string, ReadonlySet<string>>();
  for (const [key, set] of salon.crossings) {
    if (set.size <= keep) {
      crossings.set(key, set);
      continue;
    }
    const sorted = [...set].sort((x, y) => {
      const rx = Number(x.slice(0, x.indexOf(" ")));
      const ry = Number(y.slice(0, y.indexOf(" ")));
      if (rx !== ry) return rx - ry;
      if (x < y) return -1; // deterministic ordinal tie-break
      return x > y ? 1 : 0;
    });
    crossings.set(key, new Set(sorted.slice(0, keep)));
    changed = true;
  }
  return changed ? { crossings, claims: salon.claims } : salon;
}

/// Kept-claims about a node, as heard: [kept, relayer][] — a neutral readout for the oracle.
export function claimsAbout(salon: Salon, node: string): [boolean, string][] {
  const out: [boolean, string][] = [];
  for (const entry of salon.claims) {
    const [n, kept, relayer] = entry.split(" ") as [string, string, string];
    if (n === node) out.push([kept === "1", relayer]);
  }
  return out;
}

// ── the wire ────────────────────────────────────────────────────────────────────────────────

export function encodeRumor(rumor: Rumor): string {
  return `${TAG} ${JSON.stringify(rumor)}`;
}

/// Decode a salon packet; anything else on the shared wire decodes to null (schema-tag dispatch).
export function decodeRumor(text: string): Rumor | null {
  if (!text.startsWith(`${TAG} `)) return null;
  try {
    const raw: unknown = JSON.parse(text.slice(TAG.length + 1));
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (r.kind === "crossing") {
      const { a, b, rttMs, observer } = r;
      if (typeof a !== "string" || typeof b !== "string" || typeof rttMs !== "number" || typeof observer !== "string") return null;
      return { kind: "crossing", a, b, rttMs, observer };
    }
    if (r.kind === "kept") {
      const { node, kept, relayer } = r;
      if (typeof node !== "string" || typeof kept !== "boolean" || typeof relayer !== "string") return null;
      return { kind: "kept", node, kept, relayer };
    }
    return null;
  } catch {
    return null;
  }
}

/// Minimal transport surface the gossiper needs (matches the discovery/broadcast transports).
export interface SalonTransport {
  publish(text: string): void;
  onFrame(handler: (text: string, from?: string) => void): void;
}

export interface SalonScheduler {
  setInterval(ms: number, fn: () => void): () => void;
}

export interface SalonGossiper {
  start(): void;
  stop(): void;
  /// Fold a locally-observed rumor in AND broadcast it immediately (rumor-mongering).
  tell(rumor: Rumor): void;
  salon(): Salon;
}

/// The circulating salon: folds every inbound rumor; re-broadcasts everything it knows every
/// `gossipEveryMs` (anti-entropy — loss repaired by repetition, absorbed by idempotence).
/// `keepPerPair` bounds per-pair crossing memory (regime-preserving prune; default 16).
export function createSalonGossiper(
  transport: SalonTransport,
  sched: SalonScheduler,
  gossipEveryMs: number,
  keepPerPair: number = DEFAULT_KEEP_PER_PAIR,
): SalonGossiper {
  let salon = emptySalon;
  let stopLoop: (() => void) | null = null;

  transport.onFrame((text) => {
    const rumor = decodeRumor(text);
    if (rumor) salon = pruneCrossings(hear(salon, rumor), keepPerPair);
  });

  const broadcastAll = (): void => {
    for (const rumor of rumorsOf(salon)) transport.publish(encodeRumor(rumor));
  };

  return {
    start() {
      stopLoop = sched.setInterval(gossipEveryMs, broadcastAll);
    },
    stop() {
      stopLoop?.();
      stopLoop = null;
    },
    tell(rumor) {
      salon = pruneCrossings(hear(salon, rumor), keepPerPair);
      transport.publish(encodeRumor(rumor));
    },
    salon: () => salon,
  };
}
