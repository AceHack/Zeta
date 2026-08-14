module Zeta.Tests.QuorumAlgebraTests

open global.Xunit
open Zeta.Core

/// A real amplitude (phase 0) - the outcome key is `int` so the witnesses are readable.
let private r (x: float) : Complex = { Real = x; Imag = 0.0 }
let private ph (theta: float) : Complex = { Real = cos theta; Imag = sin theta }
let private magSq (z: Complex) = z.Real * z.Real + z.Imag * z.Imag
let private ampAt (k: int) (v: QuorumAlgebra.Contribution<int>) =
    v |> List.tryFind (fun (i, _) -> i = k) |> Option.map snd

// =============================================================================================
// A. THE JOIN HALF - a bounded join-semilattice. Every law HOLDS, exactly.
// =============================================================================================

[<Fact>]
let ``join is IDEMPOTENT - the same source twice counts once (this is what interference cannot do)`` () =
    let q = QuorumAlgebra.single "alice" [ 0, r 1.0 ]
    Assert.Equal<QuorumAlgebra.Quorum<int> >(q, QuorumAlgebra.join q q)

[<Fact>]
let ``join is COMMUTATIVE and ASSOCIATIVE`` () =
    let a = QuorumAlgebra.single "alice" [ 0, r 1.0 ]
    let b = QuorumAlgebra.single "bob" [ 0, r -1.0 ]
    let c = QuorumAlgebra.single "carol" [ 1, ph 0.5 ]
    Assert.Equal<QuorumAlgebra.Quorum<int> >(QuorumAlgebra.join a b, QuorumAlgebra.join b a)
    Assert.Equal<QuorumAlgebra.Quorum<int> >(
        QuorumAlgebra.join (QuorumAlgebra.join a b) c,
        QuorumAlgebra.join a (QuorumAlgebra.join b c))

[<Fact>]
let ``join has empty as its unit`` () =
    let a = QuorumAlgebra.single "alice" [ 0, r 1.0 ]
    Assert.Equal<QuorumAlgebra.Quorum<int> >(a, QuorumAlgebra.join a QuorumAlgebra.empty)
    Assert.Equal<QuorumAlgebra.Quorum<int> >(a, QuorumAlgebra.join QuorumAlgebra.empty a)

[<Fact>]
let ``a source that says two different things is NAMED and EXCLUDED, never resolved`` () =
    // universal/evidence membership rule 4: picking a winner is an arbitrary choice wearing a merge.
    let a = QuorumAlgebra.single "alice" [ 0, r 1.0 ]
    let a2 = QuorumAlgebra.single "alice" [ 0, r 2.0 ]
    let joined = QuorumAlgebra.join a a2
    Assert.Empty(QuorumAlgebra.sources joined)
    Assert.Equal<string list>([ "alice" ], joined.Conflicted |> Set.toList)
    // conflict is ABSORBING: it survives every later join, so the semilattice stays a semilattice
    let later = QuorumAlgebra.join joined a
    Assert.Empty(QuorumAlgebra.sources later)
    Assert.True(later.Conflicted.Contains "alice")

// =============================================================================================
// B. THE INTERFERENCE HALF - a free C-module. Idempotency is DECLINED BY DESIGN; and on top of
//    that, the EPS drop breaks laws the abstract carrier does have. Both facts are measured.
// =============================================================================================

[<Fact>]
let ``interfere is NOT idempotent - a plus a is 2a. Spec 12 is DECLINED here by design, not violated`` () =
    let a: QuorumAlgebra.Contribution<int> = [ 0, r 1.0 ]
    let doubled = QuorumAlgebra.interfere a a
    Assert.Equal(2.0, (ampAt 0 doubled).Value.Real, 12)
    // and that is exactly why it cannot be a join: join a a = a, interfere a a = 2a.
    Assert.NotEqual<QuorumAlgebra.Contribution<int> >(a, doubled)

[<Fact>]
let ``interference is the instrument - opposite phases annihilate`` () =
    let a: QuorumAlgebra.Contribution<int> = [ 0, ph 0.0 ]
    let b: QuorumAlgebra.Contribution<int> = [ 0, ph System.Math.PI ]
    Assert.Empty(QuorumAlgebra.interfere a b)

[<Fact>]
let ``ASSOCIATIVITY FAILS STRUCTURALLY - one grouping measures None, the other Some, gap 1.6e-6`` () =
    // The EPS = 1e-12 drop deletes any branch whose SUM has |z| below 1e-6. In the left grouping the
    // residual a+b = 8e-7 is deleted before c can be added to it; in the right grouping b+c keeps it.
    let a: QuorumAlgebra.Contribution<int> = [ 0, r 1.0 ]
    let b: QuorumAlgebra.Contribution<int> = [ 0, r (-1.0 + 8e-7) ]
    let c: QuorumAlgebra.Contribution<int> = [ 0, r 8e-7 ]
    let left = QuorumAlgebra.interfere (QuorumAlgebra.interfere a b) c
    let right = QuorumAlgebra.interfere a (QuorumAlgebra.interfere b c)
    Assert.Empty(left)
    Assert.Equal(1, List.length right)
    Assert.Equal(1.6e-6, (ampAt 0 right).Value.Real, 12)
    // The qualitative form: the two groupings disagree about whether a state exists at all.
    Assert.Equal(0, List.length (AmplitudeEmu.bornProbOf left))
    Assert.Equal(1, List.length (AmplitudeEmu.bornProbOf right))

[<Fact>]
let ``ASSOCIATIVITY FAILS at 1.1e8 ULPs - far above float noise, so this is structural not rounding`` () =
    let a: QuorumAlgebra.Contribution<int> = [ 0, r 1.0 ]
    let b: QuorumAlgebra.Contribution<int> = [ 0, r (-1.0 + 1e-7) ]
    let c: QuorumAlgebra.Contribution<int> = [ 0, r 5.0 ]
    let left = QuorumAlgebra.interfere (QuorumAlgebra.interfere a b) c
    let right = QuorumAlgebra.interfere a (QuorumAlgebra.interfere b c)
    let l = (ampAt 0 left).Value.Real
    let rr = (ampAt 0 right).Value.Real
    Assert.Equal(5.0, l, 12)
    Assert.Equal(5.0000001, rr, 12)
    let ulp5 = 8.881784197001252e-16
    let ulps = abs (l - rr) / ulp5
    Assert.True(ulps > 1e8, sprintf "gap was %g ULPs - expected structural (over 1e8), not rounding" ulps)

[<Fact>]
let ``SCALE COVARIANCE FAILS - halving a state changes its support and its Born probabilities`` () =
    // A physical state is a RAY: |z|^2 over sum|z|^2 is all that is observable, so multiplying every
    // amplitude by 0.5 is the identity physically. EPS is a DIMENSIONFUL threshold on |z|^2, so it
    // is not: it introduces an absolute scale into a theory that has none.
    let a: QuorumAlgebra.Contribution<int> = [ 0, r 1.0; 0, r (-1.0 + 2e-6); 1, r 1.0 ]
    let half = a |> List.map (fun (k, z) -> k, { Real = z.Real * 0.5; Imag = z.Imag * 0.5 })
    Assert.Equal(2, List.length (AmplitudeEmu.mergeOf a))
    Assert.Equal(1, List.length (AmplitudeEmu.mergeOf half))
    // and the measured distribution differs on states that are physically identical
    let bornOf v = AmplitudeEmu.mergeOf v |> List.map (fun (k, z) -> k, magSq z)
    Assert.Equal(2, List.length (bornOf a))
    Assert.Equal(1, List.length (bornOf half))

[<Fact>]
let ``merge IS idempotent as a NORMALISATION - that part holds`` () =
    let a: QuorumAlgebra.Contribution<int> = [ 0, r 1.0; 0, r 2.0; 1, r 3.0 ]
    let once = AmplitudeEmu.mergeOf a
    Assert.Equal<QuorumAlgebra.Contribution<int> >(once, AmplitudeEmu.mergeOf once)

// =============================================================================================
// C. THE CROSSING - join first, interfere second; the reading is a fact, not a verdict.
// =============================================================================================

[<Fact>]
let ``interfereQuorum folds in ORDINAL source order, so arrival order cannot make two nodes disagree`` () =
    let a = QuorumAlgebra.single "alice" [ 0, r 1.0 ]
    let b = QuorumAlgebra.single "bob" [ 0, r 1e16 ]
    let c = QuorumAlgebra.single "carol" [ 0, r -1e16 ]
    // three nodes, three different arrival orders, one identical fold
    let n1 = QuorumAlgebra.joinAll [ a; b; c ]
    let n2 = QuorumAlgebra.joinAll [ c; a; b ]
    let n3 = QuorumAlgebra.joinAll [ b; c; a ]
    let f1 = QuorumAlgebra.interfereQuorum n1
    Assert.Equal<QuorumAlgebra.Contribution<int> >(f1, QuorumAlgebra.interfereQuorum n2)
    Assert.Equal<QuorumAlgebra.Contribution<int> >(f1, QuorumAlgebra.interfereQuorum n3)

[<Fact>]
let ``raw interfere is NOT order-independent - the same three contributions, two different answers`` () =
    // The reason interfereQuorum exists. Fold order 1.0 then 1e16 then -1e16 loses the 1.0 to
    // rounding and the EPS drop then deletes the branch; the other order keeps it.
    let x: QuorumAlgebra.Contribution<int> = [ 0, r 1.0 ]
    let y: QuorumAlgebra.Contribution<int> = [ 0, r 1e16; 0, r -1e16 ]
    let xy = QuorumAlgebra.interfereAll [ x; y ]
    let yx = QuorumAlgebra.interfereAll [ y; x ]
    Assert.Empty(xy)
    Assert.Equal(1.0, (ampAt 0 yx).Value.Real, 12)

[<Fact>]
let ``interferenceExcess reports the NEUTRAL FACT - destructive is negative, at a magnitude`` () =
    let a = QuorumAlgebra.single "alice" [ 0, ph 0.0 ]
    let b = QuorumAlgebra.single "bob" [ 0, ph System.Math.PI ]
    let reading = QuorumAlgebra.interferenceExcess (QuorumAlgebra.join a b)
    Assert.Equal(2.0, reading.Incoherent, 9) // a Bayesian fold would see 2 units of evidence
    Assert.Equal(0.0, reading.Coherent, 9) // the amplitude fold sees a quorum that cancelled
    Assert.Equal(-2.0, reading.Excess, 9) // the magnitude of the destructive interference
    Assert.Equal(2, reading.SourceCount)
    Assert.Equal(0, reading.ConflictedCount)

[<Fact>]
let ``interferenceExcess is positive for constructive and zero when contributions do not interfere`` () =
    let same =
        QuorumAlgebra.join
            (QuorumAlgebra.single "alice" [ 0, ph 0.0 ])
            (QuorumAlgebra.single "bob" [ 0, ph 0.0 ])
    Assert.Equal(2.0, (QuorumAlgebra.interferenceExcess same).Excess, 9)

    let disjoint =
        QuorumAlgebra.join
            (QuorumAlgebra.single "alice" [ 0, ph 0.0 ])
            (QuorumAlgebra.single "bob" [ 1, ph 0.0 ])
    Assert.Equal(0.0, (QuorumAlgebra.interferenceExcess disjoint).Excess, 9)

[<Fact>]
let ``the two algebras give different answers on the SAME redundant input - which is the whole point`` () =
    // Six agents relaying ONE source. Join says "one source". Interference says "six paths".
    let one: QuorumAlgebra.Contribution<int> = [ 0, r 1.0 ]
    let joined = List.replicate 6 (QuorumAlgebra.single "the-one-stream" one) |> QuorumAlgebra.joinAll
    Assert.Equal(1, List.length (QuorumAlgebra.sources joined))
    Assert.Equal(1.0, (ampAt 0 (QuorumAlgebra.interfereQuorum joined)).Value.Real, 12)
    // the un-joined interference fold is bug B3 in miniature: six times the amplitude, 36x intensity
    let summed = QuorumAlgebra.interfereAll (List.replicate 6 one)
    Assert.Equal(6.0, (ampAt 0 summed).Value.Real, 12)

// =============================================================================================
// D. THE CYCLOTOMIC EXIT - the same fold over Z[zeta_4] = Z[i] is EXACTLY associative.
//    This is the constructive half of the finding, and it is the same restriction Soraya's
//    QuorumPhaseCancellation.tla had to make to be checkable at all.
// =============================================================================================

/// An element of Z[zeta_4] = Z[i]: exact, no rounding, and exact zero needs no epsilon.
type private Gauss = { Re: bigint; Im: bigint }

let private gzero: Gauss = { Re = 0I; Im = 0I }
let private gadd (a: Gauss) (b: Gauss) : Gauss = { Re = a.Re + b.Re; Im = a.Im + b.Im }
let private g (re: int) (im: int) : Gauss = { Re = bigint re; Im = bigint im }

/// The identical fold - group by outcome, sum, drop what cancelled - over the exact ring.
let private gmerge (l: (int * Gauss) list) =
    l
    |> List.groupBy fst
    |> List.choose (fun (k, grp) ->
        let s = grp |> List.fold (fun acc (_, z) -> gadd acc z) gzero
        if s = gzero then None else Some(k, s))
    |> List.sortBy fst

let private gcombine a b = gmerge (a @ b)

[<Fact>]
let ``over Z[i] the SAME fold is exactly associative, commutative, and unital`` () =
    let a = [ 0, g 3 0 ]
    let b = [ 0, g -5 0 ]
    let c = [ 0, g 2 0; 1, g 0 1 ]
    Assert.Equal<(int * Gauss) list>(gcombine (gcombine a b) c, gcombine a (gcombine b c))
    Assert.Equal<(int * Gauss) list>(gcombine a b, gcombine b a)
    Assert.Equal<(int * Gauss) list>(gmerge a, gcombine a [])

[<Fact>]
let ``over Z[i] cancellation is still the instrument - exact zero drops, and a plus a is still 2a`` () =
    let a = [ 0, g 3 0 ]
    let neg = [ 0, g -3 0 ]
    Assert.Empty(gcombine a neg)
    Assert.Equal<(int * Gauss) list>([ 0, g 6 0 ], gcombine a a)

[<Fact>]
let ``over Z[i] the float witness that broke associativity has no analogue - no near-zero exists`` () =
    // The float failure needed a residual BELOW an absolute threshold. In an exact ring the only
    // thing that gets dropped is an exact zero, and dropping an additive identity cannot change a
    // later sum. That is the entire argument for the cyclotomic carrier, in one test.
    let a = [ 0, g 1000000 0 ]
    let b = [ 0, g -999999 0 ]
    let c = [ 0, g 1 0 ]
    Assert.Equal<(int * Gauss) list>(gcombine (gcombine a b) c, gcombine a (gcombine b c))
    Assert.Equal<(int * Gauss) list>([ 0, g 2 0 ], gcombine (gcombine a b) c)
