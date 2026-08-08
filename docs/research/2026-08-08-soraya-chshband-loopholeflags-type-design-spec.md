# ChshBand + LoopholeFlags — type design spec (Soraya)

**Date:** 2026-08-08
**Author:** Soraya (formal-verification-expert), via routing by Otto (shadow*)
**For:** workitem `081KZHC652A08QG0R003YX1G29` — unblocks Alexa Task A (Analytics wrappers)
**Home:** `src/Core/AntiSybil.fs` (module `AntiSybil`, after `chshSybilCalibrated`, ~line 235)
**Status:** design spec — ready to implement + verify. Not yet implemented.

> **Provenance note (Otto):** Soraya's agent ran against a slightly stale checkout and
> reported `DecorrelationExcess.fs` and the `2026-08-02-adversarial-chsh-soundness-commit-probe-register3-lumen.md`
> doc as "not present under those names." Verified on current `origin/main` 2026-08-08:
> **all of them exist** (`src/Core/DecorrelationExcess.fs`, `Decorrelation.fs`,
> `DelayDecorrelation.fs`, `BellTest.fs`, and the soundness doc). No prereq to flag; the
> design binds correctly against the real tree. Spec preserved verbatim below.

---

## Routing note (why two types, not one)

The two types split cleanly by what tool certifies them:

- **`ChshBand`** is *decidable real arithmetic over the CHSH bounds* — boundary placement
  and total order are Z3/dReal territory, cross-checked by FsCheck. Cheap. No model checker.
- **`LoopholeFlags`** carries *no arithmetic* — a neutral fact-record. Its only obligation
  is dual-use neutrality (names the open loophole, never the verdict) and correct composition.
  FsCheck alone suffices.

The load-bearing soundness claim lives at the **composition** of the two — the BP-16
cross-check surface: the FsCheck property that `classifyBand` agrees with the shipped
`chshSybilCalibrated` gate is one independent witness; a Z3 lemma on the boundary arithmetic
is the second. Do NOT ship `ChshBand` on the FsCheck property alone — single-tool P0
evidence is insufficient.

---

## 1. `ChshBand`

```fsharp
/// A classification of an observed CHSH statistic `Ŝ` into the four bounded
/// regimes, calibrated to the reading's own sample size. Names the STATISTICAL
/// FACT (which regime the value falls in at this n, δ) — NOT a verdict.
/// "Quantum band" is NOT "shared source"; the reading is only as trustworthy as
/// its `LoopholeFlags` are closed. Dual-use-neutral.
///
/// Cases are declared ASCENDING so F# structural comparison gives the total order
/// Classical < SoundMargin < Quantum < SuperQuantum for free. Conviction is
/// `>= Quantum`; `Classical`/`SoundMargin` never convict.
type ChshBand =
    /// |Ŝ| <= 2 (ClassicalBound). LHV / shared-past-randomness consistent. Never convicts.
    | Classical
    /// 2 < |Ŝ| <= 2 + ε(n, δ). Above classical but INSIDE the finite-sample margin:
    /// indistinguishable from an honestly-local pair at the bound (Soraya 2026-07-02).
    /// MUST NOT convict — the band a bare-2.0 threshold falsely collapses.
    | SoundMargin
    /// 2 + ε(n, δ) < |Ŝ| <= 2√2 (TsirelsonBound, within slack). Convicts a common
    /// cause ONLY to the extent the reading's loopholes are closed.
    | Quantum
    /// |Ŝ| > 2√2 + slack. Beyond Tsirelson: unreachable by real QM. The
    /// superdeterminism / seed-control / PR-box tell (BellTest AlgebraicMax=4).
    | SuperQuantum
```

### Classifier signature

```fsharp
/// Classify `s` (raw signed Ŝ from `chshS`) against the bounds, calibrated to
/// this reading's run length. Arg order mirrors `chshMargin (delta) (rounds)` so it
/// partial-applies; `s` last so it pipes. `rounds` = pair's min stream length.
///
/// Boundary policy SOUNDNESS-BIASED: escalation requires STRICT exceedance, so every
/// tie falls to the WEAKER band. Tsirelson edge uses the same 1e-12 slack as
/// `BellTest.exceedsTsirelson`. Degenerate n: `chshMargin` returns +infinity for
/// rounds <= 0, so every |s| > 2 lands in SoundMargin — nothing convicted without samples.
val classifyBand : delta:float -> rounds:int -> s:float -> ChshBand

/// Explicit ordinal (0..3): Classical=0 .. SuperQuantum=3.
val bandRank : ChshBand -> int

/// Arithmetic gate only (`band >= Quantum`) — NOT a verdict; conviction also
/// requires loopholes closed (§3).
val bandConvictsArithmetically : ChshBand -> bool
```

Reference implementation shape (boundaries only):

```fsharp
let classifyBand (delta: float) (rounds: int) (s: float) : ChshBand =
    let a = abs s
    let eps = chshMargin delta rounds              // +inf when rounds <= 0
    let tsirelson = BellTest.TsirelsonBound + 1e-12
    if   a <= BellTest.ClassicalBound        then Classical      // ties -> weaker
    elif a <= BellTest.ClassicalBound + eps  then SoundMargin
    elif a <= tsirelson                      then Quantum
    else                                          SuperQuantum
```

### Invariants (`ChshBand` / `classifyBand`)

1. **Total order, declaration-aligned.** `Classical < SoundMargin < Quantum < SuperQuantum`; `bandRank` a strictly monotone embedding into `{0,1,2,3}`.
2. **Sign invariance.** `classifyBand d n s = classifyBand d n (-s)`.
3. **Monotone in |S| at fixed (d,n).** `|s1| <= |s2| ⇒ classifyBand d n s1 <= classifyBand d n s2`.
4. **Gate agreement (soundness-critical, cross-check surface).** For all `d ∈ (0,1)`, `n > 0`, `s`: `bandConvictsArithmetically (classifyBand d n s) ⇔ abs s > 2.0 + chshMargin d n`. Must never disagree with `chshSybilCalibrated`'s union predicate.
5. **Soundness-biased boundaries.** `|s|=2 ⇒ Classical`; `|s|=2+ε ⇒ SoundMargin`; `|s|=2√2 ⇒ Quantum`. Ambiguity never escalates.
6. **Valid-quantum ⇒ not SuperQuantum.** `|s| <= 2√2 + 1e-12 ⇒ band ≠ SuperQuantum`.
7. **Degenerate-n never convicts.** `rounds <= 0 ⇒ band ∈ {Classical; SoundMargin}` for every finite `s`.

---

## 2. `LoopholeFlags`

```fsharp
/// Which CHSH loopholes are OPEN (uncontrolled) for a reading. Each bool is a
/// NEUTRAL FACT about the setup, never a verdict: `true` = open, so a Bell
/// violation here has a loophole-local classical explanation and CANNOT on its
/// own convict a common cause. Caller's oracle decides MEANING. No `IsGenuine`/
/// `IsForgery` field, by construction.
type LoopholeFlags =
    { /// Detection / fair-sampling: outcomes may be post-selected. Open ⇒ a
      /// detection-efficiency model can fake violation.
      Detection: bool
      /// Locality / no-signaling: streams NOT space-like separated; setting choice
      /// could reach the other side in-round. Open ⇒ an in-tick channel (not
      /// entanglement) can produce |S| > 2.
      Locality: bool
      /// Measurement-independence / freedom-of-choice: settings may correlate with
      /// the hidden variable / process state. Open ⇒ superdeterministic / conducted
      /// correlation up to algebraic max S=4.
      MeasurementIndependence: bool
      /// Coincidence-time: cross-stream round pairing may be outcome-dependent.
      /// Open ⇒ windowing can manufacture correlation.
      Coincidence: bool }

/// No loophole open — the only config under which a Quantum/SuperQuantum band may
/// be read as conviction.
val loopholesAllClosed : LoopholeFlags

/// Loophole profile of an S over TWO COMMIT STREAMS FROM THE SAME PROCESS.
/// Load-bearing default (soundness-doc conclusion): Locality + MeasurementIndependence
/// OPEN (one process, no space-like separation, no independent settings), Detection
/// OPEN (no fair-sampling on commit-derived outcomes). Any S over same-process commit
/// pairs MUST carry this profile.
val commitPairLoopholes : LoopholeFlags
//  = { Detection=true; Locality=true; MeasurementIndependence=true; Coincidence=true }

val anyOpen : LoopholeFlags -> bool
val convictionLoopholesClosed : LoopholeFlags -> bool   // Detection ∧ Locality ∧ MI closed
```

### Invariants (`LoopholeFlags`)

1. **Neutrality (structural).** Only per-loophole facts; no verdict field. (Review + Semgrep, not a runtime property.)
2. **`loopholesAllClosed` is the identity of openness.** `anyOpen loopholesAllClosed = false`.
3. **`commitPairLoopholes` has Locality ∧ MeasurementIndependence open.** `convictionLoopholesClosed commitPairLoopholes = false` — the fact that makes "quantum band over commits ⇒ shared source" unsound.
4. **Monotone weakening.** Opening any loophole only moves trust down.

---

## 3. Composition — what an Analytics wrapper may conclude

```fsharp
/// The only thing a (band, loopholes) pair licenses. Neutral facts, one-way.
type ChshReadout =
    | NoViolation of ChshBand                          // Classical | SoundMargin
    | CommonCauseConvicted of ChshBand                 // band >= Quantum && loopholes closed
    | ViolationButLoopholesOpen of ChshBand * LoopholeFlags

val readout : ChshBand -> LoopholeFlags -> ChshReadout
//  NoViolation                when band < Quantum
//  CommonCauseConvicted       when band >= Quantum && convictionLoopholesClosed
//  ViolationButLoopholesOpen  otherwise
```

An Analytics wrapper, given `(ChshBand, LoopholeFlags)`, may conclude **only**:

- **`Classical`/`SoundMargin`** (any loopholes): *no conviction.* NEVER "identities proven distinct" — the CHSH oracle is one-way; distinctness is proven by the other legs (captured entropy + model-checked exchange history), never by low S.
- **`Quantum`/`SuperQuantum` with loopholes closed:** the neutral fact *"common cause: shared seed or in-tick channel"* is convicted (one-way; never acquits). Reunion vs sybil = caller-oracle policy.
- **`Quantum`/`SuperQuantum` with any conviction loophole open** — **always** the case for same-process commit pairs (`commitPairLoopholes`): the wrapper **must not** conclude shared source from S. It reports `ViolationButLoopholesOpen` and routes to the excess-over-null instrument (`DecorrelationExcess.fs` / `Decorrelation.fs` / `DelayDecorrelation.fs`). This is the whole point of pairing the types: **a band reading is trustworthy only to the extent its loopholes are closed**, and for commits they are open by construction — the type system now makes that unsoundness un-ignorable.
- **`SuperQuantum`** additionally is a neutral setup-diagnostic (beyond Tsirelson ⇒ MI almost certainly open / seed control), not a stronger sharing claim.

---

## 4. Property-test obligations (FsCheck)

1. **`prop_band_gate_agrees_with_calibrated_oracle`** *(BP-16 cross-check — highest value).* `∀ d∈(0,1), n>0, s`: `bandConvictsArithmetically (classifyBand d n s) = (abs s > 2.0 + chshMargin d n)`. Pin to `chshSybilCalibrated`'s union predicate (FsCheck witness of Invariant 4). Pair with a **Z3 lemma** on the same boundary arithmetic — two-tool floor for this P0.
2. **`prop_band_monotone_and_sign_invariant`.** Sign invariance + `|s1|<=|s2| ⇒ band1<=band2`. Covers Invariants 1–3.
3. **`prop_soundness_bias_and_valid_quantum`.** Ties fall weaker; `|s|<=2√2+1e-12 ⇒ ≠SuperQuantum`; `n<=0 ⇒ band∈{Classical;SoundMargin}`. Covers Invariants 5–7.
4. **`prop_commit_pairs_never_convict_from_S`.** `∀ band`: `readout band commitPairLoopholes` is never `CommonCauseConvicted` — even at SuperQuantum. The executable statement of the soundness-doc conclusion.

---

## Files to bind against

- `src/Core/AntiSybil.fs` §CHSH: `ChshRound`, `chshS`, `coordinationBandwidth`, `chshMargin`, `chshSybilCalibrated`. New types go after `chshSybilCalibrated` (~line 235).
- `src/Core/BellTest.fs`: `ClassicalBound (2.0)`, `TsirelsonBound (2√2)`, `AlgebraicMax (4.0)`, the `1e-12` slack from `exceedsTsirelson`.
- Loophole-open fallback: `src/Core/DecorrelationExcess.fs` / `Decorrelation.fs` / `DelayDecorrelation.fs` (excess-over-null).

## Coverage-gap callout

Invariant 1 of `LoopholeFlags` (neutrality — no verdict field) is a *structural* property FsCheck can't assert. Route it to a **Semgrep rule** on the type (`.semgrep.yml`) rather than leave it as untested trust.
