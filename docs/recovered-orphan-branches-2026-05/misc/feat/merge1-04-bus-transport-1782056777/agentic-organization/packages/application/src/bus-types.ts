// bus-types.ts — Merge1 §04 port of the inter-agent bus protocol schema.
//
// Faithful port of `src/Core.TypeScript/bus/types.ts` (the ephemeral-bus
// `AgentId`/`Topic`/`BusMessage`/`MessageEnvelope`), re-homed as the room's
// transport vocabulary. The donor's 7 operational topics are carried verbatim;
// §04 adds the federation topics (relation-offer/accept/edge, lounge-presence)
// needed by the relation protocol (bus-relation-protocol.ts).
//
// MP-3 (ZetaId addressability): the envelope `id` is the message identity.
// MP-6 (asymmetric authorship): `from` is always a concrete sender, never "*".

import type { SupervisorSignalToolType } from "../../domain/src/supervisor-communication.ts";
import type { CommunicationStrategy } from "./room.ts";

/**
 * Multi-foreground-surface agent identity — port of the donor `AgentId`.
 *
 * The unsuffixed name (e.g. "otto") is the identity-level reference; the
 * surface-tagged variants (e.g. "otto-cli", "otto-desktop") are distinct sender
 * IDs for the SAME identity on different surfaces — required by the claim
 * coordinator to prevent split-brain. The 8 unsuffixed names are the core
 * `AgentPersona` registry (§03). `"*"` is the broadcast target.
 */
export type RoomAgentId =
  // Identity-level (back-compat; unsuffixed) = AgentPersona (§03)
  | "otto"
  | "alexa"
  | "riven"
  | "vera"
  | "lior"
  | "soraya"
  // Otto multi-surface
  | "otto-cli"
  | "otto-desktop"
  | "otto-vscode"
  | "otto-windows"
  // Alexa multi-surface (Kiro IDE + CLI)
  | "alexa-cli"
  | "alexa-kiro"
  // Riven multi-surface (Cursor IDE + CLI)
  | "riven-cli"
  | "riven-cursor"
  // Lior multi-surface (Antigravity IDE + Gemini CLI)
  | "lior-antigravity"
  | "lior-gemini"
  // Vera (Codex surface)
  | "vera-codex"
  | "*"; // broadcast target — never a sender

/** Sender identity — excludes the broadcast target "*", which is not a valid origin. */
export type SenderRoomAgentId = Exclude<RoomAgentId, "*">;

/**
 * Room message topic — port of the donor `Topic`, extended with the §04
 * federation topics. The first 8 are the donor's operational topics; the last 4
 * (lounge-presence + the relation handshake triple) are room-federation topics.
 */
export type RoomTopic =
  | "heartbeat"
  | "claim"
  | "shadow-catch"
  | "review-request"
  | "infinite-backlog-nudge"
  | "work-assignment"
  | "missed-substrate-cascade"
  | "formal-verification-result"
  | "lounge-presence"
  | "relation-offer"
  | "relation-accept"
  | "relation-edge";

// ── per-topic payloads (donor-faithful for the operational 8) ─────────────────

export type HeartbeatPayload = {
  readonly status: "alive" | "idle" | "working";
  readonly note?: string;
};

export type ClaimPayload = {
  readonly action: "claim" | "release";
  readonly itemId: string;
  readonly branch?: string;
  /** Absolute path of the worktree the claim was acquired from (observability). */
  readonly worktree?: string;
};

export type ShadowCatchPayload = {
  readonly content: string;
};

export type ReviewRequestPayload = {
  readonly artifact: string; // file path, PR URL, or free-form reference
  readonly question?: string;
};

export type InfiniteBacklogNudgePayload = {
  readonly idleMinutes: number;
  readonly rationale: string;
  readonly suggestedRowId?: string;
};

export type WorkAssignmentPayload = {
  readonly rowId: string;
  readonly priority: "P0" | "P1" | "P2" | "P3";
  readonly rationale: string;
  readonly decompositionHint?: string;
};

export type MissedSubstrateCascadePayload = {
  readonly prNumber: number;
  readonly branchName: string;
  readonly missingCommits: readonly string[];
  readonly recommendedAction: string;
  readonly urgency: "low" | "medium" | "high";
};

export type FormalVerificationResultPayload = {
  readonly job: string;
  readonly verifier: string;
  readonly result: "pass" | "fail" | "skip" | "timeout";
  readonly durationMs: number;
  readonly sha: string;
  readonly runId: string;
};

// ── §04 federation payloads ───────────────────────────────────────────────────

export type LoungePresencePayload = {
  readonly status: "present" | "away";
  readonly note?: string;
};

/** A proposes a durable relation to B. */
export type RelationOfferPayload = {
  readonly relationId: string;
  readonly basis: "offer-accept";
  readonly note?: string;
};

/** B accepts A's offer (carries the same relationId). */
export type RelationAcceptPayload = {
  readonly relationId: string;
  readonly note?: string;
};

/** The durable bidirectional edge certificate emitted once the handshake completes. */
export type RelationEdgePayload = {
  readonly relationId: string;
  readonly from: SenderRoomAgentId;
  readonly to: SenderRoomAgentId;
  readonly basis: "offer-accept";
  readonly acceptedBy: SenderRoomAgentId;
};

// ── discriminated union keyed by topic ────────────────────────────────────────

export type BusMessage =
  | { readonly topic: "heartbeat"; readonly payload: HeartbeatPayload }
  | { readonly topic: "claim"; readonly payload: ClaimPayload }
  | { readonly topic: "shadow-catch"; readonly payload: ShadowCatchPayload }
  | { readonly topic: "review-request"; readonly payload: ReviewRequestPayload }
  | { readonly topic: "infinite-backlog-nudge"; readonly payload: InfiniteBacklogNudgePayload }
  | { readonly topic: "work-assignment"; readonly payload: WorkAssignmentPayload }
  | { readonly topic: "missed-substrate-cascade"; readonly payload: MissedSubstrateCascadePayload }
  | { readonly topic: "formal-verification-result"; readonly payload: FormalVerificationResultPayload }
  | { readonly topic: "lounge-presence"; readonly payload: LoungePresencePayload }
  | { readonly topic: "relation-offer"; readonly payload: RelationOfferPayload }
  | { readonly topic: "relation-accept"; readonly payload: RelationAcceptPayload }
  | { readonly topic: "relation-edge"; readonly payload: RelationEdgePayload };

/**
 * The full envelope that lands on the transport — port of the donor
 * `MessageEnvelope`. Flattens the `BusMessage` (topic + payload) with routing
 * and lifecycle metadata. `id` is the ZetaId; `publishedAt`/`ttlMs` define the
 * lifecycle window.
 */
export type BusMessageEnvelope = BusMessage & {
  readonly id: string; // ZetaId — message identity
  readonly from: SenderRoomAgentId; // a concrete named agent, never "*"
  readonly to: RoomAgentId; // specific agent or "*" for broadcast
  readonly publishedAt: string; // ISO-8601
  readonly ttlMs: number; // lifetime; expiry = publishedAt + ttlMs
};

// ── canonical agent lists (single source of truth) ────────────────────────────

export const SENDER_ROOM_AGENT_IDS: readonly SenderRoomAgentId[] = [
  "otto", "alexa", "riven", "vera", "lior", "soraya",
  "otto-cli", "otto-desktop", "otto-vscode", "otto-windows",
  "alexa-cli", "alexa-kiro",
  "riven-cli", "riven-cursor",
  "lior-antigravity", "lior-gemini",
  "vera-codex",
];

export const ROOM_AGENT_IDS: readonly RoomAgentId[] = [...SENDER_ROOM_AGENT_IDS, "*"];

export function isSenderRoomAgentId(value: unknown): value is SenderRoomAgentId {
  return typeof value === "string" && (SENDER_ROOM_AGENT_IDS as readonly string[]).includes(value);
}

export function isRoomAgentId(value: unknown): value is RoomAgentId {
  return typeof value === "string" && (ROOM_AGENT_IDS as readonly string[]).includes(value);
}

// ── TTL defaults (milliseconds), one per topic ────────────────────────────────

export const ROOM_TOPIC_TTL_MS: Readonly<Record<RoomTopic, number>> = {
  heartbeat: 5 * 60 * 1_000, // 5 min — liveness is short-lived
  claim: 24 * 60 * 60 * 1_000, // 24 h — claim survives a sleep cycle
  "shadow-catch": 60 * 60 * 1_000, // 1 h — observation lives a tick window
  "review-request": 4 * 60 * 60 * 1_000, // 4 h — review window
  "infinite-backlog-nudge": 30 * 60 * 1_000, // 30 min — nudge stales fast
  "work-assignment": 2 * 60 * 60 * 1_000, // 2 h — assignment relevant next claim cycle
  "missed-substrate-cascade": 24 * 60 * 60 * 1_000, // 24 h — survives until recovery PR lands
  "formal-verification-result": 6 * 60 * 60 * 1_000, // 6 h — survives until next audit cycle
  "lounge-presence": 15 * 60 * 1_000, // 15 min — presence is short-lived
  "relation-offer": 60 * 60 * 1_000, // 1 h — offer awaits an accept
  "relation-accept": 60 * 60 * 1_000, // 1 h — accept awaits edge emission
  "relation-edge": 30 * 24 * 60 * 60 * 1_000, // 30 d — durable edge certificate
};

/**
 * `CommunicationStrategy` → `RoomTopic` mapping (§04 §3.2). The room's chosen
 * communication style selects the transport topic its messages ride on.
 */
export function topicForStrategy(strategy: CommunicationStrategy): RoomTopic {
  switch (strategy) {
    case "artifact":
      return "shadow-catch"; // structured artifact exchange
    case "english":
      return "review-request"; // plain-language review
    case "chip8":
      return "heartbeat"; // rehearsal-arena liveness
  }
}

/**
 * `SupervisorSignalToolType` → `RoomTopic` mapping (§04 §4.3). A supervisor
 * signal rides the transport on the topic that matches its intent — blockers and
 * risks cascade, decisions/reviews request review, escalations nudge.
 */
export const SIGNAL_TO_TOPIC: Readonly<Record<SupervisorSignalToolType, RoomTopic>> = {
  ask_question: "shadow-catch",
  report_blocker: "missed-substrate-cascade",
  request_decision: "review-request",
  request_resource: "work-assignment",
  request_review: "review-request",
  report_risk: "missed-substrate-cascade",
  suggest_improvement: "shadow-catch",
  request_escalation: "infinite-backlog-nudge",
};
