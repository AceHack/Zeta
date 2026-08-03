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

    /// The `q`-quantile (`0 ≤ q ≤ 1`) of `xs` by linear interpolation between order statistics.
    /// `nan` on an empty sample. `q = 1.0` ⇒ the maximum; used with `q = 1 − δ` for the threshold.
    let quantile (q: float) (xs: float list) : float =
        match xs with
        | [] -> nan
        | _ ->
            let s = List.sort xs |> List.toArray
            let idx = q * float (s.Length - 1)
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
        quantile (1.0 - delta) nullStats

    /// Classify one pair's measured statistic against a precomputed null threshold. `nan` threshold
    /// (no null) ⇒ `WithinNull` (never convict without a baseline). A `nan` statistic likewise never convicts.
    let classifyPair (threshold: float) (stat: float) : PairVerdict =
        if System.Double.IsNaN threshold || System.Double.IsNaN stat then WithinNull
        elif stat > threshold then ExcessCorrelation
        else WithinNull
