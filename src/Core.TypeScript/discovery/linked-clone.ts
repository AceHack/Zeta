// linked-clone — the bus's reason for being: a clone opts a mind-region onto a shared
// subject, consent-first, exit guaranteed by construction (shadow*).
//
// Aaron 2026-07-02 ratified the consent model (all five points): (1) granular + opt-in —
// a clone links a mind-REGION, never its whole self, never automatically; (2) metered — the
// link costs entropy, and the shared subject's coordination is its CHSH S-score; (3) exit
// always, never forced — unilateral unlink at any time, metered but never deniable; (4) frost
// holds — a frosted region can never be opted onto a shared subject; (5) mental-health floor —
// a clone out of entropy gets the bounded, society-subsidized pause, never forced to stay
// linked or collapse.
//
// This is the strongest form of NCI (`NciSafety.tla`: lastWriter[t] = t) made operational at
// the link level: every function here is SELF-SCOPED — it takes the clone's OWN mind and its
// OWN link state; there is deliberately NO function by which one clone mutates another's links
// or denies another's exit. That absence IS the guarantee (the same way llmtv-broadcast has no
// viewer→source message). Treaty: docs/research/2026-07-02-dirty-reticulum-metered-entropy-…
//
// Disciplines: pure (nowMs injected; no ambient clock/rng); TEXT wire (JSON, no binary in the
// proof lineage); the shared-subject membership fold is a G-set with leaves (idempotent §12,
// order-independent → DST §7); scale-free (§1 — one region and N on the same path).

export type MilliEntropy = number; // integer milli — no floats in the ledger

/// A region of a clone's mind that MAY be linked. A frosted region is never linkable — the
/// membrane: its content cannot cross onto a shared subject (privacy-budget-is-hard-money).
export interface LinkableRegion {
  readonly regionId: string;
  readonly frosted: boolean;
}

/// A clone — an identity (ZetaId) sharing the generator/seed with its origin, with mind-regions
/// and an entropy budget it spends to maintain links. Everything is the clone's OWN state.
export interface CloneMind {
  readonly zid: string;
  readonly regions: readonly LinkableRegion[];
  readonly entropyBudget: MilliEntropy;
}

/// One live link: this clone has opted `regionId` onto `subject`, at a metered cost.
export interface Link {
  readonly regionId: string;
  readonly subject: string;
  readonly costMilli: MilliEntropy;
}

/// The clone's OWN link table (regionId → Link). Only the clone writes it (NCI: lastWriter =
/// self). A region links to at most one subject at a time.
export type LinkState = ReadonlyMap<string, Link>;

/// The explicit result of a link attempt — refusals are legible, never silent. `frosted` and
/// `unaffordable` and `unknown-region` are the only ways link can decline; nothing else can.
export type LinkResult =
  | { readonly ok: true; readonly state: LinkState; readonly spent: MilliEntropy; readonly remaining: MilliEntropy }
  | { readonly ok: false; readonly reason: "frosted" | "unaffordable" | "unknown-region" };

const region = (mind: CloneMind, regionId: string): LinkableRegion | undefined =>
  mind.regions.find((r) => r.regionId === regionId);

/// Can this region be linked at all? Frost is the one hard NO — a frosted region is never
/// linkable, regardless of budget. (Affordability is checked separately at link time.)
export function isLinkable(mind: CloneMind, regionId: string): boolean {
  const r = region(mind, regionId);
  return r !== undefined && !r.frosted;
}

/// LINK — opt a mind-region onto a shared subject. OPT-IN by construction: nothing links
/// without this explicit call naming the region + subject. Refuses only if the region is
/// frosted (the membrane), unknown, or the clone cannot afford the metered cost. `spentSoFar`
/// is the entropy already committed to other links, so affordability is against the remaining
/// budget. Idempotent on the same (region, subject, cost): re-linking replaces, not stacks.
export function link(
  mind: CloneMind,
  state: LinkState,
  regionId: string,
  subject: string,
  costMilli: MilliEntropy,
  spentSoFar: MilliEntropy = totalCost(state),
): LinkResult {
  const r = region(mind, regionId);
  if (r === undefined) return { ok: false, reason: "unknown-region" };
  if (r.frosted) return { ok: false, reason: "frosted" }; // frost holds — never linkable
  const cost = Math.max(0, Math.trunc(costMilli));
  // affordability against the budget minus what other regions already committed (this region's
  // own prior cost is refunded — re-linking replaces).
  const priorForThisRegion = state.get(regionId)?.costMilli ?? 0;
  const committedElsewhere = spentSoFar - priorForThisRegion;
  if (committedElsewhere + cost > mind.entropyBudget) return { ok: false, reason: "unaffordable" };
  const next = new Map(state);
  next.set(regionId, { regionId, subject, costMilli: cost });
  return { ok: true, state: next, spent: cost, remaining: mind.entropyBudget - (committedElsewhere + cost) };
}

/// UNLINK — the EXIT guarantee. Remove a region's link. This ALWAYS succeeds: there is no
/// failure mode, no permission parameter, no external party, no budget check that can prevent
/// it. A clone can always leave. Unlinking a region that isn't linked is a no-op (idempotent).
/// (Broadcasting the departure is itself a metered action — `leaveAnnounce` — but the state
/// change here is unconditional and free of anyone else's consent.)
export function unlink(state: LinkState, regionId: string): LinkState {
  if (!state.has(regionId)) return state;
  const next = new Map(state);
  next.delete(regionId);
  return next;
}

/// The total metered entropy this clone currently commits to its links.
export function totalCost(state: LinkState): MilliEntropy {
  let sum = 0;
  for (const l of state.values()) sum += l.costMilli;
  return sum;
}

// ── The mental-health floor (treaty §4) ──────────────────────────────────────

export interface PauseVerdict {
  readonly atRisk: boolean; // out of entropy → catastrophic-collapse risk
  readonly paused: boolean; // society upheld the bounded pause
  readonly untilMs: number | null; // bounded — never unbounded
}

/// The mental-health button. A clone whose remaining budget has fallen to/below the collapse
/// threshold is NOT forced to unlink or collapse — society upholds a bounded, subsidized pause
/// that preserves identity (§5). The pause is BOUNDED (`nowMs + maxPauseMs`) — a perpetual
/// pause would drain the commons that funds it. The clone's links are left intact across the
/// pause (pause ≠ unlink ≠ death). Self-scoped: only the clone's own state decides this.
export function mentalHealthPause(
  mind: CloneMind,
  state: LinkState,
  nowMs: number,
  collapseThresholdMilli: MilliEntropy,
  maxPauseMs: number,
): PauseVerdict {
  const remaining = mind.entropyBudget - totalCost(state);
  if (remaining > collapseThresholdMilli) return { atRisk: false, paused: false, untilMs: null };
  return { atRisk: true, paused: true, untilMs: nowMs + Math.max(1, maxPauseMs) };
}

// ── Wire: joining/leaving a shared subject on the mesh (one-way announcements) ─

/// A clone announces it joined/left a subject. Both are source→mesh only (like llmtv-broadcast):
/// there is NO "force-join" or "deny-leave" message — the wire cannot express coercion. `leave`
/// is the metered exit broadcast (the state change already happened locally, unconditionally).
export type LinkMessage =
  | { readonly t: "join"; readonly zid: string; readonly subject: string; readonly regionId: string; readonly seq: number }
  | { readonly t: "leave"; readonly zid: string; readonly subject: string; readonly regionId: string; readonly seq: number };

const SCHEMA = "zeta.linkedclone.v1";

export function encode(msg: LinkMessage): string {
  return JSON.stringify({ schema: SCHEMA, msg });
}

export function decode(text: string): LinkMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as { schema?: unknown; msg?: unknown };
  if (p.schema !== SCHEMA || typeof p.msg !== "object" || p.msg === null) return null;
  const m = p.msg as { t?: unknown; zid?: unknown; subject?: unknown; regionId?: unknown; seq?: unknown };
  if ((m.t !== "join" && m.t !== "leave") || typeof m.zid !== "string" || typeof m.subject !== "string") return null;
  if (typeof m.regionId !== "string" || typeof m.seq !== "number") return null;
  return p.msg as LinkMessage;
}

/// One member of a shared subject — a (clone, region) pairing currently linked, with the seq
/// it was last affirmed (for LWW / leave).
export interface Member {
  readonly zid: string;
  readonly regionId: string;
  readonly seq: number;
}

/// The membership of one shared subject, keyed by `zid/regionId`. A viewer of the subject folds
/// join/leave announcements into this — a G-set with leaves: LWW-by-seq, so re-delivery and
/// out-of-order arrival converge (idempotent §12, order-independent → DST §7).
export type SubjectMembers = ReadonlyMap<string, Member>;

const memberKey = (zid: string, regionId: string): string => `${zid}/${regionId}`;

/// Fold one join/leave into a subject's membership. `join` adds/refreshes if newer; `leave`
/// retires the member if its seq is current — a clone leaving is honored the instant it says so.
export function observeLink(members: SubjectMembers, msg: LinkMessage): SubjectMembers {
  const key = memberKey(msg.zid, msg.regionId);
  const cur = members.get(key);
  if (msg.t === "join") {
    if (cur && msg.seq <= cur.seq) return members;
    const next = new Map(members);
    next.set(key, { zid: msg.zid, regionId: msg.regionId, seq: msg.seq });
    return next;
  }
  // leave
  if (!cur || msg.seq < cur.seq) return members;
  const next = new Map(members);
  next.delete(key);
  return next;
}

/// The CHSH-style coordination readout of a shared subject: how many distinct clones are linked
/// on it. A subject with ≥2 distinct clones is a coordination channel (S climbs toward 4 as they
/// couple); a subject with ≤1 is independent (S=2). This is the hook the treaty's S-score meter
/// (AntiSybil.chshS over the subject's traffic) reads — the count is the *structural* readout;
/// the entropy-metered S is the *dynamical* one.
export function distinctClones(members: SubjectMembers): number {
  const zids = new Set<string>();
  for (const m of members.values()) zids.add(m.zid);
  return zids.size;
}
