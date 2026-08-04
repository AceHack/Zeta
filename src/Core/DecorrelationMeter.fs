namespace Zeta.Core

/// **DecorrelationMeter — the FUSION layer (the meter; `DecorrelationMetrology` = the sensors).**
///
/// Aaron's Itron distinction: metrology = the sensors (raw readings — the sensor layer selects *which*
/// spacelike commit pairs to read); **the meter = the fusion** — combine the pairwise readings into one
/// calibrated reading *with uncertainty*. This module is that fusion.
///
/// **Why spacelike-only (the load-bearing tie to the sensor layer, register-2):** CHSH's guarantee —
/// |S| ≤ 2 for systems sharing only past classical randomness with **no live channel** (Bell 1964;
/// CHSH 1969) — assumes **no signaling** between the two parties. Two commits could only have signaled
/// if one lies in the other's causal past — i.e. they are **timelike** (ancestor-related). So CHSH is
/// valid **only over spacelike (concurrent) pairs**; fusing timelike pairs would let genuine causal
/// influence inflate Ŝ and manufacture a false "coordination" conviction. The sensor layer's spacelike
/// selection *is* the CHSH validity filter — that is why it exists.
///
/// **The null (Aaron): |S| ≤ 2 is the null model AND the monoidal identity.** An independent /
/// decorrelated pair sits at or below the Bell bound; a pair whose measured |Ŝ| exceeds `2 + ε(δ,n)`
/// (`AntiSybil.chshMargin`, Hoeffding — finite-sample-honest, never bare 2.0) **convicts a common cause
/// / in-tick channel** — NOT decorrelated. The fold counting within-vs-above is a commutative monoid
/// with identity `{0;0}` ⇒ **order-independent** (any commit order → one Reading).
///
/// **Registers:** the counts / `DecorrelatedFraction` are **register-2** (a deterministic statistic).
/// Reading that fraction as "sovereignty emergence", or the coincidence structure as a "life-signature"
/// / early failure warning, is **register-3** — the caller's oracle, LABELED, never asserted by the
/// number. Per the dual-use rule, verdicts name the **fact** (`AboveClassicalBound` /
/// `WithinClassicalBound`), never the intent (no "Sovereign"/"Sybil" here).
///
/// **What a commit's PROBE stream is (honest scope):** the per-commit `ChshRound list` is a **sensor /
/// oracle choice, supplied by the caller** — the fusion is correct *given any* probe assignment and
/// deliberately does NOT hardcode a commit→probe mapping (that mapping is a separate, harder,
/// register-3 question; forcing one here would be numerology). No probe on a pair's end ⇒ that pair is
/// skipped (soundness-biased: no reading ⇒ no conviction).
///
/// **Anchors:** Bell 1964; CHSH 1969; Tsirelson 1980; Hoeffding 1963 / Pironio et al. 2010 (finite-
/// statistics device-independent); `AntiSybil.chshS` + `chshMargin` (reused, not duplicated);
/// `DecorrelationMetrology` (the sensor layer this fuses).
///
/// ═══ ⚠ SOUNDNESS / SCOPE (Soraya adversarial review 2026-08-02; verified) ═══
/// **CHSH is the WRONG instrument for a *general* decorrelation test, and its inference is INVERTED
/// for the primary threat.** Bell's theorem: a **passive shared common cause** — a shared seed, the
/// core sybil ("one process, two faces," recover-all-from-one) — IS a local-hidden-variable model, so
/// it sits at **|S| ≤ 2**. Common cause lives *under* the bound. **|S| > 2 rules common cause OUT** — it
/// requires entanglement (n/a to a commit DAG), a **live channel**, or **superdeterminism**. So:
/// - `AboveClassicalBound` convicts a **live channel / superdeterminism**, NOT a plain common cause.
/// - `WithinClassicalBound` / `WithinBoundFraction` is **NOT an acquittal** — S ≤ 2 does *not* prove
///   independence (a passive shared-seed sybil sits here). One-way inference only, per `AntiSybil`'s own
///   rule "low |S| never acquits" — this module must not be read as a decorrelation/sovereignty
///   certificate (doing so is the **false-green** on the identity layer).
/// **Scope (keep both — Aaron 2026-08-02):** CHSH here is KEPT, demoted to its valid limit — a
/// **live-channel / superdeterminism detector** (and single-source-reuse sybil, via `AntiSybil`). The
/// **general decorrelation instrument** is **MI / permutation-test-vs-independent-null + Reichenbach
/// conditional-independence** (condition on the common-ancestor set the sensor already computes via
/// `DecorrelationMetrology.ancestors`) — reconnecting to the repo's existing CMI work
/// (`docs/research/2026-06-19-anti-mirror-rigorous-measurable-decorrelation-cmi-*`). That instrument is
/// TO BE ADDED (built since as `DecorrelationExcess` / `DecorrelationExcessFusion`; Lumen's 2nd opinion
/// landed). Autocorrelation caveat (Soraya's Caveat-A) — **RESOLVED 2026-08-04**: `classifyPair` / `fuse`
/// now use `AntiSybil.chshMarginAutocorr` (the HAC effective-sample margin), aligned with the
/// `chshSybilCalibrated` default switch, so an autocorrelated probe stream no longer under-states the
/// fluctuation. The **sensor is correct and kept**; the CHSH fusion here stays scope-limited (a
/// live-channel / superdeterminism detector — see the SOUNDNESS block above), the excess-over-null
/// instrument is the general decorrelation tool.
/// ═════════════════════════════════════════════════════════════════════════════
[<RequireQualifiedAccess>]
module DecorrelationMeter =

    /// The fact about one spacelike pair's measured |Ŝ| vs the calibrated classical bound `2 + ε(δ,n)`.
    /// One-way inference only (see the module ⚠ SOUNDNESS block).
    type PairVerdict =
        /// |Ŝ| ≤ 2 + ε : **no live-channel / superdeterminism detected.** Does NOT prove independence —
        /// a passive shared common cause (shared seed) also sits here. Never read as "decorrelated."
        | WithinClassicalBound
        /// |Ŝ| > 2 + ε : convicts a **live channel / superdeterminism** (NOT a plain common cause,
        /// which is ≤ 2). One-way: this convicts; `WithinClassicalBound` never acquits.
        | AboveClassicalBound

    /// The fused reading over a commit set. **Register-2 counts**; the interpretation is the caller's.
    type Reading =
        { /// Spacelike pairs actually fused (both ends had a non-empty probe stream).
          SpacelikePairs: int
          /// Pairs convicting a **live channel / superdeterminism** (|Ŝ| > 2 + ε) — NOT a plain common cause.
          AboveBound: int
          /// Pairs with **no channel/superdeterminism detected** (|Ŝ| ≤ 2 + ε) — does NOT prove independence.
          WithinBound: int
          /// The most-conservative calibrated bound used across fused pairs (max 2 + ε), for audit.
          Bound: float }

        /// Fraction of fused pairs **within** the classical bound — i.e. **no channel/superdeterminism
        /// detected**. **⚠ NOT a decorrelation measure** (renamed from `DecorrelatedFraction`, which was
        /// the false-green): S ≤ 2 does not prove independence — a passive shared-seed sybil sits within
        /// bound. See the module ⚠ SOUNDNESS block; the real decorrelation instrument is MI/Reichenbach.
        /// `nan` if no pairs.
        member r.WithinBoundFraction : float =
            if r.SpacelikePairs = 0 then
                nan
            else
                float r.WithinBound / float r.SpacelikePairs

    /// Classify one spacelike pair's CHSH Ŝ against the finite-sample-calibrated classical bound.
    /// `delta` = per-pair false-conviction budget. Reuses `AntiSybil.chshS` + **`chshMarginAutocorr`**
    /// (the autocorrelation-corrected margin — Caveat-A alignment 2026-08-04, matching the
    /// `chshSybilCalibrated` default switch): the pair's own HAC effective sample size, never a bare `2.0`
    /// and never the i.i.d. `chshMargin` (both would falsely convict — a small-n pair at the bound, or an
    /// autocorrelated probe stream, per Soraya's finite-sample + Caveat-A findings). A periodic / bursty
    /// probe stream therefore needs MORE rounds to convict than the i.i.d. bound demanded, which is the
    /// correct, more-conservative behavior.
    let classifyPair (delta: float) (a: AntiSybil.ChshRound list) (b: AntiSybil.ChshRound list) : PairVerdict =
        let bound = 2.0 + AntiSybil.chshMarginAutocorr delta a b
        if abs (AntiSybil.chshS a b) > bound then
            AboveClassicalBound
        else
            WithinClassicalBound

    /// **Fuse** per-commit probe streams into a decorrelation `Reading` over the **spacelike pairs
    /// only** (the CHSH-valid pairs). `parents`: the commit DAG (e.g. from
    /// `DecorrelationMetrology.parseRevListParents`); `probes`: per-commit probe stream (the sensor
    /// reading); `commits`: the set to meter. Pairs missing a probe on either end are skipped.
    /// Deterministic (DST); order-independent (the sensor pairs are canonically ordered and the
    /// count-fold is commutative).
    let fuse
        (delta: float)
        (parents: Map<string, string list>)
        (probes: Map<string, AntiSybil.ChshRound list>)
        (commits: string list)
        : Reading =
        let considered =
            DecorrelationMetrology.spacelikeCommitPairs parents commits
            |> List.choose (fun (a, b) ->
                match Map.tryFind a probes, Map.tryFind b probes with
                | Some sa, Some sb when not (List.isEmpty sa) && not (List.isEmpty sb) -> Some(sa, sb)
                | _ -> None)

        let verdicts = considered |> List.map (fun (sa, sb) -> classifyPair delta sa sb)

        { SpacelikePairs = List.length considered
          AboveBound = verdicts |> List.filter ((=) AboveClassicalBound) |> List.length
          WithinBound = verdicts |> List.filter ((=) WithinClassicalBound) |> List.length
          Bound =
            match considered with
            | [] -> nan
            | _ ->
                considered
                |> List.map (fun (sa, sb) -> 2.0 + AntiSybil.chshMarginAutocorr delta sa sb)
                |> List.max }
