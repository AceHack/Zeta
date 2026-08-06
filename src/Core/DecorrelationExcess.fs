namespace Zeta.Core

/// **DecorrelationExcess — the general decorrelation instrument (excess correlation over an independent
/// null).** The honest register-3 probe the CHSH fusion layer could NOT be: `DecorrelationMeter` (CHSH)
/// only convicts an *active* live channel / superdeterminism and cannot see a **passive shared common
/// cause** (a shared seed sits *under* the Bell bound); this module is the instrument that catches the
/// passive case.
///
/// **Why CHSH was the wrong hammer (Lumen adversarial review, 2026-08-02, verified — converges with
/// Soraya's earlier finding):** forcing a ±1 CHSH observable onto commit *metadata* is numerology —
/// measurement-independence fails by construction (the "setting" is a function of the shared codebase,
/// not a free choice) and no-signaling fails (author of A may have read B). Lumen's Attempt 3 is the
/// honest instrument **available now, no protocol change, no randomness beacon**: measure a pair's
/// correlation on the *real* observable and compare it to an **independent null**, flagging only excess
/// *significantly above* what independent sources produce. See
/// `docs/research/2026-08-02-adversarial-chsh-soundness-commit-probe-register3-lumen.md` (Attempt 3 +
/// verdict) and `docs/research/2026-06-19-anti-mirror-rigorous-measurable-decorrelation-cmi-*` (the CMI
/// lineage this reconnects to; `Decorrelation.mutualInformation` is the swap-in MI statistic).
///
/// **The four pieces (this module is the pure statistical CORE — pieces 1–4; the DAG wiring +
/// Reichenbach ancestor-stratification is the SEPARATE fusion increment, deliberately NOT here):**
/// 1. **Observable** — a per-item feature the caller supplies (v1 for commits: the `Set<string>` of
///    files/subsystems touched — ordinal, straight from git). Generic `'o` here.
/// 2. **Pair statistic** — `stat : 'o -> 'o -> float`, higher = more correlated. `jaccard` is the v1
///    default (touch-set overlap); `Decorrelation.mutualInformation` is the swap-in when per-item
///    *streams* exist (the CMI reconnection). The instrument is statistic-agnostic.
/// 3. **Independent null** — `permutationNull` breaks the real A↔B pairing by seeded shuffle and pools
///    the statistic over `k` permutations (Fisher 1935 / Pitman 1937 permutation test). This is the
///    "what do independent sources produce?" baseline — the SAME null-model discipline the metrology
///    docstring demands, and the monoidal-identity/zero of the fusion.
/// 4. **Threshold + one-way verdict** — convict a pair iff its statistic exceeds the `(1 − δ)` empirical
///    quantile of the null. **ONE-WAY inference** (per `AntiSybil`'s "low |S| never acquits"):
///    `ExcessCorrelation` convicts an above-chance common cause; `WithinNull` **never acquits** — being
///    within the null does NOT prove independence, only that no excess was demonstrated at this `δ`/`k`.
///
/// **Purity / DST / noninterference:** every function is pure and total; the only entropy source is the
/// explicit `seed` (a seeded splitmix64 PRNG — no ambient `Random`, no clock), so a run replays
/// byte-identically (DST §7) and is golden-vector-lockable. Same seed ⇒ same null ⇒ same verdicts.
///
/// **Honest non-claims:** this measures *statistical excess correlation vs a permutation null* — it is
/// necessary-not-sufficient evidence of a common cause, not a *manipulation detector* and not a proof of
/// independence. The permutation null assumes the pooled pairs are exchangeable under independence;
/// a **confounder** (shared codebase state — more shared ancestors ⇒ higher innocent baseline) must be
/// conditioned on to be sound (Reichenbach 1956) — that stratification is the fusion increment's job,
/// flagged there. Statistic and δ/k are caller oracle choices, LABELED, never asserted by the number.
///
/// **Resolution floor (a permutation-test property, soundness-biased):** the pooled null contains its own
/// **coincidental matches** — a shuffle's fixed points re-create real coupling at rate ~`1/n` per
/// permutation. So a pair can only be convicted at level `δ` when that rate is *below* `δ`, i.e. roughly
/// **`n > 1/δ`** pairs. With too few pairs the `(1 − δ)` threshold saturates and nothing convicts — the
/// instrument fails **toward `WithinNull` (never a false green)**, which is the safe direction. Raise `n`
/// (more pairs) or `δ` (accept more false convictions) to resolve finer; the floor is honest, not a bug.
///
/// **Anchors:** Fisher 1935 / Pitman 1937 (permutation / randomization test); Reichenbach 1956 (common
/// cause — the conditioning axis); Aspect et al. 1982 (coincidence-over-null framework, per Lumen);
/// Shannon 1948 (MI, the swap-in statistic); Vince 1998 / splitmix64 (Steele et al. 2014, the seeded
/// deterministic PRNG). Dual-use-neutral (`dual-use-detection-is-neutral-oracle-decides`): verdicts name
/// the FACT (`ExcessCorrelation`), never the intent.
[<RequireQualifiedAccess>]
module DecorrelationExcess =

    // ── piece 2: the default pair statistic ────────────────────────────────────────────────────────
    /// **Jaccard overlap** `|A ∩ B| / |A ∪ B|` of two touch-sets. Range `[0, 1]`: `0` = disjoint,
    /// `1` = identical. Two empty sets ⇒ `0.0` (no shared evidence — not a spurious perfect match).
    let jaccard (a: Set<string>) (b: Set<string>) : float =
        let union = Set.union a b |> Set.count
        if union = 0 then 0.0 else float (Set.intersect a b |> Set.count) / float union

    // ── seeded deterministic PRNG (splitmix64 — entropy enters ONLY here, via `seed`) ───────────────
    /// One splitmix64 step: `(output, nextState)`. Pure; the whole null is a fold over this from `seed`.
    let private split (s: uint64) : uint64 * uint64 =
        let s' = s + 0x9E3779B97F4A7C15UL
        let mutable z = s'
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
        (z ^^^ (z >>> 31), s')

    /// A **seeded Fisher–Yates permutation** of `arr` — deterministic in `seed` (same seed ⇒ same
    /// permutation), a genuine permutation (the multiset of elements is preserved). Local mutation only;
    /// the function is pure (no observable effect beyond its return value).
    let shuffle (seed: uint64) (arr: 'a[]) : 'a[] =
        let a = Array.copy arr
        let mutable st = seed
        for i in a.Length - 1 .. -1 .. 1 do
            let r, st' = split st
            st <- st'
            let j = int (r % uint64 (i + 1))
            let tmp = a.[i]
            a.[i] <- a.[j]
            a.[j] <- tmp
        a

    // ── piece 3: the independent (permutation) null ─────────────────────────────────────────────────
    /// **Permutation null:** pooled distribution of `stat` under `k` shuffles that break the real A↔B
    /// pairing (each shuffle re-pairs the A-side observables with a seeded permutation of the B-side).
    /// This is the "independent sources" baseline (Fisher–Pitman). Entropy enters ONLY via `seed`
    /// (each permutation uses `seed` mixed with its index, so the `k` permutations are distinct yet
    /// fully replayable). Truncates to the shorter side if the two lists differ in length.
    let permutationNull
        (seed: uint64)
        (k: int)
        (stat: 'o -> 'o -> float)
        (aObs: 'o list)
        (bObs: 'o list)
        : float list =
        let a = List.toArray aObs
        let b = List.toArray bObs
        let n = min a.Length b.Length
        [ for p in 0 .. k - 1 do
              let bShuf = shuffle (seed + uint64 p * 0x100000001B3UL) b
              for i in 0 .. n - 1 do
                  yield stat a.[i] bShuf.[i] ]

    /// **Per-slot permutation null** — pair `i`'s OWN null: `[ stat(a_i, bShuf^p_i) for p in 0..k-1 ]`,
    /// where each `bShuf^p` is a seeded shuffle of the B-side. Returns one k-length null PER pair (indexed
    /// as `aObs`/`bObs`). This is the **correct per-pair independence null** — pair `i`'s observed statistic
    /// is compared only against `a_i` re-paired with random B's, NEVER against the `permutationNull` pooled
    /// mixture over *all* A-sides. The pooled mixture over **heterogeneous** pairs over-convicts an honest
    /// heavy-touch pair (a broad-touch commit whose statistic is high-but-constant across every partner —
    /// zero excess over its own null — looks extreme against a pool dominated by light pairs' zeros).
    /// Soraya BP-16 cross-check confirmed that as a real per-pair-`≤δ` violation (workitem
    /// 081KZ7H82J708QG0R002C1EBH1 §Claim-3); per-slot restores exactness. Same seed mixing as
    /// `permutationNull` (so `blockSize=1`-style replays line up); DST-deterministic. Truncates to shorter side.
    let permutationNullPerSlot
        (seed: uint64)
        (k: int)
        (stat: 'o -> 'o -> float)
        (aObs: 'o list)
        (bObs: 'o list)
        : float list list =
        let a = List.toArray aObs
        let b = List.toArray bObs
        let n = min a.Length b.Length
        let shuffles = [| for p in 0 .. k - 1 -> shuffle (seed + uint64 p * 0x100000001B3UL) b |]
        [ for i in 0 .. n - 1 -> [ for bShuf in shuffles -> stat a.[i] bShuf.[i] ] ]

    /// The `q`-quantile (`0 ≤ q ≤ 1`) of `xs` by linear interpolation between order statistics.
    /// `nan` on an empty sample. `q = 1.0` ⇒ the maximum; used with `q = 1 − δ` for the threshold.
    let quantile (q: float) (xs: float list) : float =
        match xs with
        | [] -> nan
        | _ ->
            let s = List.sort xs |> List.toArray
            // Clamp the interpolation index into [0, Length-1] so an out-of-range `q` (from a caller-supplied
            // `delta ∉ (0,1)`) degrades to the min/max order statistic instead of throwing IndexOutOfRange.
            let idx = q * float (s.Length - 1) |> max 0.0 |> min (float (s.Length - 1))
            let lo = int (floor idx)
            let hi = int (ceil idx)
            if lo = hi then s.[lo] else s.[lo] + (idx - float lo) * (s.[hi] - s.[lo])

    // ── piece 4: threshold + one-way verdict ────────────────────────────────────────────────────────
    /// One pair's fact vs the null-calibrated threshold. **One-way** (see the module docstring).
    type PairVerdict =
        /// `stat ≤ threshold`: **no excess correlation demonstrated.** Does NOT prove independence —
        /// a passive common cause weaker than this `δ`/`k` can see also lands here. Never read as "decorrelated."
        | WithinNull
        /// `stat > threshold`: convicts an **above-chance common cause** (the pair correlates beyond what
        /// the independent-sources null produces at level `δ`). One-way: this convicts; `WithinNull` never acquits.
        | ExcessCorrelation

    /// **The `(1 − δ)` null threshold** — the value an independent pair exceeds only with probability `δ`.
    /// `δ` is the per-pair false-conviction budget (mirrors `AntiSybil.chshMargin`'s `delta`). `nan` null
    /// (empty) ⇒ `nan` threshold ⇒ nothing convicts (soundness-biased: no null ⇒ no conviction).
    let nullThreshold (delta: float) (nullStats: float list) : float =
        // Parity with `AntiSybil.chshMargin`: an invalid budget yields no threshold ⇒ nothing convicts.
        if delta <= 0.0 || delta >= 1.0 then nan else quantile (1.0 - delta) nullStats

    /// Classify one pair's measured statistic against a precomputed null threshold. `nan` threshold
    /// (no null) ⇒ `WithinNull` (never convict without a baseline). A `nan` statistic likewise never convicts.
    let classifyPair (threshold: float) (stat: float) : PairVerdict =
        if System.Double.IsNaN threshold || System.Double.IsNaN stat then WithinNull
        elif stat > threshold then ExcessCorrelation
        else WithinNull

    /// **The exact Monte-Carlo permutation p-value** (Phipson–Smyth 2010; North et al. 2002). The observed
    /// statistic is itself one of the exchangeable arrangements under H₀, so it MUST be counted in the
    /// reference set: `p = (1 + #{null_i ≥ observed}) / (k + 1)` (here `k = List.length nullStats`). This is
    /// the calibration the bare `(1 − δ)` quantile (`nullThreshold` + `classifyPair`) lacks — that path
    /// excludes the observed value and drops the `+1`, so on a SMALL null it convicts far above δ (at null
    /// size 1 it convicts ≈ ½ regardless of δ; workitem 081KZ7H82J708QG0R002C1EBH1). `nan` on an empty null
    /// or a `nan` observed. Range `(0, 1]` — the floor `1/(k+1)` is why a test needs `k ≳ 1/δ` to convict.
    let permutationPValue (nullStats: float list) (observed: float) : float =
        match nullStats with
        | [] -> nan
        | _ ->
            if System.Double.IsNaN observed then
                nan
            else
                let atLeast = nullStats |> List.filter (fun v -> v >= observed) |> List.length
                float (1 + atLeast) / float (List.length nullStats + 1)

    /// **Calibrated one-way conviction** — convict iff the exact permutation p-value `≤ δ`. The sound
    /// replacement for `classifyPair (nullThreshold δ …)`: it honours the δ budget AND self-enforces the
    /// permutation-count floor in the SAFE direction — when `(k + 1) < 1/δ` the smallest reachable p-value
    /// `1/(k+1)` already exceeds δ, so **nothing convicts** (soundness-biased toward `WithinNull`, matching
    /// the module's "never a false green"). `δ ∉ (0,1)`, an empty null, or a `nan` observed ⇒ `WithinNull`.
    let classifyByPValue (delta: float) (nullStats: float list) (observed: float) : PairVerdict =
        if delta <= 0.0 || delta >= 1.0 || System.Double.IsNaN observed then
            WithinNull
        else
            match nullStats with
            | [] -> WithinNull
            | _ -> if permutationPValue nullStats observed <= delta then ExcessCorrelation else WithinNull

    // ── the FINER statistic: population excess mutual information (Shannon 1948) ──────────────────────
    //
    // `jaccard` is a PER-PAIR set-overlap: it only fires when two commits touch *literally the same*
    // subsystem. Mutual information is a POPULATION statistic (`Decorrelation.mutualInformation` estimates
    // I(A;B) from many co-samples), so it does not drop into the per-pair `stat` slot — instead it reads
    // the whole pairing at once and sees whether the **identity** of the A-side observable is informative
    // about the B-side's, structured coupling with ZERO literal overlap included (A always in `src/Core`
    // ⟺ B always in `tests/` registers as MI even though their sets are disjoint — Jaccard is blind to it).
    // That is the sense in which MI is *finer*. Caveat (why the observable must be COARSE): plug-in MI
    // saturates when categories are near-unique (each A-side maps to one B-side ⇒ MI → log n for BOTH the
    // real and the null pairing ⇒ no excess); feed it a coarse categorical projection (e.g. a commit's
    // primary subsystem), not the full near-unique touch-set. Excess-over-null cancels the plug-in bias:
    // the null carries the same category count, so only *structure beyond the shuffle* survives.

    /// **Population MI of a categorical pairing** — `I(A; B)` over the `(a, b)` co-samples, via
    /// `Decorrelation.mutualInformation` (nats). One value for the whole pairing, not per pair.
    let pairingMI (pairs: ('k * 'k) list) : float = Decorrelation.mutualInformation pairs

    /// **Permutation null for excess-MI:** each of `k` seeded shuffles breaks the A↔B pairing and yields
    /// **one** null MI (MI is a population statistic — one value per pairing). The real pairing's MI is
    /// compared to the `(1 − δ)` quantile of these. Entropy enters ONLY via `seed` (DST). Truncates to the
    /// shorter side. Empty/one-sided ⇒ `[]` ⇒ `nan` threshold ⇒ nothing convicts (soundness-biased).
    let permutationNullMI (seed: uint64) (k: int) (aObs: 'k list) (bObs: 'k list) : float list =
        let a = List.toArray aObs
        let b = List.toArray bObs
        let n = min a.Length b.Length
        if n = 0 then
            []
        else
            [ for p in 0 .. k - 1 do
                  let bShuf = shuffle (seed + uint64 p * 0x100000001B3UL) b
                  yield Decorrelation.mutualInformation [ for i in 0 .. n - 1 -> a.[i], bShuf.[i] ] ]

    // ── the BLOCK-permutation null: an exchangeability-respecting null for AUTOCORRELATED streams ──────
    //
    // The plain `shuffle` assumes the samples are **exchangeable**. A real commit stream is not: it
    // clusters — a writer touches one subsystem across a *span* of consecutive commits. A full shuffle
    // destroys that short-range structure, so the null **understates** the true fluctuation and the test
    // **over-convicts** (the live artifact: even causally-disjoint cross-history pairs "convict" excess-MI
    // because the null is too tight). This is Soraya's autocorrelation caveat, generalized past the CHSH
    // Hoeffding margin to the whole permutation family. The fix is a **block permutation** (Künsch 1989
    // moving blocks; Politis–Romano 1994 block bootstrap): permute the ORDER of contiguous blocks, keeping
    // each block internally intact, so autocorrelation at lag < blockSize is PRESERVED in the null while
    // the A↔B coupling is still broken at the block scale. For the blocks to carry the right
    // autocorrelation the stream must be ordered by a temporal/causal axis (e.g. commit generation) — a
    // LOCAL calibration of the null, never an input to the shared conclusion (`local-time-never-enters-the-shared-fold`).

    /// **Block permutation** of `arr`: split into consecutive blocks of `blockSize` (last may be short),
    /// permute the block ORDER with a seeded shuffle (each block kept internally intact), concatenate.
    /// `blockSize ≤ 1` ⇒ plain `shuffle` (blocks of one — full exchangeable shuffle); `blockSize ≥ n` ⇒
    /// one block ⇒ identity. Preserves within-block adjacency; a genuine permutation (multiset preserved).
    let blockShuffle (seed: uint64) (blockSize: int) (arr: 'a[]) : 'a[] =
        if blockSize <= 1 then
            shuffle seed arr
        else
            let n = arr.Length
            let blocks = [| for start in 0 .. blockSize .. n - 1 -> arr.[start .. min (start + blockSize - 1) (n - 1)] |]
            Array.concat (shuffle seed blocks)

    /// Block-permutation version of `permutationNull` (per-pair pooled statistic). Identical except the
    /// null uses `blockShuffle blockSize` — preserving lag-`< blockSize` autocorrelation. `blockSize = 1`
    /// recovers `permutationNull` exactly.
    let permutationNullBlock
        (seed: uint64)
        (k: int)
        (blockSize: int)
        (stat: 'o -> 'o -> float)
        (aObs: 'o list)
        (bObs: 'o list)
        : float list =
        let a = List.toArray aObs
        let b = List.toArray bObs
        let n = min a.Length b.Length
        [ for p in 0 .. k - 1 do
              let bShuf = blockShuffle (seed + uint64 p * 0x100000001B3UL) blockSize b
              for i in 0 .. n - 1 do
                  yield stat a.[i] bShuf.[i] ]

    /// Block-permutation version of `permutationNullMI` (one null MI per block-shuffle). `blockSize = 1`
    /// recovers `permutationNullMI`. On an autocorrelated stream the block null's threshold is **higher**
    /// (more conservative) than the plain null's — that is the whole point (it stops over-conviction).
    let permutationNullMIBlock (seed: uint64) (k: int) (blockSize: int) (aObs: 'k list) (bObs: 'k list) : float list =
        let a = List.toArray aObs
        let b = List.toArray bObs
        let n = min a.Length b.Length
        if n = 0 then
            []
        else
            [ for p in 0 .. k - 1 do
                  let bShuf = blockShuffle (seed + uint64 p * 0x100000001B3UL) blockSize b
                  yield Decorrelation.mutualInformation [ for i in 0 .. n - 1 -> a.[i], bShuf.[i] ] ]

    // ── the WITHIN-ERA (windowed) null: strip era-level marginal coupling, keep within-era coupling ────
    //
    // `blockShuffle` keeps blocks intact and permutes their ORDER — preserving *fine* autocorrelation.
    // `windowShuffle` is its COMPLEMENT: it keeps era-windows **in place** and permutes their **contents**,
    // preserving *coarse* (era-level) marginal structure. The fleet's subsystem focus shifts across eras
    // (a docs-heavy window, a Core-heavy window). When two commits look coupled ONLY because they sit in
    // the same era with the same dominant subsystem, that is a benign era-level common cause, not fine
    // coordination — but a null that shuffles ACROSS eras destroys the era marginal and reads it as excess.
    // The within-era null re-pairs only WITHIN a window, so its marginals match the data's era-conditional
    // marginals; it convicts only coupling that survives *beyond* the era. This is the refinement that lets
    // FINER strata be trusted (Reichenbach-conditioning on the era in addition to the shared ancestors).
    // Ordering by generation makes the windows eras — a LOCAL null calibration (`local-time-never-enters-the-shared-fold`).

    /// **Within-window (era-restricted) permutation** of `arr`: split into consecutive windows of
    /// `windowSize`, shuffle ONLY within each window (windows stay in place, each seeded distinctly),
    /// concatenate. Complement of `blockShuffle`. `windowSize ≤ 1` ⇒ identity (a window of one can't
    /// permute); `windowSize ≥ n` ⇒ one window ⇒ plain `shuffle`. A genuine permutation (multiset preserved).
    let windowShuffle (seed: uint64) (windowSize: int) (arr: 'a[]) : 'a[] =
        if windowSize <= 1 then
            Array.copy arr
        else
            let n = arr.Length
            [| for start in 0 .. windowSize .. n - 1 ->
                   arr.[start .. min (start + windowSize - 1) (n - 1)] |]
            |> Array.mapi (fun i w -> shuffle (seed + uint64 i * 0x9E3779B97F4A7C15UL) w)
            |> Array.concat

    /// Within-era version of `permutationNullMI` (one null MI per window-shuffle). `windowSize ≥ n`
    /// recovers `permutationNullMI` (one era). On data coupled ONLY by era-level marginals the within-era
    /// null's threshold rises to meet the real MI — it refuses to convict era-marginal coupling, leaving
    /// only coupling that survives *within* an era.
    let permutationNullMIWindow (seed: uint64) (k: int) (windowSize: int) (aObs: 'k list) (bObs: 'k list) : float list =
        let a = List.toArray aObs
        let b = List.toArray bObs
        let n = min a.Length b.Length
        if n = 0 then
            []
        else
            [ for p in 0 .. k - 1 do
                  let bShuf = windowShuffle (seed + uint64 p * 0x100000001B3UL) windowSize b
                  yield Decorrelation.mutualInformation [ for i in 0 .. n - 1 -> a.[i], bShuf.[i] ] ]

    // ── the COMBINED within-era block null: preserve BOTH era marginals AND fine autocorrelation ───────
    //
    // The block null preserves fine autocorrelation but shuffles across eras (loses era marginals); the
    // within-era null preserves era marginals but shuffles within (loses fine autocorrelation). On real
    // history BOTH nuisances are present, so neither alone is fully conservative. `windowBlockShuffle`
    // composes them: window by era (windows stay IN PLACE) **and** block-shuffle WITHIN each era (blocks
    // kept intact, only their order permuted within the window). Its permutation group is a **subset of
    // both** the block group (it also respects era boundaries) and the window group (it also keeps blocks
    // intact) — so the null is closer to the real data than either, and the threshold is **≥ both**: it is
    // the most conservative of the family. `blockSize = 1` ⇒ the within-era null; `windowSize ≥ n` ⇒ the
    // block null; `blockSize ≥ windowSize` ⇒ identity within each window (maximally conservative).

    /// **Within-era block permutation:** split `arr` into consecutive era-windows of `windowSize` (each
    /// kept IN PLACE), and within each window apply a `blockShuffle blockSize` (blocks intact, order
    /// permuted within the era). Composes `windowShuffle` (era membership) with `blockShuffle` (fine
    /// autocorrelation). `windowSize ≤ 1` ⇒ identity. A genuine permutation (multiset preserved).
    let windowBlockShuffle (seed: uint64) (windowSize: int) (blockSize: int) (arr: 'a[]) : 'a[] =
        if windowSize <= 1 then
            Array.copy arr
        else
            let n = arr.Length
            [| for start in 0 .. windowSize .. n - 1 ->
                   arr.[start .. min (start + windowSize - 1) (n - 1)] |]
            |> Array.mapi (fun i w -> blockShuffle (seed + uint64 i * 0x9E3779B97F4A7C15UL) blockSize w)
            |> Array.concat

    /// Combined within-era block version of `permutationNullMI`. `blockSize = 1` recovers
    /// `permutationNullMIWindow`; `windowSize ≥ n` recovers `permutationNullMIBlock`. Because its
    /// permutation group is a subset of both, its `(1 − δ)` threshold is **≥ both** — the most
    /// conservative null in the family (preserves era marginals AND fine autocorrelation at once).
    let permutationNullMIWindowBlock
        (seed: uint64)
        (k: int)
        (windowSize: int)
        (blockSize: int)
        (aObs: 'k list)
        (bObs: 'k list)
        : float list =
        let a = List.toArray aObs
        let b = List.toArray bObs
        let n = min a.Length b.Length
        if n = 0 then
            []
        else
            [ for p in 0 .. k - 1 do
                  let bShuf = windowBlockShuffle (seed + uint64 p * 0x100000001B3UL) windowSize blockSize b
                  yield Decorrelation.mutualInformation [ for i in 0 .. n - 1 -> a.[i], bShuf.[i] ] ]
