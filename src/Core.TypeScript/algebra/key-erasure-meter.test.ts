import { describe, test, expect } from "bun:test";
import { createEntropyTracker } from "./entropy-tracker";
import { mix } from "../splitmix64/splitmix64";
// Ordinal (code-point) comparator. Every sort below passes it explicitly rather than relying on
// the default, and deliberately NOT `localeCompare` — `.claude/rules/culture-invariant-by-default.md`.
import { stringCompare } from "../collation/collation";
import {
  BOLTZMANN_J_PER_K,
  LN_2,
  landauerFloorJoules,
  emptyErasureLedger,
  admitKeyMaterial,
  meterKeyErasure,
  ledgerKeyIds,
  testErasureDissipation,
  readEvidence,
  assessFrozen,
  meteredEvidenceFromLedger,
  type MeasuredDissipation,
  type FrozenEvidence,
  type DissipationTest,
} from "./key-erasure-meter";
import { VENDOR_TRUST_ROOTS } from "./vendor-trust-root";

const ROOM_TEMPERATURE_K = 300;

function goodInstrument(joules: number, uncertaintyJoules: number): MeasuredDissipation {
  return {
    basis: "physical-measurement",
    joules,
    uncertaintyJoules,
    temperatureKelvin: ROOM_TEMPERATURE_K,
    instrument: "hypothetical-calorimeter",
  };
}

describe("the accounting/measurement distinction lives in the type", () => {
  test("landauerFloorJoules yields a derived bound, never a measurement", () => {
    const floor = landauerFloorJoules(256, ROOM_TEMPERATURE_K);
    expect(floor.basis).toBe("derived-bound");
    // 256 bits at 300 K ≈ 7.35e-19 J — the design doc's "≈ 7 × 10⁻¹⁹ J".
    expect(floor.joules).toBeCloseTo(256 * BOLTZMANN_J_PER_K * 300 * LN_2, 30);
    expect(floor.joules / 1e-19).toBeCloseTo(7.35, 2);
    // A bound carries no instrument, because nothing measured it.
    expect(floor).not.toHaveProperty("instrument");
    expect(floor).not.toHaveProperty("uncertaintyJoules");
  });

  test("one bit at 300 K is the textbook kT ln 2 ≈ 2.87e-21 J", () => {
    expect(landauerFloorJoules(1, 300).joules / 1e-21).toBeCloseTo(2.871, 3);
  });

  test("a charged erasure produces accounting-ledger bits, not joules", () => {
    const tracker = createEntropyTracker();
    let ledger = emptyErasureLedger();
    ledger = admitKeyMaterial(ledger, { keyId: "k", bits: 8, phase: 1 }, tracker).ledger;
    const step = meterKeyErasure(ledger, { keyId: "k", phase: 2 }, tracker);
    expect(step.outcome.kind).toBe("charged");
    if (step.outcome.kind !== "charged") throw new Error("unreachable");
    expect(step.outcome.charged.basis).toBe("accounting-ledger");
    expect(step.outcome.charged.bits).toBe(8);
    expect(step.outcome.charged).not.toHaveProperty("joules");
  });
});

describe("the metered key lifecycle (§13 — the declared door)", () => {
  test("admit moves bits into Ledger A; erase transfers them to Ledger B", () => {
    const tracker = createEntropyTracker();
    let ledger = emptyErasureLedger();

    ledger = admitKeyMaterial(ledger, { keyId: "write-key", bits: 256, phase: 10 }, tracker).ledger;
    expect(tracker.state.entropy_state).toBe(256);
    expect(tracker.state.entropy_heat).toBe(0);
    expect(ledger.bitsAdmitted).toBe(256);

    ledger = meterKeyErasure(ledger, { keyId: "write-key", phase: 11 }, tracker).ledger;
    expect(tracker.state.entropy_state).toBe(0);
    expect(tracker.state.entropy_heat).toBe(256);
    expect(tracker.state.hard_measurements).toBe(1);
    expect(ledger.bitsErased).toBe(256);
  });

  test("erasing a key that was never admitted is REJECTED, not silently charged", () => {
    const tracker = createEntropyTracker();
    const step = meterKeyErasure(emptyErasureLedger(), { keyId: "ghost", phase: 1 }, tracker);
    expect(step.outcome.kind).toBe("rejected");
    if (step.outcome.kind !== "rejected") throw new Error("unreachable");
    expect(step.outcome.reason).toContain("never admitted");
    // Nothing crossed the metered channel.
    expect(tracker.state.entropy_heat).toBe(0);
    expect(tracker.state.hard_measurements).toBe(0);
    expect(step.ledger.records.size).toBe(0);
  });

  test("a rejected admit charges nothing", () => {
    const tracker = createEntropyTracker();
    for (const bits of [0, -8, 1.5, Number.NaN]) {
      const step = admitKeyMaterial(emptyErasureLedger(), { keyId: "k", bits, phase: 1 }, tracker);
      expect(step.outcome.kind).toBe("rejected");
    }
    expect(tracker.state.entropy_state).toBe(0);
    expect(tracker.state.entropy_heat).toBe(0);
  });

  test("key ids list in ordinal (code-point) order, not locale order", () => {
    const tracker = createEntropyTracker();
    let ledger = emptyErasureLedger();
    for (const keyId of ["b", "A", "a", "B", "_", "Z"]) {
      ledger = admitKeyMaterial(ledger, { keyId, bits: 1, phase: 0 }, tracker).ledger;
    }
    // Ordinal: uppercase before underscore before lowercase. A locale-aware sort would interleave.
    expect(ledgerKeyIds(ledger)).toEqual(["A", "B", "Z", "_", "a", "b"]);
  });
});

describe("§12 idempotency — apply-N-times == apply-once", () => {
  test("erasing an already-erased key is a no-op, not a double charge", () => {
    const tracker = createEntropyTracker();
    let ledger = emptyErasureLedger();
    ledger = admitKeyMaterial(ledger, { keyId: "k", bits: 128, phase: 1 }, tracker).ledger;

    const first = meterKeyErasure(ledger, { keyId: "k", phase: 2 }, tracker);
    expect(first.outcome.kind).toBe("charged");
    const heatAfterFirst = tracker.state.entropy_heat;
    const stateAfterFirst = tracker.state.entropy_state;

    let after = first.ledger;
    for (let i = 0; i < 5; i++) {
      const again = meterKeyErasure(after, { keyId: "k", phase: 3 + i }, tracker);
      expect(again.outcome.kind).toBe("already-erased");
      after = again.ledger;
    }

    expect(tracker.state.entropy_heat).toBe(heatAfterFirst);
    expect(tracker.state.entropy_state).toBe(stateAfterFirst);
    expect(tracker.state.hard_measurements).toBe(1);
    expect(after.bitsErased).toBe(128);
    // The erasure phase is the FIRST one; a repeat does not rewrite history.
    expect(after.records.get("k")?.erasedAtPhase).toBe(2);
  });

  test("admitting the same key twice does not double-charge Ledger A", () => {
    const tracker = createEntropyTracker();
    let ledger = emptyErasureLedger();
    ledger = admitKeyMaterial(ledger, { keyId: "k", bits: 64, phase: 1 }, tracker).ledger;
    const repeat = admitKeyMaterial(ledger, { keyId: "k", bits: 64, phase: 9 }, tracker);
    expect(repeat.outcome.kind).toBe("already-admitted");
    expect(tracker.state.entropy_state).toBe(64);
    expect(repeat.ledger.bitsAdmitted).toBe(64);
    expect(repeat.ledger.records.get("k")?.admittedAtPhase).toBe(1);
  });
});

describe("§7 DST — seeded and replayable", () => {
  function replay(seed: bigint): { ids: readonly string[]; admitted: number; erased: number; heat: number } {
    const tracker = createEntropyTracker();
    let ledger = emptyErasureLedger();
    let s = seed;
    for (let i = 0; i < 200; i++) {
      s = mix(s);
      const keyId = `key-${(s % 17n).toString()}`;
      const bits = Number((s >> 8n) % 32n) + 1;
      const phase = i;
      if ((s >> 16n) % 3n === 0n) {
        ledger = meterKeyErasure(ledger, { keyId, phase }, tracker).ledger;
      } else {
        ledger = admitKeyMaterial(ledger, { keyId, bits, phase }, tracker).ledger;
      }
    }
    return {
      ids: ledgerKeyIds(ledger),
      admitted: ledger.bitsAdmitted,
      erased: ledger.bitsErased,
      heat: tracker.state.entropy_heat,
    };
  }

  test("same seed, same fold — byte-for-byte", () => {
    const a = replay(0x5eedn);
    const b = replay(0x5eedn);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("different seed, different fold (the replay is not a constant)", () => {
    expect(JSON.stringify(replay(0x5eedn))).not.toBe(JSON.stringify(replay(0xd1ffn)));
  });

  test("the ledger never erases more bits than it admitted", () => {
    for (const seed of [0x1n, 0x5eedn, 0xd1ffn, 0xabcdef123456n]) {
      const r = replay(seed);
      expect(r.erased).toBeLessThanOrEqual(r.admitted);
      expect(r.heat).toBe(r.erased);
    }
  });
});

describe("one-way inference — refutes, never confirms", () => {
  test("dissipation below the floor REFUTES the erasure claim", () => {
    const floor = landauerFloorJoules(256, ROOM_TEMPERATURE_K).joules;
    const result = testErasureDissipation(256, goodInstrument(floor / 10, floor / 100));
    expect(result.kind).toBe("refuted");
  });

  test("sufficient dissipation is NOT-REFUTED, and the type has no way to say confirmed", () => {
    const floor = landauerFloorJoules(256, ROOM_TEMPERATURE_K).joules;
    const result = testErasureDissipation(256, goodInstrument(floor * 1000, floor / 100));
    expect(result.kind).toBe("not-refuted");
    if (result.kind !== "not-refuted") throw new Error("unreachable");
    expect(result.why).toContain("not confirmation");
  });

  test("astronomically more energy than the floor still cannot confirm", () => {
    const result = testErasureDissipation(1, goodInstrument(1e6, 1e-30));
    // A megajoule for one bit. Still only "not-refuted" — heat proves nothing about erasure.
    expect(result.kind).toBe("not-refuted");
  });

  test("an instrument coarser than the floor is INDETERMINATE, never not-refuted", () => {
    const floor = landauerFloorJoules(256, ROOM_TEMPERATURE_K).joules;
    // A real calorimeter's noise floor dwarfs 7e-19 J — this is the honest state of the art.
    const result = testErasureDissipation(256, goodInstrument(floor * 10, 1e-9));
    expect(result.kind).toBe("indeterminate");
    if (result.kind !== "indeterminate") throw new Error("unreachable");
    expect(result.reason).toContain("cannot discriminate");
  });

  test("malformed measurements give no information rather than a verdict", () => {
    const cases: MeasuredDissipation[] = [
      { ...goodInstrument(1e-18, 1e-22), temperatureKelvin: 0 },
      { ...goodInstrument(-1, 1e-22) },
      { ...goodInstrument(1e-18, -1) },
      { ...goodInstrument(1e-18, 1e-22), instrument: "" },
      { ...goodInstrument(Number.NaN, 1e-22) },
    ];
    for (const m of cases) {
      expect(testErasureDissipation(256, m).kind).toBe("indeterminate");
    }
    expect(testErasureDissipation(0, goodInstrument(1e-18, 1e-22)).kind).toBe("indeterminate");
    expect(testErasureDissipation(-5, goodInstrument(1e-18, 1e-22)).kind).toBe("indeterminate");
  });

  test("refutation is generous to the claimant — instrument error never manufactures one", () => {
    const floor = landauerFloorJoules(64, ROOM_TEMPERATURE_K).joules;
    // Measured is below the floor, but the error bar reaches it: no conviction.
    const borderline = testErasureDissipation(64, goodInstrument(floor * 0.6, floor * 0.5));
    expect(borderline.kind).toBe("not-refuted");
    // Push the reading down so even measured+uncertainty misses: now it convicts.
    const clear = testErasureDissipation(64, goodInstrument(floor * 0.1, floor * 0.5));
    expect(clear.kind).toBe("refuted");
  });

  test("MECHANICAL: no reachable result of the test carries a confirmation", () => {
    // Sweep a wide grid and collect every `kind` and every field name any result exposes.
    // If someone later adds a `confirmed` case or a `holds`/`confidence` field beside the
    // verdict, this test fails — the point of the lesson is that the operation is REMOVED,
    // not annotated.
    const kinds = new Set<string>();
    const fields = new Set<string>();
    const grid: { bits: number; joules: number; u: number; t: number }[] = [];
    for (const bits of [-1, 0, 1, 64, 256, 4096]) {
      for (const joules of [0, 1e-30, 1e-21, 1e-18, 1e-6, 1e6]) {
        for (const u of [0, 1e-30, 1e-24, 1e-18, 1e-3]) {
          for (const t of [0, 1, 300, 1e6]) grid.push({ bits, joules, u, t });
        }
      }
    }
    expect(grid).toHaveLength(6 * 6 * 5 * 4);
    for (const point of grid) {
      const r: DissipationTest = testErasureDissipation(point.bits, {
        basis: "physical-measurement",
        joules: point.joules,
        uncertaintyJoules: point.u,
        temperatureKelvin: point.t,
        instrument: "sweep",
      });
      kinds.add(r.kind);
      for (const k of Object.keys(r)) fields.add(k);
    }
    expect([...kinds].sort(stringCompare)).toEqual(["indeterminate", "not-refuted", "refuted"]);
    expect([...fields].sort(stringCompare)).toEqual([
      "floorJoules",
      "generousMeasuredJoules",
      "kind",
      "reason",
      "why",
    ]);
    for (const banned of ["confirmed", "confirms", "holds", "confidence", "verified", "proven"]) {
      expect(fields.has(banned)).toBe(false);
      expect(kinds.has(banned)).toBe(false);
    }
  });
});

describe("evidence-type polymorphism — the family, and the unpopulated members", () => {
  test("observed: quiescence supports frozen, weakly and defeasibly", () => {
    const r = readEvidence({
      member: "observed",
      keyId: "k",
      phasesSinceLastWrite: 5000,
      thresholdPhases: 1000,
    });
    expect(r.reading).toBe("supports-frozen");
    expect(r.why).toContain("indistinguishable");
  });

  test("observed: below threshold says nothing", () => {
    const r = readEvidence({
      member: "observed",
      keyId: "k",
      phasesSinceLastWrite: 3,
      thresholdPhases: 1000,
    });
    expect(r.reading).toBe("no-information");
  });

  test("attested and fused are UNPOPULATED — no-information, never fake success", () => {
    const attested = readEvidence({
      member: "attested",
      keyId: "k",
      deletionCertificate: "cert-a",
      nonExtractableGenerationCertificate: "cert-b",
      trustRoot: VENDOR_TRUST_ROOTS["amd-ark"],
    });
    expect(attested.reading).toBe("no-information");
    expect(attested.why).toContain("no attestation verifier");
    // The reading NAMES the root it would have to chain to — the whole point of 081M00QP7FB.
    expect(attested.why).toContain("ARK (AMD Root Key, self-signed)");
    // ...and refuses to let "named" read as "chained".
    expect(attested.why).toContain("NAMED here, which is not the same as chained");

    const fused = readEvidence({
      member: "fused",
      keyId: "k",
      fuseBankReading: "0xFF",
      attestedByBootChain: "boot-chain",
    });
    expect(fused.reading).toBe("no-information");
    expect(fused.why).toContain("no OTP/eFuse read path");
  });

  test("a surviving metered test is no-information, NOT support for frozen", () => {
    const floor = landauerFloorJoules(256, ROOM_TEMPERATURE_K).joules;
    const r = readEvidence({
      member: "metered",
      keyId: "k",
      claimedBitsErased: 256,
      measured: goodInstrument(floor * 100, floor / 100),
    });
    expect(r.reading).toBe("no-information");
  });

  test("adding a member never requires touching the others (polymorphism, checked)", () => {
    const floor = landauerFloorJoules(256, ROOM_TEMPERATURE_K).joules;
    const family: FrozenEvidence[] = [
      { member: "observed", keyId: "k", phasesSinceLastWrite: 5000, thresholdPhases: 10 },
      {
        member: "attested",
        keyId: "k",
        deletionCertificate: "c",
        nonExtractableGenerationCertificate: "g",
        trustRoot: VENDOR_TRUST_ROOTS["tpm-manufacturer-ek-ca"],
      },
      { member: "fused", keyId: "k", fuseBankReading: "0xFF", attestedByBootChain: "b" },
      {
        member: "metered",
        keyId: "k",
        claimedBitsErased: 256,
        measured: goodInstrument(floor * 10, floor / 100),
      },
    ];
    const assessment = assessFrozen("k", family);
    expect(assessment.readings).toHaveLength(4);
    expect(assessment.readings.map((r) => r.member)).toEqual([
      "observed",
      "attested",
      "fused",
      "metered",
    ]);
    // Any subset works, in any order — nothing depends on a particular member being present.
    expect(assessFrozen("k", []).readings).toHaveLength(0);
    const subset = [family.at(3), family.at(0)].filter((e) => e !== undefined);
    expect(assessFrozen("k", subset).readings).toHaveLength(2);
  });

  test("there is no isFrozen — the assessment carries no collapsed boolean", () => {
    const assessment = assessFrozen("k", [
      { member: "observed", keyId: "k", phasesSinceLastWrite: 99, thresholdPhases: 1 },
    ]);
    expect(Object.keys(assessment).sort(stringCompare)).toEqual(["conflicts", "keyId", "readings"]);
    expect(assessment).not.toHaveProperty("frozen");
    expect(assessment).not.toHaveProperty("verdict");
  });

  test("evidence about another key is named, not silently folded in", () => {
    const assessment = assessFrozen("k", [
      { member: "observed", keyId: "OTHER", phasesSinceLastWrite: 9999, thresholdPhases: 1 },
    ]);
    const only = assessment.readings.at(0);
    expect(only?.reading).toBe("no-information");
    expect(only?.why).toContain("not 'k'");
    expect(assessment.conflicts).toHaveLength(0);
  });
});

describe("disagreement is a detection, not a tie-break", () => {
  test("quiescence supports frozen while the meter refutes the erasure → conflict reported", () => {
    const floor = landauerFloorJoules(256, ROOM_TEMPERATURE_K).joules;
    const assessment = assessFrozen("k", [
      { member: "observed", keyId: "k", phasesSinceLastWrite: 100000, thresholdPhases: 10 },
      {
        member: "metered",
        keyId: "k",
        claimedBitsErased: 256,
        measured: goodInstrument(floor / 100, floor / 1000),
      },
    ]);
    expect(assessment.conflicts).toHaveLength(1);
    expect(assessment.conflicts[0]).toMatchObject({ supporting: "observed", refuting: "metered" });
    expect(assessment.conflicts.at(0)?.why).toContain("not a tie-break");
    // Both readings survive in full. Neither is dropped in favour of the other.
    expect(assessment.readings.map((r) => r.reading).sort(stringCompare)).toEqual([
      "refutes-erasure",
      "supports-frozen",
    ]);
  });

  test("agreement produces no conflict", () => {
    const floor = landauerFloorJoules(256, ROOM_TEMPERATURE_K).joules;
    const assessment = assessFrozen("k", [
      { member: "observed", keyId: "k", phasesSinceLastWrite: 100000, thresholdPhases: 10 },
      {
        member: "metered",
        keyId: "k",
        claimedBitsErased: 256,
        measured: goodInstrument(floor * 100, floor / 1000),
      },
    ]);
    expect(assessment.conflicts).toHaveLength(0);
  });

  test("conflict listing is deterministic under input reordering", () => {
    const floor = landauerFloorJoules(8, ROOM_TEMPERATURE_K).joules;
    const observed: FrozenEvidence = {
      member: "observed",
      keyId: "k",
      phasesSinceLastWrite: 100000,
      thresholdPhases: 10,
    };
    const metered: FrozenEvidence = {
      member: "metered",
      keyId: "k",
      claimedBitsErased: 8,
      measured: goodInstrument(0, floor / 1000),
    };
    const a = assessFrozen("k", [observed, metered]).conflicts;
    const b = assessFrozen("k", [metered, observed]).conflicts;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("the claimant does not supply its own bit count", () => {
  test("meteredEvidenceFromLedger takes bits from the ledger", () => {
    const tracker = createEntropyTracker();
    let ledger = emptyErasureLedger();
    ledger = admitKeyMaterial(ledger, { keyId: "k", bits: 256, phase: 1 }, tracker).ledger;
    ledger = meterKeyErasure(ledger, { keyId: "k", phase: 2 }, tracker).ledger;

    const evidence = meteredEvidenceFromLedger(ledger, "k", goodInstrument(1e-18, 1e-22));
    expect(evidence?.claimedBitsErased).toBe(256);
  });

  test("no evidence for a key that was never erased, or never existed", () => {
    const tracker = createEntropyTracker();
    let ledger = emptyErasureLedger();
    ledger = admitKeyMaterial(ledger, { keyId: "live", bits: 256, phase: 1 }, tracker).ledger;
    expect(meteredEvidenceFromLedger(ledger, "live", goodInstrument(1e-18, 1e-22))).toBeUndefined();
    expect(meteredEvidenceFromLedger(ledger, "ghost", goodInstrument(1e-18, 1e-22))).toBeUndefined();
  });
});
