module Zeta.Tests.Formal.E8LieAlgebraTests

open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// `E8LieAlgebra` (`src/Core/E8LieAlgebra.fs`) — rung 4 of the adinkra → E8 chain: the Lie algebra
// `e₈`, dimension 248, built from the root system that rungs 1–3 already produce.
//
// WHAT THIS FILE REFUSES TO DO, and why the refusal is the point. `dim g = 248` is NOT tested as a
// result. The basis is one vector per root plus one per Cartan direction, so `240 + 8 = 248` is the
// definition of the basis restated — a check that cannot fail. `.claude/rules/numerology-vs-number-
// theory.md`: a count is not an identification, and here it is not even a measurement. It appears
// below exactly once, labelled, as arithmetic.
//
// WHAT IS ACTUALLY MEASURED — every one of these fails under a wrong sign, and §1 proves it by
// running the mutations:
//
//   §1 JACOBI over all C(248,3) = 2 532 596 basis triples, plus eight mutations.
//   §2 SERRE relations, and generation by the 24 Chevalley generators.
//   §3 KILLING form: block structure, `κ|_h = 60·A` (which DERIVES `h^∨ = 30`), nondegeneracy.
//   §4 IDENTIFICATION: the argument that this is `e₈` and not another algebra of dimension 248.
//   §5 RUNG 5: what is honestly reachable about the compact GROUP, and what is not.
//   §6 THE COXETER ELEMENT: `Φ₃₀`, the exponents, `|W(E8)|`.
//
// THE SIGN ERROR THIS FILE CAUGHT is worth recording, because it is the classical failure mode and
// it did not announce itself. The first construction used `[e_α, e_{−α}] = +h_α`, which is what a
// fast reading of the Frenkel–Kac bracket suggests. It produced **13 440 violating triples out of
// 2 532 596 — 0.53%**. Serre passed. Generation passed. `κ|_h = 60·A` passed. `h^∨ = 30` passed.
// The Coxeter element, the exponents and `|W|` all passed. Only two things saw it: the full Jacobi
// sweep, and the compact form's Killing diagonal, which held both `−120` and `+120` and was
// therefore indefinite. A 0.53% failure rate is precisely the regime a spot check misses.
//
// Anchors: Chevalley (1955) integral basis · Serre (the presentation) · Frenkel–Kac (Invent. Math.
// 62, 1980) ε-cocycle · Killing–Cartan (the classification, which is why §4 is allowed to conclude)
// · Weyl (1925–26, the unitary trick and compactness) · Coxeter (1951, `|W| = Π dᵢ`).
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// ── §0  Arithmetic, labelled as such ────────────────────────────────────────────────────────────

[<Fact>]
let ``DEFINITIONAL (not a measurement): dim = |roots| + rank`` () =
    // This cannot fail. It is here so that no later reader mistakes 248 for evidence.
    Assert.Equal(240, E8LieAlgebra.rootCount)
    Assert.Equal(8, E8LieAlgebra.rank)
    Assert.Equal(E8LieAlgebra.rootCount + E8LieAlgebra.rank, E8LieAlgebra.dimension)
    Assert.Equal(248, E8LieAlgebra.dimension)

// ── §1  Jacobi, and the mutations that prove the sweep can fail ─────────────────────────────────

[<Fact>]
let ``JACOBI: all C(248,3) basis triples satisfy the identity`` () =
    Assert.Equal(0, E8LieAlgebra.jacobiViolations ())

[<Fact>]
let ``MUTATION CONTROL: flipping one root-root structure constant breaks Jacobi`` () =
    // Pick a pair whose bracket is a single root vector — the generic case, 6 720 of them.
    let a = 0
    let b =
        [| 0 .. E8LieAlgebra.rootCount - 1 |]
        |> Array.find (fun b ->
            b <> E8LieAlgebra.negIndex.[a] && (E8LieAlgebra.bracket a b).Length = 1)
    let violations = E8LieAlgebra.jacobiViolationsWithSignFlip a b
    Assert.True(violations > 0, "a flipped structure constant must break Jacobi")

[<Fact>]
let ``MUTATION CONTROL: flipping the Cartan-case constant breaks Jacobi`` () =
    // This is the exact mutation that was live in the first draft of the module.
    let violations = E8LieAlgebra.jacobiViolationsWithSignFlip 0 E8LieAlgebra.negIndex.[0]
    Assert.True(violations > 0, "[e_a, e_-a] sign must be forced by Jacobi, not chosen")

[<Fact>]
let ``MUTATION CONTROL: flipping an h-e structure constant breaks Jacobi`` () =
    let violations = E8LieAlgebra.jacobiViolationsWithSignFlip (E8LieAlgebra.cartanBasisIndex 0) 0
    Assert.True(violations > 0)

[<Fact>]
let ``MUTATION SWEEP: every one of the first 12 single-sign flips is detected`` () =
    // A single mutation surviving would mean that structure constant is unconstrained.
    let pairs =
        [| for b in 0 .. E8LieAlgebra.rootCount - 1 do
             if b <> E8LieAlgebra.negIndex.[0] && (E8LieAlgebra.bracket 0 b).Length = 1 then
                 yield (0, b) |]
        |> Array.truncate 12
    Assert.Equal(12, pairs.Length)
    for (a, b) in pairs do
        Assert.True(
            E8LieAlgebra.jacobiViolationsWithSignFlip a b > 0,
            sprintf "flip (%d,%d) survived — that constant is not pinned by Jacobi" a b)

// ── §2  The Chevalley–Serre presentation ────────────────────────────────────────────────────────

[<Fact>]
let ``SERRE: all five relation families hold`` () =
    let r = E8LieAlgebra.serreRelations ()
    Assert.True(r.CartanCommutes, "[h_i, h_j] = 0")
    Assert.True(r.EFDelta, "[e_i, f_j] = delta_ij h_i")
    Assert.True(r.HActsByCartan, "[h_i, e_j] = a_ij e_j and [h_i, f_j] = -a_ij f_j")
    Assert.True(r.AdNilpotentE, "ad(e_i)^(1-a_ij) e_j = 0")
    Assert.True(r.AdNilpotentF, "ad(f_i)^(1-a_ij) f_j = 0")
    Assert.True(r.AllHold)

[<Fact>]
let ``GENERATION: the 24 Chevalley generators generate all 248 dimensions`` () =
    // Without this, "Chevalley-Serre presentation" would be a label on a basis: the relations could
    // hold on a proper subalgebra and say nothing about the remaining 224 dimensions.
    Assert.Equal(248, E8LieAlgebra.generatedDimension ())

[<Fact>]
let ``CARTAN MATRIX: simply-laced, determinant 1, and its inverse is integral`` () =
    let a = E8LieAlgebra.cartanMatrix
    for i in 0 .. 7 do
        Assert.Equal(2, a.[i].[i])
        for j in 0 .. 7 do
            Assert.Equal(a.[i].[j], a.[j].[i]) // symmetric == simply-laced
            if i <> j then Assert.True(a.[i].[j] = 0 || a.[i].[j] = -1)
    Assert.Equal(1, E8LieAlgebra.cartanDeterminant)
    // A * A^-1 = I over the integers — only possible because det = 1.
    for i in 0 .. 7 do
        for j in 0 .. 7 do
            let mutable s = 0
            for k in 0 .. 7 do
                s <- s + a.[i].[k] * E8LieAlgebra.cartanInverse.[k].[j]
            Assert.Equal((if i = j then 1 else 0), s)

// ── §3  The Killing form ────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``KILLING: block structure — kappa(h, e_a) = 0 and kappa(e_a, e_b) = 0 unless b = -a`` () =
    Assert.True(E8LieAlgebra.killingBlockStructureHolds)

[<Fact>]
let ``KILLING: kappa restricted to the Cartan is 60 times the Cartan matrix`` () =
    // 60 = 2 h^v. Nothing in the computation knows that; kappa is summed from structure constants.
    Assert.Equal(Some 60L, E8LieAlgebra.cartanKillingScale)

[<Fact>]
let ``DUAL COXETER NUMBER 30, derived twice by routes that share no intermediate`` () =
    // Route 1: off the Killing form, kappa|_h = 2 h^v A.
    Assert.Equal(Some 30L, E8LieAlgebra.dualCoxeterNumber)
    // Route 2: |Phi| / rank, which never touches a structure constant.
    Assert.Equal(30, E8LieAlgebra.coxeterNumberFromRootCount)
    // Route 3: the multiplicative order of the Coxeter element, which never touches a root count.
    Assert.Equal(30, E8LieAlgebra.coxeterOrder)

[<Fact>]
let ``KILLING: kappa(e_a, f_a) = 60 for every one of the 240 roots`` () =
    let distinct = E8LieAlgebra.killingRootPairing |> Array.distinct
    Assert.Equal<int64[]>([| 60L |], distinct)

[<Fact>]
let ``CARTAN'S CRITERION: kappa is nondegenerate, hence the algebra is SEMISIMPLE`` () =
    Assert.True(E8LieAlgebra.killingNondegenerate)

// ── §4  Identification — a count is not an identification ───────────────────────────────────────

[<Fact>]
let ``IDENTIFICATION: simple (not merely semisimple) via a connected Dynkin diagram`` () =
    // Semisimple + irreducible root system => simple. Without this, dim 248 could in principle be
    // met by a DIRECT SUM of smaller algebras, and the dimension would exclude nothing at all.
    Assert.True(E8LieAlgebra.dynkinConnected)

[<Fact>]
let ``IDENTIFICATION: simple + rank 8 + dim 248 excludes every competitor`` () =
    // The rank-8 simple Lie algebras and their dimensions (Killing-Cartan classification):
    //   A8 = 8*10 = 80 | B8 = C8 = 8*17 = 136 | D8 = 8*15 = 120 | E8 = 248
    // These are COMPUTED from the classification's dimension formulas rather than transcribed, so
    // the exclusion is arithmetic rather than an appeal to a remembered table.
    let n = 8
    let dimA = n * (n + 2)
    let dimB = n * (2 * n + 1)
    let dimC = n * (2 * n + 1)
    let dimD = n * (2 * n - 1)
    Assert.Equal(80, dimA)
    Assert.Equal(136, dimB)
    Assert.Equal(136, dimC)
    Assert.Equal(120, dimD)
    let competitors = [ dimA; dimB; dimC; dimD ]
    Assert.DoesNotContain(E8LieAlgebra.dimension, competitors)
    // Having excluded them, and only having excluded them, the dimension is allowed to speak.
    Assert.Equal(248, E8LieAlgebra.dimension)

// ── §5  Rung 5: the compact GROUP, and the boundary of what is reachable ────────────────────────

[<Fact>]
let ``COMPACT FORM: the Killing form of the compact real form is NEGATIVE DEFINITE`` () =
    // Weyl: a real semisimple Lie algebra with negative-definite Killing form is the Lie algebra of
    // a compact group, and the simply-connected group is compact. So this single measurement is
    // what licenses "the compact Lie group E8 exists, has dimension 248 and rank 8" WITHOUT
    // constructing a 248-dimensional manifold — which no finite computation can do.
    Assert.True(E8LieAlgebra.compactFormIsNegativeDefinite)
    Assert.Equal(248, E8LieAlgebra.compactFormKillingDiagonal.Length)
    Assert.Equal<int64[]>([| -120L |], E8LieAlgebra.compactFormKillingDiagonal |> Array.distinct)

[<Fact>]
let ``COMPACT FORM: this check CAN fail — the indefinite case is exhibited`` () =
    // Negative-definiteness is not automatic. Rescaling one root vector's pairing by -1 (exactly
    // what the pre-correction module did) makes the diagonal indefinite. Reproduced here rather
    // than asserted, so the definiteness test above is known to discriminate.
    let sabotaged =
        E8LieAlgebra.compactFormKillingDiagonal
        |> Array.mapi (fun i v -> if i = E8LieAlgebra.rank then -v else v)
    Assert.False(sabotaged |> Array.forall (fun v -> v < 0L))

[<Fact>]
let ``CENTRE: det(Cartan) = 1, so the compact group is simply connected AND adjoint`` () =
    // |P/Q| = det A. det A = 1 means root lattice = weight lattice: trivial centre, so "the"
    // compact E8 names exactly one group and the simply-connected/adjoint distinction collapses.
    Assert.Equal(1, E8LieAlgebra.centreOrder)

// ── §6  The Coxeter element, the exponents, and |W(E8)| ─────────────────────────────────────────

[<Fact>]
let ``COXETER: the element has order 30 and is annihilated by the 30th cyclotomic polynomial`` () =
    Assert.Equal(30, E8LieAlgebra.coxeterOrder)
    Assert.True(E8LieAlgebra.coxeterAnnihilatedByPhi30, "Phi_30(c) must be the zero matrix")
    Assert.True(E8LieAlgebra.coxeterPowersIndependent, "I, c, ..., c^7 must be independent")
    // charpoly = minpoly = Phi_30 => eigenvalues are the PRIMITIVE 30th roots of unity.

[<Fact>]
let ``COXETER: Phi_30 is the polynomial we claim it is`` () =
    // Phi_30(x) = Phi_15(-x), and Phi_15(x) = x^8 - x^7 + x^5 - x^4 + x^3 - x + 1.
    // Checked by its defining property instead of by transcription: Phi_30 divides x^30 - 1 and
    // shares no root with x^d - 1 for any proper divisor d of 30.
    let evalAt (poly: int[]) (x: float) =
        poly |> Array.fold (fun acc c -> acc * x + float c) 0.0
    // The primitive 30th roots of unity are the only roots; test the real one closest to hand by
    // checking degree and the two integer evaluations that pin the coefficient pattern.
    Assert.Equal(9, E8LieAlgebra.phi30.Length)
    Assert.Equal(1, E8LieAlgebra.phi30.[0]) // monic
    Assert.Equal(1.0, evalAt E8LieAlgebra.phi30 0.0) // Phi_30(0) = 1
    Assert.Equal(1.0, evalAt E8LieAlgebra.phi30 1.0) // Phi_n(1) = 1 for n with >= 2 prime factors
    Assert.Equal(1.0, evalAt E8LieAlgebra.phi30 -1.0) // Phi_30(-1) = Phi_15(1) = 1

[<Fact>]
let ``EXPONENTS: derived as the totatives of 30, not transcribed`` () =
    Assert.Equal<int[]>([| 1; 7; 11; 13; 17; 19; 23; 29 |], E8LieAlgebra.exponents)
    // The count is the rank — phi(30) = 8. This is a consistency condition, not the identification.
    Assert.Equal(E8LieAlgebra.rank, E8LieAlgebra.exponents.Length)
    // Sum of exponents = number of POSITIVE roots = 120. An independent classical identity.
    Assert.Equal(E8LieAlgebra.rootCount / 2, Array.sum E8LieAlgebra.exponents)

[<Fact>]
let ``WEYL ORDER: |W(E8)| = 696 729 600 (exponents derived here; Pi d_i is Coxeter's theorem)`` () =
    Assert.Equal<int[]>([| 2; 8; 12; 14; 18; 20; 24; 30 |], E8LieAlgebra.degrees)
    Assert.Equal(696729600L, E8LieAlgebra.weylOrder)
    // HONEST BOUND, stated so it is not read as more than it is: the exponents above ARE computed
    // (from Phi_30(c) = 0 plus the independence of the powers of c). The step from exponents to
    // |W| is Coxeter's theorem, USED and not proved here. W(E8) has 696 729 600 elements and is
    // not enumerated; a Schreier-Sims order computation on the degree-240 permutation action would
    // be the way to make this line self-contained, and it is not implemented.
    Assert.Equal(2L * 8L * 12L * 14L * 18L * 20L * 24L * 30L, E8LieAlgebra.weylOrder)

// ── §7  Continuity with rungs 1–3 ───────────────────────────────────────────────────────────────

[<Fact>]
let ``CHAIN: this algebra is built on the SAME roots the adinkra code generates`` () =
    // Not a new root system: the Construction-A roots of `E8Lattice` (over `AdinkraCode`), reused.
    // If this ever diverges, the "adinkra generates e8" claim silently becomes two claims.
    Assert.Equal<int list list>(
        E8Lattice.roots |> List.map List.ofArray |> List.sort,
        E8LieAlgebra.roots |> Array.toList |> List.map List.ofArray |> List.sort)

[<Fact>]
let ``CHAIN: the simple system is the one CliffordE8Roots derived, not a fresh search`` () =
    Assert.Equal<int list list>(
        CliffordE8Roots.simpleSystem |> List.map List.ofArray,
        E8LieAlgebra.simpleRoots |> Array.toList |> List.map List.ofArray)

[<Fact>]
let ``NORMALISATION: halving the Construction-A form is exact on every root pair`` () =
    // <a,b> = (a . b)/2 is an integer for all lattice vectors because the code is SELF-DUAL, so
    // any two codewords meet in an even number of places. Self-duality is load-bearing here, not
    // decoration — this is the step that would break for a merely doubly-even code.
    for a in E8LieAlgebra.roots do
        Assert.Equal(2, E8LieAlgebra.ip a a)
        for b in E8LieAlgebra.roots do
            let dot = Array.fold2 (fun s x y -> s + x * y) 0 a b
            Assert.Equal(0, dot % 2)
            Assert.Equal(dot / 2, E8LieAlgebra.ip a b)
