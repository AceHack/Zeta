/**
 * budget.test.ts — an undeclared budget is not an unlimited one.
 *
 * The interesting tests here are not "does subtraction work". They are the three states, and the
 * two places a budget quietly stops being a limit: reading `Unbudgeted` as permission, and a
 * retried action being billed twice until the budget refuses work the organization was entitled to.
 */

import { describe, expect, test } from "bun:test";
import {
  BudgetDecision,
  checkBudget,
  isOpen,
  isOverrun,
  openBudget,
  remainingOf,
  spend,
} from "./budget";

const NOW = 1_000;
const b = () =>
  openBudget({
    budgetId: "eng-q3",
    allowance: 100,
    unit: "agent-minutes",
    windowStartMs: 0,
    windowEndMs: 10_000,
  });

describe("THREE STATES — and the middle one is not permission", () => {
  test("no budget declared is UNBUDGETED, not admitted", () => {
    // The whole reason this is a three-state answer. Reading it as admission makes the hard limit
    // decorative; the caller has to see that no check happened.
    const v = checkBudget(undefined, 50, NOW);
    expect(v.decision).toBe(BudgetDecision.Unbudgeted);
    expect(v.decision).not.toBe(BudgetDecision.Admitted);
    expect(v.remaining).toBeUndefined();
    expect(v.reason).toContain("no budget check was performed");
  });

  test("...and it is not a refusal either", () => {
    // The other direction, which would stop every organization that has not set a budget yet and
    // read as a broken runtime rather than a missing declaration.
    expect(checkBudget(undefined, 50, NOW).decision).not.toBe(BudgetDecision.Refused);
  });

  test("a cost that fits is admitted", () => {
    const v = checkBudget(b(), 50, NOW);
    expect(v.decision).toBe(BudgetDecision.Admitted);
    expect(v.remaining).toBe(100);
  });

  test("A COST THAT DOES NOT FIT IS REFUSED — a hard limit, not advice", () => {
    const v = checkBudget(b(), 101, NOW);
    expect(v.decision).toBe(BudgetDecision.Refused);
    expect(v.reason).toContain("100 agent-minutes left");
  });

  test("exactly the remainder fits", () => {
    // The boundary. `>` not `>=`, so spending the last minute is allowed.
    expect(checkBudget(b(), 100, NOW).decision).toBe(BudgetDecision.Admitted);
  });
});

describe("an EXPIRED budget was declared — refused, never 'unbudgeted'", () => {
  test("a closed window refuses", () => {
    // Reporting expiry as "nobody declared one" would erase a decision somebody made.
    const v = checkBudget(b(), 1, 20_000);
    expect(v.decision).toBe(BudgetDecision.Refused);
    expect(v.reason).toContain("outside its window");
  });

  test("before the window opens is equally refused", () => {
    expect(checkBudget({ ...b(), windowStartMs: 5_000 }, 1, 1_000).decision).toBe(BudgetDecision.Refused);
  });

  test("the window is inclusive at both ends", () => {
    expect(isOpen(b(), 0)).toBe(true);
    expect(isOpen(b(), 10_000)).toBe(true);
    expect(isOpen(b(), 10_001)).toBe(false);
  });
});

describe("A NEGATIVE COST IS NOT A TOP-UP", () => {
  test("it is refused rather than admitted as trivially affordable", () => {
    // Without this, `-500 > remaining` is false and the admission path becomes a way to add
    // allowance sideways.
    expect(checkBudget(b(), -500, NOW).decision).toBe(BudgetDecision.Refused);
  });

  test("and spending one charges nothing", () => {
    const r = spend(b(), "k", -500);
    expect(r.charged).toBe(false);
    expect(r.budget.spent).toBe(0);
  });

  test("a non-finite cost is refused too", () => {
    expect(checkBudget(b(), Number.POSITIVE_INFINITY, NOW).decision).toBe(BudgetDecision.Refused);
    expect(checkBudget(b(), Number.NaN, NOW).decision).toBe(BudgetDecision.Refused);
  });
});

describe("SPENDING IS IDEMPOTENT — a retry is not a second charge", () => {
  test("the same key charges once", () => {
    // The property the retry path depends on. A budget that double-bills on recovery refuses work
    // the organization had every right to do.
    const first = spend(b(), "run-1", 30);
    const second = spend(first.budget, "run-1", 30);
    expect(first.charged).toBe(true);
    expect(second.charged).toBe(false);
    expect(second.budget.spent).toBe(30);
    expect(second.reason).toContain("already charged");
  });

  test("different keys both charge", () => {
    const one = spend(b(), "run-1", 30);
    const two = spend(one.budget, "run-2", 30);
    expect(two.budget.spent).toBe(60);
  });

  test("the input budget is never mutated", () => {
    const original = b();
    spend(original, "run-1", 30);
    expect(original.spent).toBe(0);
    expect(original.charged.size).toBe(0);
  });
});

describe("an OVERRUN is recordable, because hiding one is worse", () => {
  test("spending past the allowance is charged and reported", () => {
    // `spend` does not enforce admission on purpose: a cost already incurred must be recordable, or
    // a budget silently drops every overspend it experienced and reports a tidy fiction.
    const r = spend(b(), "big", 150);
    expect(r.charged).toBe(true);
    expect(isOverrun(r.budget)).toBe(true);
  });

  test("an over-spent budget has ZERO remaining, not a negative amount", () => {
    // A negative remainder would satisfy a `cost > remaining` comparison for small costs and let
    // spending continue past an overrun.
    const over = spend(b(), "big", 150).budget;
    expect(remainingOf(over)).toBe(0);
    expect(checkBudget(over, 1, NOW).decision).toBe(BudgetDecision.Refused);
  });

  test("a budget exactly at its allowance is not an overrun", () => {
    const exact = spend(b(), "all", 100).budget;
    expect(isOverrun(exact)).toBe(false);
    expect(remainingOf(exact)).toBe(0);
  });
});
