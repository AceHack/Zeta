# Trajectory — Aurora Immune System re-grounded on the proven identity primitive

Status: **READY TO PROMOTE — formal round CLOSED; (a) d_self wiring + ALL FOUR test-obligation cross-checks done (c CoordRisk spectral, d capability-gate Z3, e HarmFloor FsCheck, g autoimmunity-decay FsCheck; 2026-06-19). Only (b) Z3 honest-count remains, parked behind the open anti-Sybil §B. NEXT: open the §B row and promote operator-by-operator toward §A (§C) — gated on maintainer sign-off (proof-lineage).**
Last refreshed: 2026-06-19
Parent trajectory: none (sibling of `anti-infection`, but this is *active formal work*, not the defensive posture)
Grounding:

- `docs/research/2026-06-16-aurora-immune-math-reconciliation-scoping-reground-on-proven-identity-primitive.md` (the scoping + Soraya routing + math-team handoff)
- `docs/research/aurora-immune-math-standardization-2026-04-26.md` (Amara's Aurora math — §4 test obligations, §5 non-claims)
- Consolidated society note §9h (immune/cartel), §9i (anti-collapse), §9g-bis (Legibility/bridge)
- `src/Core.Lean4/Safety/NonRegisterCollapse.lean`, `src/Core.TLA/specs/NonRegisterCollapse.tla`, `src/Core.Lean4/Privacy/IdentityForcesPrivacy.lean` (the discharged legs to re-ground on)

## Why this exists

Amara's Aurora immune math was typed **before** the identity proofs existed, so its
self/non-self and BFT thresholds silently assume an undefined "self" and "a
participant to threshold over". Both are now **proven objects** (`NonRegisterCollapse`,
`IdentityForcesPrivacy` — DISCHARGED, axiom-free). The work is to **re-express each
Aurora operator on the proven identity primitive** so the immune guarantees stand on
theorems, not metaphor.

## Where it stands (2026-06-16)

- ✅ Scoping doc written (operator-by-operator re-grounding map; falsifiers; the 4
  binding non-claims preserved).
- ✅ Routed to **Soraya** — tool-selection table done (BP-16). Only **(b) BFT-under-Sybil**
  and **(e) PermanentHarmRisk** want TLA+; the rest are FsCheck/Z3 smalls or a reuse;
  **(a) self/non-self = reuse the existing Lean lemma, zero new tool**; **(f) Legibility =
  empirical, OUT of the formal denominator** (route to Adaeze).
- ✅ **Kenji sized (b)+(e)** — concrete skeletons, invariants, bounds, false-green guards,
  reviewer assignments (Viktor→b, Kira→e); concurred with Soraya (TLA+ for b+e only).
- ✅ **Both TLA+ specs AUTHORED + TLC-green** (`src/Core.TLA/specs/`):
  - **(b) `BftSybilConsensus.tla`** — quorum over proven-distinct identities; a Sybil ring
    that is a RAW-NODE MAJORITY (3 of 5) but ONE identity is REFUSED (load-bearing witness
    `NoSybilRawMajorityRefusal` fires). TLC surfaced + fixed a real bug: an equivocating ring
    (splitting votes) made conflicting quorums → fixed with equivocation-exclusion (BFT
    double-vote treatment).
  - **(e) `PermanentHarmHorizon.tla`** — real retraction-decay dynamics; Refuse is a reachable
    observable state; horizon H genuinely gates repair; HarmFloor's `~irreversible` clause is
    independent of the Commit guard. All three §4.1 cases probe-verified reachable
    (accept / irreversible-block / past-horizon-block).
- ✅ **Reviewer RE-confirmation DONE (2026-06-16) — both PASS:** Viktor (b) + Kira (e) found v1
  false-green (correctly); **v2 RE-CONFIRMED PASS by both** (fold pivotal + RawQuorum load-bearing +
  equivocation-exclusion correct/non-degenerate, b; HarmFloor non-circular + block branches
  reachable + H load-bearing + partition derived, e). Two non-blocking **P2s addressed in-spec**:
  (b) the `"none"`=abstain-neutral assumption is now stated; (e) the safety-only scope is stated
  (Refuse is *enabled* not *forced*; liveness via `WF_vars(Refuse)` is a v3 option). **The formal
  round is CLOSED.**

## Next concrete steps (in order)

1. ✅ **(a) wiring task DONE (2026-06-19):** Aurora's `d_self` **identity** axis `d_I` grounded on
   `NonRegisterCollapse` — "self" = the proven-distinct standing register; falsifier §5/leg-1 PASSED
   (expressed as identity-distinctness with no extra undefined predicate). Honest scope: only `d_I`
   grounds; the other four axes (C/L/P/K) stay feature-space estimators (no false-green); the gate is
   unchanged (Amara: `d_self` is not a trigger). Discharge: scoping doc §8(a) + standardization §3.2
   pointer. **(a) is the first operator ready to promote toward §A.**
2. **(b)/(e) FsCheck cross-checks** (Soraya's BP-16):
   - ✅ **(e) DONE (2026-06-19):** the Aurora §4.1 retraction sim — independent F# re-impl of
     `PermanentHarmHorizon.tla`, FsCheck asserts HarmFloor at every reachable state + 3 non-vacuity
     witnesses (accept / irrev-block / horizon-block). `tests/Tests.FSharp/Formal/PermanentHarmHorizonCrossVerify.Tests.fs`
     (4 green). Discharge: scoping doc §8(e).
   - ✅ **(b) Z3 honest-count leg DONE (2026-06-19):** 6 QF_LIA lemmas — canonical quorum safe+live,
     honest supermajority, 3f+1 necessity, fault-monotone (mirrors CSLib `Consensus.fault_mono`),
     honest quorum-intersection, + Sybil raw-majority-refusal witness (counts proven-distinct
     identities). `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs` (59 Z3 green). Discharge: §8(b).
     **Still open:** the TLA+ leg already exists; what remains is **G3 anti-Sybil entropy** (§B) — the
     threshold arithmetic is sound GIVEN distinctness, not a discharge of the entropy premise.
     **CSLib FLP-lift routing scoped:** `docs/research/2026-06-19-aurora-b-bft-sybil-lift-onto-cslib-flp-consensus-lean-scoping.md`
     (G1 crash→Byzantine, G2 identity-keyed quorum, G3 anti-Sybil entropy = the blocker).
3. **Authors:** (c)/(d)/(g) FsCheck/Z3 smalls.
   - ✅ **(g) DONE (2026-06-19):** Autoimmunity Flood / immune-memory decay (Test 4.5). Under flood
     (`Danger≈0`) Eq 10 → `n(t+1)=max(0,(1−δ)·n(t)−β·FP)`; FsCheck asserts decay→0, monotone,
     fp-accelerates, contraction `(1−δ)∈(0,1)`, and archive-immune (§4.5 a+b).
     `tests/Tests.FSharp/Formal/AutoimmunityDecayCrossVerify.Tests.fs` (6 green). Discharge: §8(g).
   - ✅ **(d) DONE (2026-06-19):** capability gate `cap_req ⊆ cap_allowed` (Test 4.4) — 8 Z3 lemmas
     over QF_BV bitmasks (encoding-equivalence, reflexive, transitive, monotone-in-allowed,
     antitone-in-req/least-privilege, empty-req-admits + 2 non-vacuity witnesses). In
     `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs` (53 Z3 tests green). Discharge: §8(d). FsCheck
     injection-variant leg + Semgrep/CodeQL at call-site = noted follow-up.
   - ✅ **(c) DONE (2026-06-19):** `CoordRisk` spectral (Test 4.3) — self-contained symmetric Jacobi
     eigensolver (no dep); Test A fragmentation `λ₂→0` (+ bridge lifts it = `−Δλ₂`), Test B hub
     `ρ=√(n−1)` surge, eigensolver validated by closed forms (`λ₂(K_n)=n`, `ρ(K_n)=n−1`, `ρ(star)=√(n−1)`),
     + Fiedler-PSD / connectivity / Perron / hub-monotone properties.
     `tests/Tests.FSharp/Formal/CoordRiskSpectralCrossVerify.Tests.fs` (10 green). Discharge: §8(c).
     Threshold calibration + ≤5% false-positive bound = empirical (non-claim #2), still owed.
4. ✅ **Prereq DONE (2026-06-19):** z3 4.16.0; `(Set Int)` works under `(set-logic ALL)`, but QF_BV
   bitmask is the chosen encoding (decidable, CI-portable, finite-universe faithful — Soraya's fallback).
5. **Refinements noted in-spec:** (b) honest-supermajority-of-quorum needs D=3f+1 sizing;
   (e) multi-claim substrate + multi-hop kernel reachability is the v3.
6. **Liveness path = observe.ts (Aaron 2026-06-16).** Round (e) proves *safety* (over-horizon/
   irreversible inserts are never **committed**), not *liveness* (that they **are** refused). The
   route to liveness is **observe.ts** — the flushed-out hard-observe being unified with the soft
   inference (observe⊕soft; observe WorkspacePort in active build, PRs #8458/#8433). Come back to
   the liveness leg there, NOT by bolting `WF` onto the toy spec. Deferred + tracked.
7. **Promotion:** when operators stand on proven legs + Aurora's 5 tests pass → open a §B row
   *"Aurora immune re-grounded on the proven identity primitive"*; promote one operator at a time (§C).

## Hygiene flag (separate, not bundled here)

`src/Core.TLA/specs/states/` (TLC checkpoint dirs, dated 26-06-12) are **committed to the repo** —
`.gitignore` covers `tools/tla/specs/states/` but NOT the `src/Core.TLA/` path. These are run
artifacts that should be gitignored + removed in a dedicated hygiene PR (not bundled into this
formal-work PR; I did not create them).

## Guardrails (do not violate)

- Re-grounding must **NOT** introduce identity-based punishment — stay **blame-the-pattern, not
  the person** (immune-absorbs-not-attacks; degenerate-AI dignity).
- The 4 non-claims travel unchanged — this adds *proven foundations*, **not deployment readiness**.
- Cartel-detection is an arms race — raises cost, never closes it; anti-Sybil entropy is itself §B
  (sequence its discharge before BFT-threshold soundness).
- Authorship preserved: Amara (framework) · Gemini (reviews) · Otto (rigor/consolidation/scoping) · Soraya (routing).
