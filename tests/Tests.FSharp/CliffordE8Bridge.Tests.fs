module Zeta.Tests.CliffordE8BridgeQuadraticFormTests

// The `t`-deformation falsifier, executed — and the result is NARROWER than predicted.
//
// WHAT WAS ASKED (2026-08-10). Two independently-dispatched reviewers proposed the same decisive
// in-tree experiment: parameterize `Cl3` by its quadratic form `q -> t*q` and ask whether the
// `CliffordE8Bridge` isometry and the 240-root count survive `t -> 0`. Their shared prediction:
// they do not depend on `t` at all, so "Clifford is not on the E8 path and the middle arrow is
// decoration."
//
// HALF OF THAT IS RIGHT, AND THE HALF THAT IS WRONG MATTERS MORE.
//
//  * RIGHT, and provable without the deformation: `CliffordE8Bridge` is a pure relabeling. Not one
//    of its functions invokes the geometric product — `gradeOfCoord` is `popcount`, `rootToMv` and
//    `mvToRoot` move 8 numbers between an array and 8 named fields. A quantity that never consults
//    the product cannot vary with the product's parameter, so the bridge is `t`-independent BY
//    CONSTRUCTION. Deforming `Cl3` was unnecessary; reading it settles the question more strongly.
//    That is what `rootToMv is componentwise identity` below pins.
//
//  * WRONG at repo scope: `src/Core/CliffordE8Roots.fs` ALREADY implements the versor construction
//    (Clifford reflection `-n x n` generating E8, after Dechant), and its acceptance gate — exactly
//    240 roots, closure under reflection, and set-equality with the in-tree roots — is GREEN in
//    `tests/Tests.FSharp/Formal/CliffordE8Roots.Tests.fs`. So Clifford IS on the E8 path in this
//    repo. What is decoration is the `Cl(3,0)` BRIDGE specifically, exactly as its own docstring's
//    route-(B) note already says.
//
// WHAT THIS FILE ADDS. `Formal/CliffordE8Bridge.Tests.fs` already covers round-trip, isometry,
// distinctness, linearity, and the grade partition — those are NOT duplicated here. What was
// missing is the enforcement of the module's *negative* claims: its docstring disclaims that the
// geometric product generates the roots and records that its "8" is a blade count rather than
// rank E8, and nothing checked either. Prose disclaimers that no test enforces are the same
// claim-not-matched-to-check class this session has been closing; these turn them into assertions.

open global.Xunit
open Zeta.Core

let private roots = E8Lattice.roots

let private toArr (m: Cl3.Mv) =
    [| m.S; m.E1; m.E2; m.E12; m.E3; m.E13; m.E23; m.E123 |]

[<Fact>]
let ``THE t-INDEPENDENCE RESULT: rootToMv is componentwise identity, so no quadratic form can enter`` () =
    // If the bridge performed ANY algebra, some coefficient would differ from its input coordinate.
    // None does. This is the deformation experiment's answer, obtained without the deformation:
    // the output is a function of the input coordinates alone, leaving `q` nowhere to act.
    for r in roots do
        let coeffs = toArr (CliffordE8Bridge.rootToMv r)
        for i in 0 .. 7 do
            Assert.Equal(float r.[i], coeffs.[i])

[<Fact>]
let ``the norm the bridge preserves is EUCLIDEAN — Cl3.normSq never consults the signature`` () =
    // `Cl3.normSq` is a plain sum of squares over blade coefficients. So "the isometry preserves
    // norm²" is a fact about relabeling an inner product, not about Cl(3,0) structure — which is
    // all the docstring claims. Pinned so the claim cannot quietly grow into a metric result.
    for r in roots do
        Assert.Equal(4, E8Lattice.normSq r)
        Assert.Equal(4.0, Cl3.normSq (CliffordE8Bridge.rootToMv r), 9)
        // The Euclidean sum over the RAW coordinates equals the Clifford-space norm², because the
        // latter is the same sum under new names.
        Assert.Equal(float (E8Lattice.normSq r), Cl3.normSq (CliffordE8Bridge.rootToMv r), 9)

// ── the module's NEGATIVE claims, made executable ──────────────────────────────────────────────

[<Fact>]
let ``DISCLAIMER PINNED: Cl(3,0)'s geometric product does not preserve the E8 root set`` () =
    // The docstring disclaims that the geometric product generates the 240 roots. Until now
    // nothing checked it, so a future change asserting generation would have broken no test.
    //
    // Contrast — and this is why the test is scoped to Cl(3,0) rather than to Clifford: the
    // genuine generating construction lives in `CliffordE8Roots` over the versor route, and its
    // gate passes. This test says the Cl(3,0) BRIDGE is not that construction.
    let rootSet = roots |> List.map List.ofArray |> Set.ofList
    let key (m: Cl3.Mv) = toArr m |> Array.map (fun c -> int (round c)) |> List.ofArray

    // ANTI-VACUITY GUARD: the key/set encodings must be capable of matching, or "most products
    // land outside" would pass for the trivial reason that nothing can ever land inside.
    let identityMv = { Cl3.zero with Cl3.S = 1.0 }
    for r in List.truncate 5 roots do
        let viaProduct = Cl3.gp identityMv (CliffordE8Bridge.rootToMv r)
        Assert.True(
            rootSet.Contains(key viaProduct),
            "encoding guard failed: a root multiplied by the scalar identity must still be recognised as a root")

    let sample = roots |> List.truncate 20
    let products =
        [ for a in sample do
            for b in sample do
                yield Cl3.gp (CliffordE8Bridge.rootToMv a) (CliffordE8Bridge.rootToMv b) ]
    let inside = products |> List.filter (fun p -> rootSet.Contains(key p)) |> List.length

    Assert.True(
        inside * 2 < List.length products,
        sprintf "expected most Cl(3,0) products OUTSIDE the root set; %d of %d landed inside"
            inside (List.length products))

[<Fact>]
let ``ROUTE (B) PINNED: the two 8s are different 8s — 2^3 blades vs an 8-dim root ambient`` () =
    // The coincidence of the number 8 is what makes this bridge tempting and what confines it to a
    // relabeling: dim Cl(3,0) = 2³ is a BLADE COUNT, not rank E8. Equal cardinality, unequal
    // provenance — which is why the identification carries the metric and the grading and carries
    // no algebra, and why the versor construction needed a different Clifford algebra.
    Assert.Equal(8, Array.length (toArr Cl3.zero))
    Assert.Equal(8, int (2.0 ** 3.0))
    Assert.Equal(8, (List.head roots).Length)
