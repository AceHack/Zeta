/**
 * key-erasure-meter.ts — the erasure metering path, and the evidence-polymorphic frozen claim.
 *
 * Design settled in `docs/research/2026-08-13-attested-key-erasure-makes-frozen-assertable-not-merely-observed.md`
 * (its two corrections included). Prior context:
 * `docs/research/2026-08-13-canon-is-decided-by-write-keys-and-disagreement-forks-rather-than-votes.md`
 * — canon is authorship, immutability is key liveness, and "frozen" can be observed-to-date but
 * not asserted from silence alone.
 *
 * ## The one distinction this module exists to keep
 *
 * `entropy-tracker.ts` counts **bits against a floor in normalized units**. It does not, and
 * cannot, measure **energy**. Those are different claims:
 *
 * - **Accounting ledger** — "N bits were erased; the floor is N·kT ln 2." Bookkeeping about a
 *   computation. Buildable today, no instrument, no trust root. `LedgerBits` below.
 * - **Physical measurement** — "J joules were dissipated at temperature T, by instrument I, with
 *   uncertainty ±u." A measurement of the world. `MeasuredDissipation` below.
 *
 * A frozen claim backed by an accounting ledger is **strictly weaker** than one backed by a
 * physical measurement, and this file makes a consumer unable to confuse them: the two live in
 * disjoint types, the derived bound is a *third* type (`LandauerFloorJoules`), and **there is no
 * function anywhere that turns bits into a measurement**. `landauerFloorJoules` produces a bound,
 * which is a claim about what a measurement would have to exceed — never a measurement.
 *
 * Conflating them would be the physics-as-metaphor failure the metering test in
 * `.claude/rules/anchor-to-human-prior-art.md` exists to catch, and this document family has
 * already had to correct one Landauer overclaim.
 *
 * ## Status
 *
 * - **CHECKED** — the accounting half. `admitKeyMaterial` / `meterKeyErasure` route key lifecycle
 *   through the existing entropy ledger; every assertion in the test file exercises real code.
 * - **CHECKED** — the one-way falsification arithmetic (`testErasureDissipation`) against the
 *   stated floor. What is checked is *the comparison*, not any physical erasure.
 * - **PROPOSED / unpopulated** — `attested` (vendor trust root) and `fused` (OTP state) evidence.
 *   The data shapes exist so an exhaustive `switch` covers them; **no verifier exists**, and they
 *   read as `no-information` rather than as a stub returning fake success. `attested` now *names*
 *   its root (`VendorTrustRoot`, see `vendor-trust-root.ts`) instead of carrying a free `string`.
 *   Naming is not chaining: nothing here builds or checks a certificate chain.
 * - **NOT CLAIMED** — no thermodynamic guarantee is asserted by anything here. Nothing in this
 *   repository has measured a joule. `MeasuredDissipation` is a shape for an instrument that does
 *   not exist here; supplying one by hand supplies a claim, not a measurement, and the honest
 *   reading of a hand-supplied one is whatever its `instrument` field says.
 *
 * ## Anchors (Beacon)
 *
 * - Landauer 1961 — the `kT ln 2` floor on the energy cost of erasing a bit. **Conceptual anchor;
 *   explicitly not a security argument** (per the design doc's own correction).
 * - Bennett 1982 — logical reversibility; reversible ops carry no floor.
 * - Bérut, Arakelyan, Petrosyan, Ciliberto, Dillenschneider & Lutz, *Nature* 483 (2012) —
 *   experimental verification of the Landauer bound for a single bit. Cited from standing
 *   knowledge, **not page-checked**; it is the one to verify first if the physics member is ever
 *   populated.
 * - Goguen & Meseguer 1982 — noninterference (§13): influence crosses only declared, metered
 *   channels. That is why an erasure is charged here rather than happening silently.
 * - `k = 1.380649e-23 J/K` is **exact by definition** (2019 SI redefinition of the kelvin) — CHECKED,
 *   it is a defining constant, not a measured one.
 */

import type { EntropyTracker } from "./entropy-tracker";
import { stringCompare } from "../collation/collation";
import { describeVendorTrustRoot, type VendorTrustRoot } from "./vendor-trust-root";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Boltzmann constant in J/K. Exact by the 2019 SI redefinition. */
export const BOLTZMANN_J_PER_K = 1.380649e-23;

/** ln 2, the Landauer factor. */
export const LN_2 = Math.LN2;

// ─── The two bases of evidence, kept in disjoint types ───────────────────────

/**
 * A bookkeeping quantity: bits charged to the entropy ledger. **Not energy.**
 * Carries no temperature, no instrument, and no joules, because it is not a measurement of
 * anything in the world — it is a count of branches a computation gave up.
 */
export interface LedgerBits {
  readonly basis: "accounting-ledger";
  readonly bits: number;
}

/**
 * A *derived bound*: `bits · k · T · ln 2`. This is arithmetic over a bit count, so it inherits the
 * accounting ledger's epistemic status — it says what a measurement would have to exceed, and
 * asserts nothing about what any device did. Distinct from `MeasuredDissipation` on purpose: a
 * bound must never be passable where a measurement is expected.
 */
export interface LandauerFloorJoules {
  readonly basis: "derived-bound";
  readonly joules: number;
  readonly bits: number;
  readonly temperatureKelvin: number;
}

/**
 * An energy **measured by an instrument**. Every field here is required and every one of them is a
 * thing the accounting ledger does not have:
 * - `instrument` — a measurement with no named instrument is not a measurement.
 * - `uncertaintyJoules` — a measurement with no stated uncertainty cannot refute anything, since
 *   refutation is a comparison against a bound and the comparison needs the error bar.
 * - `temperatureKelvin` — `kT ln 2` is meaningless without T.
 */
export interface MeasuredDissipation {
  readonly basis: "physical-measurement";
  readonly joules: number;
  /** Stated instrument uncertainty in joules, same coverage convention throughout a comparison. */
  readonly uncertaintyJoules: number;
  readonly temperatureKelvin: number;
  /** What produced the number. Free text, but it must be *something* a reader can go look at. */
  readonly instrument: string;
}

/**
 * Invariant numeric formatting for messages. `String(n)` follows the ECMAScript `Number::toString`
 * algorithm, which is locale-independent by specification — unlike `toLocaleString`, which is not
 * (`.claude/rules/culture-invariant-by-default.md`).
 */
function num(n: number): string {
  return String(n);
}

/**
 * The Landauer floor for `bits` erased at `temperatureKelvin`.
 *
 * Note what this function is not: there is deliberately **no** `bitsToMeasuredDissipation`, no
 * `asMeasurement`, and no way to construct a `MeasuredDissipation` from a `LedgerBits`. The only
 * route from bits to joules lands in `LandauerFloorJoules`, which every consumer can see is a
 * derived bound.
 */
export function landauerFloorJoules(bits: number, temperatureKelvin: number): LandauerFloorJoules {
  return {
    basis: "derived-bound",
    joules: bits * BOLTZMANN_J_PER_K * temperatureKelvin * LN_2,
    bits,
    temperatureKelvin,
  };
}

// ─── The metered key lifecycle ───────────────────────────────────────────────

/**
 * A key known to the metered channel. Birth and death are both accounted, because **a measurement
 * cannot be retrofitted to an unmetered channel** — that is the design doc's whole argument for
 * building this half now, and it is enforced below rather than described: erasing a key that was
 * never admitted is `rejected`, not silently charged.
 *
 * `phase` throughout is agreed logical phase, never a local wall clock
 * (`.claude/rules/local-time-never-enters-the-shared-fold.md`).
 */
export interface KeyRecord {
  readonly keyId: string;
  readonly bits: number;
  readonly admittedAtPhase: number;
  /** `null` while the key is live. Set once, at erasure. */
  readonly erasedAtPhase: number | null;
}

/** Keyed by `keyId`, which is what makes admit and erase idempotent (§12). */
export interface ErasureLedger {
  readonly records: ReadonlyMap<string, KeyRecord>;
  /** Bits admitted to Ledger A over the ledger's life. */
  readonly bitsAdmitted: number;
  /** Bits transferred A → B by erasure. Accounting only — see the header. */
  readonly bitsErased: number;
}

export function emptyErasureLedger(): ErasureLedger {
  return { records: new Map(), bitsAdmitted: 0, bitsErased: 0 };
}

/** The outcome of an admit. `already-admitted` is the idempotent no-op, and it is not an error. */
export type AdmitOutcome =
  | { readonly kind: "admitted"; readonly record: KeyRecord }
  | { readonly kind: "already-admitted"; readonly record: KeyRecord }
  | { readonly kind: "rejected"; readonly reason: string };

/** The outcome of an erasure. `already-erased` is the idempotent no-op, and it is not an error. */
export type EraseOutcome =
  | { readonly kind: "charged"; readonly record: KeyRecord; readonly charged: LedgerBits }
  | { readonly kind: "already-erased"; readonly record: KeyRecord }
  | { readonly kind: "rejected"; readonly reason: string };

export interface LedgerStep<TOutcome> {
  readonly ledger: ErasureLedger;
  readonly outcome: TOutcome;
}

/**
 * Admit key material to the metered channel (the birth half).
 *
 * The `bits` become uncertainty in Ledger A — the substrate now holds a secret it did not hold
 * before. This is a pure accounting statement; it makes no claim about where the key physically
 * lives or whether it was ever extractable. The attestation of non-extractable generation, which
 * the design doc correctly calls the load-bearing half, is **not** modelled here and cannot be:
 * it needs a vendor trust root this substrate does not have.
 *
 * Idempotent by `keyId`.
 */
export function admitKeyMaterial(
  ledger: ErasureLedger,
  key: { readonly keyId: string; readonly bits: number; readonly phase: number },
  tracker: EntropyTracker,
): LedgerStep<AdmitOutcome> {
  const existing = ledger.records.get(key.keyId);
  if (existing !== undefined) {
    // §12: apply-N-times == apply-once. No second charge to the tracker.
    return { ledger, outcome: { kind: "already-admitted", record: existing } };
  }
  if (!Number.isInteger(key.bits) || key.bits <= 0) {
    return {
      ledger,
      outcome: { kind: "rejected", reason: `bits must be a positive integer; got ${String(key.bits)}` },
    };
  }
  if (key.keyId.length === 0) {
    return { ledger, outcome: { kind: "rejected", reason: "keyId must be non-empty" } };
  }

  const record: KeyRecord = {
    keyId: key.keyId,
    bits: key.bits,
    admittedAtPhase: key.phase,
    erasedAtPhase: null,
  };
  const records = new Map(ledger.records);
  records.set(record.keyId, record);
  // The declared, metered door (§13): uncertainty enters Ledger A here and nowhere else.
  for (let i = 0; i < key.bits; i++) tracker.branch();

  return {
    ledger: { records, bitsAdmitted: ledger.bitsAdmitted + key.bits, bitsErased: ledger.bitsErased },
    outcome: { kind: "admitted", record },
  };
}

/**
 * Meter a key erasure (the death half) — an accounted, irreversible crossing rather than an
 * unobserved one.
 *
 * What this does: transfers the key's bits from Ledger A to Ledger B via `tracker.measure`, and
 * records the erasure phase. What it does **not** do: claim the key material is physically gone,
 * claim any energy was dissipated, or produce evidence about either. It produces `LedgerBits` —
 * accounting — and the caller must go get a `MeasuredDissipation` from an instrument if it wants
 * the other kind of evidence.
 *
 * Idempotent by `keyId`: erasing an already-erased key is a no-op, not a double charge (§12).
 */
export function meterKeyErasure(
  ledger: ErasureLedger,
  event: { readonly keyId: string; readonly phase: number },
  tracker: EntropyTracker,
): LedgerStep<EraseOutcome> {
  const record = ledger.records.get(event.keyId);
  if (record === undefined) {
    return {
      ledger,
      outcome: {
        kind: "rejected",
        reason:
          `key '${event.keyId}' was never admitted to the metered channel; ` +
          "a measurement cannot be retrofitted to an unmetered channel",
      },
    };
  }
  if (record.erasedAtPhase !== null) {
    // §12: the second erasure charges nothing.
    return { ledger, outcome: { kind: "already-erased", record } };
  }

  const erased: KeyRecord = { ...record, erasedAtPhase: event.phase };
  const records = new Map(ledger.records);
  records.set(erased.keyId, erased);
  // The declared, metered door (§13): Ledger A → Ledger B, irreversibly.
  tracker.measure(record.bits);

  return {
    ledger: { records, bitsAdmitted: ledger.bitsAdmitted, bitsErased: ledger.bitsErased + record.bits },
    outcome: {
      kind: "charged",
      record: erased,
      charged: { basis: "accounting-ledger", bits: record.bits },
    },
  };
}

/** Key ids in the ledger, in ordinal (Unicode code-point) order — deterministic across locales. */
export function ledgerKeyIds(ledger: ErasureLedger): readonly string[] {
  return [...ledger.records.keys()].sort(stringCompare);
}

// ─── The one-way test: refutes, never confirms ───────────────────────────────

/**
 * The result of comparing a measured dissipation against the Landauer floor.
 *
 * **There is no `confirmed` case, and that is the point.** You cannot erase `N` bits while
 * dissipating less than `N · kT ln 2`, so measured dissipation below the floor **falsifies** an
 * erasure claim. Sufficient dissipation proves nothing — heat can be spent for any reason at all.
 * Same direction as `src/Core/AntiSybil.fs`: convicts, never acquits.
 *
 * Per `docs/research/2026-08-13-lessons-belong-in-the-harness-not-in-rules-the-externalization-ladder.md`,
 * the enforcement is **removal of the operation, not a field beside it** — there is no
 * `confidence`, no `holds: boolean`, no `confirmed`, and no accessor that could be read as one.
 * A consumer that wants to claim confirmation has to invent the concept itself, in the open.
 */
export type DissipationTest =
  /** Even the most generous reading of the instrument is below the floor. The claim is dead. */
  | {
      readonly kind: "refuted";
      readonly floorJoules: number;
      readonly generousMeasuredJoules: number;
      readonly why: string;
    }
  /**
   * Not refuted. **This is not confirmation** — it is the absence of a refutation, and the name
   * says so at every call site.
   */
  | {
      readonly kind: "not-refuted";
      readonly floorJoules: number;
      readonly generousMeasuredJoules: number;
      readonly why: string;
    }
  /**
   * The instrument cannot discriminate at this scale, or the input is malformed. The honest
   * answer for every instrument available today: 256 bits × kT ln 2 ≈ 7 × 10⁻¹⁹ J at 300 K, and
   * measuring that against thermal noise is a laboratory problem, not a component one.
   */
  | { readonly kind: "indeterminate"; readonly reason: string; readonly floorJoules: number };

/**
 * Test a claimed erasure of `claimedBits` against a measured dissipation.
 *
 * Refutation is deliberately *generous to the claimant*: it requires `measured + uncertainty` to
 * fall below the floor, so instrument error can never manufacture a conviction. That also makes
 * the ordering below exhaustive — when `uncertainty ≥ floor`, refutation is arithmetically
 * unreachable for any non-negative measurement, which is exactly why that case is reported as
 * `indeterminate` rather than quietly becoming `not-refuted`.
 */
export function testErasureDissipation(
  claimedBits: number,
  measured: MeasuredDissipation,
): DissipationTest {
  const floor = landauerFloorJoules(claimedBits, measured.temperatureKelvin);

  if (!Number.isFinite(claimedBits) || claimedBits <= 0) {
    return {
      kind: "indeterminate",
      reason: `claimedBits must be positive and finite; got ${String(claimedBits)}`,
      floorJoules: floor.joules,
    };
  }
  if (!Number.isFinite(measured.temperatureKelvin) || measured.temperatureKelvin <= 0) {
    return {
      kind: "indeterminate",
      reason: `temperature must be positive and finite; got ${String(measured.temperatureKelvin)} K`,
      floorJoules: floor.joules,
    };
  }
  if (!Number.isFinite(measured.joules) || measured.joules < 0) {
    return {
      kind: "indeterminate",
      reason: `dissipation must be non-negative and finite; got ${String(measured.joules)} J`,
      floorJoules: floor.joules,
    };
  }
  if (!Number.isFinite(measured.uncertaintyJoules) || measured.uncertaintyJoules < 0) {
    return {
      kind: "indeterminate",
      reason: `uncertainty must be non-negative and finite; got ${String(measured.uncertaintyJoules)} J`,
      floorJoules: floor.joules,
    };
  }
  if (measured.instrument.length === 0) {
    return {
      kind: "indeterminate",
      reason: "a measurement with no named instrument is not a measurement",
      floorJoules: floor.joules,
    };
  }
  if (measured.uncertaintyJoules >= floor.joules) {
    return {
      kind: "indeterminate",
      reason:
        `instrument uncertainty ${num(measured.uncertaintyJoules)} J is at or above the floor ` +
        `${num(floor.joules)} J for ${num(claimedBits)} bits at ${num(measured.temperatureKelvin)} K — ` +
        `'${measured.instrument}' cannot discriminate at this scale`,
      floorJoules: floor.joules,
    };
  }

  const generous = measured.joules + measured.uncertaintyJoules;
  if (generous < floor.joules) {
    return {
      kind: "refuted",
      floorJoules: floor.joules,
      generousMeasuredJoules: generous,
      why:
        `${num(generous)} J (measured + uncertainty) is below the Landauer floor ${num(floor.joules)} J ` +
        `for ${num(claimedBits)} bits at ${num(measured.temperatureKelvin)} K`,
    };
  }
  return {
    kind: "not-refuted",
    floorJoules: floor.joules,
    generousMeasuredJoules: generous,
    why:
      `${num(generous)} J meets or exceeds the floor ${num(floor.joules)} J — the claim survives this test. ` +
      "Energy can be dissipated without erasing anything, so this is not confirmation",
  };
}

// ─── The evidence-polymorphic frozen claim ───────────────────────────────────

export type FrozenMember = "observed" | "attested" | "fused" | "metered";

/**
 * No write in `phasesSinceLastWrite` agreed phases. **Always available, weakest, no trust root.**
 * An unused key and a destroyed key are indistinguishable to this member — which is the limit the
 * whole design doc is about, and it is why this member never disappears from the family.
 */
export interface ObservedEvidence {
  readonly member: "observed";
  readonly keyId: string;
  readonly phasesSinceLastWrite: number;
  /** The caller's own quiescence threshold. Whose value it is matters: this is a policy, not a fact. */
  readonly thresholdPhases: number;
}

/**
 * **UNPOPULATED.** A vendor deletion certificate, plus the birth half the design doc insists on:
 * an erasure certificate without an attested non-extractable-generation certificate is *not
 * evidence* and must be rejected rather than accepted at reduced weight.
 *
 * The shape exists so an exhaustive `switch` covers it and so the birth-half requirement is
 * written where an implementer will hit it. **No verifier exists in this substrate** — reading
 * this member yields `no-information`, never a stub success. Populating it means TPM 2.0 /
 * StrongBox / Secure Enclave attestation chains and a vendor trust root, which is a §1 dependency
 * to be argued for on its own terms.
 */
export interface AttestedEvidence {
  readonly member: "attested";
  readonly keyId: string;
  readonly deletionCertificate: string;
  readonly nonExtractableGenerationCertificate: string;
  /**
   * **The named root, required.** A `VendorTrustRoot` — not a `string`. This field used to be a
   * bare `string`, so `""`, `"unknown"` and `"r"` were all type-correct roots; an attestation
   * claim that named no root was representable. It no longer is: `VendorTrustRoot` is branded and
   * can only come from `VENDOR_TRUST_ROOTS` or from `declareVendorTrustRoot`, which refuses a
   * blank vendor or an empty chain.
   *
   * It carries the root's NAME, not a proof. Nothing chains here — see `vendor-trust-root.ts`.
   */
  readonly trustRoot: VendorTrustRoot;
}

/**
 * **UNPOPULATED.** One-time-programmable fuse state, read over a device channel and covered by
 * secure boot. A burnt fuse is not a policy assertion; it is a changed device. Orderable hardware
 * today — and still not present here, so this member reads as `no-information`.
 */
export interface FusedEvidence {
  readonly member: "fused";
  readonly keyId: string;
  readonly fuseBankReading: string;
  readonly attestedByBootChain: string;
}

/**
 * A dissipation measurement against a claimed bit count. **Falsification-only** — see
 * `DissipationTest`.
 *
 * Prefer `meteredEvidenceFromLedger`, which takes `claimedBits` from the ledger rather than from
 * the claimant, so an erasure claim cannot inflate its own bit count to make its floor easier to
 * clear.
 */
export interface MeteredEvidence {
  readonly member: "metered";
  readonly keyId: string;
  readonly claimedBitsErased: number;
  readonly measured: MeasuredDissipation;
}

export type FrozenEvidence = ObservedEvidence | AttestedEvidence | FusedEvidence | MeteredEvidence;

/**
 * Build metered evidence whose bit count comes from the ledger, not from the claimant. Returns
 * `undefined` if the ledger has no erasure for that key — there is nothing to measure against.
 */
export function meteredEvidenceFromLedger(
  ledger: ErasureLedger,
  keyId: string,
  measured: MeasuredDissipation,
): MeteredEvidence | undefined {
  const record = ledger.records.get(keyId);
  if (record === undefined) return undefined;
  if (record.erasedAtPhase === null) return undefined;
  return { member: "metered", keyId, claimedBitsErased: record.bits, measured };
}

/**
 * What one member says. Note the absent case again: there is `supports-frozen`, there is
 * `refutes-erasure`, and there is no `proves-frozen`. Every member here is defeasible or
 * falsification-only; none of them can settle the question, and the type refuses to pretend one
 * can.
 */
export type Reading =
  | { readonly reading: "supports-frozen"; readonly member: FrozenMember; readonly why: string }
  | { readonly reading: "refutes-erasure"; readonly member: FrozenMember; readonly why: string }
  | { readonly reading: "no-information"; readonly member: FrozenMember; readonly why: string };

/** Read a single member. Exhaustive over the family; unpopulated members say so out loud. */
export function readEvidence(evidence: FrozenEvidence): Reading {
  switch (evidence.member) {
    case "observed": {
      if (evidence.phasesSinceLastWrite >= evidence.thresholdPhases) {
        return {
          reading: "supports-frozen",
          member: "observed",
          why:
            `no write in ${num(evidence.phasesSinceLastWrite)} phases ` +
            `(threshold ${num(evidence.thresholdPhases)}). ` +
            "Observed-to-date only: an unused key and a lost key are indistinguishable from silence",
        };
      }
      return {
        reading: "no-information",
        member: "observed",
        why:
          `${num(evidence.phasesSinceLastWrite)} phases since last write is below the ` +
          `${num(evidence.thresholdPhases)}-phase threshold`,
      };
    }
    case "attested":
      return {
        reading: "no-information",
        member: "attested",
        why:
          "no attestation verifier exists in this substrate; verifying would require walking to the " +
          `named ${describeVendorTrustRoot(evidence.trustRoot)}, and a chain check of both the ` +
          "deletion and the non-extractable-generation certificates. Unpopulated by design — a stub " +
          "returning success would be fake evidence. The root is NAMED here, which is not the same " +
          "as chained: nothing in this substrate has verified a signature against it, and the " +
          `ceiling if one did is '${evidence.trustRoot.vendorName} says this is genuine ` +
          `${evidence.trustRoot.vendorName} silicon running this measurement'`,
      };
    case "fused":
      return {
        reading: "no-information",
        member: "fused",
        why:
          "no OTP/eFuse read path exists in this substrate; verifying would require reading the fuse " +
          `bank over a device channel and checking the boot chain ('${evidence.attestedByBootChain}'). ` +
          "Unpopulated by design",
      };
    case "metered": {
      const test = testErasureDissipation(evidence.claimedBitsErased, evidence.measured);
      switch (test.kind) {
        case "refuted":
          return { reading: "refutes-erasure", member: "metered", why: test.why };
        case "not-refuted":
          // Deliberately NOT `supports-frozen`. Surviving a falsification test is not support.
          return { reading: "no-information", member: "metered", why: test.why };
        case "indeterminate":
          return { reading: "no-information", member: "metered", why: test.reason };
      }
    }
  }
}

/**
 * A conflict between two members. **A disagreement is a detection, not a tie to be broken** — a
 * device attesting deletion while the meter shows insufficient dissipation is a finding, and the
 * only honest thing to do with it is report both sides.
 */
export interface Conflict {
  readonly supporting: FrozenMember;
  readonly refuting: FrozenMember;
  readonly why: string;
}

/**
 * Every member's reading plus every conflict between them.
 *
 * **There is no `frozen: boolean` and no `isFrozen()`, and their absence is the design.** Adding
 * one would require a tie-break rule, and a tie-break rule is exactly what the multi-oracle
 * discipline forbids the substrate from holding: the members have different trust roots and
 * different failure modes, so which one a consumer believes is that consumer's policy, made in the
 * open, at its own call site. The same removal-not-annotation move as `BoundJustification`.
 */
export interface FrozenAssessment {
  readonly keyId: string;
  readonly readings: readonly Reading[];
  readonly conflicts: readonly Conflict[];
}

/**
 * Assess a key's frozen-ness from any subset of the evidence family, in any combination.
 * Evidence about a different key is not silently folded in — it is reported as `no-information`
 * with the mismatch named. Key identity compares by ordinal (code-point) order, never by locale.
 */
export function assessFrozen(
  keyId: string,
  evidence: readonly FrozenEvidence[],
): FrozenAssessment {
  const readings: Reading[] = evidence.map((e) => {
    if (stringCompare(e.keyId, keyId) !== 0) {
      return {
        reading: "no-information" as const,
        member: e.member,
        why: `evidence is about key '${e.keyId}', not '${keyId}'`,
      };
    }
    return readEvidence(e);
  });

  const supporting = readings.filter((r) => r.reading === "supports-frozen");
  const refuting = readings.filter((r) => r.reading === "refutes-erasure");

  const conflicts: Conflict[] = [];
  for (const s of supporting) {
    for (const r of refuting) {
      conflicts.push({
        supporting: s.member,
        refuting: r.member,
        why:
          `'${s.member}' supports frozen while '${r.member}' refutes the erasure claim. ` +
          "Independent evidence with independent failure modes disagrees; this is a detection, " +
          `not a tie-break. Supporting: ${s.why} | Refuting: ${r.why}`,
      });
    }
  }
  conflicts.sort(
    (a, b) => stringCompare(a.supporting, b.supporting) || stringCompare(a.refuting, b.refuting),
  );

  return { keyId, readings, conflicts };
}
