/**
 * self-claims.test.ts — probabilistic liveness via self-claims.
 */

import { describe, test, expect } from "bun:test";
import {
  computeReliability,
  recordClaim,
  markClaimMet,
  markClaimMissed,
  resolveAtTick,
  schedulingWindowForDependency,
  EMPTY_LEDGER,
  type SelfClaim,
  type ResolvedClaim,
} from "./self-claims";

const agentA = "alexa";
const agentB = "otto";

function makeClaim(agentId: string, itemId: string, deadline: number, claimedAt = 0): SelfClaim {
  return { agentId, itemId, title: `Deliver ${itemId}`, deadline, claimedAt };
}

describe("computeReliability — track record → reliability score", () => {
  test("no claims = undefined reliability, neutral window (1.0)", () => {
    const score = computeReliability(agentA, []);
    expect(score.reliability).toBeUndefined();
    expect(score.windowMultiplier).toBe(1.0);
    expect(score.totalClaims).toBe(0);
  });

  test("all claims met = reliability 1.0, max window (1.5)", () => {
    const resolved: ResolvedClaim[] = [
      { claim: makeClaim(agentA, "x", 10), outcome: { status: "met", completedAt: 8 } },
      { claim: makeClaim(agentA, "y", 20), outcome: { status: "met", completedAt: 18 } },
      { claim: makeClaim(agentA, "z", 30), outcome: { status: "met", completedAt: 25 } },
    ];
    const score = computeReliability(agentA, resolved);
    expect(score.reliability).toBe(1.0);
    expect(score.windowMultiplier).toBe(1.5);
    expect(score.metClaims).toBe(3);
    expect(score.missedClaims).toBe(0);
  });

  test("all claims missed = reliability 0.0, floor window (0.5)", () => {
    const resolved: ResolvedClaim[] = [
      { claim: makeClaim(agentA, "x", 10), outcome: { status: "missed" } },
      { claim: makeClaim(agentA, "y", 20), outcome: { status: "missed" } },
    ];
    const score = computeReliability(agentA, resolved);
    expect(score.reliability).toBe(0);
    expect(score.windowMultiplier).toBe(0.5); // floor
  });

  test("mixed: 3 met, 1 missed = reliability 0.75, window 1.25", () => {
    const resolved: ResolvedClaim[] = [
      { claim: makeClaim(agentA, "a", 10), outcome: { status: "met", completedAt: 9 } },
      { claim: makeClaim(agentA, "b", 20), outcome: { status: "met", completedAt: 15 } },
      { claim: makeClaim(agentA, "c", 30), outcome: { status: "met", completedAt: 28 } },
      { claim: makeClaim(agentA, "d", 40), outcome: { status: "missed" } },
    ];
    const score = computeReliability(agentA, resolved);
    expect(score.reliability).toBe(0.75);
    expect(score.windowMultiplier).toBe(1.25); // 1 + (0.75 - 0.5)
  });

  test("pending claims don't count toward reliability ratio", () => {
    const resolved: ResolvedClaim[] = [
      { claim: makeClaim(agentA, "a", 10), outcome: { status: "met", completedAt: 9 } },
      { claim: makeClaim(agentA, "b", 100), outcome: { status: "pending" } },
    ];
    const score = computeReliability(agentA, resolved);
    expect(score.reliability).toBe(1.0); // 1 met / (1 met + 0 missed)
    expect(score.pendingClaims).toBe(1);
  });

  test("only counts claims from the specified agent", () => {
    const resolved: ResolvedClaim[] = [
      { claim: makeClaim(agentA, "a", 10), outcome: { status: "met", completedAt: 9 } },
      { claim: makeClaim(agentB, "b", 10), outcome: { status: "missed" } },
    ];
    const scoreA = computeReliability(agentA, resolved);
    const scoreB = computeReliability(agentB, resolved);
    expect(scoreA.reliability).toBe(1.0);
    expect(scoreB.reliability).toBe(0);
  });
});

describe("ClaimsLedger — event-sourced claims tracking", () => {
  test("recordClaim adds to ledger with pending outcome", () => {
    const claim = makeClaim(agentA, "item-1", 50, 10);
    const ledger = recordClaim(EMPTY_LEDGER, claim);
    expect(ledger.claims).toHaveLength(1);
    expect(ledger.resolved).toHaveLength(1);
    expect(ledger.resolved[0]!.outcome.status).toBe("pending");
  });

  test("markClaimMet resolves a pending claim", () => {
    const claim = makeClaim(agentA, "item-1", 50, 10);
    let ledger = recordClaim(EMPTY_LEDGER, claim);
    ledger = markClaimMet(ledger, "item-1", agentA, 45);
    expect(ledger.resolved[0]!.outcome.status).toBe("met");
    if (ledger.resolved[0]!.outcome.status === "met") {
      expect(ledger.resolved[0]!.outcome.completedAt).toBe(45);
    }
  });

  test("markClaimMissed resolves a pending claim with reason", () => {
    const claim = makeClaim(agentA, "item-1", 50, 10);
    let ledger = recordClaim(EMPTY_LEDGER, claim);
    ledger = markClaimMissed(ledger, "item-1", agentA, "blocked by dependency");
    expect(ledger.resolved[0]!.outcome.status).toBe("missed");
  });

  test("resolveAtTick auto-resolves based on completedItems + deadline", () => {
    let ledger = EMPTY_LEDGER;
    ledger = recordClaim(ledger, makeClaim(agentA, "done", 50, 10));  // will be in completedItems
    ledger = recordClaim(ledger, makeClaim(agentA, "late", 30, 10));  // deadline passed
    ledger = recordClaim(ledger, makeClaim(agentA, "future", 100, 10)); // still pending

    const completed = new Set(["done"]);
    ledger = resolveAtTick(ledger, 60, completed);

    const outcomes = ledger.resolved.map((r) => ({ id: r.claim.itemId, status: r.outcome.status }));
    expect(outcomes).toEqual([
      { id: "done", status: "met" },
      { id: "late", status: "missed" },
      { id: "future", status: "pending" }, // deadline=100, current=60 → still pending
    ]);
  });
});

describe("schedulingWindowForDependency — trust → scheduling", () => {
  test("high reliability (1.0) → 1.5x base window", () => {
    const score = computeReliability(agentA, [
      { claim: makeClaim(agentA, "x", 10), outcome: { status: "met", completedAt: 8 } },
    ]);
    expect(schedulingWindowForDependency(score, 100)).toBe(150);
  });

  test("no track record → 1.0x base window (neutral)", () => {
    const score = computeReliability(agentA, []);
    expect(schedulingWindowForDependency(score, 100)).toBe(100);
  });

  test("low reliability (0.0) → 0.5x base window (floor)", () => {
    const score = computeReliability(agentA, [
      { claim: makeClaim(agentA, "x", 10), outcome: { status: "missed" } },
    ]);
    expect(schedulingWindowForDependency(score, 100)).toBe(50);
  });

  test("the earned window grows with consistent delivery", () => {
    // Simulate building track record over time
    const claims: ResolvedClaim[] = [];
    const windows: number[] = [];

    for (let i = 1; i <= 10; i++) {
      claims.push({
        claim: makeClaim(agentA, `item-${i}`, i * 10),
        outcome: { status: "met", completedAt: i * 10 - 2 },
      });
      const score = computeReliability(agentA, claims);
      windows.push(schedulingWindowForDependency(score, 100));
    }

    // Window should be stable at 150 (max) after first claim at 100% reliability
    expect(windows[0]).toBe(150);
    expect(windows[9]).toBe(150);
    // All the same because reliability stays 1.0 throughout
    expect(new Set(windows).size).toBe(1);
  });
});
