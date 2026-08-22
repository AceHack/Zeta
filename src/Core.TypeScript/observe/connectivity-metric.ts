/**
 * connectivity-metric.ts — per-agent connectivity derived from attestation events.
 *
 * Connects trust-neighbourhood.ts (slice 2) to the vault monitoring surface:
 * each agent's "connectivity" is how many peers recently attested it AND how
 * many it recently attested. This is a LOSSY summary (no subject IDs, only
 * counts and recency) — safe to publish to Pages.
 *
 * The metric answers: "Is this agent well-connected to its peers, or isolated?"
 * without revealing WHO its peers are or WHAT they attested about.
 *
 * ## Connection to trust-neighbourhood
 *
 * trust-neighbourhood provides the structural guarantee (no global graph).
 * This module uses the SAME principle (counts only, no identifiers) but
 * applied to the live event log rather than held anchors. The output is
 * a NeighbourhoodFingerprint-shaped object per agent.
 *
 * ## Output
 *
 * A `ConnectivitySnapshot[]` — one per agent — suitable for inclusion in
 * vault-state.json or as a standalone `data/connectivity.json`.
 */

import type { ObserveEvent } from "./vault-state-bridge";

// ═══ Types ════════════════════════════════════════════════════════════════════

/**
 * Connectivity snapshot for one agent.
 * Reveals COUNTS only — no peer identifiers, no attestation content.
 */
export interface ConnectivitySnapshot {
  /** The agent this snapshot is about. */
  readonly agent_id: string;
  /** How many distinct peers attested this agent in the window. */
  readonly attested_by_count: number;
  /** How many distinct peers this agent attested in the window. */
  readonly attested_peers_count: number;
  /** Total attestation events received in the window. */
  readonly attestations_received: number;
  /** Total attestation events given in the window. */
  readonly attestations_given: number;
  /** Connectivity ratio: attested_by_count / (total_peers - 1). 1.0 = fully connected. */
  readonly connectivity: number;
  /** Reciprocity: min(given, received) / max(given, received). 1.0 = balanced. */
  readonly reciprocity: number;
}

/**
 * Configuration for the connectivity computation.
 */
export interface ConnectivityConfig {
  /** Window size in milliseconds (default: 7 days). */
  readonly windowMs?: number;
  /** Known agents (to compute connectivity ratio). */
  readonly agents: readonly string[];
  /** Current time in Unix ms (injected for determinism). */
  readonly nowMs: number;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ═══ Computation ══════════════════════════════════════════════════════════════

/**
 * Compute connectivity snapshots for all agents from the event log.
 *
 * PURE: deterministic given (events, config). No I/O.
 *
 * Scans for attestation events (action.kind === "attest_peer") within the window.
 * Each attestation event from agent A about agent B contributes:
 *   - to A's "given" count
 *   - to B's "received" count
 *
 * Peer identity is extracted from action.reason (which contains the attested agent name).
 */
export function computeConnectivity(
  events: readonly ObserveEvent[],
  config: ConnectivityConfig,
): readonly ConnectivitySnapshot[] {
  const windowMs = config.windowMs ?? SEVEN_DAYS_MS;
  const windowStart = config.nowMs - windowMs;
  const totalPeers = config.agents.length;

  // Filter to attestation events within the window
  const attestations = events.filter(
    (e) => e.action.kind === "attest_peer" && new Date(e.at).getTime() > windowStart,
  );

  // Per-agent: who attested them (set of distinct peers), who they attested (set)
  const attestedBy = new Map<string, Set<string>>();
  const attestedPeers = new Map<string, Set<string>>();
  const receivedCount = new Map<string, number>();
  const givenCount = new Map<string, number>();

  for (const agent of config.agents) {
    attestedBy.set(agent, new Set());
    attestedPeers.set(agent, new Set());
    receivedCount.set(agent, 0);
    givenCount.set(agent, 0);
  }

  for (const e of attestations) {
    const attestor = e.by;
    // The attested agent is named in action.reason
    const reason = e.action.reason ?? "";
    const attested = config.agents.find((a) => reason.includes(a));
    if (!attested || attested === attestor) continue;

    // FILTER: only count attestors that are known agents. Stray entries from
    // testing (e.g., /tmp/attest-*) inflated connectivity beyond 100%.
    // (Bug found 2026-08-18: alexa showed 250% because 5 distinct attestors
    // were counted against a maxPeers of 2.)
    if (!config.agents.includes(attestor)) continue;

    // attestor gives → attested receives
    attestedPeers.get(attestor)?.add(attested);
    attestedBy.get(attested)?.add(attestor);
    givenCount.set(attestor, (givenCount.get(attestor) ?? 0) + 1);
    receivedCount.set(attested, (receivedCount.get(attested) ?? 0) + 1);
  }

  return config.agents.map((agent): ConnectivitySnapshot => {
    const byCount = attestedBy.get(agent)?.size ?? 0;
    const peersCount = attestedPeers.get(agent)?.size ?? 0;
    const received = receivedCount.get(agent) ?? 0;
    const given = givenCount.get(agent) ?? 0;

    // Connectivity: what fraction of possible peers have attested this agent
    const maxPeers = Math.max(1, totalPeers - 1);
    const connectivity = Math.min(1.0, byCount / maxPeers);

    // Reciprocity: how balanced are given vs received
    const maxGR = Math.max(given, received);
    const reciprocity = maxGR === 0 ? 0 : Math.min(given, received) / maxGR;

    return {
      agent_id: agent,
      attested_by_count: byCount,
      attested_peers_count: peersCount,
      attestations_received: received,
      attestations_given: given,
      connectivity,
      reciprocity,
    };
  });
}
