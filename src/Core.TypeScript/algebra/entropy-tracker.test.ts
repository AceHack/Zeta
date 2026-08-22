import { describe, test, expect } from "bun:test";
import {
  createEntropyTracker, auditEntropyLedger, accountFerryCommit, readHeat,
  LANDAUER_FLOOR_PER_BIT,
} from "./entropy-tracker";

describe("entropy-tracker — two-ledger Maxwell-Demon model", () => {
  test("initial state: zero entropy, second law satisfied", () => {
    const t = createEntropyTracker();
    expect(t.state.entropy_state).toBe(0);
    expect(t.state.entropy_heat).toBe(0);
    expect(t.state.second_law_satisfied).toBe(true);
  });

  test("branch: +1 bit uncertainty (Hadamard)", () => {
    const t = createEntropyTracker();
    t.branch();
    expect(t.state.entropy_state).toBe(1);
    expect(t.state.entropy_heat).toBe(0); // no heat for reversible op
    t.branch();
    expect(t.state.entropy_state).toBe(2); // two branches = 2 bits
    expect(t.state.bits_admitted).toBe(2);
  });

  test("observe (Adj): zero heat, just counts", () => {
    const t = createEntropyTracker();
    t.branch(); // create some uncertainty
    t.observe();
    t.observe();
    expect(t.state.soft_observations).toBe(2);
    expect(t.state.entropy_heat).toBe(0); // Adj = free (Bennett)
    expect(t.state.entropy_state).toBe(1); // unchanged
  });

  test("measure (non-Adj): entropy transfers from state to heat", () => {
    const t = createEntropyTracker();
    t.branch(); // +1 bit
    t.branch(); // +1 bit (total: 2 bits uncertainty)
    t.measure(1); // collapse 1 bit
    expect(t.state.entropy_state).toBe(1); // lost 1 bit from state
    expect(t.state.entropy_heat).toBe(1); // gained 1 bit in heat (Landauer)
    expect(t.state.hard_measurements).toBe(1);
    expect(t.state.bits_erased).toBe(1);
  });

  test("permutation: zero entropy change", () => {
    const t = createEntropyTracker();
    t.branch(); // +1
    t.permutation(); // mul/xorshr — bijective
    t.permutation();
    expect(t.state.entropy_state).toBe(1); // unchanged
    expect(t.state.entropy_heat).toBe(0); // no heat
  });

  test("full cycle: branch -> observe -> measure (demon reads then erases)", () => {
    const t = createEntropyTracker();
    t.branch(); // +1 bit uncertainty
    t.branch(); // +1 bit (support = 4 states)
    t.observe(); // read for free (Adj)
    t.observe(); // read again (still free)
    expect(t.state.soft_observations).toBe(2);
    expect(t.state.entropy_heat).toBe(0); // still no heat

    t.measure(2); // erase both bits
    expect(t.state.entropy_state).toBe(0); // fully collapsed
    expect(t.state.entropy_heat).toBe(2); // 2 bits of heat paid
    expect(t.state.second_law_satisfied).toBe(true);
  });

  test("reset re-baselines the heat-monotonicity watch", () => {
    const t = createEntropyTracker();
    t.measure(-1);
    expect(t.state.second_law_satisfied).toBe(false);
    t.reset();
    expect(t.state.second_law_satisfied).toBe(true);
    expect(t.state.bits_admitted).toBe(0);
    expect(t.state.bits_erased).toBe(0);
  });
});

// ═══ Anti-vacuity: every invariant below has a witness that makes it FALSE ═════
//
// A check that structurally cannot fail is worse than no check — it occupies the slot where a
// real one would go and reports success forever. The pre-2026-08-13 `verifyLandauer` was that
// defect: `holds` compared `entropy_heat` to `entropy_heat`, and `second_law_satisfied` tested a
// sum that no operation could decrease. These tests exist so that a future edit which makes any
// of the remaining invariants unfalsifiable FAILS here, loudly.

const OPS = ["branch", "observe", "permutation", "measure+", "measure-", "measureBig"] as const;
type Op = (typeof OPS)[number];

function runSequence(seq: readonly Op[]) {
  const t = createEntropyTracker();
  for (const o of seq) {
    if (o === "branch") t.branch();
    else if (o === "observe") t.observe();
    else if (o === "permutation") t.permutation();
    else if (o === "measure+") t.measure(1);
    else if (o === "measure-") t.measure(-3);
    else t.measure(9999);
  }
  return t;
}

function allSequences(maxLen: number): Op[][] {
  let frontier: Op[][] = [[]];
  const out: Op[][] = [];
  for (let d = 0; d < maxLen; d++) {
    const next: Op[][] = [];
    for (const s of frontier) for (const o of OPS) next.push([...s, o]);
    out.push(...next);
    frontier = next;
  }
  return out;
}

describe("entropy-tracker — anti-vacuity (each invariant has a false witness)", () => {
  test("second_law_satisfied is NOT structurally true — a sweep finds both values", () => {
    // The pre-change definition (state + heat >= 0) produced `false` ZERO times over this
    // exact sweep, because `measure` moves bits between ledgers and leaves the sum alone.
    // If someone restores a level test on the sum, this test fails.
    const seqs = allSequences(4);
    const values = new Set(seqs.map((s) => runSequence(s).state.second_law_satisfied));
    expect(values.has(false)).toBe(true);
    expect(values.has(true)).toBe(true);
  });

  test("heatMonotone is falsified by measure(k < 0) — heat cannot be un-paid", () => {
    const t = createEntropyTracker();
    t.branch(); t.measure(1);
    expect(auditEntropyLedger(t).heatMonotone).toBe(true);
    t.measure(-5); // refund 5 bits of heat: irreversibility violated
    expect(auditEntropyLedger(t).heatMonotone).toBe(false);
  });

  test("heatMonotone is sticky — a later legal measurement does not clear the violation", () => {
    const t = createEntropyTracker();
    t.measure(-5);
    t.measure(50);
    expect(t.state.entropy_heat).toBe(45); // heat is positive again
    expect(auditEntropyLedger(t).heatMonotone).toBe(false); // but the arrow of time broke
  });

  test("heatNonNegative is falsified by a net-negative measurement history", () => {
    const t = createEntropyTracker();
    t.measure(-5);
    const a = auditEntropyLedger(t);
    expect(a.heatPaid).toBe(-5);
    expect(a.heatNonNegative).toBe(false);
  });

  test("erasuresFullyAdmitted is falsified by erasing what was never admitted", () => {
    const t = createEntropyTracker();
    t.measure(1_000_000); // fresh tracker, nothing ever branched
    const a = auditEntropyLedger(t);
    expect(a.bitsAdmitted).toBe(0);
    expect(a.bitsErased).toBe(1_000_000);
    expect(a.unadmittedErasureBits).toBe(1_000_000);
    expect(a.erasuresFullyAdmitted).toBe(false);
    // ...and it is NOT rejected: the ledger still records the transfer. Reporting, not guarding.
    expect(t.state.entropy_state).toBe(-1_000_000);
  });

  test("the audit exposes no aggregate boolean — the aggregate is where the vacuity hid", () => {
    const t = createEntropyTracker();
    t.branch(); t.measure(1);
    expect(Object.keys(auditEntropyLedger(t))).not.toContain("holds");
  });

  test("landauerFloorBits === heatPaid is an IDENTITY, not a check", () => {
    // Stated as an identity on purpose. In normalized units the floor IS the heat, so any
    // comparison between them is `x >= x`. Asserting the identity over every sequence in the
    // sweep documents that there is nothing here to verify — and fails if someone silently
    // changes the floor scaling and leaves the docs claiming a bound was checked.
    for (const s of allSequences(3)) {
      const a = auditEntropyLedger(runSequence(s));
      expect(a.landauerFloorBits).toBe(a.heatPaid);
      expect(LANDAUER_FLOOR_PER_BIT).toBe(1);
    }
  });
});

// ═══ The shipped callers that make erasuresFullyAdmitted false in normal operation ═══
//
// Locking this in as an executable statement of the documented precondition: these are not
// hypothetical misuses, they are what the current callers do, and they are why the overdraft is
// reported rather than guarded. If a future change makes `measure` reject unadmitted erasure,
// these tests fail and name the two paths that break.

describe("entropy-tracker — the unadmitted-erasure precondition, as shipped", () => {
  test("a mid-stream tracker erases bits it never admitted, and keeps working", () => {
    const t = createEntropyTracker();
    // Three non-Adj mutations, the createNonAdjMap put/put/delete shape (physics-traits.ts).
    t.measure(1); t.measure(1); t.measure(1);
    expect(t.state.entropy_state).toBe(-3);
    const a = auditEntropyLedger(t);
    expect(a.unadmittedErasureBits).toBe(3);
    expect(a.erasuresFullyAdmitted).toBe(false);
    // The invariants that DO hold still hold — the deficit is isolated, not contagious.
    expect(a.heatMonotone).toBe(true);
    expect(a.heatNonNegative).toBe(true);
  });

  test("a closed ledger (branch then measure) reports zero unadmitted erasure", () => {
    const t = createEntropyTracker();
    t.branch(); t.branch(); t.measure(2);
    const a = auditEntropyLedger(t);
    expect(a.bitsAdmitted).toBe(2);
    expect(a.bitsErased).toBe(2);
    expect(a.unadmittedErasureBits).toBe(0);
    expect(a.erasuresFullyAdmitted).toBe(true);
    expect(a.heatMonotone).toBe(true);
  });
});

describe("entropy-tracker — ferry commit accounting", () => {
  test("ferry commit: Landauer floor + finite-time excess", () => {
    const account = accountFerryCommit(10, 100); // 10 bits, 100 time units
    expect(account.batchBits).toBe(10);
    expect(account.landauerFloor).toBe(10); // 10 x 1 kT.ln2
    expect(account.finiteTimeExcess).toBe(0.01); // L^2/tau = 1/100
    expect(account.totalHeat).toBe(10.01); // floor + excess
  });

  test("predictive advantage: larger tau = less excess", () => {
    const fast = accountFerryCommit(10, 1);    // rushed commit (tau=1)
    const slow = accountFerryCommit(10, 1000); // predicted commit (tau=1000)

    // Same floor (Landauer does not amortize)
    expect(fast.landauerFloor).toBe(slow.landauerFloor);

    // But excess is MUCH less for predicted (larger tau)
    expect(slow.finiteTimeExcess).toBeLessThan(fast.finiteTimeExcess);
    expect(slow.totalHeat).toBeLessThan(fast.totalHeat);
  });

  test("infinite erasure window = zero excess (quasi-static limit)", () => {
    const quasiStatic = accountFerryCommit(10, Infinity);
    expect(quasiStatic.finiteTimeExcess).toBe(0); // L^2/inf = 0
    expect(quasiStatic.totalHeat).toBe(10); // just the floor
  });

  test("zero erasure window = infinite excess (maximally irreversible)", () => {
    const instant = accountFerryCommit(10, 0);
    expect(instant.finiteTimeExcess).toBe(Infinity);
    expect(instant.totalHeat).toBe(Infinity);
  });
});

// ═══ The third door: `unmeasured` — an unknown cost is not a zero cost ══════
//
// Before this, the tracker could say "pay k" and "pay nothing, it is a bijection", and had no way
// at all to say "nobody has measured this one". A caller facing an unswept operation therefore had
// to charge an invented number or charge nothing — and charging nothing is the closed-ledger free
// lunch the module header calls a demon.
//
// The property under test is that `unmeasured()` and `permutation()` are DISTINGUISHABLE. Both
// move zero bits; only one of them is a claim that zero is correct.

describe("unmeasured — the hole, not the zero", () => {
  test("a permutation and an unmeasured operation both move zero bits and are NOT the same reading", () => {
    const bijection = createEntropyTracker();
    bijection.permutation();

    const unknown = createEntropyTracker();
    unknown.unmeasured("nobody has swept QuorumAlgebra.join's conditional H(A|B)");

    // Same heat…
    expect(readHeat(bijection).bitsErased).toBe(0);
    expect(readHeat(unknown).bitsErased).toBe(0);
    // …opposite meaning, and the difference is in the value a caller receives, not in a side
    // channel it may skip reading. If `unmeasured` were a no-op these two would be equal.
    expect(readHeat(bijection).complete).toBe(true);
    expect(readHeat(unknown).complete).toBe(false);
    expect(readHeat(bijection)).not.toEqual(readHeat(unknown));
  });

  test("the measured charge survives beside the hole — refusing the unknown is not discarding the known", () => {
    const t = createEntropyTracker();
    t.branch();
    t.branch();
    t.measure(2);
    t.unmeasured("compaction on a backend that declares no erasure profile");

    const reading = readHeat(t);
    expect(reading.bitsErased).toBe(2); // the real charge is still there
    expect(reading.complete).toBe(false); // and it is explicitly a LOWER BOUND
    expect(reading.holes).toEqual(["compaction on a backend that declares no erasure profile"]);
  });

  test("the hole set is keyed and the invocation count is not — idempotent identity, cumulative use", () => {
    const t = createEntropyTracker();
    t.unmeasured("same hole");
    t.unmeasured("same hole");
    t.unmeasured("a different hole");

    const audit = auditEntropyLedger(t);
    expect(audit.unmeasuredOperations).toBe(3);
    expect(audit.unmeasuredReasons).toEqual(["same hole", "a different hole"]);
    expect(audit.chargeComplete).toBe(false);
  });

  test("a hole with no written reason is recorded as a hole AND as a defect, never dropped", () => {
    const t = createEntropyTracker();
    t.unmeasured("   ");
    const audit = auditEntropyLedger(t);
    expect(audit.unmeasuredOperations).toBe(1);
    expect(audit.chargeComplete).toBe(false);
    expect(audit.unmeasuredReasons[0]).toContain("no reason written");
  });

  test("chargeComplete is sticky across a fresh charge, and cleared only by reset", () => {
    const t = createEntropyTracker();
    t.unmeasured("unknown");
    t.branch();
    t.measure(1);
    expect(auditEntropyLedger(t).chargeComplete).toBe(false);
    t.reset();
    expect(auditEntropyLedger(t).chargeComplete).toBe(true);
    expect(readHeat(t).holes).toEqual([]);
  });
});
