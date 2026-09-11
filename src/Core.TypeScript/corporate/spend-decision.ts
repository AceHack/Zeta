/**
 * spend-decision.ts — before this organization pays for anything, somebody has to have looked for a
 * free way and said why it lost.
 *
 * ── WHAT `budget.ts` ALREADY ANSWERS, AND WHAT IT DOES NOT ───────────────────
 * `checkBudget` answers **can we afford it** — a hard limit with three honest states, including
 * `Unbudgeted` for the case nobody declared one. That is the whole of the affordability question
 * and none of the interesting one:
 *
 *   > **Affordable is not the same as worth it, and neither is the same as necessary.**
 *
 * An organization that only asks the first buys every cheap thing anybody proposes. This module is
 * the second and third questions, and they belong to the hat that owns the money.
 *
 * ── THE FORCING FUNCTION: YOU MAY NOT BUY WHAT YOU HAVE NOT TRIED TO GET FREE ─
 * A proposal carries an `AlternativeSearch`, and `not_searched` is REFUSED — not decided against,
 * refused, because the decider has not been given what a decision needs. That is the one rule here
 * that changes behaviour rather than recording it: it makes looking for an open-source or
 * already-owned answer a precondition of spending, instead of a virtue somebody might remember.
 *
 * And it is the register's recurring shape in its most expensive form. Without it, a proposal where
 * somebody searched hard and found nothing and a proposal where nobody looked arrive at the CFO as
 * the same document — a thing nobody examined, rendered identically to a thing examined and found
 * clean. The difference is the entire value of asking.
 *
 * `searched` with an EMPTY list is a real and different answer: somebody looked, there is no free
 * way, and the ruling says so. Three states, and the middle one is the one systems skip.
 *
 * ── RETURNED IS A RULING; REFUSED MEANS THE CALL WAS MALFORMED ───────────────
 * The line falls where the fix does. Anything the PROPOSER can supply — a search, a shortfall, a
 * priority — comes back as a `Returned` ruling addressed to them, because that is an act the CFO
 * performed and somebody can act on. Anything about the CALL itself — an unknown hat, a hat that
 * does not hold the money, a proposer approving its own purchase, a cost that is not a cost, a
 * budget nobody declared — is a refusal, because there is no proposer to hand it back to and
 * recording a verdict would name a decision nobody made.
 *
 * ── WHY THE VERDICT IS DERIVED AND NOT CHOSEN ────────────────────────────────
 * Every input to the ruling is a fact the organization already holds — the alternatives the
 * proposer found, the priority its supervisor decided, the budget its finance authority declared,
 * and one stated policy (how much effort a free path may cost). So the ruling is a function of
 * those, and two organizations with the same facts reach the same answer. A chooser here would let
 * the same proposal be approved on Tuesday and refused on Wednesday with nothing in the record to
 * say what changed.
 *
 * ── AND THE DECIDER IS DERIVED TOO ───────────────────────────────────────────
 * Not a new declaration: `blocker-taxonomy.ts` already says who owns `budget_exceeded` — the CFO,
 * then the program director, then the board — most-specific-first, filtered to the hats a chart
 * actually has. Money questions were already routed; this reads that answer rather than inventing a
 * second one that could disagree with it.
 */

import { BlockerKind, ownersFor } from "./blocker-taxonomy";
import { GateOutcome } from "./quality-gate";
import { BudgetDecision, checkBudget, type Budget } from "./budget";
import { PriorityClass } from "./prioritization";
import type { OrgChart, OrgHat } from "./org-chart";

/** How well a free option actually does the job. */
export const Adequacy = {
  /** It does the job. This is the only kind that can beat paying. */
  Adequate: "adequate",
  /** It does part of the job. Recorded as considered, and it loses. */
  Partial: "partial",
  /** It does not do the job. */
  Inadequate: "inadequate",
} as const;

export type Adequacy = (typeof Adequacy)[keyof typeof Adequacy];

/**
 * What a free path costs in work, ORDINALLY.
 *
 * Ordinal rather than a number of days, because a day estimate invites arithmetic against money and
 * that arithmetic needs a rate nobody in this register has declared. Comparing "moderate effort" to
 * "£400 a year" honestly requires a judgement, and the judgement is `effortTolerance` — stated once,
 * as policy, instead of hidden inside a conversion factor.
 */
export const EffortClass = {
  Trivial: "trivial",
  Small: "small",
  Moderate: "moderate",
  Large: "large",
} as const;

export type EffortClass = (typeof EffortClass)[keyof typeof EffortClass];

/** Least effort first. The single source of the ordering. */
export const EFFORT_ORDER: readonly EffortClass[] = [
  EffortClass.Trivial,
  EffortClass.Small,
  EffortClass.Moderate,
  EffortClass.Large,
];

export function effortRank(effort: EffortClass): number {
  return EFFORT_ORDER.indexOf(effort);
}

export interface FreeAlternative {
  /** What it is — "postgres full-text search", "the ripgrep we already ship". */
  readonly what: string;
  readonly adequacy: Adequacy;
  readonly effort: EffortClass;
  /** What it does not cover. Required for anything short of adequate; see `decideSpend`. */
  readonly shortfall?: string;
}

/**
 * Whether anybody looked for a free way, and what they found.
 *
 * A discriminated union rather than an optional list, so "found none" and "did not look" cannot be
 * the same value. An empty array under `searched` is a RESULT; `not_searched` is the absence of
 * one, and this module refuses to rule on the second.
 */
export type AlternativeSearch =
  | { readonly kind: "searched"; readonly found: readonly FreeAlternative[] }
  | { readonly kind: "not_searched"; readonly why: string };

export interface SpendProposal {
  readonly proposalId: string;
  /** The work this would be bought for. Spend is always FOR something. */
  readonly workId: string;
  readonly what: string;
  /** In the budget's own unit, so two budgets cannot be compared by accident. */
  readonly cost: number;
  readonly proposedByHatId: string;
  readonly search: AlternativeSearch;
}

/**
 * Where the work this money is for currently stands.
 *
 * Three states, and the middle one is why this exists. A proposal for work that has FINISHED is not
 * a proposal waiting on a price — there is nothing left to buy for, and ruling it `not worth it` is
 * the true answer rather than a stall. Measured: a proposal for a memory tool waited three
 * simulated days while its goal was decomposed, delivered and superseded, and would have waited
 * forever, because the price it was waiting on stops being offered the moment work completes.
 *
 * `Unknown` is the proposer pointing at nothing, which is their error and comes back to them.
 */
export const WorkStanding = {
  Live: "live",
  Finished: "finished",
  Unknown: "unknown",
} as const;

export type WorkStanding = (typeof WorkStanding)[keyof typeof WorkStanding];

export const SpendVerdict = {
  /** Pay. No free way does the job, the work is worth it, and the budget covers it. */
  Approved: "approved",
  /** Do not pay — a free option does the job for an effort the organization accepts. */
  UseFreeAlternative: "use_free_alternative",
  /** Do not pay, and do not do it this way. The work is deprioritised, or the money is not there. */
  NotWorthIt: "not_worth_it",
  /**
   * Sent back: the proposer has not supplied what a decision needs.
   *
   * ── WHY THIS IS A VERDICT AND NOT A REFUSAL ─────────────────────────────
   * It was a refusal first, and that was wrong twice over. As a pure function, "I was not given
   * what I need" is not a decision — but at the level of an organization, HANDING IT BACK IS ONE.
   * The CFO looked, saw no search for a free way, and said so to the hat that asked. That is an act,
   * it reaches somebody who can do something about it, and it belongs in the record.
   *
   * And as a refusal it produced this drive's fifth livelock. A refused act leaves its own opening
   * standing, so the CFO was offered the same unsearched proposal every round forever — and because
   * the menu is ordinal, `sp-transcription` sorted ahead of `sp-vector-db` and the second proposal
   * was never reached at all. One malformed request starved every well-formed one behind it.
   */
  Returned: "returned",
} as const;

export type SpendVerdict = (typeof SpendVerdict)[keyof typeof SpendVerdict];

/** One alternative, and the reason it did not win. */
export interface ConsideredAlternative {
  readonly alternative: FreeAlternative;
  readonly lostBecause: string;
}

export interface SpendRuling {
  readonly proposalId: string;
  readonly verdict: SpendVerdict;
  readonly byHatId: string;
  readonly reason: string;
  /** The free option that won, when one did. */
  readonly instead?: FreeAlternative;
  /**
   * Every alternative that was weighed and why it lost — INCLUDING when one won.
   *
   * The record of the reasoning, not a debugging aid. A ruling that said only "approved" would be
   * indistinguishable a month later from one where the CFO never opened the list.
   */
  readonly considered: readonly ConsideredAlternative[];
  /** What this ruling commits, in the budget's unit. Zero unless it approved. */
  readonly charged: number;
}

export type SpendResult =
  | { readonly ok: true; readonly ruling: SpendRuling }
  | { readonly ok: false; readonly reason: string };

/**
 * The hats this chart has that may rule on money, most specific first.
 *
 * Read from `blocker-taxonomy`'s `budget_exceeded` policy rather than declared again here. That
 * policy already names the CFO, then the program director, then the board, and already skips hats a
 * chart does not have — so an organization with no CFO routes to whoever it does have instead of to
 * a hat nobody can be.
 */
export function financeAuthorities(chart: OrgChart): readonly OrgHat[] {
  return ownersFor(chart, BlockerKind.BudgetExceeded);
}

/** Work the organization has decided not to push on. Buying for it is buying for a shelf. */
const DEPRIORITISED: ReadonlySet<PriorityClass> = new Set([PriorityClass.Defer, PriorityClass.Paused]);

export interface SpendInput {
  readonly chart: OrgChart;
  readonly proposal: SpendProposal;
  readonly byHatId: string;
  /** Absent means no budget was declared — see the `Unbudgeted` refusal below. */
  readonly budget: Budget | undefined;
  readonly nowMs: number;
  /** What the organization decided this work is worth. Absent is a refusal, not a default. */
  readonly priority: PriorityClass | undefined;
  /**
   * The most effort a free path may cost before paying becomes the better answer.
   *
   * REQUIRED, and stated by the organization rather than defaulted here. It is the one genuinely
   * subjective input — the exchange rate between somebody's week and a subscription — and a module
   * that picked it silently would be making the company's spending policy on its behalf.
   */
  readonly effortTolerance: EffortClass;
  /** Whether the work still has anything left to do. See `WorkStanding`. */
  readonly standing: WorkStanding;
}

/**
 * Rule on a spend proposal.
 *
 * The refusals come first and none of them is a verdict: a refusal means the decider was not given
 * what a decision needs, which is a different thing from deciding against.
 */
export function decideSpend(input: SpendInput): SpendResult {
  const { chart, proposal, byHatId } = input;

  const decider = chart.byId.get(byHatId);
  if (decider === undefined) return { ok: false, reason: `unknown hat '${byHatId}'` };

  const authorities = financeAuthorities(chart);
  if (!authorities.some((h) => h.id === byHatId)) {
    return {
      ok: false,
      reason:
        `'${byHatId}' does not hold the money: spend is ruled on by ` +
        `${authorities.map((h) => `'${h.id}'`).join(", ") || "nobody in this chart"}`,
    };
  }

  // SEPARATION OF DUTIES, the same rule the quality gates apply to reviews. A hat approving its own
  // purchase is a proposal with a rubber stamp attached, and the record would not show the
  // difference.
  if (proposal.proposedByHatId === byHatId) {
    return { ok: false, reason: `'${byHatId}' proposed this; it cannot also rule on it` };
  }

  if (!Number.isFinite(proposal.cost) || proposal.cost <= 0) {
    return {
      ok: false,
      reason: `'${proposal.proposalId}' costs ${String(proposal.cost)}, which is not a spend decision`,
    };
  }

  // THE FORCING FUNCTION, and it comes back to the proposer rather than stopping here. Guessing
  // either way would put an answer in the record that nobody arrived at; handing it back says what
  // is missing to the hat that can supply it.
  const returned = (reason: string): SpendResult => ({
    ok: true,
    ruling: {
      proposalId: proposal.proposalId,
      verdict: SpendVerdict.Returned,
      byHatId,
      reason,
      considered: [],
      charged: 0,
    },
  });

  if (proposal.search.kind === "not_searched") {
    return returned(
      `no free alternative was looked for (${proposal.search.why}) — ` +
        "find out whether this can be done free before asking to pay for it",
    );
  }

  // A SHORTFALL IS REQUIRED WHERE THERE IS ONE. "Partly adequate" with no account of what is
  // missing is an opinion, and the ruling below is about to hold it against the alternative.
  const unexplained = proposal.search.found.find(
    (a) => a.adequacy !== Adequacy.Adequate && (a.shortfall === undefined || a.shortfall.trim() === ""),
  );
  if (unexplained !== undefined) {
    return returned(`'${unexplained.what}' is ${unexplained.adequacy} and does not say what it fails to cover`);
  }

  if (input.standing === WorkStanding.Unknown) {
    return returned(`'${proposal.workId}' is not work this organization holds`);
  }

  // FINISHED WORK IS NOT WORTH BUYING FOR, and this is a verdict rather than a wait. A proposal
  // whose work completed while it sat in the queue has been answered by events; leaving it open
  // would have it wait for a price that will never be set, because pricing is only ever offered on
  // work that is still live.
  if (input.standing === WorkStanding.Finished) {
    return {
      ok: true,
      ruling: {
        proposalId: proposal.proposalId,
        verdict: SpendVerdict.NotWorthIt,
        byHatId,
        reason: `'${proposal.workId}' is finished; there is nothing left to buy for`,
        considered: [],
        charged: 0,
      },
    };
  }

  if (input.priority === undefined) {
    return returned(
      `'${proposal.workId}' has no decided priority — ` +
        "whether paying is worth it cannot be weighed against work nobody has valued",
    );
  }

  const budgetVerdict = checkBudget(input.budget, proposal.cost, input.nowMs);
  if (budgetVerdict.decision === BudgetDecision.Unbudgeted) {
    // NOT AN APPROVAL. Ruling on affordability nobody checked is what makes a budget decorative,
    // and `budget.ts` went to some trouble to make this its own answer rather than either other one.
    return { ok: false, reason: `no budget was declared, so '${proposal.proposalId}' cannot be ruled on` };
  }

  // ── THE FREE WAY IS CONSIDERED FIRST ──────────────────────────────────────
  // Deliberately before affordability and before worth. A free option that does the job wins even
  // when the money is there and the work is urgent, because spending is the fallback and not the
  // default — which is the whole policy this module was asked for.
  const considered: ConsideredAlternative[] = [];
  const winners: FreeAlternative[] = [];
  for (const alternative of proposal.search.found) {
    if (alternative.adequacy !== Adequacy.Adequate) {
      considered.push({
        alternative,
        lostBecause: `${alternative.adequacy}: ${alternative.shortfall ?? ""}`,
      });
      continue;
    }
    if (effortRank(alternative.effort) > effortRank(input.effortTolerance)) {
      considered.push({
        alternative,
        lostBecause: `${alternative.effort} effort, and this organization accepts up to ${input.effortTolerance}`,
      });
      continue;
    }
    winners.push(alternative);
  }

  // LEAST EFFORT FIRST, then ORDINAL by name — never the order the proposer happened to list them
  // in, which would make the answer depend on how somebody typed up their research.
  const instead = [...winners].sort((a, b) => {
    const byEffort = effortRank(a.effort) - effortRank(b.effort);
    if (byEffort !== 0) return byEffort;
    return a.what < b.what ? -1 : a.what > b.what ? 1 : 0;
  })[0];

  if (instead !== undefined) {
    return {
      ok: true,
      ruling: {
        proposalId: proposal.proposalId,
        verdict: SpendVerdict.UseFreeAlternative,
        byHatId,
        reason: `'${instead.what}' does the job for ${instead.effort} effort; not paying for '${proposal.what}'`,
        instead,
        considered,
        charged: 0,
      },
    };
  }

  if (DEPRIORITISED.has(input.priority)) {
    return {
      ok: true,
      ruling: {
        proposalId: proposal.proposalId,
        verdict: SpendVerdict.NotWorthIt,
        byHatId,
        reason: `'${proposal.workId}' is ${input.priority}; the organization is not spending on work it has set aside`,
        considered,
        charged: 0,
      },
    };
  }

  if (budgetVerdict.decision === BudgetDecision.Refused) {
    return {
      ok: true,
      ruling: {
        proposalId: proposal.proposalId,
        verdict: SpendVerdict.NotWorthIt,
        byHatId,
        reason: budgetVerdict.reason,
        considered,
        charged: 0,
      },
    };
  }

  return {
    ok: true,
    ruling: {
      proposalId: proposal.proposalId,
      verdict: SpendVerdict.Approved,
      byHatId,
      // The reason SAYS WHAT THE FREE OPTIONS WERE. "Approved" alone is the answer that reads the
      // same whether or not anybody looked, which is what this module exists to prevent.
      reason:
        considered.length === 0
          ? `no free way was found and '${proposal.workId}' is ${input.priority}`
          : `${String(considered.length)} free option(s) were weighed and none does the job; ` +
            `'${proposal.workId}' is ${input.priority}`,
      considered,
      charged: proposal.cost,
    },
  };
}

/**
 * What the cost gate says about a piece of work — derived, never judged.
 *
 * ── THE RULE THE CFO IS FOR ──────────────────────────────────────────────────
 * Every architecture reaches the hat that holds the money before anything is built against it, and
 * the question is only ever the same one: does this cost anything, and if so has it been ruled on?
 *
 *   nothing proposed        -> WAIVED. The gate does not apply, and the record SAYS it did not.
 *   proposed, not ruled     -> CHANGES REQUESTED. The CFO has not been asked yet, or has not answered.
 *   returned                -> CHANGES REQUESTED. The proposer owes a free-alternative search.
 *   not worth it            -> CHANGES REQUESTED. Design it another way; this way is not funded.
 *   approved / use the free -> APPROVED, naming which.
 *
 * ── WHY `Waived` AND NOT `Approved` FOR THE NO-COST CASE ─────────────────────
 * "There was nothing to rule on" and "the spending was approved" are different facts, and they are
 * the two halves of this register's oldest defect: a control that did not apply and a control that
 * passed, rendered identically. `PASSING` already treats both as letting work through, so the
 * distinction costs nothing and survives into the evaluation record.
 *
 * The user's phrasing was that a document with no price implication may "bypass / no-op". This is
 * that bypass, made visible — the difference between skipping a step and recording that the step
 * had nothing to do is the whole of an audit trail.
 */
export function costGateOutcome(
  workId: string,
  proposals: readonly SpendProposal[],
  rulings: ReadonlyMap<string, SpendVerdict>,
): { readonly outcome: GateOutcome; readonly reason: string } {
  const mine = proposals.filter((p) => p.workId === workId);
  if (mine.length === 0) {
    return { outcome: GateOutcome.Waived, reason: `'${workId}' implies no cost; there is nothing to rule on` };
  }

  // ORDINAL BY PROPOSAL ID, so a run reports the same blocker every time rather than whichever
  // proposal happened to be listed first.
  const sorted = [...mine].sort((a, b) => (a.proposalId < b.proposalId ? -1 : a.proposalId > b.proposalId ? 1 : 0));

  for (const proposal of sorted) {
    const verdict = rulings.get(proposal.proposalId);
    if (verdict === undefined) {
      return {
        outcome: GateOutcome.ChangesRequested,
        reason: `'${proposal.proposalId}' (${proposal.what}) has not been ruled on`,
      };
    }
    if (verdict === SpendVerdict.Returned) {
      return {
        outcome: GateOutcome.ChangesRequested,
        reason: `'${proposal.proposalId}' was sent back to '${proposal.proposedByHatId}'`,
      };
    }
    if (verdict === SpendVerdict.NotWorthIt) {
      // CHANGES REQUESTED RATHER THAN REJECTED, and the difference is what the author should do
      // next. The design is not wrong; the way it spends money is, and there may be another way.
      return {
        outcome: GateOutcome.ChangesRequested,
        reason: `'${proposal.what}' is not funded — design it another way`,
      };
    }
  }

  const free = sorted.filter((p) => rulings.get(p.proposalId) === SpendVerdict.UseFreeAlternative).length;
  const paid = sorted.length - free;
  return {
    outcome: GateOutcome.Approved,
    reason: `${String(paid)} purchase(s) approved and ${String(free)} replaced by a free alternative`,
  };
}

/**
 * Which of the cost gate's owners actually evaluates it — MOST SPECIFIC FIRST.
 *
 * `runGateChain` defaults to `owners[0]`, and `gateOwners` returns them in CHART DECLARATION ORDER.
 * That put the Executive Board on every cost gate in this seed, because the board is the first hat
 * declared — the same "whichever was listed first" defect this register has now corrected in
 * routing, in rung ownership and in alternative ranking, arriving a fourth time through a default
 * nobody had looked at.
 *
 * `financeAuthorities` already orders them: the CFO, then the program director, then the board. A
 * cost is ruled on by the nearest hat that holds the money, and the board is where it goes when the
 * nearer ones are the author or absent — which is what most-specific-first means everywhere else
 * here.
 *
 * EXPORTED BECAUSE TWO CALLERS RUN THE CHAIN — the drive and `org-cycle.ts` — and a preference
 * expressed twice is a preference that can disagree with itself.
 */
export function costGateEvaluator(chart: OrgChart, owners: readonly OrgHat[]): OrgHat | undefined {
  const eligible = new Set(owners.map((h) => h.id));
  return financeAuthorities(chart).find((h) => eligible.has(h.id));
}
