// llmtv-broadcast — the society's minds on the mesh, strictly one-way (shadow*).
//
// Aaron 2026-07-02: the LLMTV centerpiece, wired live — "the whole society broadcasts
// at once, over Reticulum: self-certifying, no central broadcaster, anyone on the mesh
// watches the whole society predict at once." This is the transport behind the still
// frame that darkhall-tv.ts renders. It rides the same substrate as discovery-beacon.ts
// (transport-agnostic core, injected port, TEXT wire, DST-replayable) and adds the two
// properties LLMTV requires:
//
//   1. NONINTERFERENCE (§13) — the picture is ONE-WAY OUT. A source PUBLISHES frames; a
//      viewer FOLDS them. There is no viewer→source message in the wire vocabulary at
//      all — watching a mind cannot steer it, structurally, not by convention. Feedback
//      (if any) takes its own declared channel, never this one.
//   2. FROST AT THE MEMBRANE (privacy-budget-is-hard-money) — a source's mind is projected
//      through `frostStrip` before it can be published. Required-for-role predictions
//      broadcast; a frosted personal region contributes only its PUBLIC veil label, never
//      its predictions. The `BroadcastMind` type cannot even hold frosted content, so the
//      substrate has nothing to leak. Open by default (unfrosted personal shares); frost
//      is the earned, inviolable exception.
//
// Disciplines: pure core (nowMs injected, no ambient clock); TEXT wire (JSON, no binary
// in the proof lineage); LWW-by-seq viewer fold (idempotent §12, order-independent →
// DST-replayable §7); scale-free (1 source and N fold on the same path §1).

import type { MindTemp, DwellerMind, LlmtvTranscript } from "../darkhall-ui/darkhall-tv";

/// A broadcasting source — self-certifying: it carries its own ZetaId, so a frame needs
/// no central broadcaster to vouch for it (the zid IS the certificate; a name is a label).
export interface BroadcastSource {
  readonly zid: string;
  readonly name: string;
}

/// One soft prediction on the wire — the same (value, ε) as darkhall-tv, integer milli.
export interface BroadcastPrediction {
  readonly label: string;
  readonly temp: MindTemp;
  readonly valueMilli: number;
  readonly epsilonMilli: number;
}

/// The PUBLISHED projection of a mind — what crosses the membrane. It can hold
/// required-for-role predictions and, at most, a frost MARKER (the public veil label).
/// It has no field for frosted content: the type is the guarantee.
export interface BroadcastMind {
  readonly role: string;
  readonly hat: string;
  readonly predictions: readonly BroadcastPrediction[];
  readonly frostMarker?: { readonly veilLabel: string };
}

/// The SOURCE-side mind — the private form, before the membrane. `required` always
/// broadcasts. `personal` is the dweller's own region: if `frosted`, its predictions are
/// withheld (only the veil label survives); if not, they broadcast (glass-halo default).
export interface SourceMind {
  readonly role: string;
  readonly hat: string;
  readonly required: readonly BroadcastPrediction[];
  readonly personal?: {
    readonly frosted: boolean;
    readonly veilLabel: string;
    readonly predictions: readonly BroadcastPrediction[];
  };
}

/// THE MEMBRANE. Project a source mind to what may be published. Frosted personal
/// predictions are DROPPED here — they never reach the wire — leaving only the public
/// veil label. Unfrosted personal predictions are appended (open by default). This is the
/// only door mind-state crosses to the mesh; everything published went through it.
export function frostStrip(mind: SourceMind): BroadcastMind {
  const predictions: BroadcastPrediction[] = [...mind.required];
  if (mind.personal && !mind.personal.frosted) {
    predictions.push(...mind.personal.predictions);
  }
  if (mind.personal && mind.personal.frosted) {
    return { role: mind.role, hat: mind.hat, predictions, frostMarker: { veilLabel: mind.personal.veilLabel } };
  }
  return { role: mind.role, hat: mind.hat, predictions };
}

/// The broadcast wire vocabulary. TWO messages, both source→mesh. There is deliberately
/// NO viewer→source variant: that absence is the noninterference guarantee (§13).
export type BroadcastMessage =
  | { readonly t: "frame"; readonly source: BroadcastSource; readonly seq: number; readonly frameNo: number; readonly mind: BroadcastMind }
  | { readonly t: "dark"; readonly source: BroadcastSource; readonly seq: number };

const SCHEMA = "zeta.llmtv.broadcast.v1";

/// A channel a viewer is watching — the latest frame heard from one source, with the tick
/// it arrived (for TTL / going-dark).
export interface Channel {
  readonly source: BroadcastSource;
  readonly seq: number;
  readonly frameNo: number;
  readonly mind: BroadcastMind;
  readonly lastSeenMs: number;
}

export type ChannelTable = ReadonlyMap<string, Channel>;

/// Publish a frame: project the source mind through the membrane, then wrap it. The only
/// way to build a "frame" message — you cannot hand-assemble one around a SourceMind.
export function publishFrame(source: BroadcastSource, seq: number, frameNo: number, mind: SourceMind): BroadcastMessage {
  return { t: "frame", source, seq, frameNo, mind: frostStrip(mind) };
}

/// TEXT wire (JSON, no binary in the proof lineage) with a schema tag.
export function encode(msg: BroadcastMessage): string {
  return JSON.stringify({ schema: SCHEMA, msg });
}

/// Guarded decode — foreign / malformed / wrong-schema input returns null, never throws.
export function decode(text: string): BroadcastMessage | null {
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
  if (m.t === "frame" || m.t === "dark") return p.msg as BroadcastMessage;
  return null;
}

function upsert(table: ChannelTable, channel: Channel): ChannelTable {
  const next = new Map(table);
  next.set(channel.source.zid, channel);
  return next;
}

/// The pure viewer fold: accept one inbound frame into the channel table. LWW-BY-SEQ — a
/// frame only supersedes if its seq is strictly newer, so re-delivery and out-of-order
/// arrival both converge to the same final table (idempotent §12; order-independent →
/// DST-replayable §7). `dark` retires a source when its going-dark seq is at least the
/// last frame's. `nowMs` injected — no ambient clock. Keyed by zid — the society grid.
export function observeBroadcast(table: ChannelTable, msg: BroadcastMessage, nowMs: number): ChannelTable {
  const key = msg.source.zid;
  const current = table.get(key);
  switch (msg.t) {
    case "frame":
      if (current && msg.seq <= current.seq) return table; // stale or duplicate — no-op
      return upsert(table, { source: msg.source, seq: msg.seq, frameNo: msg.frameNo, mind: msg.mind, lastSeenMs: nowMs });
    case "dark": {
      if (!current || msg.seq < current.seq) return table; // stale going-dark — keep the newer frame
      const next = new Map(table);
      next.delete(key);
      return next;
    }
  }
}

/// Drop channels unheard for longer than `ttlMs` — a source that stops broadcasting goes
/// dark on its own (pure; `nowMs` injected, the caller ticks it).
export function expireChannels(table: ChannelTable, nowMs: number, ttlMs: number): ChannelTable {
  const next = new Map<string, Channel>();
  for (const [k, c] of table) if (nowMs - c.lastSeenMs <= ttlMs) next.set(k, c);
  return next;
}

/// Bridge the live channel table back to a darkhall-tv transcript, so the SAME homoiconic
/// generator renders the live society grid that renders the still frame. Sources sort by
/// zid for a deterministic tile order (DST). Frosted channels carry their veil label
/// forward; unfrosted ones render no frost region.
export function toLlmtvTranscript(table: ChannelTable, seed: string): LlmtvTranscript {
  const dwellers: DwellerMind[] = Array.from(table.values())
    .sort((a, b) => (a.source.zid < b.source.zid ? -1 : a.source.zid > b.source.zid ? 1 : 0))
    .map((c) => {
      const base = {
        name: c.source.name,
        role: c.mind.role,
        hat: c.mind.hat,
        predictions: c.mind.predictions,
        live: true,
        frame: c.frameNo,
      };
      return c.mind.frostMarker ? { ...base, frost: { veilLabel: c.mind.frostMarker.veilLabel } } : base;
    });
  return { schema: "zeta.darkhall.llmtv.v1", seed, generatedBy: "llmtv-broadcast", dwellers };
}

/// The injected transport port — the ONE declared channel a frame crosses (§13). `publish`
/// is source→mesh; `onFrame` is mesh→viewer. They are SEPARATE and neither returns to the
/// other: a source cannot hear a viewer through this port, a viewer cannot address a source.
/// One-way by construction. UDP/Reticulum/DHT impls plug in here; the core imports no socket.
export interface BroadcastTransport {
  publish(text: string): void;
  onFrame(handler: (text: string, from: string) => void): void;
}
