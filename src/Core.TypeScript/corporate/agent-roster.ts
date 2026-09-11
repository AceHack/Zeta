/**
 * agent-roster.ts — agents exist BEFORE hats, and a hat can run out of people.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 * `agentsFromChart` minted one agent per IC hat, named `agent-<hatId>`, permanently paired to it.
 * So an agent had no existence apart from its hat, every hat always had exactly one willing wearer,
 * and no hat could ever be short-staffed. The RMO computed a supply target against a pool that
 * conjured itself on demand — a constraint that cannot bind, which is not a constraint.
 *
 * A roster is the pool stated OUT LOUD: these agents exist, each is provisioned for these hats, and
 * each may hold this many at once. Now "who can wear this hat" has an answer that can be **no**, and
 * a supply decision means something because the supply is finite.
 *
 * ── WHY ELIGIBILITY IS A LIST AND NOT A PREDICATE ───────────────────────────
 * A predicate ("can this agent wear this hat?") is unenumerable: nothing can ask *who is available*,
 * only *is this one available*, so an operator cannot see the bench and the UI cannot draw it. The
 * list is the smaller, duller, answerable shape — and answerable is the whole point of a roster.
 */

import { isTerminal, type HatBinding } from "./hat-binding";
import type { OrgChart, OrgHat } from "./org-chart";

/** How many wearers a hat admits at once. One unless the hat says otherwise. */
export const DEFAULT_MAX_WEARERS = 1;

/** How many hats one agent may hold at once. One unless the roster says otherwise. */
export const DEFAULT_CONCURRENT_HATS = 1;

export interface ProvisionedAgent {
  readonly agentId: string;
  /**
   * The hats this agent is provisioned to wear. Empty means provisioned for NOTHING — a real and
   * useful state (an agent that exists but is not yet cleared for any role), and deliberately not
   * read as "anything".
   */
  readonly eligibleHatIds: readonly string[];
  /** Hats it may hold simultaneously. Absent means one: a person wears one hat at a time. */
  readonly concurrentHats?: number;
  /** Free-text for the directory — a model name, a team, a person. Never used for a decision. */
  readonly label?: string;
}

export interface AgentRoster {
  readonly agents: readonly ProvisionedAgent[];
}

export type ProvisionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/** How many wearers this hat admits. */
export function maxWearersOf(hat: OrgHat): number {
  return Math.max(1, hat.maxWearers ?? DEFAULT_MAX_WEARERS);
}

/** The live (non-terminal) bindings on a hat. */
export function wearersOf(bindings: readonly HatBinding[], hatId: string): readonly HatBinding[] {
  return bindings.filter((b) => b.hatId === hatId && !isTerminal(b.phase));
}

/** The live bindings an agent holds, across all hats. */
export function hatsHeldBy(bindings: readonly HatBinding[], agentId: string): readonly HatBinding[] {
  return bindings.filter((b) => b.wearerAgentId === agentId && !isTerminal(b.phase));
}

export function agentIn(roster: AgentRoster, agentId: string): ProvisionedAgent | undefined {
  return roster.agents.find((a) => a.agentId === agentId);
}

/**
 * May this agent take this hat right now?
 *
 * Every refusal names the thing that refused it, because "no" without a reason is indistinguishable
 * from a bug and an operator cannot act on it.
 */
export function mayProvision(input: {
  readonly roster: AgentRoster;
  readonly bindings: readonly HatBinding[];
  readonly chart: OrgChart;
  readonly agentId: string;
  readonly hatId: string;
  readonly nowMs: number;
}): ProvisionResult {
  const hat = input.chart.byId.get(input.hatId);
  if (hat === undefined) return { ok: false, reason: `no hat '${input.hatId}' in this chart` };

  const agent = agentIn(input.roster, input.agentId);
  if (agent === undefined) {
    // NOT auto-provisioned. An agent the roster has never heard of is exactly the case the old
    // derive-an-agent-per-hat behaviour hid, and hiding it is what made supply meaningless.
    return { ok: false, reason: `'${input.agentId}' is not on the roster` };
  }
  if (!agent.eligibleHatIds.includes(input.hatId)) {
    return { ok: false, reason: `'${input.agentId}' is not provisioned for '${input.hatId}'` };
  }

  const held = hatsHeldBy(input.bindings, input.agentId);
  if (held.some((b) => b.hatId === input.hatId)) {
    return { ok: false, reason: `'${input.agentId}' already wears '${input.hatId}'` };
  }
  const limit = Math.max(1, agent.concurrentHats ?? DEFAULT_CONCURRENT_HATS);
  if (held.length >= limit) {
    return {
      ok: false,
      reason: `'${input.agentId}' already holds ${String(held.length)} hat(s), limit ${String(limit)}`,
    };
  }

  const wearers = wearersOf(input.bindings, input.hatId);
  const cap = maxWearersOf(hat);
  if (wearers.length >= cap) {
    return {
      ok: false,
      reason: `'${input.hatId}' is at capacity: ${String(wearers.length)}/${String(cap)} wearer(s)`,
    };
  }

  // Cooldown is the wearer's own, on this hat — a hat it just took off is not one it may re-take.
  const cooling = input.bindings.find(
    (b) =>
      b.hatId === input.hatId &&
      b.wearerAgentId === input.agentId &&
      b.cooldownUntilMs !== undefined &&
      input.nowMs < b.cooldownUntilMs,
  );
  if (cooling !== undefined) {
    return {
      ok: false,
      reason: `'${input.agentId}' is cooling down on '${input.hatId}' until ${String(cooling.cooldownUntilMs)}`,
    };
  }
  return { ok: true };
}

/**
 * WHO could wear this hat right now — the bench, enumerated.
 *
 * This is the question a staffing decision actually asks, and the reason eligibility is a list.
 * An empty result is a real answer: the hat is unstaffable, and the organization should say so
 * rather than assign somebody who cannot hold it.
 */
export function assignableAgents(input: {
  readonly roster: AgentRoster;
  readonly bindings: readonly HatBinding[];
  readonly chart: OrgChart;
  readonly hatId: string;
  readonly nowMs: number;
}): readonly string[] {
  return input.roster.agents
    .filter(
      (a) =>
        mayProvision({
          roster: input.roster,
          bindings: input.bindings,
          chart: input.chart,
          agentId: a.agentId,
          hatId: input.hatId,
          nowMs: input.nowMs,
        }).ok,
    )
    .map((a) => a.agentId);
}

/** What the directory shows for one hat: capacity, who holds it, who could. */
export interface HatSupply {
  readonly hatId: string;
  readonly maxWearers: number;
  readonly wearers: readonly string[];
  readonly available: readonly string[];
  /** Provisioned for this hat but not currently able to take it — the bench that cannot play. */
  readonly blocked: readonly { readonly agentId: string; readonly reason: string }[];
}

export function hatSupply(input: {
  readonly roster: AgentRoster;
  readonly bindings: readonly HatBinding[];
  readonly chart: OrgChart;
  readonly hatId: string;
  readonly nowMs: number;
}): HatSupply {
  const hat = input.chart.byId.get(input.hatId);
  const provisioned = input.roster.agents.filter((a) => a.eligibleHatIds.includes(input.hatId));
  const blocked: { agentId: string; reason: string }[] = [];
  const available: string[] = [];
  for (const agent of provisioned) {
    const verdict = mayProvision({ ...input, agentId: agent.agentId });
    if (verdict.ok) available.push(agent.agentId);
    else blocked.push({ agentId: agent.agentId, reason: verdict.reason });
  }
  return {
    hatId: input.hatId,
    maxWearers: hat === undefined ? DEFAULT_MAX_WEARERS : maxWearersOf(hat),
    wearers: wearersOf(input.bindings, input.hatId).map((b) => b.wearerAgentId),
    available,
    blocked,
  };
}

/**
 * A roster with one agent per individual-contributor hat — the OLD behaviour, named.
 *
 * Kept because a caller may genuinely want an unconstrained pool (a simulation, a test), and
 * because deleting it would silently change every existing run. But it is now something a caller
 * CHOOSES and the run can report, rather than the only way agents could come into existence.
 *
 * Note what it is not: a default. `run-org` reads a real roster when one is declared.
 */
export function rosterFromChart(chart: OrgChart, prefix = "agent"): AgentRoster {
  return {
    agents: chart.hats
      .filter((h) => h.level === "individual_contributor")
      .map((h) => ({
        agentId: `${prefix}-${h.id}`,
        eligibleHatIds: [h.id],
        label: `derived from ${h.id} — one agent per hat, no scarcity`,
      })),
  };
}
