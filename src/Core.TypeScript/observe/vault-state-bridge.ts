/**
 * vault-state-bridge.ts — project heartbeat telemetry into the Genesis vault ontology.
 *
 * Pure function: all I/O injected. Given events + tick-history + drift-ledger + now,
 * produces the vault-state.json and vault-roster.json contracts.
 *
 * Contract: docs/design/2026-08-01-vault-monitoring-bridge.md (v2, #9927)
 * Status vocabulary: "live" | "cold" | "stale" | "heat" (per llmtv-root-site-status.ts)
 * No color in output. No precomputed state adjectives. Timestamps only.
 */

import { computeConnectivity } from "./connectivity-metric";
import { stringCompare } from "../collation/collation";

// ═══ Input Types (what we read) ═══════════════════════════════════════════════

export interface ObserveEvent {
  readonly id: string;
  readonly at: string; // ISO 8601
  readonly by: string; // agent_id
  readonly action: { readonly kind: string; readonly reason?: string };
  readonly mode?: string;
  readonly entropy_state?: number;
  readonly entropy_heat?: number;
  readonly phase?: { readonly phase: number; readonly derived: number }; // semantic time (multi-planet)
}

export interface TickFrame {
  readonly t: string;
  readonly total_events: number;
  readonly last_action: string;
  readonly last_mode: string;
  readonly last_agent: string;
  readonly ticks_24h: number;
  readonly agents_active: number;
}

export interface TickHistory {
  readonly frames: readonly TickFrame[];
}

export interface DriftClass {
  readonly rule: string;
  readonly healedCount: number;
  readonly mtthTicks: number | null;
  readonly openCount: number;
  readonly oldestOpenAgeTicks: number | null;
}

export interface DriftLedger {
  readonly latestTick: number;
  readonly classes: readonly DriftClass[];
}

// ═══ Output Types (the contract) ══════════════════════════════════════════════

export type StatusKind = "live" | "cold" | "stale" | "heat";

export interface VaultRoster {
  readonly schema: "zeta.vault-roster.v1";
  readonly agents: readonly { id: string; name: string }[];
  readonly vaults: readonly { id: string; name: string; rooms: readonly { id: string; name: string; default_agent_ids: string[] }[] }[];
  readonly hats: readonly { id: string; name: string; room_id: string; default_agent_id: string | null; rights: string[]; restrictions: string[] }[];
}

export interface VaultState {
  readonly schema: "zeta.vault-state.v1";
  readonly status: StatusKind;
  readonly reason: string;
  readonly generated_at_ms: number;
  readonly tick_frame_t: string;
  readonly total_events_read: number;
  readonly max_phase: number | null;  // highest phase seen across all events (null = no phase stamps yet)
  readonly vaults: readonly VaultSnapshot[];
  /** Per-agent connectivity derived from attestation events (optional — omitted when no attestations). */
  readonly connectivity?: readonly { agent_id: string; connectivity: number; reciprocity: number }[];
}

export interface VaultSnapshot {
  readonly id: string;
  readonly status: StatusKind;
  readonly confidence: SoftValue;
  readonly rooms: readonly RoomSnapshot[];
}

export interface RoomSnapshot {
  readonly id: string;
  readonly confidence: SoftValue;
  readonly activity_log: readonly ActivityEntry[];
  readonly dwellers: readonly DwellerSnapshot[];
}

export interface DwellerSnapshot {
  readonly agent_id: string;
  readonly last_seen: string | null;
  readonly hat_id: string | null;
  readonly last_action: { kind: string; at: string } | null;
  readonly reputation: { value: number; epsilon: number; silent: boolean };
  readonly reputation_history: readonly number[];
}

export interface SoftValue {
  readonly value: number;
  readonly epsilon: number;
}

export interface ActivityEntry {
  readonly at: string;
  readonly agent: string;
  readonly kind: string;
  readonly summary: string;
}

// ═══ Bridge Input ═════════════════════════════════════════════════════════════

export interface BridgeInput {
  readonly events: readonly ObserveEvent[];
  readonly tickHistory: TickHistory;
  readonly driftLedger: DriftLedger | null;
  readonly nowMs: number; // Unix epoch ms (injected for determinism)
}

// ═══ Constants ════════════════════════════════════════════════════════════════

const AGENTS = ["alexa", "otto", "soraya"] as const;
const AGENT_NAMES: Record<string, string> = { alexa: "Alexa", otto: "Otto", soraya: "Soraya" };

const THIRTY_MIN_MS = 30 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const TWO_DAYS_MS = 2 * ONE_DAY_MS;

// Hat assignments (from agent-heartbeat.yml)
const STATIC_HATS: Record<string, string> = { healer: "otto", merge: "alexa", archive: "soraya" };

function codegenAgent(hourUtc: number): string {
  return AGENTS[hourUtc % 3]!;
}

// ═══ Roster (the hub — static topology) ═══════════════════════════════════════

export function buildRoster(): VaultRoster {
  return {
    schema: "zeta.vault-roster.v1",
    agents: AGENTS.map((id) => ({ id, name: AGENT_NAMES[id]! })),
    vaults: [
      {
        id: "observatory", name: "Observatory",
        rooms: [
          { id: "signal-triage", name: "Signal Triage", default_agent_ids: ["alexa", "otto", "soraya"] },
          { id: "demand-forecast", name: "Demand Forecast", default_agent_ids: ["alexa", "otto", "soraya"] },
        ],
      },
      {
        id: "tools", name: "Tools",
        rooms: [
          { id: "drift-watch", name: "Drift Watch", default_agent_ids: ["otto"] },
          { id: "heal-bay", name: "Heal Bay", default_agent_ids: ["otto"] },
        ],
      },
      {
        id: "system", name: "System",
        rooms: [
          { id: "merge-floor", name: "Merge Floor", default_agent_ids: ["alexa"] },
          { id: "archive-stacks", name: "Archive Stacks", default_agent_ids: ["soraya"] },
        ],
      },
      {
        id: "training", name: "Training",
        rooms: [{ id: "codegen-lab", name: "Codegen Lab", default_agent_ids: ["alexa", "otto", "soraya"] }],
      },
      {
        id: "economy", name: "Economy",
        rooms: [{ id: "reputation-engine", name: "Reputation Engine", default_agent_ids: ["alexa", "otto", "soraya"] }],
      },
    ],
    hats: [
      { id: "healer", name: "Healer Hat", room_id: "heal-bay", default_agent_id: "otto", rights: ["execute-tier0-healers"], restrictions: ["max-25-files-per-tick"] },
      { id: "merge", name: "Merge Hat", room_id: "merge-floor", default_agent_id: "alexa", rights: ["auto-merge-clean-prs"], restrictions: ["max-3-prs-per-tick"] },
      { id: "archive", name: "Archive Hat", room_id: "archive-stacks", default_agent_id: "soraya", rights: ["archive-pr-reviews"], restrictions: ["max-3-prs-per-batch"] },
      { id: "codegen", name: "Codegen Hat", room_id: "codegen-lab", default_agent_id: null, rights: ["execute-7b-codegen"], restrictions: ["one-work-tick-per-hour"] },
    ],
  };
}

// ═══ State (the satellite — regenerated every tick) ═══════════════════════════

export function buildVaultState(input: BridgeInput): VaultState {
  const { events, tickHistory, driftLedger, nowMs } = input;
  const latestFrame = tickHistory.frames[tickHistory.frames.length - 1];

  if (events.length === 0 || !latestFrame) {
    return {
      schema: "zeta.vault-state.v1",
      status: "cold",
      reason: "no events or tick-history frames available",
      generated_at_ms: nowMs,
      tick_frame_t: latestFrame?.t ?? new Date(nowMs).toISOString(),
      total_events_read: events.length,
      max_phase: null,
      vaults: buildRoster().vaults.map((v) => ({
        id: v.id,
        status: "cold" as const,
        confidence: { value: 0, epsilon: 0.5 },
        rooms: v.rooms.map((r) => ({
          id: r.id,
          confidence: { value: 0, epsilon: 0.5 },
          activity_log: [],
          dwellers: [],
        })),
      })),
    };
  }

  // Index events by agent
  const eventsByAgent = new Map<string, ObserveEvent[]>();
  for (const e of events) {
    const list = eventsByAgent.get(e.by) || [];
    list.push(e);
    eventsByAgent.set(e.by, list);
  }

  // Sort each agent's events by timestamp (ZetaId names are time-ordered but be safe)
  for (const list of eventsByAgent.values()) {
    list.sort((a, b) => stringCompare(a.at, b.at));
  }

  // Compute per-agent latest event
  const agentLatest = new Map<string, ObserveEvent>();
  for (const [agent, list] of eventsByAgent) {
    agentLatest.set(agent, list[list.length - 1]!);
  }

  // Compute global status from latest frame age
  const frameAgeMs = nowMs - new Date(latestFrame.t).getTime();
  const globalStatus = computeStatus(frameAgeMs, events, nowMs);

  // Hat assignments for current hour
  const hourUtc = new Date(nowMs).getUTCHours();
  const currentCodegenAgent = codegenAgent(hourUtc);
  const hatAssignments = new Map<string, string>(); // agent → hat_id
  for (const [hatId, agent] of Object.entries(STATIC_HATS)) {
    hatAssignments.set(agent, hatId);
  }
  // Codegen overrides if the agent doesn't already have a static hat... 
  // Actually codegen is an ADDITIONAL hat, but for room placement we use primary duty
  // Let's keep it simple: codegen agent gets placed in codegen-lab if they don't have another room
  const codegenHatAgent = currentCodegenAgent;

  // Build reputation per agent
  const reputations = new Map<string, { value: number; epsilon: number; silent: boolean; history: number[] }>();
  for (const agent of AGENTS) {
    reputations.set(agent, computeReputation(agent, events, nowMs, eventsByAgent));
  }

  // Build vault snapshots
  const vaults: VaultSnapshot[] = [
    buildObservatoryVault(events, agentLatest, hatAssignments, reputations, nowMs),
    buildToolsVault(events, agentLatest, driftLedger, hatAssignments, reputations, nowMs),
    buildSystemVault(events, agentLatest, hatAssignments, reputations, nowMs),
    buildTrainingVault(events, agentLatest, codegenHatAgent, reputations, nowMs),
    buildEconomyVault(events, agentLatest, reputations, nowMs),
  ];

  // Compute per-agent connectivity from attestation events
  const connectivitySnapshots = computeConnectivity(events, { agents: [...AGENTS], nowMs });
  const hasAttestations = connectivitySnapshots.some((c) => c.attestations_received > 0 || c.attestations_given > 0);

  return {
    schema: "zeta.vault-state.v1",
    status: globalStatus,
    reason: globalStatus === "live" ? "latest frame within 30min" :
      globalStatus === "stale" ? `latest frame ${Math.round(frameAgeMs / 60000)}min ago` :
      globalStatus === "heat" ? "active failures detected" :
      "no recent activity",
    generated_at_ms: nowMs,
    tick_frame_t: latestFrame.t,
    total_events_read: events.length,
    max_phase: events.reduce((max, e) => e.phase?.phase != null && e.phase.phase > max ? e.phase.phase : max, -1) >= 0
      ? events.reduce((max, e) => e.phase?.phase != null && e.phase.phase > max ? e.phase.phase : max, -1)
      : null,
    vaults,
    ...(hasAttestations ? {
      connectivity: connectivitySnapshots.map((c) => ({
        agent_id: c.agent_id,
        connectivity: c.connectivity,
        reciprocity: c.reciprocity,
      })),
    } : {}),
  };
}

// ═══ Status Computation ══════════════════════════════════════════════════════

function computeStatus(frameAgeMs: number, events: readonly ObserveEvent[], nowMs: number): StatusKind {
  // Check for heat: any event in last 2h with "fail" in action kind
  const twoHoursAgo = nowMs - TWO_HOURS_MS;
  const hasFailures = events.some((e) =>
    e.action && new Date(e.at).getTime() > twoHoursAgo &&
    (e.action.kind.includes("fail") || e.action.kind.includes("error"))
  );
  if (hasFailures) return "heat";

  if (frameAgeMs < THIRTY_MIN_MS) return "live";
  if (frameAgeMs < TWO_HOURS_MS) return "stale";
  return "cold";
}

// ═══ Reputation ══════════════════════════════════════════════════════════════

function computeReputation(
  agent: string,
  _allEvents: readonly ObserveEvent[],
  nowMs: number,
  eventsByAgent: Map<string, ObserveEvent[]>,
): { value: number; epsilon: number; silent: boolean; history: number[] } {
  const agentEvents = eventsByAgent.get(agent) || [];
  const sevenDaysAgo = nowMs - SEVEN_DAYS_MS;
  const twoDaysAgo = nowMs - TWO_DAYS_MS;

  // Filter to trailing 7 days
  const trailing = agentEvents.filter((e) => new Date(e.at).getTime() > sevenDaysAgo);

  // Check silent: zero ticks for 7 days AND k >= 2 peers active
  if (trailing.length === 0) {
    const activePeers = AGENTS.filter((a) => a !== agent && (eventsByAgent.get(a) || [])
      .some((e) => new Date(e.at).getTime() > sevenDaysAgo)).length;
    if (activePeers >= 2) {
      // Epsilon is MAXIMAL here, not zero.
      //
      // `silent` and `epsilon` are different quantities and were being conflated. `silent`
      // is a corroborated FACT about absence — zero ticks with k >= 2 peers active — and
      // high confidence in that fact is correct, because it is a quorum observation.
      // `epsilon` is uncertainty about the agent's VALUE, and seven days of silence is no
      // evidence whatsoever about capability. A silent dweller is the most uncertain object
      // in the system, not the least.
      //
      // The old `epsilon: 0` asserted perfect certainty at the point of maximum absence of
      // evidence, and contradicted the stated design (Aaron 2026-08-01: "you start at 100%
      // trust with 0.1% certainty"). Found independently by Soraya (formal) and Iris
      // (render: "a full-track empty bar with no admitted uncertainty is the strongest
      // statement the bar can make, and it is exactly backwards").
      //
      // Sign is negative — downside uncertainty — because the absence points that way, while
      // the magnitude records that we do not actually know.
      return { value: 0, epsilon: -1, silent: true, history: [0, 0, 0, 0, 0, 0, 0] };
    }
    // Not enough peers to declare silent — just very uncertain
    // Not enough peers to declare silent — but still very uncertain, and the
    // uncertainty is DOWNSIDE (negative): zero ticks is not evidence of capability.
    // The only reason this isn't silent:true is insufficient corroboration.
    return { value: 0.1, epsilon: -0.5, silent: false, history: [0, 0, 0, 0, 0, 0, 0] };
  }

  // Split into recent (48h) and older (days 3-7)
  const recent = trailing.filter((e) => new Date(e.at).getTime() > twoDaysAgo);
  const older = trailing.filter((e) => new Date(e.at).getTime() <= twoDaysAgo);

  // Expected: 4 ticks/hour (every 15min)
  const recentExpected = 48 * 4; // 192
  const olderExpected = 5 * 24 * 4; // 480

  const recentRatio = Math.min(recent.length / recentExpected, 1.0);
  const olderRatio = Math.min(older.length / olderExpected, 1.0);

  // Attestation bonus: ticks that were peer-attested are worth more.
  // Count attestation events where this agent is the attested party.
  const attestationsReceived = trailing.filter((e) =>
    e.action.kind === "attest_peer" && e.action.reason?.includes(agent)
  ).length;
  // Also count attestations FROM this agent about others (shows participation)
  const attestationsGiven = trailing.filter((e) =>
    e.by === agent && e.action.kind === "attest_peer"
  ).length;
  // Attestation bonus: up to 10% boost for being attested, 5% for attesting others
  const attestationBonus = Math.min(attestationsReceived * 0.02, 0.1) + Math.min(attestationsGiven * 0.01, 0.05);

  const score = Math.max((2 * recentRatio + olderRatio) / 3 + attestationBonus, 0.1);

  // Epsilon: signed. Positive = upside uncertainty (recovering), negative = downside
  const totalEvents = trailing.length;
  const epsilonMagnitude = totalEvents < 10 ? Math.max(0.3, 1 / Math.sqrt(totalEvents)) : 1 / Math.sqrt(totalEvents);

  // Trend from last two days vs days 3-4
  const threeDaysAgo = nowMs - 3 * ONE_DAY_MS;
  const dayBeforeRecent = trailing.filter((e) => {
    const t = new Date(e.at).getTime();
    return t > threeDaysAgo && t <= twoDaysAgo;
  });
  const recentDensity = recent.length / 2; // per day
  const olderDensity = dayBeforeRecent.length > 0 ? dayBeforeRecent.length : older.length / 5;
  const improving = recentDensity > olderDensity * 1.05;
  const epsilon = improving ? epsilonMagnitude : -epsilonMagnitude;

  // History: daily scores for last 7 days
  const history: number[] = [];
  for (let d = 6; d >= 0; d--) {
    const dayStart = nowMs - (d + 1) * ONE_DAY_MS;
    const dayEnd = nowMs - d * ONE_DAY_MS;
    const dayEvents = agentEvents.filter((e) => {
      const t = new Date(e.at).getTime();
      return t > dayStart && t <= dayEnd;
    });
    const dayExpected = 24 * 4; // 96
    history.push(Math.min(dayEvents.length / dayExpected, 1.0));
  }

  return { value: score, epsilon, silent: false, history };
}

// ═══ Vault Builders ══════════════════════════════════════════════════════════

function buildObservatoryVault(
  events: readonly ObserveEvent[],
  agentLatest: Map<string, ObserveEvent>,
  hatAssignments: Map<string, string>,
  reputations: Map<string, { value: number; epsilon: number; silent: boolean; history: number[] }>,
  nowMs: number,
): VaultSnapshot {
  // Observatory: monitoring & cadence — all events are relevant
  const recentEvents = events.filter((e) => new Date(e.at).getTime() > nowMs - TWO_HOURS_MS);
  const confidence = recentEvents.length > 0
    ? { value: Math.min(0.7 + 0.3 * (recentEvents.length / 24), 1.0), epsilon: 0.1 }
    : { value: 0.5, epsilon: 0.25 };

  return {
    id: "observatory",
    status: recentEvents.length > 0 ? "live" : "stale",
    confidence,
    rooms: [
      buildRoom("signal-triage", events, agentLatest, hatAssignments, reputations, nowMs,
        () => true, "cadence measurement"),
      buildRoom("demand-forecast", events, agentLatest, hatAssignments, reputations, nowMs,
        () => true, "reliability forecasting"),
    ],
  };
}

function buildToolsVault(
  events: readonly ObserveEvent[],
  agentLatest: Map<string, ObserveEvent>,
  driftLedger: DriftLedger | null,
  hatAssignments: Map<string, string>,
  reputations: Map<string, { value: number; epsilon: number; silent: boolean; history: number[] }>,
  nowMs: number,
): VaultSnapshot {
  const healEvents = events.filter((e) => e.action.kind.includes("heal"));
  const recentHeal = healEvents.filter((e) => new Date(e.at).getTime() > nowMs - TWO_HOURS_MS);
  const openDrift = driftLedger?.classes.reduce((sum, c) => sum + c.openCount, 0) ?? 0;

  const hasHeat = openDrift > 0 || recentHeal.some((e) => e.action.kind.includes("fail"));
  const confidence = driftLedger
    ? { value: openDrift === 0 ? 0.9 : Math.max(0.2, 0.7 - openDrift * 0.1), epsilon: 0.1 }
    : { value: 0, epsilon: 0.5 };

  return {
    id: "tools",
    status: hasHeat ? "heat" : recentHeal.length > 0 ? "live" : driftLedger ? "stale" : "cold",
    confidence,
    rooms: [
      buildRoom("drift-watch", events, agentLatest, hatAssignments, reputations, nowMs,
        (_e) => false, "drift class monitoring", driftLedger),
      buildRoom("heal-bay", events, agentLatest, hatAssignments, reputations, nowMs,
        (e) => e.action.kind.includes("heal"), "healer operations"),
    ],
  };
}

function buildSystemVault(
  events: readonly ObserveEvent[],
  agentLatest: Map<string, ObserveEvent>,
  hatAssignments: Map<string, string>,
  reputations: Map<string, { value: number; epsilon: number; silent: boolean; history: number[] }>,
  nowMs: number,
): VaultSnapshot {
  // System vault status: derived from the assigned agents' activity, not just merge/archive
  // action kinds (which don't exist in the current event log). The merge-floor shows alexa's
  // work; archive-stacks shows soraya's work. Status is "live" if either has recent activity.
  const alexaEvents = events.filter((e) => e.by === "alexa");
  const sorayaEvents = events.filter((e) => e.by === "soraya");
  const recentAlexa = alexaEvents.filter((e) => new Date(e.at).getTime() > nowMs - TWO_HOURS_MS);
  const recentSoraya = sorayaEvents.filter((e) => new Date(e.at).getTime() > nowMs - TWO_HOURS_MS);

  const anyRecent = recentAlexa.length > 0 || recentSoraya.length > 0;
  return {
    id: "system",
    status: anyRecent ? "live" : (alexaEvents.length > 0 || sorayaEvents.length > 0) ? "stale" : "cold",
    confidence: anyRecent ? { value: 0.8, epsilon: 0.1 } : { value: 0.4, epsilon: 0.3 },
    rooms: [
      buildRoom("merge-floor", events, agentLatest, hatAssignments, reputations, nowMs,
        (e) => e.by === "alexa", "PR merge operations"),
      buildRoom("archive-stacks", events, agentLatest, hatAssignments, reputations, nowMs,
        (e) => e.by === "soraya", "PR review archival"),
    ],
  };
}

function buildTrainingVault(
  events: readonly ObserveEvent[],
  agentLatest: Map<string, ObserveEvent>,
  codegenAgent: string,
  reputations: Map<string, { value: number; epsilon: number; silent: boolean; history: number[] }>,
  nowMs: number,
): VaultSnapshot {
  const workEvents = events.filter((e) => e.mode === "codegen" || e.action.kind.includes("work") ||
    e.action.kind === "edit_grammar" || e.action.kind === "decompose");
  const recentWork = workEvents.filter((e) => new Date(e.at).getTime() > nowMs - TWO_HOURS_MS);

  const hatAssignments = new Map<string, string>();
  hatAssignments.set(codegenAgent, "codegen");

  return {
    id: "training",
    status: recentWork.length > 0 ? "live" : workEvents.length > 0 ? "stale" : "cold",
    confidence: recentWork.length > 0
      ? { value: 0.7 + 0.3 * Math.min(recentWork.length / 4, 1), epsilon: 0.1 }
      : { value: 0.3, epsilon: 0.3 },
    rooms: [
      buildRoom("codegen-lab", events, agentLatest, hatAssignments, reputations, nowMs,
        (e) => e.mode === "codegen" || e.action.kind.includes("work") ||
          e.action.kind === "edit_grammar" || e.action.kind === "decompose", "codegen execution"),
    ],
  };
}

function buildEconomyVault(
  events: readonly ObserveEvent[],
  agentLatest: Map<string, ObserveEvent>,
  reputations: Map<string, { value: number; epsilon: number; silent: boolean; history: number[] }>,
  nowMs: number,
): VaultSnapshot {
  // Status derives from EVIDENCE RECENCY, like every other scope.
  //
  // This previously read `events.length > 0 ? "live" : "cold"` with a hardcoded confidence of
  // {0.8, 0.1}, on the reasoning that "reputation is always computable". That conflates the
  // computation being available with the society being active: a seven-hour-old event still made
  // reputation computable, and the vault duly reported "live" over a settlement that had done
  // nothing since morning. Found by Iris reviewing the emitted JSON, 2026-08-01.
  //
  // A renderer can cap this (a child never raises its parent), but the FILE has to be honest on
  // its own — monitor.html, a CLI, or any other consumer reads it directly and inherits whatever
  // it claims.
  const hatAssignments = new Map<string, string>();
  const freshestMs = events.reduce(
    (newest, e) => Math.max(newest, new Date(e.at).getTime()),
    Number.NEGATIVE_INFINITY,
  );
  const evidenceAgeMs = events.length === 0 ? Number.POSITIVE_INFINITY : nowMs - freshestMs;
  const status = computeStatus(evidenceAgeMs, events, nowMs);
  // Confidence tracks the evidence too: wide band when the newest evidence is old, because a
  // narrow band is a claim of precision we did not earn.
  const confidence = status === "live"
    ? { value: 0.8, epsilon: 0.1 }
    : status === "stale"
      ? { value: 0.5, epsilon: 0.3 }
      : { value: 0.2, epsilon: 0.5 };
  return {
    id: "economy",
    status,
    confidence,
    rooms: [
      buildRoom("reputation-engine", events, agentLatest, hatAssignments, reputations, nowMs,
        (_e) => true, "reputation computation"),
    ],
  };
}

// ═══ Room Builder ════════════════════════════════════════════════════════════

function buildRoom(
  roomId: string,
  events: readonly ObserveEvent[],
  agentLatest: Map<string, ObserveEvent>,
  hatAssignments: Map<string, string>,
  reputations: Map<string, { value: number; epsilon: number; silent: boolean; history: number[] }>,
  nowMs: number,
  eventFilter: (e: ObserveEvent) => boolean,
  _domain: string,
  driftLedger?: DriftLedger | null,
): RoomSnapshot {
  const roomEvents = events.filter(eventFilter);
  const recentRoom = roomEvents.filter((e) => new Date(e.at).getTime() > nowMs - TWO_HOURS_MS);

  // Confidence
  let confidence: SoftValue;
  if (recentRoom.length > 0) {
    confidence = { value: Math.min(0.7 + 0.3 * (recentRoom.length / 10), 1.0), epsilon: 0.1 };
  } else if (roomEvents.length > 0) {
    const lastEventMs = Math.max(...roomEvents.map((e) => new Date(e.at).getTime()));
    const hoursSince = (nowMs - lastEventMs) / (60 * 60 * 1000);
    confidence = { value: 0.5, epsilon: Math.min(0.2 + hoursSince * 0.01, 0.5) };
  } else if (driftLedger) {
    // Drift watch room: derive from the ledger
    const openCount = driftLedger.classes.reduce((s, c) => s + c.openCount, 0);
    confidence = openCount === 0
      ? { value: 0.9, epsilon: 0.1 }
      : { value: Math.max(0.2, 0.6 - openCount * 0.1), epsilon: 0.15 };
  } else {
    confidence = { value: 0, epsilon: 0.5 };
  }

  // Activity log: last 5 events for this room
  const activityLog: ActivityEntry[] = roomEvents
    .slice(-5)
    .reverse()
    .map((e) => ({
      at: e.at,
      agent: e.by,
      kind: e.action.kind,
      summary: `${e.action.kind}${e.action.reason ? `: ${e.action.reason}` : ""}`,
    }));

  // Dwellers: agents assigned to this room via hat
  const dwellers: DwellerSnapshot[] = [];
  for (const [agent, hatId] of hatAssignments) {
    const roomForHat = hatToRoom(hatId);
    if (roomForHat === roomId) {
      const latest = agentLatest.get(agent);
      const rep = reputations.get(agent)!;
      dwellers.push({
        agent_id: agent,
        last_seen: latest?.at ?? null,
        hat_id: hatId,
        last_action: latest ? { kind: latest.action.kind, at: latest.at } : null,
        reputation: { value: rep.value, epsilon: rep.epsilon, silent: rep.silent },
        reputation_history: rep.history,
      });
    }
  }

  return { id: roomId, confidence, activity_log: activityLog, dwellers };
}

function hatToRoom(hatId: string): string {
  switch (hatId) {
    case "healer": return "heal-bay";
    case "merge": return "merge-floor";
    case "archive": return "archive-stacks";
    case "codegen": return "codegen-lab";
    default: return "reputation-engine";
  }
}
