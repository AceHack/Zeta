namespace Zeta.Core

/// **`AntiSybil` — the base case that makes `clock-drift ≡ identity` non-circular (Aaron 2026-06-08).**
///
/// Soraya called `clock-drift ≡ identity` "circular/definitional." That verdict is *behavioralist-loaded*:
/// drop behavioralism (intentions are real — GOVERNANCE §3) and the identification is **synthetic** — drift
/// is the agent's only **unforgeable** external trace. The self-reference is **meta-circular** (a productive
/// fixed point grounded by a base case), which *compiles*. **This module is that base case.**
///
/// **The anti-Sybil claim (the falsifiable core):** forging *k* distinct drift-identities costs **≥ *k*
/// independent entropy sources** — clock-drift entropy is **non-fungible across identities**. A Sybil forger
/// claiming *k* identities from *s &lt; k* sources must (pigeonhole) re-use a source across two claims, so two
/// of its emitted bit-streams are **correlated**. The `probe` (`BitGan`) becomes a **distinguishing oracle**:
/// a discriminator confined to observed bits can beat chance on a correlated pair ⇒ the forgery is caught.
///
/// **Proof-of-distinctness**, structurally identical to how proof-of-work grounds a blockchain's otherwise
/// circular "longest chain is truth": the circle bottoms out on a hardness fact, and the hardness does the
/// work. Anchors: Douceur 2002 (*The Sybil Attack*); Dwork–Naor 1992 / Nakamoto 2008 (PoW); the
/// jitter/ring-oscillator TRNG non-reproducibility that makes two clocks' drift uncheaply-mergeable (#7091).
///
/// **Honest scope (peel):** this is **sound for exact replays** (a re-used source ⇒ correlation `1.0` ⇒
/// always caught). For *noisy* forgeries and at *finite* stream length there is a detection/length tradeoff:
/// genuinely-independent streams can spuriously correlate at short length (false positive), with probability
/// shrinking as length grows. So the guarantee is: *exact source-reuse is always detected*; noisy reuse is
/// detected above a length/threshold curve. This is the attack-research surface — route to Aminata/Mateo
/// before any outward "Sybil-resistance via drift non-fungibility" claim. Not yet a proved theorem: a named
/// function + a falsifiable property + an attack program.
module AntiSybil =

    open ZetaCli

    /// Cross-stream agreement **beyond chance**, in `[0,1]`. Streams are truncated to the shorter length.
    /// `0` = independent (≈50% agreement); `1` = same source (perfect agreement **or** perfect
    /// anti-correlation — an inverted replay is still one source). Empty/length-≤-0 overlap ⇒ `0`.
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

    /// Verdict of an anti-Sybil run over a set of claimed identities (indexed by position in the input).
    type SybilVerdict =
        { /// Number of claimed identities (input streams).
          ClaimedCount: int
          /// Number of genuinely-distinct entropy sources detected (connected components). The **forgery-cost
          /// floor**: to pass as `ClaimedCount`, the adversary needed at least this many independent clocks.
          DistinctCount: int
          /// Claimed-identity index → its source-component id (`0 .. DistinctCount-1`). Two indices sharing a
          /// component were forged from one source (Sybil).
          SourceOf: Map<int, int>
          /// True iff every claimed identity is its own source — no Sybil detected within budget.
          AllDistinct: bool }

    /// Run the anti-Sybil oracle: collapse claimed identities whose pairwise `correlation` meets `threshold`
    /// into shared sources (union-find), and report how many genuinely-distinct sources remain.
    ///
    /// **The guarantee:** an adversary emitting `streams` from `s` independent sources yields
    /// `DistinctCount ≤ s` — it cannot be seen as more distinct identities than it had sources (exact reuse ⇒
    /// `correlation = 1 ≥ threshold` ⇒ collapsed). Deterministic (DST §7).
    let antiSybil (threshold: float) (streams: int list list) : SybilVerdict =
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

    /// The forgery-cost floor for a claimed identity set: the minimum number of independent entropy sources
    /// (clocks) an adversary needed to produce `streams` — i.e. `DistinctCount`. "Forging *k* identities costs
    /// ≥ this many clocks." Equal to `ClaimedCount` exactly when no Sybil is present.
    let forgeryCostFloor (threshold: float) (streams: int list list) : int =
        (antiSybil threshold streams).DistinctCount

    // ── CHSH escalation (2026-07-02, Addendum 4 of the name(name) doc) ──────────
    //
    // `correlation` above is a ONE-setting Bell correlator (|E|): sound for exact
    // replays, but a *strategic* forger can suppress a single-setting correlation.
    // The randomized-settings CHSH closes that gap: two systems with no live
    // channel and no shared seed cannot exceed |S| = 2 (Bell 1964; CHSH 1969) —
    // whatever per-setting strategy they run — so |S| > 2 CONVICTS a common cause
    // (shared seed or in-tick communication). Direction of inference is ONE-WAY
    // and stays stated: high |S| convicts sameness; low |S| never acquits
    // (firewalled puppets can decorrelate). Distinctness is proven by the other
    // legs of the identity definition (captured irreducible entropy + an exchange
    // history that model-checks), never by this oracle alone.

    /// One round of a CHSH identity probe: the SETTING this claimed identity was
    /// challenged with (0 or 1) and the ±1 OUTCOME it emitted.
    type ChshRound = { Setting: int; Outcome: int }

    /// Pairwise CHSH `S` from two per-round probe streams (truncated to the
    /// shorter). Rounds are bucketed by the setting pair; `E` per bucket is the
    /// mean outcome product; `S = E(0,0) − E(0,1) + E(1,0) + E(1,1)` via
    /// `BellTest.chshOf`. An EMPTY bucket contributes `E = 0` — degeneracy only
    /// ever weakens conviction (soundness-biased), never manufactures it.
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
    let chshSybil (threshold: float) (streams: ChshRound list list) : SybilVerdict =
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

    /// The **autocorrelation-corrected CHSH margin**: substitute `n_eff` (a Bartlett-windowed HAC estimate
    /// over the pair's own outcome-product series, `effectiveSampleSizeHAC`) for `n` in the Hoeffding ε.
    /// On a stream with no positive autocorrelation at any lag it **equals** `chshMargin delta n`; on any
    /// positively-autocorrelated stream (at any lag ≤ bandwidth) it is strictly **larger** (`n_eff < n`) —
    /// the sound correction for Caveat (a), now robust past lag 1. Takes the actual streams (not just `n`)
    /// because the `ρ_k` depend on the outcomes. `n_eff < 1` ⇒ `infinity` (no effective power ⇒ never convict).
    let chshMarginAutocorr (delta: float) (a: ChshRound list) (b: ChshRound list) : float =
        let series = outcomeProductSeries a b
        let n = List.length series
        let nEff = effectiveSampleSizeHAC series (neweyWestBandwidth n)
        if nEff < 1.0 || delta <= 0.0 || delta >= 1.0 then infinity
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

    /// The CALIBRATED CHSH identity oracle: conviction at `2 + ε` with the pair's own run length, so an
    /// honestly-local pair at the bound is falsely convicted with probability ≤ δ (per pair) — the sound
    /// default the bare-threshold `chshSybil` is not. Same one-way inference: convicts sameness, never
    /// acquits. Deterministic (DST §7).
    ///
    /// **ε is now the autocorrelation-corrected margin `chshMarginAutocorr` (Caveat-A default switch,
    /// 2026-08-04)**, not the i.i.d. `chshMargin`. Real streams autocorrelate ⇒ the i.i.d. margin
    /// over-convicts (false collapse of honest-but-bursty identities); the corrected margin uses the pair's
    /// own HAC effective sample size. Soraya VERIFIED this is **provably more conservative** than the i.i.d.
    /// variant — the conviction set is a strict subset, so the switch can only *remove* false collapses,
    /// never add one (obligations (a)/(b)/(c), + the 40-batch machine-check). **Framing:** "more
    /// conservative than i.i.d.", NOT "fully sound" — dependence beyond the HAC bandwidth can still evade.
    /// The stationarity-gated variant is `chshSybilAutocorrCalibrated` (opt-in — it needs a tol choice);
    /// this default is the parameter-free margin swap only.
    let chshSybilCalibrated (delta: float) (streams: ChshRound list list) : SybilVerdict =
        let k = List.length streams
        let arr = List.toArray streams
        let parent = Array.init k id
        let rec find i = if parent.[i] = i then i else (let r = find parent.[i] in parent.[i] <- r; r)
        let union i j = let ri, rj = find i, find j in if ri <> rj then parent.[ri] <- rj

        for i in 0 .. k - 1 do
            for j in i + 1 .. k - 1 do
                // Caveat-A: the autocorrelation-corrected margin (n_eff from the pair's own HAC), not n.
                if abs (chshS arr.[i] arr.[j]) > 2.0 + chshMarginAutocorr delta arr.[i] arr.[j] then
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

    /// The **autocorrelation-calibrated** CHSH sybil oracle — the sound default for streams that may
    /// autocorrelate (Caveat (a)). Two changes vs `chshSybilCalibrated`: (1) conviction at
    /// `2 + chshMarginAutocorr` (each pair's own `n_eff`), and (2) a pair whose outcome-product series is
    /// NOT approximately stationary **downgrades to non-convicting** (never evidence). Because
    /// `marginAutocorr ≥ marginᵢᵢᵈ` and the stationarity gate only ever *removes* convictions, this is
    /// **strictly more conservative** than `chshSybilCalibrated` — it can only drop FALSE collapses of
    /// honest-but-autocorrelated identities, never add new ones. Same one-way inference (convicts sameness,
    /// never acquits) and determinism (DST §7). `stationarityTol` in `[0, 2]` (product means live in
    /// `[-1, 1]`); a smaller tol downgrades more aggressively.
    let chshSybilAutocorrCalibrated (delta: float) (stationarityTol: float) (streams: ChshRound list list) : SybilVerdict =
        let k = List.length streams
        let arr = List.toArray streams
        let parent = Array.init k id
        let rec find i = if parent.[i] = i then i else (let r = find parent.[i] in parent.[i] <- r; r)
        let union i j = let ri, rj = find i, find j in if ri <> rj then parent.[ri] <- rj

        for i in 0 .. k - 1 do
            for j in i + 1 .. k - 1 do
                let series = outcomeProductSeries arr.[i] arr.[j]
                // Stationarity gate first (multi-block: catches within-half drift the two-halves check
                // missed): a non-stationary window is Unmeasured, never convicting.
                if isApproxStationaryMultiBlock stationarityTol 4 series
                   && abs (chshS arr.[i] arr.[j]) > 2.0 + chshMarginAutocorr delta arr.[i] arr.[j] then
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
    /// pipes. `rounds` = the pair's min stream length (the same `n` the calibrated oracle uses).
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
