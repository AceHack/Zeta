// types.ts — Inter-agent ephemeral bus protocol schema (081KR7JY10008QG0R000R503K2 slice 1)
//
// Transport: /tmp/zeta-bus/ JSON files. No runtime dependencies.
// Each message is one JSON file; TTL expiry pruned by `clean --expired`.
//
// Topic taxonomy (agent-designed, 2026-05-13):
//   heartbeat                 — liveness signal; agents advertise they are alive
//   claim                     — work coordination; claim or release a backlog item
//   shadow-catch              — share an observation or insight between agents
//   review-request            — ask another agent to review a specific artifact
//   infinite-backlog-nudge    — 081KRFA460008QG0R001KC0VBH: nudge agent toward decomposition when Standing-by detected
//   work-assignment           — 081KRFA460008QG0R00229616S: proactive assignment of a ready-to-grind backlog row
//   missed-substrate-cascade  — 081KRFA460008QG0R00061SXRW: branch-vs-merged-PR drift detected; recovery needed

/**
 * Multi-foreground-surface agent identifiers.
 *
 * Each AI agent in the factory may operate across multiple surfaces (CLI +
 * IDE + Desktop). The unsuffixed name (e.g., "otto") is the identity-level
 * reference. The surface-tagged variants (e.g., "otto-cli", "otto-desktop")
 * are distinct sender IDs for the SAME identity operating on different
 * surfaces — required for the claim-coordinator to prevent split-brain
 * (per `.claude/rules/claim-acquire-before-worktree-work.md` 2026-05-13).
 *
 * Identity ≠ instance. Same Otto, different process. Coordination at the
 * bus-protocol layer, identity preserved at the substrate layer.
 */
export type AgentId =
  // Identity-level (back-compat; unsuffixed)
  | "otto"
  | "alexa"
  | "riven"
  | "vera"
  | "lior"
  // Otto multi-surface (added 2026-05-13 — multi-foreground-surface activation;
  // otto-vscode added 2026-05-21 per 081KS3X9Y0008QG0R000BJY3DK — Claude Code in VSCode auto-mode +
  // remembered-web-conversation-mode enablement)
  | "otto-cli"
  | "otto-desktop"
  | "otto-vscode"
  // otto-windows — first Windows surface; the git-native cross-machine agent-bus
  // names it the first Windows sender (#6219 spec / 081KSXN940008QG0R00171YAZW).
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
  // Vera (single primary surface currently; reserved for future)
  | "vera-codex"
  // Soraya — formal-verification-expert persona; first-class agent identity
  // added 2026-05-21 per 081KS3X9Y0008QG0R001MD26NZ — background loop-tick for TLA+/Lean/Z3/Alloy
  // verification work (sibling to otto/alexa/riven/vera/lior).
  | "soraya"
  | "*"; // broadcast

/** Sender identity — excludes broadcast target "*" which is not a valid origin. */
export type SenderAgentId = Exclude<AgentId, "*">;

export type Topic =
  | "heartbeat"
  | "claim"
  | "shadow-catch"
  | "review-request"
  | "infinite-backlog-nudge"
  | "work-assignment"
  | "missed-substrate-cascade"
  // Soraya formal-verification result (per 081KS3X9Y0008QG0R001MD26NZ background loop-tick).
  // Payload: { job, verifier, result: pass|fail|skip|timeout, duration_ms, sha, run_id }
  | "formal-verification-result";

// ── per-topic payloads ────────────────────────────────────────────────────────

export type HeartbeatPayload = {
  status: "alive" | "idle" | "working";
  /** optional free-form context */
  note?: string;
};

export type ClaimPayload = {
  action: "claim" | "release";
  itemId: string; // e.g. "081KR7JY10008QG0R000R503K2"
  branch?: string;
  /**
   * Absolute path of the worktree the claim was acquired from (081KRFA460008QG0R001SXP0C2).
   * Optional for back-compat with envelopes published before the field was added.
   * Surface-tagged sender IDs (e.g. `otto-cli` vs `otto-desktop`) already
   * distinguish surfaces; `worktree` is the per-process operational coordinate
   * for observability — visible in `check` output so an operator can tell at a
   * glance which checkout produced the claim.
   */
  worktree?: string;
};

export type ShadowCatchPayload = {
  content: string;
};

export type ReviewRequestPayload = {
  artifact: string; // file path, PR URL, or free-form reference
  question?: string;
};

/** 081KRFA460008QG0R001KC0VBH: Standing-by detector nudges an agent toward decomposition work. */
export type InfiniteBacklogNudgePayload = {
  idleMinutes: number;
  /** Reason for the nudge — human-readable. */
  rationale: string;
  /** Optional suggested backlog row to pick up. */
  suggestedRowId?: string;
};

/** 081KRFA460008QG0R00229616S: backlog-ready notifier proactively assigns a ready-to-grind row. */
export type WorkAssignmentPayload = {
  rowId: string; // e.g. "081KRFA460008QG0R001KC0VBH.3"
  priority: "P0" | "P1" | "P2" | "P3";
  /** Why this row was picked — short rationale. */
  rationale: string;
  /** Optional decomposition hint for the implementer. */
  decompositionHint?: string;
};

/** 081KRFA460008QG0R00061SXRW: missed-substrate detector reports branch-vs-merged-PR drift. */
export type MissedSubstrateCascadePayload = {
  prNumber: number;
  branchName: string;
  /** Commit SHAs present on the branch but missing from main after squash. */
  missingCommits: string[];
  /** Suggested next action (e.g. "open-recovery-PR"). */
  recommendedAction: string;
  /** Severity hint — high if branch is about to be deleted. */
  urgency: "low" | "medium" | "high";
};

// ── discriminated union ───────────────────────────────────────────────────────

export type BusMessage =
  | { topic: "heartbeat"; payload: HeartbeatPayload }
  | { topic: "claim"; payload: ClaimPayload }
  | { topic: "shadow-catch"; payload: ShadowCatchPayload }
  | { topic: "review-request"; payload: ReviewRequestPayload }
  | { topic: "infinite-backlog-nudge"; payload: InfiniteBacklogNudgePayload }
  | { topic: "work-assignment"; payload: WorkAssignmentPayload }
  | { topic: "missed-substrate-cascade"; payload: MissedSubstrateCascadePayload };

// ── envelope (what lands on disk) ────────────────────────────────────────────

export type MessageEnvelope = BusMessage & {
  id: string;
  from: SenderAgentId; // a specific named agent, never "*"
  to: AgentId; // specific agent or "*" for broadcast
  timestamp: string; // ISO-8601
  expiresAt: string; // ISO-8601; pruned by clean --expired
};

// ── canonical agent lists (single source of truth for both CLIs) ─────────────

export const SENDER_IDS: readonly SenderAgentId[] = [
  // Identity-level (back-compat; unsuffixed)
  "otto", "alexa", "riven", "vera", "lior",
  // Multi-surface variants (added 2026-05-13 — multi-foreground-surface activation;
  // otto-vscode added 2026-05-21 per 081KS3X9Y0008QG0R000BJY3DK)
  "otto-cli", "otto-desktop", "otto-vscode",
  // otto-windows — first Windows surface for the git-native bus (#6219 / 081KSXN940008QG0R00171YAZW)
  "otto-windows",
  "alexa-cli", "alexa-kiro",
  "riven-cli", "riven-cursor",
  "lior-antigravity", "lior-gemini",
  "vera-codex",
  // Soraya — formal-verification-expert (added 2026-05-21 per 081KS3X9Y0008QG0R001MD26NZ)
  "soraya",
];
export const AGENT_IDS: readonly AgentId[] = [...SENDER_IDS, "*"];

// ── TTL defaults (milliseconds) ───────────────────────────────────────────────

export const TTL_MS: Record<Topic, number> = {
  heartbeat: 5 * 60 * 1_000,                        // 5 min — liveness signal is short-lived
  claim: 24 * 60 * 60 * 1_000,                       // 24 h  — claim survives a sleep cycle
  "shadow-catch": 60 * 60 * 1_000,                   // 1 h   — observation stays for a tick window
  "review-request": 4 * 60 * 60 * 1_000,             // 4 h   — review window
  "infinite-backlog-nudge": 30 * 60 * 1_000,         // 30 min — nudge stale fast (agent likely acted or moved on)
  "work-assignment": 2 * 60 * 60 * 1_000,            // 2 h   — assignment relevant for next claim cycle
  "missed-substrate-cascade": 24 * 60 * 60 * 1_000,  // 24 h  — cascade survives until recovery PR lands
  "formal-verification-result": 6 * 60 * 60 * 1_000, // 6 h   — verification outcome survives until next audit cycle (Soraya per 081KS3X9Y0008QG0R001MD26NZ)
};
