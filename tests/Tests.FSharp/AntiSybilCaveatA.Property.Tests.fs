module Zeta.Tests.AntiSybilCaveatAPropertyTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core.AntiSybil

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// BP-16 SECOND TOOL for the Caveat-A default switch (#10027). Soraya machine-verified obligations
// (a)/(b)/(c) with **Z3** on the pointwise formulas; the cross-check rule wants a SECOND, INDEPENDENT
// tool for a P0 security change. This is **FsCheck** — generative properties over real `ChshRound`
// streams reaching the executable paths Z3 can't (union-find closure, the ∞ guard, the HAC bandwidth,
// the RhoMax clamp). Hardened after an adversarial review (harsh-critic, 2026-08-04) that flagged the
// first cut as testing the *cardinality shadow* of "subset" with a generator that never produced the
// autocorrelated adversary. This version fixes both:
//   • (c) is now **per-pair implication** + **partition refinement** (true subset), not DistinctCount ≥.
//   • generators produce **bursty (run-structured)** and **conducted (high-|S|)** streams, so the
//     corrected-convicts antecedent actually fires and margin_autocorr genuinely exceeds margin_iid.
//   • an EXPLICIT conviction-flip is demonstrated (i.i.d. over-convicts an honest bursty pair; corrected
//     spares it) — the whole point of the switch, now a concrete test, not just a monotonicity theorem.
//   • streams run past length 64 so the Newey–West bandwidth ⌊n^(1/3)⌋ reaches ≥ 4.
//   • `Replay` fixes the seed (DST §7 — a security-gating property must replay).
//
// Honest scope: (a)/(b) are theorems of the code (factor ≥ 1 ⇒ n_eff ≤ n ⇒ margin monotone). As
// properties they are REGRESSION GUARDS — a future formula change that breaks monotonicity is caught.
// (c)/(c') and the flip are the load-bearing behavioral checks.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

[<Literal>]
let private Rep = "1337,7331" // fixed replay seed (determinism / DST)

// ── generators ────────────────────────────────────────────────────────────────────────────────────
let private genRound =
    gen {
        let! s = Gen.elements [ 0; 1 ]
        let! o = Gen.elements [ 1; -1 ]
        return { Setting = s; Outcome = o }
    }

/// i.i.d. stream (0..120 rounds) — the "corrected ≈ iid" baseline, and > 64 so the HAC bandwidth ≥ 4.
let private genIidStream = gen { let! n = Gen.choose (0, 120) in return! Gen.listOfLength n genRound }

/// **Bursty** stream: outcomes/settings in RUNS ⇒ a genuinely autocorrelated product series (n_eff < n).
let private genBurstStream =
    gen {
        let! segs =
            Gen.nonEmptyListOf (
                gen {
                    let! s = Gen.elements [ 0; 1 ]
                    let! o = Gen.elements [ 1; -1 ]
                    let! rl = Gen.choose (1, 14)
                    return s, o, rl
                }
            )
        return [ for (s, o, rl) in segs do for _ in 1..rl -> { Setting = s; Outcome = o } ] |> List.truncate 120
    }

/// **Conducted** pair: outcome product = a deterministic f(sa,sb) ⇒ high |S| (fires the corrected-convicts
/// antecedent); settings in runs ⇒ autocorrelated product ⇒ margin_autocorr > margin_iid. This is the
/// honest-but-bursty shape Caveat-A targets, generated so (c)'s antecedent is non-vacuous.
let private genConductedPair =
    gen {
        let f sa sb = if sa = 0 && sb = 1 then -1 else 1 // an |S| = 4 strategy

        let! segs =
            Gen.nonEmptyListOf (
                gen {
                    let! sa = Gen.elements [ 0; 1 ]
                    let! sb = Gen.elements [ 0; 1 ]
                    let! rl = Gen.choose (1, 12)
                    return sa, sb, rl
                }
            )

        let a = [ for (sa, _, rl) in segs do for _ in 1..rl -> { Setting = sa; Outcome = 1 } ] |> List.truncate 120
        let b = [ for (sa, sb, rl) in segs do for _ in 1..rl -> { Setting = sb; Outcome = f sa sb } ] |> List.truncate 120
        return a, b
    }

let private genStreamPair =
    Gen.frequency
        [ 3, genConductedPair
          2, gen { let! a = genBurstStream in let! b = genBurstStream in return a, b }
          2, gen { let! a = genIidStream in let! b = genIidStream in return a, b } ]

let private genDelta = Gen.choose (1, 99) |> Gen.map (fun i -> float i / 100.0) // δ ∈ (0, 1)

/// A batch that interleaves conducted pairs (so high-|S| convictions + union-find actually fire).
let private genBatch =
    gen {
        let! pairs = Gen.nonEmptyListOf genStreamPair
        return [ for (a, b) in pairs do yield a; yield b ] |> List.truncate 8
    }

type PairCase = { D: float; A: ChshRound list; B: ChshRound list }
type BatchCase = { D: float; Tol: float; Streams: ChshRound list list }

let private genPairCase =
    gen {
        let! d = genDelta
        let! (a, b) = genStreamPair
        return { D = d; A = a; B = b }
    }

let private genBatchCase =
    gen {
        let! d = genDelta
        let! tol = Gen.choose (0, 200) |> Gen.map (fun i -> float i / 100.0)
        let! s = genBatch
        return { D = d; Tol = tol; Streams = s }
    }

type CaveatAArb() =
    static member Pair() = Arb.fromGen genPairCase
    static member Batch() = Arb.fromGen genBatchCase

// ── the pre-switch i.i.d. oracle, reconstructed inline (chshSybilCalibrated now uses the CORRECTED
//    margin, so the old behavior is rebuilt to compare against). SourceOf built EXACTLY as the oracle does.
let private iidSourceOf (delta: float) (streams: ChshRound list list) : Map<int, int> =
    let k = List.length streams
    let arr = List.toArray streams
    let parent = Array.init k id
    let rec find i = if parent.[i] = i then i else (let r = find parent.[i] in parent.[i] <- r; r)
    let union i j = let ri, rj = find i, find j in if ri <> rj then parent.[ri] <- rj
    for i in 0 .. k - 1 do
        for j in i + 1 .. k - 1 do
            let n = min (List.length arr.[i]) (List.length arr.[j])
            if abs (chshS arr.[i] arr.[j]) > 2.0 + chshMargin delta n then
                union i j
    let roots = [ 0 .. k - 1 ] |> List.map find
    let canon = roots |> List.distinct |> List.mapi (fun id r -> r, id) |> Map.ofList
    roots |> List.mapi (fun i r -> i, canon.[r]) |> Map.ofList

/// `fine` refines `coarse` iff every group of `fine` sits inside one group of `coarse` — i.e. two indices
/// sharing a `fine` source always share a `coarse` source. This is the TRUE subset (partition refinement),
/// not the DistinctCount shadow: it catches a regressed oracle that convicts a pair the baseline didn't,
/// even when block counts coincide.
let private refines (fine: Map<int, int>) (coarse: Map<int, int>) : bool =
    let idx = fine |> Map.toList |> List.map fst
    idx
    |> List.forall (fun i -> idx |> List.forall (fun j -> fine.[i] <> fine.[j] || coarse.[i] = coarse.[j]))

// ── (a) n_eff ≤ n ─────────────────────────────────────────────────────────────────────────────────────

[<Property(Replay = Rep, MaxTest = 500)>]
let ``(a) effectiveSampleSize <= n, equality iff rho1 <= 0`` (NonNegativeInt n0) (rInt: int) =
    let n = n0 % 500 + 1
    let r = float (((rInt % 199) + 199) % 199 - 99) / 100.0 // r ∈ [-0.99, 0.99]
    let neff = effectiveSampleSize n r
    neff <= float n + 1e-9
    && (if r <= 0.0 then abs (neff - float n) < 1e-9 else neff < float n)

[<Property(Arbitrary = [| typeof<CaveatAArb> |], Replay = Rep, MaxTest = 500)>]
let ``(a) effectiveSampleSizeHAC <= n for any stream + bandwidth`` (c: PairCase) =
    let series = outcomeProductSeries c.A c.B
    effectiveSampleSizeHAC series (neweyWestBandwidth (List.length series)) <= float (List.length series) + 1e-9

// ── (b) margin monotone (regression guard for the whole chain) ────────────────────────────────────────

[<Property(Arbitrary = [| typeof<CaveatAArb> |], Replay = Rep, MaxTest = 500)>]
let ``(b) chshMarginAutocorr >= chshMargin for every pair + delta`` (c: PairCase) =
    chshMarginAutocorr c.D c.A c.B >= chshMargin c.D (min (List.length c.A) (List.length c.B))

// ── (c) TRUE subset: per-pair implication + partition refinement ──────────────────────────────────────

[<Property(Arbitrary = [| typeof<CaveatAArb> |], Replay = Rep, MaxTest = 1000)>]
let ``(c) per-pair: corrected conviction IMPLIES iid conviction`` (c: PairCase) =
    let s = abs (chshS c.A c.B)
    let n = min (List.length c.A) (List.length c.B)
    (not (s > 2.0 + chshMarginAutocorr c.D c.A c.B)) || (s > 2.0 + chshMargin c.D n)

[<Property(Arbitrary = [| typeof<CaveatAArb> |], Replay = Rep, MaxTest = 1000)>]
let ``(c) oracle: corrected SourceOf REFINES the iid SourceOf (true subset, not count)`` (c: BatchCase) =
    refines (chshSybilCalibrated c.D c.Streams).SourceOf (iidSourceOf c.D c.Streams)

[<Property(Arbitrary = [| typeof<CaveatAArb> |], Replay = Rep, MaxTest = 1000)>]
let ``(c') gate: gated SourceOf REFINES the margin-only SourceOf (gate only removes)`` (c: BatchCase) =
    refines (chshSybilAutocorrCalibrated c.D c.Tol c.Streams).SourceOf (chshSybilCalibrated c.D c.Streams).SourceOf

// ── the EXPLICIT conviction-flip: the whole reason for the switch, demonstrated concretely ────────────
// A conducted |S| = 4 pair with settings in runs of 12 (strongly autocorrelated). i.i.d. margin at n = 96
// gives bound 2.999 ⇒ FALSELY convicts (4 > 2.999); the corrected HAC margin gives bound ≈ 4.019 ⇒ spares
// it (4 < 4.019). This honest-but-bursty pair is exactly what the switch stops over-convicting.
[<Fact>]
let ``FLIP: i.i.d. over-convicts a bursty conducted pair; the corrected margin spares it`` () =
    let f sa sb = if sa = 0 && sb = 1 then -1 else 1
    let segs = [ for _ in 0..1 do for (sa, sb) in [ 0, 0; 0, 1; 1, 0; 1, 1 ] -> (sa, sb, 12) ]
    let a = [ for (sa, _, rl) in segs do for _ in 1..rl -> { Setting = sa; Outcome = 1 } ]
    let b = [ for (sa, sb, rl) in segs do for _ in 1..rl -> { Setting = sb; Outcome = f sa sb } ]
    let n = min (List.length a) (List.length b)
    let s = abs (chshS a b)
    Assert.Equal(4.0, s, 9) // a genuine |S| = 4 signal
    Assert.True(s > 2.0 + chshMargin 0.05 n, "i.i.d. margin convicts (the false positive)")
    Assert.False(s > 2.0 + chshMarginAutocorr 0.05 a b, "corrected margin spares (the fix)")

// ── HAC strict direction (the reverse half of obligation (a), on a genuinely bursty stream) ───────────
[<Fact>]
let ``(a) HAC: n_eff is STRICTLY below n on a positively-autocorrelated stream`` () =
    let series = [ for i in 0..119 -> if (i / 8) % 2 = 0 then 1.0 else -1.0 ] // runs of 8 ⇒ positive autocorr
    Assert.True(effectiveSampleSizeHAC series (neweyWestBandwidth 120) < 120.0)
