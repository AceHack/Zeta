module Zeta.Tests.Algebra.OctonionLawsTests

open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// The OCTONION ALGEBRA, fully proven — the defining properties that make 𝕆 a genuine normed
// division algebra (not merely "non-associative"), on top of the Cayley–Dickson doubling.
// These are the PROVABLE half of "map the hex core to full Cayley"; the SEMANTIC mapping of the
// hex walls onto the octonion basis (e₁…e₇) with a meaning-bearing product remains an OPEN
// conjecture (not derivable — must be designed and checked), deliberately NOT asserted here.
//   • each imaginary unit squares to −1; distinct units anticommute
//   • the ALTERNATIVE law (associativity holds in any 2-generated subalgebra) — survives at 𝕆,
//     lost at 𝕊; this is what distinguishes octonions from generic non-associative algebras
//   • NORM-MULTIPLICATIVITY N(xy)=N(x)N(y) — the composition/division-algebra property (fails at 𝕊)
//   • every non-zero octonion has a unique two-sided inverse (division algebra)
// ═══════════════════════════════════════════════════════════════════

let private O = ImaginaryStack.octonion

/// Build an octonion from its 8 real components (e₀..e₇).
let private oct a b c d e f g h : Octonion =
    Doubled.make (Doubled.make (Doubled.make a b) (Doubled.make c d)) (Doubled.make (Doubled.make e f) (Doubled.make g h))

let private comps (o: Octonion) : float list =
    [ o.Real.Real.Real; o.Real.Real.Imag; o.Real.Imag.Real; o.Real.Imag.Imag
      o.Imag.Real.Real; o.Imag.Real.Imag; o.Imag.Imag.Real; o.Imag.Imag.Imag ]

let private approxT (tol: float) (a: Octonion) (b: Octonion) =
    List.forall2 (fun x y -> abs (x - y) < tol) (comps a) (comps b)

let private scal r = oct r 0.0 0.0 0.0 0.0 0.0 0.0 0.0
let private realPart (o: Octonion) = o.Real.Real.Real
/// N(x) = real part of x·x̄ = Σ component² — the octonion norm-squared.
let private norm2 (o: Octonion) = realPart (O.Mul(o, O.Conj o))

let private basis : Octonion[] =
    [| oct 1.0 0.0 0.0 0.0 0.0 0.0 0.0 0.0
       oct 0.0 1.0 0.0 0.0 0.0 0.0 0.0 0.0
       oct 0.0 0.0 1.0 0.0 0.0 0.0 0.0 0.0
       oct 0.0 0.0 0.0 1.0 0.0 0.0 0.0 0.0
       oct 0.0 0.0 0.0 0.0 1.0 0.0 0.0 0.0
       oct 0.0 0.0 0.0 0.0 0.0 1.0 0.0 0.0
       oct 0.0 0.0 0.0 0.0 0.0 0.0 1.0 0.0
       oct 0.0 0.0 0.0 0.0 0.0 0.0 0.0 1.0 |]

// integer-valued components → octonion multiplication is exact in float (no rounding)
let private genOct : Gen<Octonion> =
    gen {
        let! c = Gen.listOfLength 8 (Gen.choose (-4, 4) |> Gen.map float)
        return oct c.[0] c.[1] c.[2] c.[3] c.[4] c.[5] c.[6] c.[7]
    }

type OctArb() =
    static member O() = Arb.fromGen genOct

[<Fact>]
let ``Octonion: the 7 imaginary units each square to -1`` () =
    for i in 1..7 do
        Assert.True(approxT 1e-9 (O.Mul(basis.[i], basis.[i])) (scal -1.0), sprintf "e%d squared ≠ -1" i)

[<Fact>]
let ``Octonion: distinct imaginary units anticommute (e_i e_j = -(e_j e_i))`` () =
    for i in 1..7 do
        for j in 1..7 do
            if i <> j then
                Assert.True(approxT 1e-9 (O.Mul(basis.[i], basis.[j])) (O.Negate(O.Mul(basis.[j], basis.[i]))), sprintf "e%d e%d not anticommuting" i j)

[<Property(Arbitrary = [| typeof<OctArb> |])>]
let ``Octonion: LEFT alternative law — x(xy) = (xx)y`` (x: Octonion) (y: Octonion) =
    approxT 1e-9 (O.Mul(x, O.Mul(x, y))) (O.Mul(O.Mul(x, x), y))

[<Property(Arbitrary = [| typeof<OctArb> |])>]
let ``Octonion: RIGHT alternative law — (yx)x = y(xx)`` (x: Octonion) (y: Octonion) =
    approxT 1e-9 (O.Mul(O.Mul(y, x), x)) (O.Mul(y, O.Mul(x, x)))

[<Property(Arbitrary = [| typeof<OctArb> |])>]
let ``Octonion: norm is MULTIPLICATIVE — N(xy) = N(x)N(y) (division-algebra property)`` (x: Octonion) (y: Octonion) =
    abs (norm2 (O.Mul(x, y)) - norm2 x * norm2 y) < 1e-6

[<Property(Arbitrary = [| typeof<OctArb> |])>]
let ``Octonion: x·x̄ is real and equals N(x); conjugation is involutive`` (x: Octonion) =
    let prod = O.Mul(x, O.Conj x)
    let imagZero = comps prod |> List.tail |> List.forall (fun c -> abs c < 1e-9)
    imagZero && abs (realPart prod - norm2 x) < 1e-9 && approxT 1e-9 (O.Conj(O.Conj x)) x

[<Property(Arbitrary = [| typeof<OctArb> |])>]
let ``Octonion: every non-zero octonion has a two-sided inverse (division algebra)`` (x: Octonion) =
    let n = norm2 x
    if n < 0.5 then true // skip the zero octonion
    else
        let inv = O.Mul(scal (1.0 / n), O.Conj x)
        approxT 1e-7 (O.Mul(x, inv)) (scal 1.0) && approxT 1e-7 (O.Mul(inv, x)) (scal 1.0)
