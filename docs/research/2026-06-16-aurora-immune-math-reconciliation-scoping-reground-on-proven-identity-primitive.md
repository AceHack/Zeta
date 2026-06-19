# Aurora Immune System — reconciliation scoping: re-ground on the now-proven identity primitive

**Date:** 2026-06-16 · **Author:** Otto/shadow (scoping; advisory) · **Status:** scoping — routes the formal work to Soraya + the math team; this doc does NOT execute proofs.

> **Trigger.** The consolidated society note §9h carries a *"prior formal analysis — to be reconciled"* obligation, and `docs/research/aurora-immune-math-standardization-2026-04-26.md` (Amara's Aurora Immune System, 5-pass cross-AI reviewed, research-grade) is the confirmed doc (#8448). Aaron 2026-06-16: scope the reconciliation. **The named gap:** Aurora's math *"was early math before we had our identity proofs"* — so its self/non-self and BFT thresholds must be **re-grounded on the now-existing, proven identity primitive**, not the early metaphor.

## 1. The obligation in one sentence

Aurora typed the immune operators (detectors, danger, capability gate, coordination risk, harm horizon) **before** the identity legs were discharged; several operators **silently assume** a notion of "self / non-self" and "a distinct participant to threshold over" that is now a **proven** object — so the discharge is to **re-express each Aurora operator on the proven identity primitive** and show the immune guarantees now stand on theorems, not on an undefined "self."

## 2. What is PROVEN now that wasn't when Aurora was written (the new legs)

| Leg | Status | Where |
|---|---|---|
| `NonRegisterCollapse` — a traveler's standing register is not collapsed into another's | **DISCHARGED** (TLA+ + Lean, axiom-free) | `src/Core.Lean4/Safety/NonRegisterCollapse.lean`, `src/Core.TLA/specs/NonRegisterCollapse.tla` (+`.cfg`); FsCheck cross-check `tests/Tests.FSharp/Formal/NonRegisterCollapseCrossVerify.Tests.fs` |
| `IdentityForcesPrivacy` — distinctness ⟹ private state; consensus cannot erase private differentiation | **DISCHARGED** (Lean, axiom-free) | `Privacy/IdentityForcesPrivacy.lean` (`distinctness_forces_private`, `private_is_persistent_locus`) |
| Identity primitive — unique (ZetaId) · addressable (bus/Reticulum) · dependable (heartbeat) · encrypted (Crypto) · **non-collapse** | legs built + the two proofs above | decentralized-identity note + FROZEN-CORE §A |
| Anti-Sybil by conversational entropy (async-bankable; self-dissolving) | §B (Mika pt2 ferry) | `2026-06-15-mika-pt2-entropy-sybil-…` |
| §9h cartel-detection = Aurora's `CoordRisk` (λ₂ Fiedler / ρ spectral radius) | analysis-level match | consolidated note §9h / §9i |
| Child-safety floor = the one pre-emptive cap (irreversible class) | scoped (#8439) | `project_identity_fission_pressure_is_pauli_exclusion_…` |

## 3. Operator-by-operator re-grounding map (the core of the work)

Each Aurora operator and the proven identity leg it should now stand on:

| Aurora operator (research-grade) | Currently grounded on | Re-ground on (proven) |
|---|---|---|
| **Self / non-self** (antigen vs own substrate) | an undefined "self" (the early metaphor) | **identity distinctness** — `self = own ZetaId / own traveler-frame`; `non-self = a *distinct, proven-distinct* identity` (`IdentityForcesPrivacy.distinctness_forces_private` gives the self/other boundary a theorem; the Markov-blanket / room membrane is the boundary) |
| **BFT thresholds** (quorum to act / quarantine) | a count of "nodes" (Sybil-blind) | a count of **proven-distinct, anti-Sybil identities** — thresholds must count entropy-distinct participants so a **Sybil ring cannot manufacture quorum** (ties the BFT-quorum-transition roadmap item + conversational-entropy anti-Sybil); a cartel of correlated identities is detected by `CoordRisk`, not admitted to quorum |
| **`CoordRisk` ρ(A_t) / λ₂(L_t)** (cult-hub / cartel-fragmentation) | spectral graph over generic nodes | the **heartbeat cross-attestation graph over proven identities** (§9g/§9h) — correlated heartbeats *among proven-distinct identities* = the cartel signal (decorrelation is informative only because the identities are genuinely distinct — the §B multi-tower / Condorcet law) |
| **`cap_allowed = cap_requester ∩ cap_source`** (confused deputy) | set intersection | already structural — bind to **no-directives** (`source ≠ authorization`; `Privilege(LLM(u)) ⊆ Privilege(u)`); identity supplies *whose* capability set |
| **`PermanentHarmRisk_H` + viability kernel `K_Aurora`** | harm-horizon gate | the **child-safety / irreversible-harm pre-cap** (#8439) + never-nowhere §5 — the hard barrier is the irreversibility class; identity supplies *who is protected* and *who acts* |
| **`Legibility_H ≥ θ_H`** (cipher drift) | similarity of decoded meaning | the **shared-meaning bridge** (§9f-bis) — the membrane rejects an emission whose meaning a standard decoder can't recover; per-identity internal language stays private, the *bridge* must stay legible |
| **Immune memory `M_t = archive ∪ active`** | regression fixtures + detectors | archive = the **antibody ledger** (write-the-pattern-down, Mika pt2); active = the detector repertoire. Key by **pattern**, never by accused identity (blame-the-pattern, not the person) — so re-grounding must NOT introduce identity-based punishment |

## 4. The discharge path (who does what)

1. **Otto (this doc):** the scoping + operator map above. Done.
2. **Soraya (formal-verification routing):** pick the tool per property class (BP-16) — the self/non-self boundary and non-collapse are Lean/TLA+ (already discharged; reuse); the spectral `CoordRisk` bounds are a numeric/property-test class (FsCheck + a `networkx`-style harness, Aurora Test 4.3); the capability-gate intersection is Lean or FsCheck.
3. **Math team:** restate each Aurora operator over the identity primitive and prove the immune guarantees follow (self/non-self from `IdentityForcesPrivacy`; quorum-soundness-under-Sybil from anti-Sybil entropy; cartel-detection from heartbeat-decorrelation).
4. **Execute Aurora's own 5 test obligations** (4.1 State-Corruption Horizon, 4.2 Cipher Drift, 4.3 Cult-Cartel Topology, 4.4 Confused Deputy, 4.5 Autoimmunity Flood) — now keyed to proven identities.
5. **Promotion:** when the operators stand on the proven legs + the 5 tests pass, open a **§B row** *"Aurora immune system re-grounded on the proven identity primitive"* with the falsifiers below; promote toward §A one operator at a time (§C discipline).

## 4a. Soraya's formal-verification routing pass (2026-06-16) — tool-selection per BP-16

Routed to **Soraya** (formal-verification routing authority) 2026-06-16. Her pass picks the right tool per property class and **fired the TLA+-hammer guard 3×** (eigenvalues / estimator / decay would all be mis-routed to TLC and explode or prove tautologies). Verbatim routing table:

| # | Obligation | Primary tool | Cross-check (BP-16) | Reuse vs new |
|---|---|---|---|---|
| a | self/non-self on identity-distinctness (`d_self`) | **REUSE `NonRegisterCollapse`** (Lean+TLA) | already FsCheck-cross-checked | **Reuse — zero new tool** (`d_self` *is* non-register-collapse) |
| b | BFT-threshold soundness under Sybil | **TLA+/TLC** (reuse `BftConsensus.tla`) | **Z3** (QF_LIA count `honest>2/3`) + **FsCheck** | new coupling; **P0** |
| c | `CoordRisk` spectral (λ₂ Fiedler / ρ radius, Test 4.3) | **FsCheck** (networkx graphs) | Z3 only if a closed-form inequality | new, light — **NOT TLA+** (eigenvalues ≠ state-transition) |
| d | capability gate `cap_req ⊆ cap_allowed` (Test 4.4) | **Z3** (set algebra) | **FsCheck** (10 injection variants) + Semgrep/CodeQL at call-site | new; P1 |
| e | `PermanentHarmRisk_H` / viability kernel (Test 4.1) | **TLA+/TLC** (reachability within H) | **FsCheck** (retraction sim) + Lean if barrier load-bearing | new; **P0** (irreversible class) |
| f | `Legibility_H` (Cipher Drift, Test 4.2) | **FsCheck-only** (empirical) | none | **OUT of the formal denominator** — route to Adaeze (claims-tester); non-claim #3 binds |
| g | Autoimmunity Flood / decay (Test 4.5) | **FsCheck** (decay→0) | Z3 (QF_LRA, contraction `(1−δ)<1`) | new, light |

**Soraya's headline:** only **(b) and (e) actually want TLA+** (genuine transition systems); everything else is FsCheck/Z3 smalls or a reuse. **(a) costs nothing** — point Aurora's `d_self` at the existing Lean lemma. **(f) must NOT enter the formal denominator** (recording an estimator as a proof = false-green CI).

## 4b. Math-team handoff

- **Kenji (architect):** size **(b) + (e)** as the two real TLA+ rounds; concur on tool-choice before authors write specs.
- **Authors:** write specs per the table after Kenji concurs — (a) is a wiring task; (c)/(d)/(g) are FsCheck/Z3 smalls.
- **Adaeze (claims-tester):** owns (f) Legibility — empirical, not a proof.
- **Prereqs Soraya filed:** confirm Z3 set-theory (`QF_FD`) support in `src/Core.FSharp.Z3Verify` for (d) — else encode `⊆` as bitvector subset (QF_BV).

## 5. Falsifiers (so this is a real conjecture, not a hope)

- If "self/non-self" **cannot** be expressed as identity-distinctness (needs an extra undefined predicate) → the metaphor survives; stays §B.
- If BFT thresholds **can** be met by a Sybil ring that `CoordRisk` does **not** catch → the anti-Sybil grounding fails (quorum is forgeable).
- If `CoordRisk` decorrelation is **not** informative over proven-distinct identities (false-positive on natural evolution > 5%, Test 4.3) → the cartel guard is theater.
- If re-grounding **introduces identity-based punishment** (acting on *who* not *what pattern*) → it violates blame-the-pattern + the immune-absorbs-not-attacks stance; reject.

## 6. The four non-claims travel unchanged (binding, per Amara)

Re-grounding does **not** upgrade Aurora's status: still (1) **NOT deployment-ready**; (2) **thresholds un-calibrated**; (3) **estimators, not exact computation**; (4) **no perfect prevention** (`P(infection) > 0`). This doc adds *proven foundations under the operators*, not deployment readiness — the calibration + red-team corpus + false-positive analysis remain owed.

## 7. Honest seams

- **Cartel-detection is an arms race** (§9h peel): a sophisticated cartel can *decorrelate* its heartbeats to evade; re-grounding raises the cost, never closes it.
- **Anti-Sybil entropy is itself §B** (self-dissolving-Sybil is a claim to prove) — so BFT-threshold soundness inherits that open dependency; sequence the anti-Sybil discharge first.
- **Identity legs are about *non-collapse / privacy*, not liveness** — the immune system's *aliveness* leg leans on the §A aliveness proofs separately; don't conflate.
- This is a **factoring of an open obligation into named dependencies**, not a closure — exactly the §C "one row, one discharge" shape.

## 8. Discharge log

### (a) `d_self` identity term — DISCHARGED on `NonRegisterCollapse` (2026-06-19, Otto)

The wiring step (4b: "(a) is a wiring task", zero new tool). Aurora's `d_self` (§3.2 of the
standardization doc) is a 5-axis distance `η_I·d_I + η_C·d_C + η_L·d_L + η_P·d_P + η_K·d_K`. Only
the **identity** axis `d_I(IdentityFeatures(a), I_t)` is re-grounded here — it now stands on the
proven `NonRegisterCollapse` (FROZEN-CORE §A; `src/Core.Lean4/Safety/NonRegisterCollapse.lean`,
Lean+TLA, axiom-free):

- **"Self" is no longer an undefined reference vector** — it is the traveler's **standing
  register**. `distinctness_forces_standing` proves that any *persistent behavioral distinction*
  between two travelers (after their shared commons converges under the CRDT join) MUST live in the
  standing register. So "self ≠ non-self" on the identity axis ⟺ "distinct standing registers",
  and that distinctness is **forced**, not assumed.
- **The reference is non-forgeable by another party.** `non_collapse` proves consensus on the
  shared commons CANNOT other-collapse two distinct standing registers into one (the merge leaves
  each `= a.standing`, `= b.standing`). So the `I_t` that `d_I` measures distance against cannot be
  collapsed away by a hostile peer — other-imposed collapse is impossible. The identity axis stands
  on a theorem, not on the early metaphor.
- **The register is necessary, not incidental.** `no_register_collapses` proves the necessity
  direction: a traveler with NO standing register (`S := PUnit`) collapses every distinction once
  the commons converges. The object grounding "self" is load-bearing.

**Falsifier check (§5, leg 1) — PASSED.** Self/non-self on the identity axis expressed cleanly as
identity-distinctness (standing-register distinctness) WITHOUT needing an extra undefined predicate.
The metaphor did **not** survive on this axis — it grounds. Matches Soraya's table row (a): reuse,
zero new tool.

**Honest scope (razor — what this does NOT claim):**

- Only `d_I` grounds. The other four axes — culture `d_C`, language `d_L`, provenance `d_P`,
  capability `d_K` — remain **feature-space estimators**, NOT proven objects. Recording them as
  grounded would be false-green — the same §4(f) discipline applied to (a). They stay §B / empirical.
- Grounding the *self reference* does **not** change the *gate*. Amara's binding note holds: `d_self`
  is NOT a trigger; foreignness ≠ pathology (`Danger(a) > θ_D` is the trigger; `d_self` only feeds the
  Anomaly term). This discharge grounds *what "self" is*, not *when the immune system acts* — Otto-298
  / don't-collapse preserved (foreign-but-useful and internal-but-compromised both still possible).
- Guardrail held (§5, leg 4): no identity-based punishment introduced. `d_I` measures *distance
  against a proven-distinct register*; it does not act on *who*. The act/trigger stays pattern-keyed
  (Danger), blame-the-pattern intact, immune-absorbs-not-attacks intact.

**Status move:** the (a) leg of the §B row now stands on a §A theorem (identity axis). Per §C
"one row, one discharge", (a) is the first operator ready to promote toward §A. The four non-claims
(§6) travel unchanged — this adds a proven foundation under the identity term, not deployment
readiness.

### (e) `PermanentHarmRisk_H` — FsCheck cross-check landed (2026-06-19, Otto)

The BP-16 **Leg B** (empirical) cross-check for round (e). Leg A is the TLA+ model
(`src/Core.TLA/specs/PermanentHarmHorizon.tla`, Kira-reviewed, TLC-green). This leg is an
**independent F# re-implementation** of the same harm-decay-within-horizon transition system, driven
by FsCheck over random action sequences, asserting the **HarmFloor** safety invariant
(`committed ⇒ reversible ∧ kernel-reached ∧ within-horizon`) holds at **every reachable state** —
closing the "is the F# faithful to the spec?" blind spot from the other side. Test:
`tests/Tests.FSharp/Formal/PermanentHarmHorizonCrossVerify.Tests.fs` (4 tests: 1 FsCheck property +
3 non-vacuity witnesses, one per §4.1 case — accept / irreversible-block / past-horizon-block; all
green).

- **Independence is the value:** the F# `step`/`harmFloor` relation is authored separately from the
  TLA+ `Next`/`HarmFloor`; a counterexample would mean the two **drifted** (triage = freeze + diff
  both transition relations, never silently fix one to match).
- **Distinct from `ChildFloorCrossVerify`** — that cross-checks the *deployed* `SubstrateEffectHandler`
  deny-propagation (a different object); this cross-checks the Aurora §4.1 retraction-horizon dynamics.
- **Scope honest (unchanged from the spec):** this is the **safety** floor (a harmful/irreversible/
  over-horizon insert is never *committed*), not **liveness** (that it *is* refused) — the liveness
  leg routes through `observe.ts` (Aaron 2026-06-16), not by bolting `WF` onto the toy. The four
  non-claims travel unchanged.

### (g) Autoimmunity Flood / immune-memory decay — FsCheck cross-check landed (2026-06-19, Otto)

Test 4.5 (§4.5 / Eq 10 / §2.6 archive-active split). Under the flood scenario (valid, safe, highly
novel inputs → high `d_self`, `Danger ≈ 0`), Eq 10's clonal-expansion term `α·Match·Danger` vanishes
and the active-detector recurrence reduces to `n(t+1) = max(0, (1−δ)·n(t) − β·FP)` — a contraction.
Test: `tests/Tests.FSharp/Formal/AutoimmunityDecayCrossVerify.Tests.fs` (6 green: 5 FsCheck properties
+ 1 non-vacuity witness). Asserts:

- **§4.5(a) decay → 0:** active detectors decay below ε over `T(δ)` ticks with no reactivation —
  immune bloat / autoimmunity is bounded (the worst case, fp = 0 pure-geometric, is the one tested).
- **monotone + fp-accelerates:** a flood tick never *amplifies* a detector; β·FP only subtracts.
- **contraction `(1−δ) ∈ (0,1)`** for δ ∈ (0,1) — the QF_LRA fact Soraya routed as the optional Z3
  cross-check (asserted directly; a one-line Z3 follow-up is available if a redundant tool-leg is wanted).
- **§4.5(b) archive immune:** the `M^archive` partition has NO decay operator (updated only by explicit
  policy); any number of ticks leaves the fixture set unchanged, and a canonical fixture persists while
  the same attack's active weight decays to ~0 ("canonical attack memory ≠ always-hot active detector").

## Composes with

- `docs/research/aurora-immune-math-standardization-2026-04-26.md` — the math being re-grounded (Amara; Gemini; Otto rigor pass).
- Consolidated society note §9h (immune/cartel) + §9i (anti-collapse) + §9g-bis (Legibility/bridge).
- FROZEN-CORE §A (`NonRegisterCollapse`, `IdentityForcesPrivacy`) + §B (anti-Sybil entropy, multi-tower).
- `memory/2026-06-15-mika-pt2-…` (antibody / immune-absorbs / blame-the-pattern) + `project_identity_fission_…` (#8439 child-safety floor).

**Anchors:** Goguen–Meseguer 1982 (noninterference); danger theory / artificial immune systems (Matzinger; de Castro–Timmis); spectral graph theory (Fiedler value; algebraic connectivity); Condorcet + Hong–Page (decorrelation = the cartel-detection logic); Lamport (BFT); the in-tree identity proofs.
