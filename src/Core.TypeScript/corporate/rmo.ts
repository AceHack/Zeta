/**
 * corporate/rmo.ts — the Resource Management Office: how many wearers a hat is authorized.
 *
 * ── THE SEAM THAT HAD NOTHING BEHIND IT ──────────────────────────────────────
 * `assignment-engine.ts` already takes a `supplyTarget` and already reports `supply_exhausted`
 * rather than over-staffing — and nothing computed that target. The RMO existed as a hat that
 * signals route to and as a number every caller had to invent. So the one decision the office is
 * for was being made by whoever happened to be calling it.
 *
 * The reference states the mechanism exactly: *"required hat supply is computed from
 * priority-weighted workload; supervisors vote; a majority-quorum tally yields a HatSupplyDecision
 * (expand/release/hold) with the median target."* Three parts, and each carries a refusal.
 *
 * ── WHY A VOTE AT ALL ────────────────────────────────────────────────────────
 * Staffing is the one decision where the person who wants the resource is the worst judge of how
 * much of it exists. A lead short of people always needs more; the organization's total supply is
 * finite. So the computation is a RECOMMENDATION and the authority is a quorum of the hat's own
 * supervisors — the same separation the gates use, applied to headcount.
 *
 * ── MEDIAN, NOT MEAN ─────────────────────────────────────────────────────────
 * One supervisor who asks for twelve moves a mean and does not move a median. The median is the
 * number a majority is at-or-past in both directions, which is what "the group decided" should
 * mean; a mean is a number nobody voted for and one outlier can pick.
 *
 * ── NO QUORUM IS NOT A DECISION ──────────────────────────────────────────────
 * A tally below quorum returns `no_quorum` and NOT `hold`. They look alike — nothing changes
 * either way — and they are opposite: `hold` is the supervisors deciding the current level is
 * right, `no_quorum` is them not having decided. Collapsing the two would let an unstaffed
 * organization report that its staffing was reviewed and approved.
 */

import { LEVEL_RANK, supervisorChainOf, type OrgChart } from "./org-chart";
import { childrenOf, isLeafType, WorkState, type Cascade, type CascadeNode } from "./goal-cascade";
import { PRIORITY_ORDER, priorityRank, type PriorityDecision } from "./prioritization";

/** How much open work one wearer is expected to carry. Above this, the hat needs another wearer. */
export const DEFAULT_LOAD_PER_WEARER = 2;

/** The lowest level that may vote on supply. A lead cannot authorize its own headcount. */
export const MIN_VOTER_LEVEL = "manager";

/**
 * How much a piece of work weighs, from the priority the organization DECIDED.
 *
 * Expedite counts fully; a paused item counts for nothing, because staffing for work nobody
 * intends to do is how an organization ends up over-staffed and still late.
 */
export function priorityWeight(decision: PriorityDecision | undefined): number {
  if (decision === undefined) return 0.5; // unprioritized: unknown, not weightless
  const rank = priorityRank(decision.priorityClass);
  if (rank < 0) return 0.5;
  return 1 - rank / (PRIORITY_ORDER.length - 1);
}

export interface SupplyInput {
  readonly cascade: Cascade;
  readonly priorities: readonly PriorityDecision[];
  /** Open work carried by one wearer before another is needed. */
  readonly loadPerWearer?: number;
  /**
   * Work that will need a wearer but does not have one yet, with the hat each item would go to.
   *
   * Without this, supply is computed from ASSIGNED work only — so a hat is never authorized to grow
   * until after the queue has already been forced onto the wearers it has. The RMO would be
   * perpetually one cycle behind demand, staffing for the backlog it just absorbed rather than the
   * one in front of it, which is the opposite of what a resource office is for.
   *
   * The caller supplies the routing because the caller is the one about to perform it; inferring it
   * here would be a second, quietly divergent opinion about who does what.
   */
  readonly upcoming?: readonly { readonly node: CascadeNode; readonly hatId: string }[];
}

/**
 * The supply a hat's OPEN workload implies — a recommendation, never an authorization.
 *
 * Counts live leaves assigned to the hat, weighted by priority. Finished and cancelled work is
 * excluded: staffing for work already done is the same error as staffing for work nobody will do.
 * Zero open work implies zero required wearers, and that is a real answer — a hat with nothing to
 * do does not need anyone in it.
 */
export function requiredSupply(hatId: string, input: SupplyInput): number {
  const perWearer = Math.max(1, input.loadPerWearer ?? DEFAULT_LOAD_PER_WEARER);
  let weighted = 0;
  for (const node of input.cascade.nodes) {
    if (node.assigneeHatId !== hatId) continue;
    if (!isLeafType(node.workType)) continue;
    if (childrenOf(input.cascade, node.workId).length > 0) continue;
    if (node.state === WorkState.Done || node.state === WorkState.Canceled) continue;
    weighted += priorityWeight(input.priorities.find((p) => p.workId === node.workId));
  }
  for (const item of input.upcoming ?? []) {
    if (item.hatId !== hatId) continue;
    if (item.node.state === WorkState.Done || item.node.state === WorkState.Canceled) continue;
    weighted += priorityWeight(input.priorities.find((p) => p.workId === item.node.workId));
  }
  return Math.ceil(weighted / perWearer);
}

/**
 * Who may vote on this hat's supply: its supervisors, at manager level or above.
 *
 * DERIVED from the chart rather than named. A fixed roster goes stale the moment the organization
 * changes shape, and a staffing decision taken by hats with no relationship to the work is exactly
 * the failure the reporting line exists to prevent.
 */
export function eligibleVoters(chart: OrgChart, hatId: string): readonly string[] {
  const min = LEVEL_RANK[MIN_VOTER_LEVEL];
  return supervisorChainOf(chart, hatId)
    .filter((id) => id !== hatId)
    .filter((id) => {
      const level = chart.byId.get(id)?.level;
      // LOWER rank is MORE senior (`org-chart.ts`: board 0 .. individual_contributor 5), so
      // "manager or above" is `<= LEVEL_RANK.manager`. Written the other way round it admitted
      // every level BELOW manager and excluded every level above — which let a lead vote on its
      // own headcount and locked the directors out.
      return level !== undefined && LEVEL_RANK[level] <= min;
    });
}

export interface SupplyVote {
  readonly voterHatId: string;
  /** The number of wearers this supervisor thinks the hat should have. */
  readonly target: number;
  readonly reason: string;
}

export type SupplyAction = "expand" | "release" | "hold";

export type SupplyResult =
  | {
      readonly ok: true;
      readonly decision: HatSupplyDecision;
    }
  | { readonly ok: false; readonly reason: string };

export interface HatSupplyDecision {
  readonly hatId: string;
  readonly action: SupplyAction;
  /** The authorized number of wearers — the MEDIAN of the votes cast. */
  readonly target: number;
  readonly currentWearers: number;
  /** What the workload recommended, kept beside what was decided. */
  readonly recommended: number;
  readonly votesCast: number;
  readonly quorum: number;
  readonly voters: readonly string[];
}

/** A majority of the eligible voters. One supervisor is its own majority; zero can never reach it. */
export function quorumFor(voterCount: number): number {
  return Math.floor(voterCount / 2) + 1;
}

/** The median of the votes. Even counts take the LOWER middle — supply rounds toward restraint. */
function medianTarget(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  // The lower middle, not the average: an authorized headcount must be a number somebody voted for.
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

/**
 * Tally the supervisors' votes into an authorization.
 *
 * Refuses rather than deciding when the input cannot support a decision: an ineligible voter, a
 * supervisor voting twice, a negative target, or a tally short of quorum.
 */
export function tallySupply(input: {
  readonly chart: OrgChart;
  readonly hatId: string;
  readonly votes: readonly SupplyVote[];
  readonly currentWearers: number;
  readonly recommended: number;
}): SupplyResult {
  const voters = eligibleVoters(input.chart, input.hatId);
  if (voters.length === 0) {
    return { ok: false, reason: `no hat at ${MIN_VOTER_LEVEL} or above supervises '${input.hatId}'` };
  }

  const seen = new Set<string>();
  for (const vote of input.votes) {
    if (!voters.includes(vote.voterHatId)) {
      // A hat outside the line voting on this hat's headcount is the staffing equivalent of a
      // stranger approving a gate.
      return { ok: false, reason: `'${vote.voterHatId}' does not supervise '${input.hatId}' and may not vote` };
    }
    if (seen.has(vote.voterHatId)) {
      // A second vote is a changed mind and has to be explicit; silently taking the last would let
      // one supervisor outvote the rest by repeating.
      return { ok: false, reason: `'${vote.voterHatId}' voted twice` };
    }
    if (!Number.isFinite(vote.target) || vote.target < 0 || !Number.isInteger(vote.target)) {
      return { ok: false, reason: `'${vote.voterHatId}' voted for ${vote.target} wearers, which is not a headcount` };
    }
    seen.add(vote.voterHatId);
  }

  const quorum = quorumFor(voters.length);
  if (input.votes.length < quorum) {
    // NOT `hold`. Nothing changes either way, and they are opposite facts.
    return {
      ok: false,
      reason: `no quorum for '${input.hatId}': ${input.votes.length} of ${voters.length} voted, ${quorum} needed`,
    };
  }

  const target = medianTarget(input.votes.map((v) => v.target));
  const action: SupplyAction =
    target > input.currentWearers ? "expand" : target < input.currentWearers ? "release" : "hold";

  return {
    ok: true,
    decision: {
      hatId: input.hatId,
      action,
      target,
      currentWearers: input.currentWearers,
      recommended: input.recommended,
      votesCast: input.votes.length,
      quorum,
      voters,
    },
  };
}

/**
 * The whole office in one call: compute the recommendation, then put it to the supervisors.
 *
 * The recommendation is passed to the voters and carried into the decision, so a decision that
 * departs from the workload is VISIBLE as a departure rather than looking like the computation.
 */
export function decideSupply(input: {
  readonly chart: OrgChart;
  readonly hatId: string;
  readonly currentWearers: number;
  readonly supply: SupplyInput;
  /** How each eligible supervisor votes, given the recommendation. */
  readonly voteBy: (voterHatId: string, recommended: number) => SupplyVote | undefined;
}): SupplyResult {
  const recommended = requiredSupply(input.hatId, input.supply);
  const voters = eligibleVoters(input.chart, input.hatId);
  const votes: SupplyVote[] = [];
  for (const voter of voters) {
    const vote = input.voteBy(voter, recommended);
    // An abstention is a real position: it counts toward neither side and can leave the tally short
    // of quorum, which is the correct outcome when the supervisors did not engage.
    if (vote !== undefined) votes.push(vote);
  }
  return tallySupply({
    chart: input.chart,
    hatId: input.hatId,
    votes,
    currentWearers: input.currentWearers,
    recommended,
  });
}

/** A supervisor that simply endorses the workload's recommendation. The deterministic baseline. */
export function endorseRecommendation(reason = "workload"): (voterHatId: string, recommended: number) => SupplyVote {
  return (voterHatId, recommended) => ({ voterHatId, target: recommended, reason });
}
