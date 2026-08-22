/**
 * tick-budget.ts — an injected, attributed tick bound for the TS loops.
 *
 * The F# core already has this shape: `SimLoop.Budget` carries `MaxTicks` and
 * `SimLoop.run` receives it (`let maxTicks = max 1 budget.MaxTicks`) — the loop
 * never picks the number, it is handed one. `DarkHallScheduler` reads the same
 * field. This module is that shape for TypeScript.
 *
 * Why a record instead of a number: a bare `const maxTicks = 24` is a **hidden
 * oracle** — the bound silently decides how much work is allowed, and nobody is
 * on the record for choosing it. The discriminator is ATTRIBUTION, not
 * existence: a bound is necessary, an *unattributed* bound is the defect. So the
 * type refuses to carry a number without a `chosenBy` and a `rationale`, and the
 * rationale must answer "why THIS number", not "why a bound at all" — those are
 * different questions and only the first is ever in dispute.
 *
 * Anchor (Beacon): Goguen & Meseguer 1982, noninterference — influence enters
 * only through declared, metered channels. A tick bound *is* influence on the
 * result (it decides whether the loop finishes), so it must arrive through a
 * declared channel rather than ambiently from a literal in the loop body.
 */

/** A named, attributed bound on how many ticks a loop may take. */
export interface TickBudget {
  /** Short stable identifier, for logs and telemetry. */
  readonly name: string;
  /** The bound itself. Clamped to >= 1 at use — no field can disable its rail. */
  readonly maxTicks: number;
  /** Who chose this number. A budget nobody chose is the hidden oracle. */
  readonly chosenBy: string;
  /** Why THIS number — not why a bound exists. Must survive being read aloud. */
  readonly rationale: string;
}

/**
 * Clamp at use, mirroring `SimLoop.run`'s `max 1 budget.MaxTicks`: a caller
 * cannot hand in 0 or a negative and turn the rail off. There is no infinity.
 */
export function clampTicks(budget: TickBudget): number {
  return Math.max(1, Math.floor(budget.maxTicks));
}

/**
 * A budget is well-formed when someone is on the record for it. Exported so the
 * loops' own tests can assert their budgets are attributed rather than merely
 * present — the vacuity guard: a rationale field nothing checks is decoration.
 */
export function budgetIsAttributed(budget: TickBudget): boolean {
  return (
    budget.name.trim().length > 0 &&
    budget.chosenBy.trim().length > 0 &&
    budget.rationale.trim().length > 0 &&
    Number.isFinite(budget.maxTicks) &&
    budget.maxTicks >= 1
  );
}
