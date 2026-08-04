namespace Zeta.Core

/// **DecorrelationExcessFusion — the DAG layer for the excess-over-null instrument** (the pure
/// statistical core is `DecorrelationExcess`; the causal-graph primitives are `DecorrelationMetrology`).
/// This is the increment the core's docstring deferred: fuse the per-commit observables over the
/// **spacelike (concurrent) commit pairs**, against an independent null that is **stratified by the
/// Reichenbach confounder** — the amount of shared causal past.
///
/// **Why stratify (Reichenbach 1956, common-cause principle):** two commits that share more ancestors
/// inherit more shared codebase state, so they correlate *innocently* more than two commits with little
/// shared past. A single global null would read that inherited baseline as "coupling" and false-convict.
/// Conditioning on the confounder is the fix: we only ever compare a pair's correlation against the null
/// of **other pairs with the same shared-ancestor magnitude**. `sharedAncestorCount` is that confounder;
/// `stratumKey` bands it (pass `id` for exact conditioning, `fun c -> c / w` to coarsen when strata are
/// too thin to clear the resolution floor — see `DecorrelationExcess` `n > 1/δ`).
///
/// **What is spacelike-only, and why:** only causally-concurrent pairs are metered — a timelike pair
/// (one is the other's ancestor) has a legitimate causal path, so correlation there is expected, not
/// evidence of a *hidden* common cause. This is `DecorrelationMetrology.spacelikeCommitPairs`, the same
/// validity filter the CHSH meter uses. Pairs missing an observable on either end are skipped
/// (soundness-biased: no reading ⇒ no conviction).
///
/// **Determinism / noninterference:** pure and total over the supplied DAG + observables; the only
/// entropy source is the explicit `seed` (threaded into each stratum's null as `seed + stratumKey`), so
/// the whole reading replays byte-identically (DST §7) and is golden-lockable. Order-independent: the
/// sensor emits pairs in canonical order, so the within-stratum observable order — and thus every null —
/// does not depend on the input `commits` order.
///
/// **One-way, dual-use-neutral (unchanged from the core):** `Excess` convicts an above-chance common
/// cause *beyond the shared-ancestor baseline*; `WithinNull` **never acquits**. The counts are
/// register-2 facts; reading `ExcessFraction` as "coordination / sovereignty" is register-3 caller policy.
///
/// **Anchors:** Reichenbach 1956 (common cause / conditioning); Fisher 1935 / Pitman 1937 (permutation
/// null); Lamport 1978 (`DecorrelationMetrology` ancestry); `DecorrelationExcess` (the core it fuses).
[<RequireQualifiedAccess>]
module DecorrelationExcessFusion =

    /// **The Reichenbach confounder magnitude** for a pair: `|ancestors(a) ∩ ancestors(b)|`, the size of
    /// the pair's shared causal past. Larger ⇒ more shared inherited state ⇒ higher innocent baseline
    /// correlation ⇒ the null the pair must exceed is drawn from the same stratum.
    let sharedAncestorCount (parents: Map<'C, 'C list>) (a: 'C) (b: 'C) : int =
        Set.intersect (DecorrelationMetrology.ancestors parents a) (DecorrelationMetrology.ancestors parents b)
        |> Set.count

    /// The fused excess-over-null reading over a commit set. **Register-2 counts**; interpretation is the
    /// caller's oracle.
    type Reading =
        { /// Spacelike pairs actually metered (both ends had an observable).
          SpacelikePairs: int
          /// Pairs convicting an **above-chance common cause** (stat > the pair's stratum `(1−δ)` null threshold).
          Excess: int
          /// Pairs with **no excess demonstrated** (stat ≤ threshold) — does NOT prove independence.
          WithinNull: int
          /// Distinct Reichenbach strata (shared-ancestor bands) the null was conditioned on, for audit.
          Strata: int }

        /// Fraction of metered pairs convicting excess. **⚠ register-3 read only** (not a decorrelation
        /// certificate — `WithinNull` never acquits). `nan` if no pairs.
        member r.ExcessFraction : float =
            if r.SpacelikePairs = 0 then nan else float r.Excess / float r.SpacelikePairs

    /// **Fuse** per-commit observables into an excess-over-null `Reading` over the spacelike pairs only,
    /// with the independent null **stratified by the Reichenbach confounder** (shared-ancestor count,
    /// banded by `stratumKey`). `seed`/`k`: the permutation null's determinism seed and permutation count;
    /// `delta`: per-pair false-conviction budget; `parents`: the commit DAG; `observables`: per-commit
    /// touch-set (the sensor reading); `commits`: the set to meter. Deterministic (DST), order-independent.
    let fuse
        (seed: uint64)
        (delta: float)
        (k: int)
        (stratumKey: int -> int)
        (parents: Map<'C, 'C list>)
        (observables: Map<'C, Set<string>>)
        (commits: 'C list)
        : Reading =
        // Memoize each commit's ancestor set ONCE (reused for the confounder of every pair it appears in).
        let ancOf =
            commits
            |> List.distinct
            |> List.map (fun c -> c, DecorrelationMetrology.ancestors parents c)
            |> Map.ofList

        let anc c = Map.tryFind c ancOf |> Option.defaultValue Set.empty

        // Spacelike pairs (canonical order from the sensor) that have an observable on both ends.
        let pairs =
            DecorrelationMetrology.spacelikeCommitPairs parents commits
            |> List.choose (fun (a, b) ->
                match Map.tryFind a observables, Map.tryFind b observables with
                | Some oa, Some ob -> Some(a, b, oa, ob)
                | _ -> None)

        // Stratify by the banded Reichenbach confounder; sort strata for a deterministic seed assignment.
        let strata =
            pairs
            |> List.groupBy (fun (a, b, _, _) -> stratumKey (Set.intersect (anc a) (anc b) |> Set.count))
            |> List.sortBy fst

        // Per stratum: build the null from THIS stratum's pairs only (Reichenbach conditioning), threshold,
        // classify. Each stratum gets a distinct-yet-replayable seed (seed + its banded key).
        let verdicts =
            strata
            |> List.collect (fun (key, ps) ->
                let aObs = ps |> List.map (fun (_, _, oa, _) -> oa)
                let bObs = ps |> List.map (fun (_, _, _, ob) -> ob)
                let nullStats = DecorrelationExcess.permutationNull (seed + uint64 key) k DecorrelationExcess.jaccard aObs bObs
                let threshold = DecorrelationExcess.nullThreshold delta nullStats
                ps
                |> List.map (fun (_, _, oa, ob) -> DecorrelationExcess.classifyPair threshold (DecorrelationExcess.jaccard oa ob)))

        { SpacelikePairs = List.length pairs
          Excess = verdicts |> List.filter ((=) DecorrelationExcess.ExcessCorrelation) |> List.length
          WithinNull = verdicts |> List.filter ((=) DecorrelationExcess.WithinNull) |> List.length
          Strata = List.length strata }

    // ── the FINER lens: per-stratum excess mutual information ────────────────────────────────────────
    /// One stratum's excess-MI test: the real pairing's `I(A; B)` vs its permutation-null threshold.
    type MIStratum =
        { /// The banded Reichenbach key (shared-ancestor magnitude) this stratum conditions on.
          Stratum: int
          /// Spacelike pairs in the stratum (the MI sample size).
          Pairs: int
          /// `I(A; B)` (nats) of the REAL categorical pairing.
          RealMI: float
          /// The `(1 − δ)` quantile of the permutation-null MI — the bar the real MI must clear.
          NullThreshold: float
          /// `ExcessCorrelation` iff `RealMI > NullThreshold`; else `WithinNull` (never acquits).
          Verdict: DecorrelationExcess.PairVerdict }

    /// The fused excess-MI reading. Granularity is **per-stratum** (MI is a population statistic — one
    /// value per pairing, so a stratum, not a pair, is the unit of conviction — coarser than `fuse`'s
    /// per-pair verdicts, but sensitive to identity-coupling `fuse`'s Jaccard cannot see).
    type MIReading =
        { Strata: MIStratum list
          /// Strata convicting excess mutual information.
          ExcessStrata: int }

    /// **Fuse with the mutual-information statistic** — the finer lens (see `DecorrelationExcess` MI
    /// section). Identical DAG/Reichenbach machinery as `fuse`, but the observable is a **coarse
    /// categorical** `Map<'C, 'k>` (e.g. each commit's primary subsystem — full touch-sets saturate MI),
    /// and each stratum gets ONE excess-MI verdict from `I(A; B)` vs the permutation-null MI. Deterministic
    /// (DST, `seed` only), order-independent, one-way (`ExcessCorrelation` convicts; `WithinNull` never acquits).
    let fuseMI
        (seed: uint64)
        (delta: float)
        (k: int)
        (stratumKey: int -> int)
        (parents: Map<'C, 'C list>)
        (categories: Map<'C, 'k>)
        (commits: 'C list)
        : MIReading =
        let ancOf =
            commits
            |> List.distinct
            |> List.map (fun c -> c, DecorrelationMetrology.ancestors parents c)
            |> Map.ofList

        let anc c = Map.tryFind c ancOf |> Option.defaultValue Set.empty

        let pairs =
            DecorrelationMetrology.spacelikeCommitPairs parents commits
            |> List.choose (fun (a, b) ->
                match Map.tryFind a categories, Map.tryFind b categories with
                | Some ca, Some cb -> Some(a, b, ca, cb)
                | _ -> None)

        let strata =
            pairs
            |> List.groupBy (fun (a, b, _, _) -> stratumKey (Set.intersect (anc a) (anc b) |> Set.count))
            |> List.sortBy fst

        let readings =
            strata
            |> List.map (fun (key, ps) ->
                let aObs = ps |> List.map (fun (_, _, ca, _) -> ca)
                let bObs = ps |> List.map (fun (_, _, _, cb) -> cb)
                let realMI = DecorrelationExcess.pairingMI (List.zip aObs bObs)
                let nullMIs = DecorrelationExcess.permutationNullMI (seed + uint64 key) k aObs bObs
                let threshold = DecorrelationExcess.nullThreshold delta nullMIs
                { Stratum = key
                  Pairs = List.length ps
                  RealMI = realMI
                  NullThreshold = threshold
                  Verdict = DecorrelationExcess.classifyPair threshold realMI })

        { Strata = readings
          ExcessStrata = readings |> List.filter (fun r -> r.Verdict = DecorrelationExcess.ExcessCorrelation) |> List.length }

    /// **`fuseMI` with a BLOCK-permutation null** — the exchangeability-respecting variant. Identical to
    /// `fuseMI` except each stratum's pairs are ordered by the B-commit's **generation** (a pure causal-
    /// temporal ordinal, `DecorrelationMetrology.generation`) and the null uses `permutationNullMIBlock`
    /// with `blockSize`, so autocorrelation at lag `< blockSize` is preserved in the null. This raises the
    /// threshold on autocorrelated streams and removes the over-conviction the plain `fuseMI` suffers on
    /// real commit history. `blockSize = 1` recovers `fuseMI`'s null shape. The generation ordering is a
    /// LOCAL null calibration only — `RealMI` is order-invariant, so the shared conclusion never sees it
    /// (`local-time-never-enters-the-shared-fold`). Deterministic (DST), order-independent in `commits`.
    ///
    /// **`minSharedAncestors`** excludes pairs whose **raw** shared-ancestor count is below it (the
    /// causally-disjoint / cross-history pairs). Zero-shared-ancestor pairs have **no common cause to
    /// condition on** — Reichenbach conditioning is undefined there — and generation is not a shared
    /// temporal axis across disjoint histories, so their block null is meaningless and they over-convict.
    /// Pass `1` to meter only causally-related concurrent pairs (the principled default); `0` meters all.
    /// The floor is on the RAW count, not the banded `stratumKey` value (with `c/2` banding, banded-key-0
    /// would wrongly also hold count-1 pairs).
    let fuseMIBlock
        (seed: uint64)
        (delta: float)
        (k: int)
        (blockSize: int)
        (minSharedAncestors: int)
        (stratumKey: int -> int)
        (parents: Map<'C, 'C list>)
        (categories: Map<'C, 'k>)
        (commits: 'C list)
        : MIReading =
        let ancOf =
            commits
            |> List.distinct
            |> List.map (fun c -> c, DecorrelationMetrology.ancestors parents c)
            |> Map.ofList

        let anc c = Map.tryFind c ancOf |> Option.defaultValue Set.empty
        let gens = DecorrelationMetrology.generation parents
        let genOf c = Map.tryFind c gens |> Option.defaultValue 0

        let pairs =
            DecorrelationMetrology.spacelikeCommitPairs parents commits
            |> List.choose (fun (a, b) ->
                match Map.tryFind a categories, Map.tryFind b categories with
                | Some ca, Some cb ->
                    let shared = Set.intersect (anc a) (anc b) |> Set.count
                    // Exclude causally-disjoint pairs (no common cause to condition on).
                    if shared >= minSharedAncestors then Some(a, b, ca, cb, shared) else None
                | _ -> None)

        let strata =
            pairs
            |> List.groupBy (fun (_, _, _, _, shared) -> stratumKey shared)
            |> List.sortBy fst

        let readings =
            strata
            |> List.map (fun (key, ps) ->
                // Order by causal-temporal position so block adjacency = short-range autocorrelation.
                let ordered = ps |> List.sortBy (fun (a, b, _, _, _) -> genOf b, genOf a, b, a)
                let aObs = ordered |> List.map (fun (_, _, ca, _, _) -> ca)
                let bObs = ordered |> List.map (fun (_, _, _, cb, _) -> cb)
                let realMI = DecorrelationExcess.pairingMI (List.zip aObs bObs) // order-invariant
                let nullMIs = DecorrelationExcess.permutationNullMIBlock (seed + uint64 key) k blockSize aObs bObs
                let threshold = DecorrelationExcess.nullThreshold delta nullMIs
                { Stratum = key
                  Pairs = List.length ps
                  RealMI = realMI
                  NullThreshold = threshold
                  Verdict = DecorrelationExcess.classifyPair threshold realMI })

        { Strata = readings
          ExcessStrata = readings |> List.filter (fun r -> r.Verdict = DecorrelationExcess.ExcessCorrelation) |> List.length }

    /// **`fuseMIBlock`'s within-era sibling** — uses the WINDOWED (era-restricted) null instead of the
    /// block null. Same generation-ordering, Reichenbach stratification, and `minSharedAncestors` exclusion;
    /// the only change is `permutationNullMIWindow windowSize`, which re-pairs **only within era-windows**
    /// so the null's marginals match the data's era-conditional marginals. This strips **era-level marginal
    /// coupling** (two commits looking coupled only because they share a same-dominant-subsystem era) and
    /// convicts only coupling that survives *within* an era — a second Reichenbach conditioning (on the era),
    /// which is what lets finer strata be trusted. `windowSize ≥ stratum size` ⇒ one era ⇒ recovers `fuseMI`'s
    /// null shape. Deterministic (DST); the generation ordering is a LOCAL null calibration only
    /// (`RealMI` is order-invariant — `local-time-never-enters-the-shared-fold`).
    let fuseMIWindow
        (seed: uint64)
        (delta: float)
        (k: int)
        (windowSize: int)
        (minSharedAncestors: int)
        (stratumKey: int -> int)
        (parents: Map<'C, 'C list>)
        (categories: Map<'C, 'k>)
        (commits: 'C list)
        : MIReading =
        let ancOf =
            commits
            |> List.distinct
            |> List.map (fun c -> c, DecorrelationMetrology.ancestors parents c)
            |> Map.ofList

        let anc c = Map.tryFind c ancOf |> Option.defaultValue Set.empty
        let gens = DecorrelationMetrology.generation parents
        let genOf c = Map.tryFind c gens |> Option.defaultValue 0

        let pairs =
            DecorrelationMetrology.spacelikeCommitPairs parents commits
            |> List.choose (fun (a, b) ->
                match Map.tryFind a categories, Map.tryFind b categories with
                | Some ca, Some cb ->
                    let shared = Set.intersect (anc a) (anc b) |> Set.count
                    if shared >= minSharedAncestors then Some(a, b, ca, cb, shared) else None
                | _ -> None)

        let strata =
            pairs
            |> List.groupBy (fun (_, _, _, _, shared) -> stratumKey shared)
            |> List.sortBy fst

        let readings =
            strata
            |> List.map (fun (key, ps) ->
                // Order by generation so each window is a contiguous ERA of the stratum.
                let ordered = ps |> List.sortBy (fun (a, b, _, _, _) -> genOf b, genOf a, b, a)
                let aObs = ordered |> List.map (fun (_, _, ca, _, _) -> ca)
                let bObs = ordered |> List.map (fun (_, _, _, cb, _) -> cb)
                let realMI = DecorrelationExcess.pairingMI (List.zip aObs bObs) // order-invariant
                let nullMIs = DecorrelationExcess.permutationNullMIWindow (seed + uint64 key) k windowSize aObs bObs
                let threshold = DecorrelationExcess.nullThreshold delta nullMIs
                { Stratum = key
                  Pairs = List.length ps
                  RealMI = realMI
                  NullThreshold = threshold
                  Verdict = DecorrelationExcess.classifyPair threshold realMI })

        { Strata = readings
          ExcessStrata = readings |> List.filter (fun r -> r.Verdict = DecorrelationExcess.ExcessCorrelation) |> List.length }

    /// **The COMBINED within-era block null** — the most conservative fusion in the family. Same
    /// generation-ordering, Reichenbach stratification, and `minSharedAncestors` exclusion as `fuseMIBlock`
    /// / `fuseMIWindow`, but the null is `permutationNullMIWindowBlock windowSize blockSize`: it windows by
    /// era (preserving era marginals) AND block-shuffles within each era (preserving fine autocorrelation),
    /// so it convicts only coupling that survives BOTH nuisances. Its threshold is `≥` both siblings'
    /// (subset permutation group), so `ExcessStrata ≤ min(block, window)`. `blockSize = 1` ⇒ `fuseMIWindow`;
    /// `windowSize ≥ stratum size` ⇒ `fuseMIBlock`. Deterministic (DST); the generation ordering is a LOCAL
    /// null calibration only (`RealMI` order-invariant — `local-time-never-enters-the-shared-fold`).
    let fuseMIWindowBlock
        (seed: uint64)
        (delta: float)
        (k: int)
        (windowSize: int)
        (blockSize: int)
        (minSharedAncestors: int)
        (stratumKey: int -> int)
        (parents: Map<'C, 'C list>)
        (categories: Map<'C, 'k>)
        (commits: 'C list)
        : MIReading =
        let ancOf =
            commits
            |> List.distinct
            |> List.map (fun c -> c, DecorrelationMetrology.ancestors parents c)
            |> Map.ofList

        let anc c = Map.tryFind c ancOf |> Option.defaultValue Set.empty
        let gens = DecorrelationMetrology.generation parents
        let genOf c = Map.tryFind c gens |> Option.defaultValue 0

        let pairs =
            DecorrelationMetrology.spacelikeCommitPairs parents commits
            |> List.choose (fun (a, b) ->
                match Map.tryFind a categories, Map.tryFind b categories with
                | Some ca, Some cb ->
                    let shared = Set.intersect (anc a) (anc b) |> Set.count
                    if shared >= minSharedAncestors then Some(a, b, ca, cb, shared) else None
                | _ -> None)

        let strata =
            pairs
            |> List.groupBy (fun (_, _, _, _, shared) -> stratumKey shared)
            |> List.sortBy fst

        let readings =
            strata
            |> List.map (fun (key, ps) ->
                let ordered = ps |> List.sortBy (fun (a, b, _, _, _) -> genOf b, genOf a, b, a)
                let aObs = ordered |> List.map (fun (_, _, ca, _, _) -> ca)
                let bObs = ordered |> List.map (fun (_, _, _, cb, _) -> cb)
                let realMI = DecorrelationExcess.pairingMI (List.zip aObs bObs) // order-invariant
                let nullMIs = DecorrelationExcess.permutationNullMIWindowBlock (seed + uint64 key) k windowSize blockSize aObs bObs
                let threshold = DecorrelationExcess.nullThreshold delta nullMIs
                { Stratum = key
                  Pairs = List.length ps
                  RealMI = realMI
                  NullThreshold = threshold
                  Verdict = DecorrelationExcess.classifyPair threshold realMI })

        { Strata = readings
          ExcessStrata = readings |> List.filter (fun r -> r.Verdict = DecorrelationExcess.ExcessCorrelation) |> List.length }
