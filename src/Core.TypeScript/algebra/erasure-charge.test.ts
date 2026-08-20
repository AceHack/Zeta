import { describe, test, expect } from "bun:test";
import { createEntropyTracker, auditEntropyLedger, readHeat } from "./entropy-tracker.ts";
import type { ErasureProfile } from "./erasure-class.ts";
import { dispositionOf, postToTracker, settle, settleAll } from "./erasure-charge.ts";

// ═══════════════════════════════════════════════════════════════════════════
// THE CHARGE SIDE, TypeScript oracle.
//
// These fixtures are the SAME three profiles the F# pack uses
// (`tests/Tests.FSharp/Formal/Erasure.Charge.Laws.Tests.fs`), with the same expected dispositions.
// Two independent implementations of one rule, asserted against one set of inputs: a divergence in
// either is caught by the other, which is what makes this evidence rather than a claim (BP-16).
// ═══════════════════════════════════════════════════════════════════════════

const erasingProfile: ErasureProfile = {
  representation: "Fixture",
  operation: "collapse",
  observation: "the returned value",
  recoveryChannel: "nothing",
  classification: "erasing",
  evidence: { kind: "exhaustive-sweep", domain: "a four-point domain", largestFibre: 4, bitsErasedPpm: 2_000_000 },
};

const reversibleProfile: ErasureProfile = {
  representation: "Fixture",
  operation: "relabel",
  observation: "the returned value",
  recoveryChannel: "everything — the operation is a bijection",
  classification: "reversible",
  evidence: { kind: "exhaustive-sweep", domain: "a four-point domain", largestFibre: 1, bitsErasedPpm: 0 },
};

const unmeasuredProfile: ErasureProfile = {
  representation: "Fixture",
  operation: "vanish",
  observation: "the returned value",
  recoveryChannel: "unknown",
  classification: "unmeasured",
  evidence: { kind: "no-admissible-measurement", reason: "nobody has swept this" },
};

describe("dispositionOf — derived from the classification, never from a name", () => {
  test("renaming every string field cannot change the charge", () => {
    const garble = (p: ErasureProfile): ErasureProfile => ({
      ...p,
      representation: "zzzz-not-a-real-representation",
      operation: "zzzz-not-a-real-operation",
      observation: "zzzz-not-a-real-observation",
    });
    for (const p of [erasingProfile, reversibleProfile, unmeasuredProfile]) {
      expect(dispositionOf(garble(p))).toEqual(dispositionOf(p));
    }
  });

  test("the three classes map to three distinct dispositions — matching the F# oracle", () => {
    expect(dispositionOf(erasingProfile)).toEqual({ kind: "charged", bitsPpm: 2_000_000 });
    expect(dispositionOf(reversibleProfile)).toEqual({ kind: "free" });
    expect(dispositionOf(unmeasuredProfile)).toEqual({ kind: "unmeasured", reason: "nobody has swept this" });
  });

  test("a `reversible` declaration over a wide fibre is malformed, not free", () => {
    const lying: ErasureProfile = {
      ...reversibleProfile,
      evidence: { kind: "exhaustive-sweep", domain: "a four-point domain", largestFibre: 4, bitsErasedPpm: 2_000_000 },
    };
    expect(dispositionOf(lying).kind).toBe("malformed");
  });

  test("`unmeasured` with a blank reason is malformed — a hole must say why it is a hole", () => {
    const blank: ErasureProfile = {
      ...unmeasuredProfile,
      evidence: { kind: "no-admissible-measurement", reason: "   " },
    };
    expect(dispositionOf(blank).kind).toBe("malformed");
  });
});

describe("settle — an unknown cost is not a zero cost", () => {
  test("a reversible-only fold is complete; an unmeasured-only fold is not, and both total zero", () => {
    const rev = settle([reversibleProfile]);
    const unk = settle([unmeasuredProfile]);
    expect(rev.bitsPpm).toBe(0);
    expect(unk.bitsPpm).toBe(0);
    // Same number, opposite meaning — and the difference is in the returned value.
    expect(rev.complete).toBe(true);
    expect(unk.complete).toBe(false);
    expect(unk.holes[0]?.why).toContain("nobody has swept this");
  });

  test("one hole makes the reading a lower bound and the measured charge survives inside it", () => {
    const r = settle([erasingProfile, reversibleProfile, unmeasuredProfile]);
    expect(r.bitsPpm).toBe(2_000_000);
    expect(r.complete).toBe(false);
    expect(r.chargedPostings).toBe(1);
    expect(r.freePostings).toBe(1);
    expect(r.holePostings).toBe(1);
  });

  test("hole identity is keyed and hole use is counted", () => {
    const r = settle([unmeasuredProfile, unmeasuredProfile, unmeasuredProfile]);
    expect(r.holes.length).toBe(1);
    expect(r.holePostings).toBe(3);
  });

  test("repeated charges accumulate — a posting is an invocation, not a declaration", () => {
    expect(settle([erasingProfile, erasingProfile]).bitsPpm).toBe(4_000_000);
  });
});

describe("settleAll — bits are never summed across observations", () => {
  test("two observations of one operation settle separately", () => {
    const readSurface: ErasureProfile = { ...erasingProfile, observation: "the log's own read surface" };
    const commitDag: ErasureProfile = { ...reversibleProfile, observation: "the commit DAG including the parent edge" };
    const readings = settleAll([readSurface, commitDag]);
    expect(readings.size).toBe(2);
    expect(readings.get("the log's own read surface")?.bitsPpm).toBe(2_000_000);
    expect(readings.get("the commit DAG including the parent edge")?.bitsPpm).toBe(0);
  });
});

describe("postToTracker — the wire from the classification to the two-ledger meter", () => {
  test("an erasing profile charges its MEASURED bits, not a caller's constant", () => {
    const t = createEntropyTracker();
    postToTracker(t, erasingProfile);
    expect(readHeat(t)).toEqual({ bitsErased: 2, complete: true, holes: [] });
  });

  test("a reversible profile goes through the permutation door — zero heat, zero holes", () => {
    const t = createEntropyTracker();
    postToTracker(t, reversibleProfile);
    const audit = auditEntropyLedger(t);
    expect(audit.heatPaid).toBe(0);
    // The DOOR matters, not just the zero: a measured bijection must not be recorded as a
    // measurement of zero bits, or the two zeros become indistinguishable again one layer down.
    expect(t.state.hard_measurements).toBe(0);
    expect(t.state.unmeasured_operations).toBe(0);
    expect(audit.chargeComplete).toBe(true);
  });

  test("an unmeasured profile goes through the UNMEASURED door — the ledger reports incomplete forever", () => {
    const t = createEntropyTracker();
    postToTracker(t, unmeasuredProfile);
    const audit = auditEntropyLedger(t);
    expect(audit.heatPaid).toBe(0);
    expect(audit.chargeComplete).toBe(false);
    expect(audit.unmeasuredReasons[0]).toContain("nobody has swept this");
    // …and it stays incomplete after a genuine charge lands on top of it.
    postToTracker(t, erasingProfile);
    expect(readHeat(t)).toEqual({
      bitsErased: 2,
      complete: false,
      holes: auditEntropyLedger(t).unmeasuredReasons,
    });
  });

  test("a malformed declaration fails CLOSED — into the hole set, never into free", () => {
    const t = createEntropyTracker();
    const lying: ErasureProfile = {
      ...reversibleProfile,
      evidence: { kind: "exhaustive-sweep", domain: "d", largestFibre: 4, bitsErasedPpm: 2_000_000 },
    };
    postToTracker(t, lying);
    expect(auditEntropyLedger(t).chargeComplete).toBe(false);
    expect(auditEntropyLedger(t).unmeasuredReasons[0]).toContain("malformed declaration");
  });
});
