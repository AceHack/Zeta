module Zeta.Tests.Predicate3Tests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core.FSharp.TriBoolean

module P = Zeta.Core.FSharp.TriBoolean.Predicate3

// ═══════════════════════════════════════════════════════════════════
// Predicate3 — the three-valued (Kleene K3) predicate register. These tests prove the
// property that motivated it: `'a -> bool` COLLAPSES SQL-null propagation, `'a -> Tri`
// PRESERVES it. UNKNOWN must propagate through and/or/not (never silently become false),
// and the 3→2 collapse must happen ONLY at the terminal selection boundary.
// ═══════════════════════════════════════════════════════════════════

// the identity predicate over Tri — lets us drive the algebra directly with T/F/N inputs
let private idP : P.Predicate3<Tri> = id

let private genTri : Gen<Tri> = Gen.elements [ Tri.T; Tri.F; Tri.N ]

type TriArb() =
    static member T() = Arb.fromGen genTri

// ── UNKNOWN propagates (the never-collapse property) ──

[<Fact>]
let ``Predicate3: UNKNOWN propagates through AND/OR/NOT — it is NOT collapsed to false`` () =
    // NOT UNKNOWN = UNKNOWN (a two-valued predicate would have made this false)
    Assert.Equal(Tri.N, (P.notP3 idP) Tri.N)
    // UNKNOWN AND TRUE = UNKNOWN (still living-uncertain — not false)
    Assert.Equal(Tri.N, (P.andP3 idP P.always) Tri.N)
    // UNKNOWN OR FALSE = UNKNOWN
    Assert.Equal(Tri.N, (P.orP3 idP P.never) Tri.N)
    // but UNKNOWN AND FALSE = FALSE (F dominates ∧), UNKNOWN OR TRUE = TRUE (T dominates ∨)
    Assert.Equal(Tri.F, (P.andP3 idP P.never) Tri.N)
    Assert.Equal(Tri.T, (P.orP3 idP P.always) Tri.N)

[<Fact>]
let ``Predicate3: 'false' and 'unknown' stay DISTINCT through composition (no register-collapse)`` () =
    // The whole point: a definite-false and an unknown must not be conflated. After the same
    // composition, F-input and N-input land on different results — the distinction survives.
    let composed = P.andP3 idP P.always // p ∧ ⊤ = p (identity on the K3 value)
    Assert.NotEqual<Tri>(composed Tri.F, composed Tri.N) // F vs N preserved, not both → false

// ── the collapse happens ONLY at the terminal boundary (SQL WHERE: keep only TRUE) ──

[<Fact>]
let ``Predicate3: isSelected collapses 3→2 only at the boundary — TRUE included, FALSE and UNKNOWN excluded`` () =
    Assert.True(P.isSelected idP Tri.T)
    Assert.False(P.isSelected idP Tri.F)
    Assert.False(P.isSelected idP Tri.N) // UNKNOWN drops out of WHERE, exactly like SQL
    Assert.Equal<Tri list>([ Tri.T ], P.filter idP [ Tri.T; Tri.F; Tri.N ] |> List.ofSeq)

// ── lifted two-valued predicates never produce UNKNOWN (total inputs stay certain) ──

[<Property>]
let ``Predicate3: ofBool never yields UNKNOWN`` (b: bool) =
    (P.ofBool (fun _ -> b)) () <> Tri.N

// ── the K3 algebra laws (lifted from the proven TriBoolean truth tables) ──

[<Property(Arbitrary = [| typeof<TriArb> |])>]
let ``Predicate3: De Morgan holds in K3 — ¬(p ∧ q) = ¬p ∨ ¬q`` (a: Tri) (b: Tri) =
    let p : P.Predicate3<unit> = fun _ -> a
    let q : P.Predicate3<unit> = fun _ -> b
    (P.notP3 (P.andP3 p q)) () = (P.orP3 (P.notP3 p) (P.notP3 q)) ()

[<Property(Arbitrary = [| typeof<TriArb> |])>]
let ``Predicate3: double negation is identity`` (a: Tri) =
    (P.notP3 (P.notP3 idP)) a = a

[<Property(Arbitrary = [| typeof<TriArb> |])>]
let ``Predicate3: AND/OR are commutative in K3`` (a: Tri) (b: Tri) =
    let p : P.Predicate3<unit> = fun _ -> a
    let q : P.Predicate3<unit> = fun _ -> b
    ((P.andP3 p q) () = (P.andP3 q p) ()) && ((P.orP3 p q) () = (P.orP3 q p) ())
