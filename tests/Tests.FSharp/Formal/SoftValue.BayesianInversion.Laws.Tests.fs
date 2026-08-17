module Zeta.Tests.Formal.SoftValueBayesianInversionLaws

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module SV = Zeta.Core.SoftValue

// ═══════════════════════════════════════════════════════════════════
// SoftValue.observe vs BAYESIAN INVERSION — does the §A #7 "proven leg"
// actually sit where the Markov-category literature says it should?
//
// This pack is a FALSIFIER, not a decoration. It answers four questions
// that the existing five SoftValue test files do not ask:
//
//   (BI) Is `observe` a Bayesian inversion in the Cho–Jacobs / Fritz sense?
//        Answer: YES, POINTWISE — and constructively so. Proven here against
//        a reference inverse computed straight from the DEFINING EQUATION
//        (the joint factors both ways), never from `observe` itself.
//
//   (UN) Is the `None` honest? YES, and sharply: `observe` returns `None`
//        exactly on the outcomes where the Bayesian inverse is NOT DETERMINED
//        by its defining equation. The negative control exhibits two distinct
//        distributions that BOTH satisfy the equation there — so any value
//        returned would be fabricated. The calibration guard lands exactly on
//        the literature's own indeterminacy.
//
//   (MC) Is `observe` a morphism of a MARKOV category? NO — and this is the
//        finding. A Markov category (Fritz 2020, Def. 2.1) is a *semicartesian*
//        symmetric monoidal category: its monoidal unit is TERMINAL, which
//        forces every morphism to be total/normalized. `observe` is partial by
//        construction (`SoftValue option`). So SoftValue's honesty guard is
//        precisely the axiom a Markov category does not have — it lives one
//        stratum down, in the CD / copy-discard layer (Cho–Jacobs 2019), which
//        is exactly where the in-repo hexagon table already puts the non-
//        normalized corners. The refusal is not a defect; it is a placement.
//
//   (IND) THE PEEL on the frozen-core row's wording. §A #7 reads "observe
//        commutes for INDEPENDENT evidence". Measured here: commutation is
//        UNCONDITIONAL — it holds for likelihoods that are explicitly NOT
//        conditionally independent, because the operation is pointwise
//        multiplication of reals and nothing else. What "independent" actually
//        buys is CORRECTNESS of the two-step result, not commutation; and
//        nothing in the type or the code checks it. IND-2 exhibits a joint
//        channel under which the commuting answer is the WRONG posterior.
//
// Anchors (Beacon) — and the honest reading depth, because an anchor must be
// CHECKED not cited (.claude/rules/anchor-to-human-prior-art.md):
//   • Tobias Fritz (2020), "A synthetic approach to Markov kernels, conditional
//     independence and theorems on sufficient statistics", Adv. Math. — OPENED:
//     abstract + Definition 2.1 (symmetric monoidal + commutative comonoid
//     copy/discard on every object) and the terminal-unit remark, via the
//     arXiv/ar5iv HTML. NOT opened: the full 98pp, in particular Fritz's own
//     Bayesian-inverse equation and his a.s.-uniqueness statement.
//   • Cho & Jacobs (2019), "Disintegration and Bayesian inversion via string
//     diagrams", MSCS — OPENED: abstract only. It is the source for the
//     defining property used below ("produce channels, as conditional
//     probabilities, from a joint state, or from an already given channel").
//     The equation as coded here is the standard finite-discrete form, derived
//     locally, not transcribed from the paper.
//   • nLab, "Markov category" — OPENED: gives the definition as a
//     SEMICARTESIAN symmetric monoidal category supplying cocommutative
//     comonoids. Semicartesian = unit terminal; that is the axiom MC-1 fails.
//   • Bayes (1763) / Laplace (1774) — the inversion itself.
//   • Giry (1982); Moggi (1991) — the distribution monad SoftValue implements
//     (already proven in SoftValueMonad.Tests.fs; not re-proven here).
//
// Sibling in-tree: tests/Tests.FSharp/Formal/WSet.Comonoid.Laws.Tests.fs proves
// the comonoid laws + the Fox discriminator over the ℤ corner. The NORMALIZED
// ℝ≥0 (Markov) corner was left uninstantiated there. This pack does not close
// that gap either — it measures where SoftValue stands relative to it.
// ═══════════════════════════════════════════════════════════════════

let private approx (a: float) (b: float) = abs (a - b) < 1e-9

let private cand (i: int) = DynamicValue.Int(int64 i)

/// Compare two SoftValues AS DISTRIBUTIONS (order-insensitive — `Candidates` is
/// a list, so structural equality would be an artefact of insertion order).
let private sameDist (a: SV.SoftValue) (b: SV.SoftValue) : bool =
    let ca = SV.candidates a
    let cb = SV.candidates b
    List.length ca = List.length cb
    && ca
       |> List.forall (fun (d, p) ->
           match cb |> List.tryFind (fun (d2, _) -> d2 = d) with
           | Some(_, p2) -> approx p p2
           | None -> false)

// ── the finite setting: X = 3 candidates, Y = 3 outcomes ──
// A CHANNEL f : X → DY is a row-stochastic matrix `f.[x].[y]`.
// A PRIOR p is a distribution on X.

let private nX = 3
let private nY = 3

/// Normalize a nonneg row; a wholly-zero row becomes uniform (so the matrix is
/// always genuinely row-stochastic — a channel, not a sub-channel).
let private normRow (row: float list) : float list =
    let s = List.sum row
    if s <= 0.0 then row |> List.map (fun _ -> 1.0 / float nY)
    else row |> List.map (fun v -> v / s)

/// The REFERENCE Bayesian inverse, computed from the DEFINING EQUATION only:
///   joint(x,y) = p(x)·f(y|x);   q(y) = Σ_x joint(x,y);
///   f†_p(x|y) = joint(x,y) / q(y)      (undefined where q(y) = 0)
/// Deliberately written without touching `SoftValue`, so it is an independent
/// oracle rather than a restatement of the code under test.
let private referenceInverseAt (prior: float list) (chan: float list list) (y: int) : (int * float) list option =
    let joint = [ for x in 0 .. nX - 1 -> prior.[x] * chan.[x].[y] ]
    let qy = List.sum joint
    if qy <= 1e-15 then None
    else Some [ for x in 0 .. nX - 1 do
                    if joint.[x] > 0.0 then yield x, joint.[x] / qy ]

/// The same situation expressed for `SoftValue`: prior as a SoftValue over
/// `cand x`, and the likelihood as the FIBRE of the channel at outcome `y`
/// (i.e. `λx. f(y|x)` — the likelihood function, which is what `observe` eats).
let private priorSoft (prior: float list) : SV.SoftValue =
    (SV.ofWeighted [ for x in 0 .. nX - 1 -> cand x, prior.[x] ]).Value

let private fibreAt (chan: float list list) (y: int) : DynamicValue -> float =
    fun d ->
        match d with
        | DynamicValue.Int n when n >= 0L && n < int64 nX -> chan.[int n].[y]
        | _ -> 0.0

// ── generator: a strictly-positive prior and an arbitrary row-stochastic
//    channel. Channel entries are drawn 0..4 so ZERO COLUMNS occur naturally —
//    that is what exercises the `None` boundary rather than avoiding it. ──

type Setup =
    { Prior: float list
      Chan: float list list }

let private genSetup: Gen<Setup> =
    gen {
        // prior strictly positive (SoftValue drops non-positive weights, and a
        // dropped candidate would change the support and make the comparison
        // an artefact of the generator rather than of the operation)
        let! p0 = Gen.choose (1, 9)
        let! p1 = Gen.choose (1, 9)
        let! p2 = Gen.choose (1, 9)
        let priorRaw = [ float p0; float p1; float p2 ]
        let ps = List.sum priorRaw
        let prior = priorRaw |> List.map (fun v -> v / ps)

        let! rows =
            Gen.listOfLength nX (Gen.listOfLength nY (Gen.choose (0, 4) |> Gen.map float))

        return { Prior = prior; Chan = rows |> List.map normRow }
    }

type SetupArb() =
    static member S() = Arb.fromGen genSetup

// ═══════════════════════════════════════════════════════════════════
// (BI) `observe` IS pointwise Bayesian inversion — the positive result
// ═══════════════════════════════════════════════════════════════════

/// BI-1. For every outcome `y`, `observe (fibre f y) p` agrees with the
/// reference inverse computed from the joint — INCLUDING agreeing on when the
/// answer exists at all. This is the whole correspondence in one property.
[<Property(Arbitrary = [| typeof<SetupArb> |])>]
let ``BI-1: observe (likelihood = channel fibre at y) = the Bayesian inverse at y, for every y``
    (s: Setup)
    =
    [ 0 .. nY - 1 ]
    |> List.forall (fun y ->
        let viaObserve = SV.observe (fibreAt s.Chan y) (priorSoft s.Prior)
        let viaJoint = referenceInverseAt s.Prior s.Chan y

        match viaObserve, viaJoint with
        | None, None -> true
        | Some sv, Some rows ->
            let expected =
                (SV.ofWeighted [ for x, w in rows -> cand x, w ]).Value
            sameDist sv expected
        | _ -> false)

/// BI-2. The DEFINING EQUATION itself, checked directly on `observe`'s own
/// output: for the returned posterior r and the Y-marginal q,
///     q(y) · r(x)  =  p(x) · f(y|x)      for every x.
/// This is the Cho–Jacobs condition ("the joint factors both ways") rather
/// than a formula comparison, so it cannot be satisfied by coincidence of
/// normalisation.
[<Property(Arbitrary = [| typeof<SetupArb> |])>]
let ``BI-2: observe's output satisfies the joint-factorisation equation q(y)·r(x) = p(x)·f(y|x)``
    (s: Setup)
    =
    [ 0 .. nY - 1 ]
    |> List.forall (fun y ->
        let qy = [ for x in 0 .. nX - 1 -> s.Prior.[x] * s.Chan.[x].[y] ] |> List.sum

        match SV.observe (fibreAt s.Chan y) (priorSoft s.Prior) with
        | None -> qy <= 1e-15 // refused exactly when there is no mass to factor
        | Some r ->
            [ 0 .. nX - 1 ]
            |> List.forall (fun x ->
                let rx = SV.weightOf (cand x) r
                approx (qy * rx) (s.Prior.[x] * s.Chan.[x].[y])))

/// BI-3. `observe` is not MORE general than Bayesian inversion, which is the
/// half that is easy to assume and worth checking. Its argument type admits any
/// nonnegative function, but every such function on a finite support IS the
/// fibre of an explicitly constructible binary channel
///     g(y₀|x) = ℓ(x)/M,   g(y₁|x) = 1 − ℓ(x)/M,   M = max ℓ
/// and `observe` is scale-invariant, so observing ℓ = observing that channel's
/// fibre. Hence the correspondence is exact in both directions: no admissible
/// likelihood escapes it.
[<Property(Arbitrary = [| typeof<SetupArb> |])>]
let ``BI-3: an arbitrary nonneg likelihood is the fibre of a constructed binary channel (scale-invariance)``
    (s: Setup)
    (k: PositiveInt)
    =
    // an arbitrary likelihood, taken from the generator so it is not hand-picked
    let ell = fibreAt s.Chan 0
    let m = [ 0 .. nX - 1 ] |> List.map (fun x -> ell (cand x)) |> List.max

    if m <= 0.0 then
        // ℓ ≡ 0: no channel makes this outcome reachable, and observe refuses.
        (SV.observe ell (priorSoft s.Prior)).IsNone
    else
        let scale = float k.Get // any positive rescaling
        let rescaled (d: DynamicValue) = ell d * scale / m

        match SV.observe ell (priorSoft s.Prior), SV.observe rescaled (priorSoft s.Prior) with
        | Some a, Some b -> sameDist a b
        | None, None -> true
        | _ -> false

// ═══════════════════════════════════════════════════════════════════
// (UN) the `None` is exactly the literature's indeterminacy
// ═══════════════════════════════════════════════════════════════════

/// UN-1. Where the outcome has zero marginal, the defining equation degenerates
/// to 0 = 0 and constrains NOTHING — so the Bayesian inverse is not determined
/// there. Exhibited: two distinct distributions both satisfy it. `observe`
/// returning `None` is therefore the only non-fabricating answer, and this test
/// is what makes that claim measurable rather than rhetorical.
[<Fact>]
let ``UN-1: at a zero-marginal outcome the defining equation admits MANY inverses — observe refuses`` () =
    // channel where outcome y = 1 is unreachable from every candidate
    let chan =
        [ [ 1.0; 0.0; 0.0 ]
          [ 1.0; 0.0; 0.0 ]
          [ 1.0; 0.0; 0.0 ] ]

    let prior = [ 1.0 / 3.0; 1.0 / 3.0; 1.0 / 3.0 ]
    let qy = [ for x in 0 .. nX - 1 -> prior.[x] * chan.[x].[1] ] |> List.sum
    Assert.True(approx qy 0.0)

    // TWO different candidate inverses, both satisfying q(1)·r(x) = p(x)·f(1|x)
    // because both sides are identically zero. Neither is more correct.
    let r1 = [ 1.0; 0.0; 0.0 ]
    let r2 = [ 0.0; 0.0; 1.0 ]

    let satisfies (r: float list) =
        [ 0 .. nX - 1 ]
        |> List.forall (fun x -> approx (qy * r.[x]) (prior.[x] * chan.[x].[1]))

    Assert.True(satisfies r1)
    Assert.True(satisfies r2)
    Assert.NotEqual<float list>(r1, r2)

    // and observe declines to pick one
    Assert.True((SV.observe (fibreAt chan 1) (priorSoft prior)).IsNone)

// ═══════════════════════════════════════════════════════════════════
// (MC) `observe` is NOT a morphism of a Markov category — the placement
// ═══════════════════════════════════════════════════════════════════

/// MC-1. A Markov category is SEMICARTESIAN: the monoidal unit is terminal
/// (Fritz 2020 Def. 2.1 + Rem. 2.3; nLab "Markov category"). Terminality forces
/// every morphism to be total — there is no sub-normalized or absent state to
/// land in. `observe` has such a state and reaches it, so it is not a morphism
/// of any Markov category over these objects; it belongs to the CD / copy-
/// discard stratum, where discard is not natural and partiality is admissible.
///
/// The negative control matters: without it "SoftValue is a Markov category"
/// would be a sentence nothing could refute. This is the refutation.
[<Fact>]
let ``MC-1: observe is PARTIAL, so it is not a morphism of a (semicartesian) Markov category`` () =
    let p = priorSoft [ 0.5; 0.3; 0.2 ]

    // A total morphism into a Markov category cannot produce "no state".
    // `observe` does, whenever the evidence refutes the whole support.
    Assert.True((SV.observe (fun _ -> 0.0) p).IsNone)

    // And it is reachable from a perfectly ordinary CHANNEL, not only from a
    // degenerate hand-written likelihood — so the partiality is intrinsic to
    // the construction, not an artefact of admitting arbitrary functions.
    let chan =
        [ [ 1.0; 0.0 ]
          [ 1.0; 0.0 ]
          [ 1.0; 0.0 ] ]

    Assert.True((SV.observe (fibreAt chan 1) p).IsNone)

    // The contrast that makes the point sharp: `bind` (the Kleisli/channel
    // composition, the part that IS Markov-shaped) is TOTAL — it returns a
    // SoftValue, never an option. Two operations, two strata, one module.
    let viaBind = SV.bind (fun _ -> SV.certain (cand 9)) p
    Assert.True(approx (SV.confidence viaBind) 1.0)

// ═══════════════════════════════════════════════════════════════════
// (IND) THE PEEL — what "for independent evidence" does and does not buy
// ═══════════════════════════════════════════════════════════════════

/// IND-1. Commutation is UNCONDITIONAL. The existing headline property
/// (`SoftValue.Tests.fs`) fixes two likelihoods that happen to be independent
/// and varies only the prior, which cannot distinguish "commutes because
/// independent" from "commutes always". Here the two likelihoods are drawn from
/// a joint channel over (Y,Z) that is explicitly NOT a product given X — they
/// are dependent — and `observe` commutes anyway, because the operation is
/// pointwise multiplication of reals and multiplication is commutative.
///
/// So the frozen-core row's qualifier is not describing the commutation.
[<Fact>]
let ``IND-1: observe commutes for DEPENDENT likelihoods too — commutation never needed independence`` () =
    let p = priorSoft [ 0.5; 0.3; 0.2 ]

    // Two likelihood functions with no independence relation whatsoever;
    // l2 is deliberately built as a function of l1's own shape.
    let l1 (d: DynamicValue) =
        match d with
        | DynamicValue.Int 0L -> 0.9
        | DynamicValue.Int 1L -> 0.2
        | _ -> 0.5

    let l2 (d: DynamicValue) = 1.0 - 0.5 * l1 d // manifestly dependent on l1

    let ab = SV.observe l1 p |> Option.bind (SV.observe l2)
    let ba = SV.observe l2 p |> Option.bind (SV.observe l1)

    match ab, ba with
    | Some a, Some b -> Assert.True(sameDist a b, "observe commuted even for dependent likelihoods")
    | _ -> Assert.Fail "both orders should produce a posterior"

/// IND-2. What independence DOES buy: correctness. Here is a joint channel
/// P(y,z | x) that is not a product given x. Folding the two MARGINAL
/// likelihoods — which is the only thing `observe`'s type lets a caller pass
/// without extra care — gives an answer that differs from the true posterior
/// P(x | y₀,z₀). The fold still commutes (IND-1); it is simply wrong.
///
/// Nothing in the type, the code, or the existing tests can detect this. That
/// is the honest content of the §A #7 qualifier: it is a PRECONDITION ON THE
/// CALLER, not a property the module establishes.
[<Fact>]
let ``IND-2: under dependence the commuting two-step fold is NOT the true posterior`` () =
    // X = {0,1,2}; observations Y,Z each binary. Joint P(y,z|x), rows sum to 1.
    // Strongly dependent: given x, Y and Z are near-perfectly correlated.
    //                          (0,0) (0,1) (1,0) (1,1)
    let joint =
        [ [ 0.45; 0.05; 0.05; 0.45 ] // x = 0
          [ 0.10; 0.40; 0.40; 0.10 ] // x = 1
          [ 0.25; 0.25; 0.25; 0.25 ] ] // x = 2  (independent row, as a control)

    let prior = [ 1.0 / 3.0; 1.0 / 3.0; 1.0 / 3.0 ]

    // marginals: P(y=0|x) = j[0]+j[1] ; P(z=0|x) = j[0]+j[2]
    let pY0 x = joint.[x].[0] + joint.[x].[1]
    let pZ0 x = joint.[x].[0] + joint.[x].[2]
    // the true joint likelihood of observing (y=0, z=0)
    let pY0Z0 x = joint.[x].[0]

    // the true posterior, from the joint
    let trueUn = [ for x in 0 .. nX - 1 -> prior.[x] * pY0Z0 x ]
    let trueTot = List.sum trueUn
    let truePost = trueUn |> List.map (fun v -> v / trueTot)

    // what SoftValue gives when handed the two marginal likelihoods
    let folded =
        SV.observe (fun d -> match d with DynamicValue.Int n -> pY0 (int n) | _ -> 0.0) (priorSoft prior)
        |> Option.bind (SV.observe (fun d -> match d with DynamicValue.Int n -> pZ0 (int n) | _ -> 0.0))
        |> Option.get

    let foldedAsList = [ for x in 0 .. nX - 1 -> SV.weightOf (cand x) folded ]

    // they differ — and by a wide margin, not a rounding artefact
    Assert.False(
        List.forall2 approx truePost foldedAsList,
        "under dependence the marginal-likelihood fold must not coincide with the true posterior")

    let maxGap =
        List.map2 (fun a b -> abs (a - b)) truePost foldedAsList |> List.max

    Assert.True(maxGap > 0.05, $"gap between true posterior and folded answer was only {maxGap}")

    // and the sanity half: supplying the TRUE joint likelihood as a single
    // observe recovers the true posterior exactly. `observe` is not broken —
    // the caller's independence assumption is what fails.
    let correct =
        SV.observe (fun d -> match d with DynamicValue.Int n -> pY0Z0 (int n) | _ -> 0.0) (priorSoft prior)
        |> Option.get

    Assert.True(
        List.forall2 approx truePost [ for x in 0 .. nX - 1 -> SV.weightOf (cand x) correct ],
        "one observe with the true joint likelihood reproduces the true posterior")
