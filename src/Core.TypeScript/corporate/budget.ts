/**
 * budget.ts — "if budget is available" as something that can actually refuse.
 *
 * ── WHERE THE NORTH STAR PUTS IT ─────────────────────────────────────────────
 * `ALWAYS_ON_ORCHESTRATION_RUNTIME.md` names budget twice, in two different roles:
 *
 *   as a PRECONDITION   `TaskMarkedReady -> if hat supply can reserve implementer
 *                        -> IF BUDGET IS AVAILABLE -> create Hermes implementer run`
 *   as a HARD LIMIT     in the precedence ladder, above department policy and below the
 *                       architecture gate
 *
 * The register had neither. Work was dispatched with no notion of what it cost or what remained.
 *
 * ── THREE STATES, BECAUSE "NO BUDGET DECLARED" IS NOT "UNLIMITED" ────────────
 * This is the same discipline as everywhere else in the register, and budget is a place it is
 * unusually tempting to get wrong. An undeclared budget is not permission and it is not a refusal:
 *
 *   Admitted    a budget exists, and the cost fits inside what remains
 *   Refused     a budget exists, and the cost does not fit — a HARD limit, not advice
 *   Unbudgeted  nobody declared one, so no check was performed
 *
 * `Unbudgeted` is deliberately not a synonym for either. Treating it as admission makes the limit
 * decorative; treating it as refusal stops every organization that has not yet set a budget, which
 * would read as a broken runtime rather than as a missing declaration. So it is its own answer, the
 * caller decides what to do with it, and — this is the part that matters — a run in which it
 * occurred SAYS SO, exactly as an unchecked reconciliation party does.
 *
 * ── SPENDING IS IDEMPOTENT ───────────────────────────────────────────────────
 * `spend` is keyed. Applying the same spend twice charges once, because a retried action must not
 * be billed again — the retry is how a distributed runtime recovers, and a budget that double-bills
 * on recovery would refuse work the organization had every right to do.
 */

/** A declared allowance over a window. Every field stated; nothing inferred. */
export interface Budget {
  readonly budgetId: string;
  /** What is allowed over this window, in `unit`. */
  readonly allowance: number;
  /** What has been charged so far. Never negative. */
  readonly spent: number;
  /** What the numbers MEAN — "agent-minutes", "usd", "runs". Carried so two budgets cannot be compared by accident. */
  readonly unit: string;
  readonly windowStartMs: number;
  readonly windowEndMs: number;
  /** Spend keys already charged, so a replay is not a second charge. */
  readonly charged: ReadonlySet<string>;
}

export const BudgetDecision = {
  Admitted: "admitted",
  Refused: "refused",
  /** No budget was declared, so no check happened. NOT permission, and NOT a refusal. */
  Unbudgeted: "unbudgeted",
} as const;

export type BudgetDecision = (typeof BudgetDecision)[keyof typeof BudgetDecision];

export interface BudgetVerdict {
  readonly decision: BudgetDecision;
  readonly reason: string;
  /** What was left before this cost. `undefined` when there is no budget to have a remainder. */
  readonly remaining: number | undefined;
}

export function remainingOf(budget: Budget): number {
  // Clamped at zero: an over-spent budget has nothing left rather than a negative amount, and a
  // negative remainder would quietly satisfy a `>= cost` comparison for negative costs.
  return Math.max(0, budget.allowance - budget.spent);
}

/** Is this budget's window open at `nowMs`? Inclusive of both ends. */
export function isOpen(budget: Budget, nowMs: number): boolean {
  return nowMs >= budget.windowStartMs && nowMs <= budget.windowEndMs;
}

/**
 * May an action costing `cost` proceed?
 *
 * A closed window REFUSES rather than reporting `Unbudgeted`: a budget that has expired is a budget
 * that was declared, and its expiry is a decision someone made. Reporting it as "nobody declared
 * one" would erase that decision and make an expired allowance look like a missing one.
 *
 * A negative cost is REFUSED. Nothing in this system legitimately costs less than nothing, and a
 * negative cost would otherwise be a way to top a budget up through the admission path.
 */
export function checkBudget(
  budget: Budget | undefined,
  cost: number,
  nowMs: number,
): BudgetVerdict {
  if (budget === undefined) {
    return {
      decision: BudgetDecision.Unbudgeted,
      reason: "no budget was declared, so no budget check was performed",
      remaining: undefined,
    };
  }
  if (!Number.isFinite(cost) || cost < 0) {
    return {
      decision: BudgetDecision.Refused,
      reason: `a cost of ${String(cost)} is not a cost`,
      remaining: remainingOf(budget),
    };
  }
  if (!isOpen(budget, nowMs)) {
    return {
      decision: BudgetDecision.Refused,
      reason: `budget '${budget.budgetId}' is outside its window`,
      remaining: remainingOf(budget),
    };
  }
  const remaining = remainingOf(budget);
  if (cost > remaining) {
    return {
      decision: BudgetDecision.Refused,
      reason:
        `budget '${budget.budgetId}' has ${String(remaining)} ${budget.unit} left ` +
        `and this costs ${String(cost)}`,
      remaining,
    };
  }
  return {
    decision: BudgetDecision.Admitted,
    reason: `${String(cost)} of ${String(remaining)} ${budget.unit} remaining`,
    remaining,
  };
}

/**
 * Charge a cost, once per key.
 *
 * Returns a NEW budget; the input is never mutated, so a caller holding the pre-spend value still
 * holds it. Re-spending an already-charged key returns the budget UNCHANGED and says so — the
 * idempotency the retry path depends on.
 *
 * It does not check admission. Charging and deciding are separate on purpose: a caller that wants
 * the limit enforced calls `checkBudget` first, and one that is recording an already-incurred cost
 * must be able to record an overrun rather than silently dropping it. A budget that could not go
 * over would hide every overspend it experienced.
 */
export function spend(
  budget: Budget,
  key: string,
  cost: number,
): { readonly budget: Budget; readonly charged: boolean; readonly reason: string } {
  if (budget.charged.has(key)) {
    return { budget, charged: false, reason: `'${key}' was already charged; not charged again` };
  }
  if (!Number.isFinite(cost) || cost < 0) {
    return { budget, charged: false, reason: `a cost of ${String(cost)} is not a cost; nothing charged` };
  }
  return {
    budget: {
      ...budget,
      spent: budget.spent + cost,
      charged: new Set([...budget.charged, key]),
    },
    charged: true,
    reason: `charged ${String(cost)} ${budget.unit} to '${budget.budgetId}'`,
  };
}

/** A budget with nothing spent yet. The only constructor, so `charged` cannot be forgotten. */
export function openBudget(input: {
  readonly budgetId: string;
  readonly allowance: number;
  readonly unit: string;
  readonly windowStartMs: number;
  readonly windowEndMs: number;
}): Budget {
  return { ...input, spent: 0, charged: new Set<string>() };
}

/**
 * True when the budget is spent past its allowance — an overrun that already happened.
 *
 * Distinct from `checkBudget` refusing: that is a cost being turned away at the door, this is money
 * already out. Both are worth reporting and they are not the same event.
 */
export function isOverrun(budget: Budget): boolean {
  return budget.spent > budget.allowance;
}
