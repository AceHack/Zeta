module Zeta.Tests.BraidRepYangBaxterTests

// SORAYA'S LEG-2A DECISIVE ARTIFACT (background round 2, 2026-07-04; spec verified numerically by her
// before landing — a deviation from the expected table below is a FINDING, not a test bug; shadow* landed).
//
// VERDICT (round 2, YB-1..6): every generator IMAGE the shipped ISA carries (SWAP, JOIN=CNOT, the
// BRANCH-dressed swap, strand-local Ry) is either involutive (σ² = id) or NOT a Yang–Baxter solution.
// VERDICT UPGRADED (round 3, YB-7..8): the braided monoidal structure is EARNED AS A DERIVED WORD —
// R_KL is an EXACT (machine-precision) composition over the shipped ops, needing only EMIT/RETRACT/JOIN:
//   R_KL = (Ry(π/2)⊗I) · CNOT · (I⊗Ry(−π/2)) · CNOT · (Ry(−π/2)⊗I)
// (= exp((π/4)·i(X⊗Y)); two JOINs optimal by determinant parity — det(CNOT)=−1, det(R_KL)=+1). So the
// braiding lives in the WORDS at the amplitude level too, not only at the Ihara/free-monoid level; the
// six-op VM stays minimal (Soraya round 3: the strict irreducible core is {EMIT(θ), JOIN} — even H is a
// derived word at n≥2; ⟨H,CNOT⟩ alone is the finite real Clifford group, order 2304, so EMIT is essential;
// the six ops generate the full real orthogonal fragment EXACTLY — Jurdjevic–Sussmann finite-word
// reachability — and real amplitudes lose nothing: Rudolph–Grover/Shi/Aharonov). YB-1..6 remain correct as
// stated: they test generator images; YB-7..8 test generated words. A deviation from the expected numbers
// is a FINDING (BP-16 third leg: her closed form + her numpy run + this F# run over ImaginaryStack.complex).
// Anchors: Joyal–Street (braided monoidal); Selinger (dagger-compact); Kauffman–Lomonaco, "Braiding
// operators are universal quantum gates", New J. Phys. 6 (2004) 134; Vatan–Williams PRA 69 032315 (2004);
// Brylinski–Brylinski (exact universality); Jurdjevic–Sussmann 1972; Freedman–Kitaev–Larsen–Wang.

open global.Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Core

let private c = ImaginaryStack.complex
let private re (x: float) : Complex = { Real = x; Imag = 0.0 }

type private M = Complex[][]

let private eye n : M =
    Array.init n (fun i -> Array.init n (fun j -> if i = j then c.One else c.Zero))

let private matMul (a: M) (b: M) : M =
    Array.init a.Length (fun i ->
        Array.init a.Length (fun j ->
            let mutable s = c.Zero
            for k in 0 .. a.Length - 1 do
                s <- c.Add(s, c.Mul(a.[i].[k], b.[k].[j]))
            s))

let private kron (a: M) (b: M) : M =
    let nb = b.Length
    Array.init (a.Length * nb) (fun i ->
        Array.init (a.Length * nb) (fun j -> c.Mul(a.[i / nb].[j / nb], b.[i % nb].[j % nb])))

let private maxDev (a: M) (b: M) : float =
    Seq.max (
        seq {
            for i in 0 .. a.Length - 1 do
                for j in 0 .. a.Length - 1 do
                    let d = c.Add(a.[i].[j], c.Negate b.[i].[j])
                    yield sqrt (d.Real * d.Real + d.Imag * d.Imag)
        })

let private I2 = eye 2

/// Yang–Baxter deviation on (ℂ²)⊗³ (8×8): ‖(R⊗I)(I⊗R)(R⊗I) − (I⊗R)(R⊗I)(I⊗R)‖_max
let private ybDev (r: M) : float =
    let a, b = kron r I2, kron I2 r
    maxDev (matMul (matMul a b) a) (matMul (matMul b a) b)

/// σ² = id deviation on ℂ²⊗ℂ² (4×4)
let private invDev (r: M) : float = maxDev (matMul r r) (eye 4)

let private TOL_PASS = 1e-9
let private TOL_FAIL = 0.5
let private TOL_FAIL_THETA = 1e-2

let private row (xs: float list) : Complex[] = xs |> List.map re |> List.toArray

let private SWAP : M = [| row [ 1.; 0.; 0.; 0. ]; row [ 0.; 0.; 1.; 0. ]; row [ 0.; 1.; 0.; 0. ]; row [ 0.; 0.; 0.; 1. ] |]
let private CNOT : M = [| row [ 1.; 0.; 0.; 0. ]; row [ 0.; 1.; 0.; 0. ]; row [ 0.; 0.; 0.; 1. ]; row [ 0.; 0.; 1.; 0. ] |]

let private h = 1.0 / sqrt 2.0
let private H : M = [| row [ h; h ]; row [ h; -h ] |]
let private BH : M = matMul SWAP (kron H H)

/// Kauffman–Lomonaco R — a genuine unitary Yang–Baxter solution (the positive control).
let private RKL : M =
    [| row [ h; 0.; 0.; h ]; row [ 0.; h; -h; 0. ]; row [ 0.; h; h; 0. ]; row [ -h; 0.; 0.; h ] |]

/// Ry(θ) — the real rotation form matching ZSetISA.qs EMIT.
let private ry (theta: float) : M =
    let ct, st = cos (theta / 2.0), sin (theta / 2.0)
    [| row [ ct; -st ]; row [ st; ct ] |]

[<Fact>]
let ``YB-1: SWAP satisfies Yang–Baxter AND sigma^2=id — Mat(C)'s braiding is SYMMETRIC`` () =
    Assert.True(ybDev SWAP <= TOL_PASS)
    Assert.True(invDev SWAP <= TOL_PASS)

[<Fact>]
let ``YB-2: JOIN = CNOT is involutive but FAILS Yang–Baxter — the ISA's two-strand operator is not a braiding`` () =
    Assert.True(invDev CNOT <= TOL_PASS)
    Assert.True(ybDev CNOT >= TOL_FAIL)

[<Fact>]
let ``YB-3: BRANCH-dressed swap SWAP·(H⊗H) is a YB solution but sigma^2=id — Hadamard buys no braided twist`` () =
    Assert.True(ybDev BH <= TOL_PASS)
    Assert.True(invDev BH <= TOL_PASS)

[<Fact>]
let ``YB-4: positive control — Kauffman–Lomonaco R satisfies YB with sigma^2<>id and R^8=I; proper braiding EXISTS in Mat(C), just not in the shipped ISA`` () =
    Assert.True(ybDev RKL <= TOL_PASS)
    Assert.True(invDev RKL >= TOL_FAIL)
    let r2 = matMul RKL RKL
    let r4 = matMul r2 r2
    let r8 = matMul r4 r4
    Assert.True(maxDev r8 (eye 4) <= TOL_PASS)

[<Property>]
let ``YB-5: EMIT∘RETRACT = I for every angle (the unitarity law the ISA actually has)`` (NormalFloat t) =
    let theta = abs t % (2.0 * System.Math.PI)
    maxDev (matMul (ry theta) (ry (-theta))) I2 <= TOL_PASS

[<Property>]
let ``YB-6: strand-local EMIT = Ry(theta) FAILS the braid relation for every non-degenerate angle — the braid structure lives in the WORDS`` (NormalFloat t) =
    let theta = 0.25 + (abs t % 2.65) // clamped to [0.25, 2.90], away from the degenerate U = ±I
    let s1 = kron (ry theta) I2
    let s2 = kron I2 (ry theta)
    maxDev (matMul (matMul s1 s2) s1) (matMul (matMul s2 s1) s2) >= TOL_FAIL_THETA

/// The derived braiding word (Soraya round 3): RETRACT(π/2)@1 · JOIN · RETRACT(π/2)@2 · JOIN · EMIT(π/2)@1.
let private RWORD : M =
    [ kron (ry (System.Math.PI / 2.0)) I2
      CNOT
      kron I2 (ry (-System.Math.PI / 2.0))
      CNOT
      kron (ry (-System.Math.PI / 2.0)) I2 ]
    |> List.reduce matMul

[<Fact>]
let ``YB-7: Kauffman–Lomonaco R is an EXACT word over the shipped ISA — braiding earned by composition, primitives unchanged`` () =
    Assert.True(maxDev RWORD RKL <= TOL_PASS) // expect ~1.3e-16
    Assert.True(ybDev RWORD <= TOL_PASS) // expect ~1.1e-16
    Assert.True(invDev RWORD >= TOL_FAIL) // expect exactly 1.0
    let r2 = matMul RWORD RWORD
    let r4 = matMul r2 r2
    Assert.True(maxDev (matMul r4 r4) (eye 4) <= TOL_PASS) // order-8, matching YB-4

[<Property>]
let ``YB-8: the braiding angle is ISOLATED — the same word shape with a generic inner angle FAILS Yang–Baxter`` (NormalFloat t) =
    let theta = 1.9 + (abs t % 1.1) // clamp to [1.9, 3.0]; the braid point |theta| = pi/2 is excluded
    let w =
        [ kron (ry (System.Math.PI / 2.0)) I2
          CNOT
          kron I2 (ry theta)
          CNOT
          kron (ry (-System.Math.PI / 2.0)) I2 ]
        |> List.reduce matMul
    ybDev w >= 0.2 // grid-swept minimum on the clamp's image is 0.263 (Soraya round 3)
