namespace Zeta.Core

/// Threshold-graph observations over claimed identities' supplied bit streams.
///
/// `antiSybil` joins input indices when their absolute agreement score reaches a
/// threshold. Its connected components detect some record similarities, including
/// nonempty exact/complemented replays at thresholds at most 1. They do not count
/// physical clocks, independent entropy sources, or distinct controllers. One shared
/// stream deterministically recoded with balanced XOR masks can yield arbitrarily
/// many disconnected components at positive thresholds as the record length grows.
///
/// The earlier physical-source floor claim confused source reuse with exact record
/// replay. The executable counterexample and correction are preserved in
/// docs/research/relational-identity/2026-09-06-component-interpretation-correction.md.
/// Entropy floors require a separate conditional-innovation premise; admission and
/// controller identity require evidence not supplied by this statistic.
module AntiSybil =

    open ZetaCli

    /// Absolute normalized agreement in `[0,1]`, truncating to the shorter stream and mapping
    /// each integer to `x <> 0`. Zero means half agreement; one means all agree or all disagree.
    /// Neither value establishes statistical independence or common physical provenance.
    /// Empty overlap returns zero and therefore carries no evidence of independence.
    let correlation (a: int list) (b: int list) : float =
        let n = min (List.length a) (List.length b)
        if n <= 0 then
            0.0
        else
            let agree =
                List.zip (List.truncate n a) (List.truncate n b)
                |> List.sumBy (fun (x, y) -> if (x <> 0) = (y <> 0) then 1 else 0)
            let frac = float agree / float n
            abs (2.0 * frac - 1.0)

    /// Connected-component readout for the pair criterion of the selected probe.
    /// Field names retain the existing API vocabulary; "source" means an invocation-local
    /// graph component here. Component membership is an observation, not a controller verdict.
    type DistinctnessReadout =
        { /// Number of supplied claimed-identity streams.
          ClaimedCount: int
          /// Number of connected components under the probe's pair criterion.
          DistinctCount: int
          /// Input index to component id, canonicalized by first appearance in this invocation.
          /// Connectivity is transitive; two members need not directly meet the pair criterion.
          SourceOf: Map<int, int>
          /// True iff every component is a singleton; vacuously true for empty input.
          /// This does not certify independent entropy, distinct controllers, or absence of Sybils.
          AllDistinct: bool }

    /// Connect each pair whose `correlation >= threshold` and report the graph's components.
    /// Deterministic for a fixed input order. Thresholds are used as supplied, without validation.
    /// A nonempty exact or complemented replay pair scores one and is joined if `threshold <= 1`.
    /// Recoding one shared stream can avoid every edge; source count has no bound from this output.
    let antiSybil (threshold: float) (streams: int list list) : DistinctnessReadout =
        let k = List.length streams
        let arr = List.toArray streams
        // Union-find over claimed indices.
        let parent = Array.init k id
        let rec find i = if parent.[i] = i then i else (let r = find parent.[i] in parent.[i] <- r; r)
        let union i j = let ri, rj = find i, find j in if ri <> rj then parent.[ri] <- rj

        for i in 0 .. k - 1 do
            for j in i + 1 .. k - 1 do
                if correlation arr.[i] arr.[j] >= threshold then
                    union i j

        // Canonical component ids 0..d-1 in order of first appearance.
        let roots = [ 0 .. k - 1 ] |> List.map find
        let canon =
            roots
            |> List.distinct
            |> List.mapi (fun id r -> r, id)
            |> Map.ofList
        let sourceOf = roots |> List.mapi (fun i r -> i, canon.[r]) |> Map.ofList
        let distinct = canon.Count

        { ClaimedCount = k
          DistinctCount = distinct
          SourceOf = sourceOf
          AllDistinct = distinct = k }

    /// Number of correlation-threshold graph components; shorthand for `antiSybil(...).DistinctCount`.
    /// This is an observable count, with no physical-source or forgery-cost interpretation.
    let correlationComponentCount (threshold: float) (streams: int list list) : int =
        (antiSybil threshold streams).DistinctCount

    // ── CHSH escalation (2026-07-02, Addendum 4 of the name(name) doc) ──────────
    //
    // CHSH adds probe settings and outcome-product statistics. Interpreting an
    // observed score requires a stated classical/quantum domain, measurement
    // independence, communication assumptions, and finite-sample eligibility.
    // The score alone does not establish common control or physical distinctness;
    // low scores do not certify separate controllers either.
    // Captured entropy and cross-consistent disclosed histories are separate,
    // conditional evidence. Their conjunction is not a controller-distinctness
    // theorem; see the indexed component-interpretation correction above.

    /// One round of a CHSH identity probe: the SETTING this claimed identity was
    /// challenged with (0 or 1) and the ±1 OUTCOME it emitted.
    type ChshRound = { Setting: int; Outcome: int }

    /// Pairwise CHSH `S` from two per-round probe streams (truncated to the
    /// shorter). Rounds are bucketed by the setting pair; `E` per bucket is the
    /// mean outcome product; `S = E(0,0) − E(0,1) + E(1,0) + E(1,1)` via
    /// `BellTest.chshOf`. An EMPTY bucket contributes `E = 0` for this descriptive
    /// statistic only. This can inflate |S|: missing (0,1) with constant +1 products
    /// gives 3 instead of the complete contrast 2. Calibrated inference must check
    /// setting coverage; a raw score is not a measurement-eligibility certificate.
    let chshS (a: ChshRound list) (b: ChshRound list) : float =
        let n = min (List.length a) (List.length b)
        if n <= 0 then
            0.0
        else
            let sums = Array.zeroCreate<float> 4
            let counts = Array.zeroCreate<int> 4
            List.zip (List.truncate n a) (List.truncate n b)
            |> List.iter (fun (ra, rb) ->
                let bucket = (ra.Setting &&& 1) * 2 + (rb.Setting &&& 1)
                let prod = float (sign ra.Outcome * sign rb.Outcome)
                sums.[bucket] <- sums.[bucket] + prod
                counts.[bucket] <- counts.[bucket] + 1)
            let e i = if counts.[i] = 0 then 0.0 else sums.[i] / float counts.[i]
            // Same combination as `BellTest.chshOf` (compiled later in Core, so
            // inlined here; agreement is locked by a cross-check test):
            // S = E(a,b) − E(a,b') + E(a',b) + E(a',b').
            e 0 - e 1 + e 2 + e 3

    /// The coordination-bandwidth estimator (geo-superdeterminism doc):
    /// `f̂ = (|S| − 2) / 2`, clamped to `[0, 1]` — the fraction of rounds on
    /// which a conductor's cross-setting instruction was effectively delivered.
    /// `0` = no in-tick coordination detected; `1` = fully conducted (PR-box).
    let coordinationBandwidth (s: float) : float =
        min 1.0 (max 0.0 ((abs s - 2.0) / 2.0))

    /// Run the CHSH identity oracle over a set of claimed identities: collapse
    /// every pair whose `|chshS|` exceeds `threshold` into a shared source,
    /// union-find, and report.
    ///
    /// **The guarantee (one-way, IN EXPECTATION):** E[S] > 2 is impossible for
    /// two systems sharing only past classical randomness with no in-tick
    /// channel (Bell 1964; CHSH 1969). `AllDistinct = true` means "no pair
    /// convicted", NEVER "all proven distinct". Deterministic (DST §7).
    ///
    /// **Finite-sample honesty (Soraya's finding, 2026-07-02):** the EMPIRICAL
    /// Ŝ of an honestly-local pair fluctuates around its expectation — a
    /// λ-mixing pair (shared past randomness alternating two deterministic S=2
    /// strategies) sits AT the bound with nonzero variance, so at
    /// `threshold = 2.0` exactly it is falsely convicted with probability ≈ 1/2
    /// at every run length. A sound conviction threshold is `2 + ε(n)` with
    /// ε(n) concentration-calibrated (Hoeffding-shaped, `c·sqrt(ln(1/δ)/n)`) —
    /// the calibrated gate is routed work (Soraya batch 2; BUGS.md). Until it
    /// lands, callers own the margin: pass `threshold = 2 + ε`, never bare 2.0,
    /// when false collapse has consequences.
    let chshSybil (threshold: float) (streams: ChshRound list list) : DistinctnessReadout =
        let k = List.length streams
        let arr = List.toArray streams
        let parent = Array.init k id
        let rec find i = if parent.[i] = i then i else (let r = find parent.[i] in parent.[i] <- r; r)
        let union i j = let ri, rj = find i, find j in if ri <> rj then parent.[ri] <- rj

        for i in 0 .. k - 1 do
            for j in i + 1 .. k - 1 do
                if abs (chshS arr.[i] arr.[j]) > threshold then
                    union i j

        let roots = [ 0 .. k - 1 ] |> List.map find
        let canon =
            roots
            |> List.distinct
            |> List.mapi (fun id r -> r, id)
            |> Map.ofList
        let sourceOf = roots |> List.mapi (fun i r -> i, canon.[r]) |> Map.ofList
        let distinct = canon.Count

        { ClaimedCount = k
          DistinctCount = distinct
          SourceOf = sourceOf
          AllDistinct = distinct = k }

    /// Hoeffding-shaped conviction margin ε(n, δ) for the CHSH oracle (Soraya
    /// batch 2b — the calibration the BUGS.md P1 asked for). Derivation: each
    /// bucket mean of ±1 outcomes is sub-Gaussian with parameter 1/n_b; Ŝ is a
    /// ±-signed sum of the four independent bucket means, so its deviation is
    /// sub-Gaussian with parameter Σ 1/n_b ≈ 16/n under uniform probe settings
    /// (n_b ≈ n/4 — architectural: WE choose the settings, seeded uniform).
    /// P(Ŝ − E[Ŝ] ≥ ε) ≤ exp(−n·ε²/32) ⇒ ε(n, δ) = sqrt(32·ln(1/δ)/n).
    /// Scope: per-round-independent local strategies (shared λ i.i.d. across
    /// rounds); Hoeffding 1963, finite-statistics DI lineage Pironio et al. 2010.
    /// **⚠ Caveat (a):** this i.i.d. margin OVER-convicts on autocorrelated
    /// streams (real commit/message bursts) — use `chshMarginAutocorr` /
    /// `chshSybilAutocorrCalibrated` there. See the block comment below.
    let chshMargin (delta: float) (rounds: int) : float =
        if rounds <= 0 || delta <= 0.0 || delta >= 1.0 then infinity
        else sqrt (32.0 * log (1.0 / delta) / float rounds)

    // ═══ Caveat (a): the i.i.d. margin over-convicts on AUTOCORRELATED streams ═══════════════════════
    // `chshMargin` assumes per-round-independent λ (its own scope note). Real commit / message streams
    // autocorrelate (author bursts, topic runs), so the EFFECTIVE sample size n_eff < n and the true
    // margin is LARGER than the i.i.d. one — the shipped margin is optimistic and over-convicts (falsely
    // collapses honest-but-autocorrelated identities into one source). Model chosen (the math-team call
    // per the Caveat-A handoff): the AR(1) effective-sample correction (Soraya's candidate #1), soundness-
    // biased. Concentration CORRECTNESS (the monotonicity obligations) is Soraya's to prove formally;
    // these are the model + estimator. Anchors: Newey–West 1987 (long-run variance under dependence);
    // Kontorovich–Ramanan 2008 (concentration for mixing sequences).
    // Doc: docs/research/2026-08-02-caveat-a-chsh-margin-autocorrelation-math-team-handoff-*.

    /// **Lag-1 autocorrelation** `ρ₁` of a series (Pearson between `xₜ` and `xₜ₊₁`). `0.0` for a
    /// constant or too-short (`< 2`) series — no dependence to correct for.
    let lag1Autocorr (series: float list) : float =
        let x = List.toArray series
        let n = x.Length
        if n < 2 then
            0.0
        else
            let mean = Array.average x
            let denom = x |> Array.sumBy (fun v -> (v - mean) * (v - mean))
            if denom <= 1e-12 then
                0.0 // constant series ⇒ no autocorrelation to speak of
            else
                let num = [ for t in 0 .. n - 2 -> (x.[t] - mean) * (x.[t + 1] - mean) ] |> List.sum
                num / denom

    /// **Lag-`k` autocorrelation** `ρ_k` (Pearson between `xₜ` and `xₜ₊ₖ`). `0.0` for `k < 1`, `k ≥ n`,
    /// or a constant series. Generalises `lag1Autocorr` (= `lagKAutocorr series 1`) — the HAC estimator
    /// sums over lags to catch dependence that lag-1 alone misses (Soraya's lag-2 hole, 2026-08-04).
    let lagKAutocorr (series: float list) (k: int) : float =
        let x = List.toArray series
        let n = x.Length
        if k < 1 || k >= n then
            0.0
        else
            let mean = Array.average x
            let denom = x |> Array.sumBy (fun v -> (v - mean) * (v - mean))
            if denom <= 1e-12 then
                0.0
            else
                let num = [ for t in 0 .. n - 1 - k -> (x.[t] - mean) * (x.[t + k] - mean) ] |> List.sum
                num / denom

    /// The round-ordered **±1 outcome-product series** that feeds the CHSH buckets:
    /// `prodₜ = sign(aₜ.Outcome) · sign(bₜ.Outcome)` (truncated to the shorter stream). Its
    /// autocorrelation is what drives `n_eff`.
    let outcomeProductSeries (a: ChshRound list) (b: ChshRound list) : float list =
        let n = min (List.length a) (List.length b)
        List.zip (List.truncate n a) (List.truncate n b)
        |> List.map (fun (ra, rb) -> float (sign ra.Outcome * sign rb.Outcome))

    /// Largest `ρ₁⁺` we act on (cap below 1 so `n_eff` never collapses to exactly 0 / the margin never
    /// hard-overflows before the `< 1` guard).
    [<Literal>]
    let private RhoMax = 0.999

    /// **Effective sample size** under lag-1 (AR(1)-style) dependence:
    /// `n_eff = n · (1 − ρ₁⁺) / (1 + ρ₁⁺)`, with `ρ₁⁺ = clamp ρ₁ to [0, RhoMax]`. **Positive**
    /// autocorrelation shrinks `n_eff` (⇒ a larger, sound margin); **negative** autocorrelation is
    /// treated as `0` (no optimistic bonus — soundness-biased). **`n_eff ≤ n` always, equality iff
    /// `ρ₁ ≤ 0`** — the monotonicity obligation Soraya proves.
    let effectiveSampleSize (n: int) (rho1: float) : float =
        let r = min RhoMax (max 0.0 rho1)
        float n * (1.0 - r) / (1.0 + r)

    /// **Newey–West bandwidth** `L = ⌊n^(1/3)⌋` (≥ 1) — the lag horizon summed in the long-run variance.
    let neweyWestBandwidth (n: int) : int =
        if n < 2 then 1 else max 1 (int (floor (float n ** (1.0 / 3.0))))

    /// **Effective sample size under a Bartlett-windowed long-run variance** (Newey–West 1987) — the HAC
    /// generalisation of the AR(1) `effectiveSampleSize`. It sums dependence across lags, so a stream with
    /// weak `ρ₁` but strong higher-lag structure still shrinks `n_eff` (**fixes Soraya's lag-2 hole**):
    ///   `n_eff = n / (1 + 2·Σ_{k=1}^{L} (1 − k/(L+1))·ρ_k⁺)`,  `ρ_k⁺ = max(0, ρ_k)`, `L = bandwidth`.
    /// The clamped `ρ_k⁺ ≥ 0` and Bartlett weights keep the factor `≥ 1` ⇒ **`n_eff ≤ n` always, equality
    /// iff every `ρ_k⁺ = 0`** — the monotonicity obligation, generalised past lag 1 (so Soraya's (a)/(b)/(c)
    /// proofs still hold: they need only `n_eff ≤ n`). AR(1) is the special case `ρ_k = ρ₁^k`.
    /// Anchors: Newey–West 1987 (HAC long-run variance); Bartlett 1946 (the psd kernel that guarantees
    /// the factor is well-behaved); Kontorovich–Ramanan 2008 (concentration under mixing).
    let effectiveSampleSizeHAC (series: float list) (bandwidth: int) : float =
        let n = List.length series
        if n < 2 then
            float n
        else
            let l = max 1 bandwidth
            let factor =
                1.0
                + 2.0
                  * ([ for k in 1 .. min l (n - 1) ->
                           let w = 1.0 - float k / float (l + 1)
                           w * max 0.0 (lagKAutocorr series k) ]
                     |> List.sum)
            float n / factor

    // Only paired observations enter the statistic. Unmatched suffixes are intentionally ignored.
    // Zero also represents malformed paired probes; it cannot become calibrated evidence.
    let private minimumChshBucketCount (a: ChshRound list) (b: ChshRound list) =
        let counts = Array.zeroCreate<int> 4
        let valid (round: ChshRound) =
            not (isNull (box round))
            && (round.Setting = 0 || round.Setting = 1)
            && (round.Outcome = -1 || round.Outcome = 1)
        let rec collect left right =
            match left, right with
            | ra :: restA, rb :: restB when valid ra && valid rb ->
                let bucket = 2 * ra.Setting + rb.Setting
                counts.[bucket] <- counts.[bucket] + 1
                collect restA restB
            | [], _ | _, [] -> Array.min counts
            | _ -> 0
        if isNull (box a) || isNull (box b) then 0 else collect a b

    /// Coverage-limited HAC engineering margin. Cap the outcome-product HAC effective
    /// rounds by `4 * minimumBucketCount`; absent settings or malformed paired probes
    /// return infinity. Balanced valid buckets preserve the previous HAC formula.
    /// Under conditional independent bounded samples, `sum_b 1/n_b <= 4/min_b(n_b)`
    /// motivates the cap. It never decreases the earlier margin, but proves neither
    /// general dependent-sample calibration nor a two-sided false-alarm guarantee.
    /// Setting randomization, locality and sampling validity remain separate assumptions.
    let chshMarginAutocorr (delta: float) (a: ChshRound list) (b: ChshRound list) : float =
        let minimumCount = minimumChshBucketCount a b
        if minimumCount = 0 || not (System.Double.IsFinite delta) || delta <= 0.0 || delta >= 1.0 then infinity
        else
            let series = outcomeProductSeries a b
            let n = List.length series
            let nEff = min (4.0 * float minimumCount) (effectiveSampleSizeHAC series (neweyWestBandwidth n))
            if nEff < 1.0 then infinity
            else sqrt (32.0 * log (1.0 / delta) / nEff)

    /// **Approximate-stationarity gate** (Soraya's candidate #2): the outcome-product series' first-half
    /// and second-half means differ by `≤ tol`. Crude but honest — a NON-stationary window must
    /// **downgrade to non-convicting** (never upgrade to evidence), because `n_eff` assumes a stable
    /// dependence structure. Series shorter than 2 count as stationary (nothing to compare).
    let isApproxStationary (tol: float) (series: float list) : bool =
        let x = List.toArray series
        let n = x.Length
        if n < 2 then
            true
        else
            let h = n / 2
            let m1 = x.[0 .. h - 1] |> Array.average
            let m2 = x.[h..] |> Array.average
            abs (m1 - m2) <= tol

    /// **Multi-block stationarity gate** — strengthens `isApproxStationary`. Splits into `blocks`
    /// contiguous blocks and requires **both** the spread of block MEANS and the spread of block
    /// (population) VARIANCES to be `≤ tol`. The two-halves check saw only a first-moment difference of two
    /// coarse blocks, so a within-half regime change or symmetric drift whose half-means cancel slipped
    /// through (Soraya's defeat witness `[+1×10, −1×10, +1×10, −1×10]`, both half-means 0 yet a step
    /// function). More blocks + a variance check catch it. A series shorter than `blocks` counts as
    /// stationary (too little to compare). `blocks` is floored at 2.
    let isApproxStationaryMultiBlock (tol: float) (blocks: int) (series: float list) : bool =
        let x = List.toArray series
        let n = x.Length
        let b = max 2 blocks
        if n < b then
            true
        else
            let sz = n / b
            let stats =
                [ for i in 0 .. b - 1 ->
                      let lo = i * sz
                      let hi = if i = b - 1 then n - 1 else lo + sz - 1
                      let seg = x.[lo..hi]
                      let m = Array.average seg
                      let v = seg |> Array.averageBy (fun z -> (z - m) * (z - m))
                      m, v ]
            let spread xs = List.max xs - List.min xs
            spread (stats |> List.map fst) <= tol && spread (stats |> List.map snd) <= tol

    /// CHSH component classification at `2 + ε`, with valid four-setting coverage and
    /// the pair's coverage-limited HAC margin. An ineligible pair adds no merge edge;
    /// this does not establish independence. The margin is an engineering refinement,
    /// not a proved general per-pair false-classification bound. Deterministic (DST §7).
    ///
    /// HAC replaced the i.i.d. margin in 2026-08-04; the setting-count cap is an
    /// additional conservative refinement. Either change can remove true or false
    /// merge edges. Neither checks measurement independence or proves arbitrary-
    /// dependence concentration. See docs/research/chsh-coverage/2026-09-06-audit.md.
    let chshSybilCalibrated (delta: float) (streams: ChshRound list list) : DistinctnessReadout =
        let k = List.length streams
        let arr = List.toArray streams
        let parent = Array.init k id
        let rec find i = if parent.[i] = i then i else (let r = find parent.[i] in parent.[i] <- r; r)
        let union i j = let ri, rj = find i, find j in if ri <> rj then parent.[ri] <- rj

        for i in 0 .. k - 1 do
            for j in i + 1 .. k - 1 do
                let margin = chshMarginAutocorr delta arr.[i] arr.[j]
                if System.Double.IsFinite margin && abs (chshS arr.[i] arr.[j]) > 2.0 + margin then
                    union i j

        let roots = [ 0 .. k - 1 ] |> List.map find
        let canon =
            roots
            |> List.distinct
            |> List.mapi (fun id r -> r, id)
            |> Map.ofList
        let sourceOf = roots |> List.mapi (fun i r -> i, canon.[r]) |> Map.ofList
        let distinct = canon.Count

        { ClaimedCount = k
          DistinctCount = distinct
          SourceOf = sourceOf
          AllDistinct = distinct = k }

    /// Stationarity-gated CHSH classification. The same coverage-limited margin as
    /// `chshSybilCalibrated` applies; a pair whose outcome-product series is
    /// NOT approximately stationary **downgrades to non-convicting** (never evidence). Because
    /// `marginAutocorr ≥ marginᵢᵢᵈ` and the stationarity gate only ever *removes* convictions, this is
    /// at least as conservative as `chshSybilCalibrated`: it can remove either true or
    /// false merge edges, never add edges. This is not a general calibration theorem.
    /// Deterministic (DST §7). `stationarityTol` in `[0, 2]` (product means live in
    /// `[-1, 1]`); a smaller tol downgrades more aggressively.
    let chshSybilAutocorrCalibrated (delta: float) (stationarityTol: float) (streams: ChshRound list list) : DistinctnessReadout =
        let k = List.length streams
        let arr = List.toArray streams
        let parent = Array.init k id
        let rec find i = if parent.[i] = i then i else (let r = find parent.[i] in parent.[i] <- r; r)
        let union i j = let ri, rj = find i, find j in if ri <> rj then parent.[ri] <- rj

        for i in 0 .. k - 1 do
            for j in i + 1 .. k - 1 do
                let margin = chshMarginAutocorr delta arr.[i] arr.[j]
                if System.Double.IsFinite margin
                   && isApproxStationaryMultiBlock stationarityTol 4 (outcomeProductSeries arr.[i] arr.[j])
                   && abs (chshS arr.[i] arr.[j]) > 2.0 + margin then
                    union i j

        let roots = [ 0 .. k - 1 ] |> List.map find
        let canon =
            roots
            |> List.distinct
            |> List.mapi (fun id r -> r, id)
            |> Map.ofList
        let sourceOf = roots |> List.mapi (fun i r -> i, canon.[r]) |> Map.ofList
        let distinct = canon.Count

        { ClaimedCount = k
          DistinctCount = distinct
          SourceOf = sourceOf
          AllDistinct = distinct = k }

    // ═══ ChshBand + LoopholeFlags — Analytics-wrapper substrate (Soraya's design, 2026-08-08) ═══════════
    // Spec: docs/research/2026-08-08-soraya-chshband-loopholeflags-type-design-spec.md
    // Unblocks Alexa Task A (Analytics wrappers) — workitem 081KZHC652A08QG0R003YX1G29.
    //
    // COMPILE-ORDER NOTE (Otto, correcting Soraya's reference impl): AntiSybil.fs compiles BEFORE
    // BellTest.fs in Core.fsproj, so we CANNOT reference `BellTest.ClassicalBound` / `TsirelsonBound` /
    // `AlgebraicMax` here — the constants are INLINED (2.0, 2√2, 4.0, 1e-12 slack), exactly as `chshS`
    // already inlines `chshOf`'s combination for the same reason. Agreement with BellTest's values is
    // locked by a cross-check test (BellTest compiles later and re-exports the same constants).

    /// A classification of an observed CHSH statistic `Ŝ` into the four bounded regimes, calibrated to
    /// the reading's own sample size. Names the STATISTICAL FACT (which regime, at this n, δ) — NOT a
    /// verdict. "Quantum band" is NOT "shared source"; a reading is only as trustworthy as its
    /// `LoopholeFlags` are closed (see `readout`). Dual-use-neutral
    /// (`dual-use-detection-is-neutral-oracle-decides`).
    ///
    /// Cases are declared ASCENDING so F#'s structural comparison gives the total order
    /// `Classical < SoundMargin < Quantum < SuperQuantum` for free. Conviction is `>= Quantum`;
    /// `Classical` / `SoundMargin` never convict.
    type ChshBand =
        /// `|Ŝ| <= 2`. Consistent with a local hidden-variable / shared-past-randomness model. Never convicts.
        | Classical
        /// `2 < |Ŝ| <= 2 + ε(n, δ)`. Above the classical bound but INSIDE the finite-sample margin:
        /// statistically indistinguishable from an honestly-local pair sitting at the bound
        /// (Soraya 2026-07-02). MUST NOT convict — the band a bare-2.0 threshold falsely collapses.
        | SoundMargin
        /// `2 + ε(n, δ) < |Ŝ| <= 2√2` (Tsirelson, within numerical slack). Beyond the calibrated bound and
        /// within what real QM allows. Convicts a common cause ONLY to the extent loopholes are closed.
        | Quantum
        /// `|Ŝ| > 2√2 + slack`. Beyond Tsirelson: unreachable by real QM. The superdeterminism /
        /// seed-control / PR-box tell (algebraic max S=4), not a stronger "quantum" reading.
        | SuperQuantum

    /// Explicit ordinal (`Classical=0 .. SuperQuantum=3`) for callers that want the order without relying
    /// on structural comparison.
    let bandRank (band: ChshBand) : int =
        match band with
        | Classical -> 0
        | SoundMargin -> 1
        | Quantum -> 2
        | SuperQuantum -> 3

    /// Classify `s` (raw signed `Ŝ` from `chshS`) against the bounds, calibrated to this reading's run
    /// length. Arg order mirrors `chshMargin (delta) (rounds)` so it partial-applies; `s` is last so it
    /// pipes. `rounds` is the declared sample count for this scalar i.i.d.-shaped margin;
    /// stream-based classifiers instead apply setting coverage and HAC refinement.
    /// This scalar API cannot verify setting coverage. Callers must establish valid
    /// four-setting estimates separately; an incomplete raw score is ineligible.
    ///
    /// Boundary policy is SOUNDNESS-BIASED: escalation to a stronger band requires STRICT exceedance, so
    /// every tie falls to the WEAKER band. The Tsirelson edge carries the same `1e-12` slack as
    /// `BellTest.exceedsTsirelson` so valid maximal-violation data does not jitter into `SuperQuantum`.
    ///
    /// Degenerate `n`: `chshMargin` returns `+infinity` for `rounds <= 0` (or bad δ), so `2 + ε = +infinity`
    /// and every `|s| > 2` lands in `SoundMargin` — with no samples, nothing above 2 is ever convicted.
    let classifyBand (delta: float) (rounds: int) (s: float) : ChshBand =
        let a = abs s
        let classicalBound = 2.0
        let tsirelson = 2.0 * sqrt 2.0 + 1e-12
        let eps = chshMargin delta rounds // +infinity when rounds <= 0 or delta out of (0,1)
        if a <= classicalBound then Classical // ties -> weaker
        elif a <= classicalBound + eps then SoundMargin
        elif a <= tsirelson then Quantum
        else SuperQuantum

    /// Does this band, on its own arithmetic, meet the calibrated conviction gate (`band >= Quantum`)?
    /// NOTE: this is the ARITHMETIC gate only — NOT a verdict; conviction additionally requires the
    /// conviction-relevant loopholes closed (see `readout`).
    let bandConvictsArithmetically (band: ChshBand) : bool = band >= Quantum

    /// Which CHSH loopholes are OPEN (uncontrolled) for a given reading. Each bool is a NEUTRAL FACT about
    /// the setup, never a verdict: `true` = this loophole is open, so a Bell violation here has a
    /// loophole-local classical explanation and CANNOT on its own convict a common cause. The caller's
    /// oracle decides what an open loophole MEANS (reunion vs sybil vs "instrument mis-scoped") — this
    /// record only reports the fact. Dual-use-neutral by construction: there is deliberately no
    /// `IsGenuine` / `IsForgery` field.
    type LoopholeFlags =
        { /// Detection / fair-sampling: outcomes may be post-selected (missing rounds not
          /// missing-at-random). Open ⇒ a detection-efficiency model can fake violation.
          Detection: bool
          /// Locality / no-signaling: the two streams were NOT space-like separated and setting-choice
          /// could reach the other side within the round. Open ⇒ an in-tick channel, not entanglement,
          /// can produce `|S| > 2`.
          Locality: bool
          /// Measurement-independence / freedom-of-choice: settings may be correlated with the hidden
          /// variable / process state (settings not drawn from an independent source). Open ⇒
          /// superdeterministic / conducted correlation, up to the algebraic max S=4.
          MeasurementIndependence: bool
          /// Coincidence-time: pairing of rounds across streams may itself be outcome-dependent. Open ⇒
          /// windowing can manufacture correlation.
          Coincidence: bool }

    /// No loophole open — a fully loophole-free reading. The only configuration under which a
    /// `Quantum` / `SuperQuantum` band may be read as conviction.
    let loopholesAllClosed: LoopholeFlags =
        { Detection = false
          Locality = false
          MeasurementIndependence = false
          Coincidence = false }

    /// The loophole profile of a CHSH statistic computed over TWO COMMIT STREAMS FROM THE SAME PROCESS.
    /// Load-bearing default (soundness-doc conclusion,
    /// docs/research/2026-08-02-adversarial-chsh-soundness-commit-probe-register3-lumen.md): Locality and
    /// MeasurementIndependence are OPEN (settings and outcomes share one process, no space-like
    /// separation, no independent settings source), and Detection is OPEN (no fair-sampling guarantee on
    /// commit-derived outcomes). Any `S` read over same-process commit pairs MUST carry this profile —
    /// which is why a naive "quantum band ⇒ shared source" read over commits is unsound.
    let commitPairLoopholes: LoopholeFlags =
        { Detection = true
          Locality = true
          MeasurementIndependence = true
          Coincidence = true }

    /// Any loophole open?
    let anyOpen (flags: LoopholeFlags) : bool =
        flags.Detection
        || flags.Locality
        || flags.MeasurementIndependence
        || flags.Coincidence

    /// Are the conviction-relevant loopholes (Detection, Locality, MeasurementIndependence) all closed?
    /// Coincidence is a windowing concern that weakens trust but is not on the conviction gate.
    let convictionLoopholesClosed (flags: LoopholeFlags) : bool =
        not flags.Detection
        && not flags.Locality
        && not flags.MeasurementIndependence

    /// The only thing a `(ChshBand, LoopholeFlags)` pair licenses. Neutral facts, one-way (convicts a
    /// common cause, never acquits distinctness).
    type ChshReadout =
        /// `|S|` within the calibrated classical region (`Classical` | `SoundMargin`). No conviction, at
        /// any loophole setting. NEVER read as "identities proven distinct" — the CHSH oracle is one-way;
        /// low `S` never proves distinctness.
        | NoViolation of ChshBand
        /// `band >= Quantum` AND all conviction-relevant loopholes closed: the FACT "common cause (shared
        /// seed or in-tick channel)" is convicted. One-way. Reunion-vs-sybil meaning is caller policy.
        | CommonCauseConvicted of ChshBand
        /// `band >= Quantum` but a conviction-relevant loophole is OPEN: the `S` value alone cannot
        /// convict. The honest instrument for this case is excess-over-null (`DecorrelationExcess` /
        /// `Decorrelation` / `DelayDecorrelation`), NOT this `S`. ALWAYS the case for same-process commit
        /// pairs (`commitPairLoopholes`).
        | ViolationButLoopholesOpen of ChshBand * LoopholeFlags

    /// Compose a band and its loophole profile into the one sound verdict they license (neutral fact,
    /// one-way). See `ChshReadout`.
    let readout (band: ChshBand) (flags: LoopholeFlags) : ChshReadout =
        if not (bandConvictsArithmetically band) then NoViolation band
        elif convictionLoopholesClosed flags then CommonCauseConvicted band
        else ViolationButLoopholesOpen(band, flags)

    [<Literal>]
    let SeamName = "sim"

    /// Is this command on the `sim` seam (`zeta sim anti-sybil ...`)?
    let isSimCommand (cmd: ZetaCommand) = cmd.Seam = Some SeamName
