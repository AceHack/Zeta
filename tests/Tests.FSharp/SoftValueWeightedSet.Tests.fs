module Zeta.Tests.SoftValueWeightedSetTests

open System
open System.Collections.Immutable
open System.Reflection
open global.Xunit
open Zeta.Core

module SV = Zeta.Core.SoftValue
module PS = Zeta.Core.ProbabilitySemiring
module WS = Zeta.Core.WeightedSet

// ═══════════════════════════════════════════════════════════════════════════════
// `SoftValue` as a genuine `WeightedSet`, and the float/exact boundary.
//
// Three falsifiers, in the order the change has to earn them:
//
//   1. THE KEY IS SOUND — the total order `WeightedSet` needs agrees with the equality
//      `DynamicValue` already has. If it does not, candidates silently stop merging (or start
//      merging things that are not equal) and every distribution in the repo is wrong.
//   2. THE BOUNDARY IS ENFORCED — a float-weighted tensor cannot reach the wire encoder. The
//      structural half is a signature; the residual half (inside `Zeta.Core`) is this test,
//      which enumerates the exported capabilities and fails if a float one appears.
//   3. ASSOCIATIVITY IS THE REASON — exact ℚ weights fold identically under permutation and
//      float weights are shown NOT to. The justification for the boundary lives in the suite,
//      not only in prose.
// ═══════════════════════════════════════════════════════════════════════════════

let private cand i = DynamicValue.Int(int64 i)
let private key (d: DynamicValue) = CandidateKey d
let private R = LocalFloatRing.Instance
let private Q = PS.RationalRing.Instance

// ═══════════════════════════════════════════════════════════════════════════════
// 1. THE KEY IS SOUND — order agrees with equality
// ═══════════════════════════════════════════════════════════════════════════════

/// A corpus that deliberately includes every hazard `DynamicValue.Equals` special-cases.
let private corpus: DynamicValue list =
    [ DynamicValue.Null
      DynamicValue.Bool false
      DynamicValue.Bool true
      DynamicValue.Int -1L
      DynamicValue.Int 0L
      DynamicValue.Int 7L
      DynamicValue.Float 0.0
      DynamicValue.Float -0.0 // `Double.Equals` says this IS `0.0`
      DynamicValue.Float 1.5
      DynamicValue.Float Double.NaN
      DynamicValue.Float(0.0 / 0.0) // a second NaN, possibly a different bit pattern
      DynamicValue.Float Double.PositiveInfinity
      DynamicValue.String ""
      DynamicValue.String "a"
      DynamicValue.String "ab"
      DynamicValue.String "B"
      DynamicValue.Bytes(ImmutableArray<byte>.Empty)
      DynamicValue.Bytes(ImmutableArray.Create<byte>(1uy))
      DynamicValue.Bytes(ImmutableArray.Create<byte>(1uy, 2uy))
      DynamicValue.Array []
      DynamicValue.Array [ DynamicValue.Int 1L ]
      DynamicValue.Array [ DynamicValue.Int 1L; DynamicValue.Int 2L ]
      DynamicValue.Object []
      DynamicValue.Object [ "k", DynamicValue.Int 1L ]
      DynamicValue.Object [ "k", DynamicValue.Int 2L ] ]

[<Fact>]
let ``CandidateKey: compare = 0 exactly when DynamicValue.Equals — the merge invariant`` () =
    for a in corpus do
        for b in corpus do
            let cmp = DynamicValueOrder.compareValues a b
            let eq = a.Equals(b)

            Assert.True(
                (cmp = 0) = eq,
                sprintf "order/equality disagree on %A vs %A: compare=%d equals=%b" a b cmp eq
            )

[<Fact>]
let ``CandidateKey: the hazards Double.Equals special-cases are handled, not ignored`` () =
    // -0.0 and 0.0 are ONE candidate (this is what `Double.Equals` says), so they must merge.
    Assert.Equal(0, DynamicValueOrder.compareValues (DynamicValue.Float 0.0) (DynamicValue.Float -0.0))
    // every NaN is ONE candidate, so NaNs must merge with each other...
    Assert.Equal(0, DynamicValueOrder.compareValues (DynamicValue.Float Double.NaN) (DynamicValue.Float(0.0 / 0.0)))
    // ...and must NOT merge with a number.
    Assert.NotEqual(0, DynamicValueOrder.compareValues (DynamicValue.Float Double.NaN) (DynamicValue.Float 1.0))
    // a default (uninitialised) ImmutableArray reads as empty, exactly as `Equals` does.
    let mutable dflt = Unchecked.defaultof<ImmutableArray<byte>>

    Assert.Equal(
        0,
        DynamicValueOrder.compareValues (DynamicValue.Bytes dflt) (DynamicValue.Bytes ImmutableArray<byte>.Empty)
    )

[<Fact>]
let ``CandidateKey: the order is total — antisymmetric and transitive over the corpus`` () =
    for a in corpus do
        for b in corpus do
            Assert.Equal(
                sign (DynamicValueOrder.compareValues a b),
                -(sign (DynamicValueOrder.compareValues b a))
            )

    for a in corpus do
        for b in corpus do
            for c in corpus do
                let ab = sign (DynamicValueOrder.compareValues a b)
                let bc = sign (DynamicValueOrder.compareValues b c)
                let ac = sign (DynamicValueOrder.compareValues a c)
                if ab <> 0 && ab = bc then
                    Assert.Equal(ab, ac)

[<Fact>]
let ``SoftValue IS a WeightedSet: -0.0 and 0.0 are one candidate, and NaNs merge`` () =
    // The old association-list `build` used a `Dictionary<DynamicValue,_>` keyed on the same
    // equality, so this is parity — asserted because the new key had to reproduce it.
    let sv = (SV.ofWeighted [ DynamicValue.Float 0.0, 1.0; DynamicValue.Float -0.0, 1.0 ]).Value
    Assert.Equal(1, List.length (SV.candidates sv))

    let nanSv =
        (SV.ofWeighted [ DynamicValue.Float Double.NaN, 1.0; DynamicValue.Float(0.0 / 0.0), 1.0 ])
            .Value

    Assert.Equal(1, List.length (SV.candidates nanSv))

// ═══════════════════════════════════════════════════════════════════════════════
// 2. THE BOUNDARY IS ENFORCED
// ═══════════════════════════════════════════════════════════════════════════════
//
// The load-bearing half is a SIGNATURE and cannot be asserted from inside the assembly:
// `WeightedSetWire.toDynamicValue` takes a `WireWeight<'W>`, and `WireWeight<'W>`'s only
// constructor is `internal`, so no caller outside `Zeta.Core` can manufacture one at any 'W —
// least of all `float`. The two tests below pin what CAN still drift: that the constructor
// stays non-public, and that the set of capabilities `Zeta.Core` itself exports never grows a
// float. Adding `WireWeight.floatUnsafe` turns this suite red.

let private wireWeightModule: Type =
    typeof<CandidateKey>.Assembly.GetTypes()
    |> Array.find (fun t -> t.FullName = "Zeta.Core.WireWeightModule" || t.FullName = "Zeta.Core.WireWeight")
    |> fun t -> if t.IsAbstract && t.IsSealed then t else failwith "WireWeight module type not found as a static class"

[<Fact>]
let ``boundary: WireWeight has no public constructor — outside Zeta.Core it is unforgeable`` () =
    let ctors =
        typedefof<WireWeight<_>>.GetConstructors(BindingFlags.Public ||| BindingFlags.Instance)

    Assert.Empty(ctors)

[<Fact>]
let ``boundary: every exported WireWeight is an exact ring — none is float`` () =
    let exported =
        wireWeightModule.GetProperties(BindingFlags.Public ||| BindingFlags.Static)
        |> Array.filter (fun p ->
            p.PropertyType.IsGenericType
            && p.PropertyType.GetGenericTypeDefinition() = typedefof<WireWeight<_>>)
        |> Array.map (fun p -> p.Name, p.PropertyType.GetGenericArguments().[0])

    // The capability exists at all (a vacuous "no float found" over an empty set would pass
    // while proving nothing).
    Assert.NotEmpty(exported)

    for (name, w) in exported do
        Assert.True(w <> typeof<float>, sprintf "WireWeight.%s is float-weighted — the boundary is breached" name)
        Assert.True(w <> typeof<float32>, sprintf "WireWeight.%s is float32-weighted" name)

    let names = exported |> Array.map fst |> Array.sort
    Assert.Equal<string[]>([| "integer"; "rational" |], names)

[<Fact>]
let ``boundary: there is no generic factory that could be instantiated at float`` () =
    // A `let make<'W> … : WireWeight<'W>` in the module would be the escape hatch: it would let
    // any caller inside the assembly mint a float capability without adding a named instance,
    // so the previous test would stay green while the boundary was gone.
    let generics =
        wireWeightModule.GetMethods(BindingFlags.Public ||| BindingFlags.Static)
        |> Array.filter (fun m ->
            m.IsGenericMethodDefinition
            && m.ReturnType.IsGenericType
            && m.ReturnType.GetGenericTypeDefinition() = typedefof<WireWeight<_>>)

    Assert.Empty(generics)

[<Fact>]
let ``boundary: the exact crossing round-trips and is the ONLY way a SoftValue reaches bytes`` () =
    let sv = (SV.ofWeighted [ cand 0, 1.0; cand 1, 3.0 ]).Value

    match SV.toWire 1_000L sv with
    | Error e -> failwithf "toWire declined: %A" e
    | Ok bytes -> Assert.NotEmpty(bytes)

    // The denominator is bounded on purpose (see `toExact`) — an unbounded one would overflow
    // `ProbabilitySemiring.rat`, which does not check.
    Assert.Equal<Result<byte[], SV.ExactError>>(Error SV.ExactError.DenominatorOutOfRange, SV.toWire 0L sv)

    Assert.Equal<Result<byte[], SV.ExactError>>(
        Error SV.ExactError.DenominatorOutOfRange,
        SV.toWire 2_000_000_000L sv
    )

[<Fact>]
let ``boundary: the exact projection sums to EXACTLY one — which the floats never did`` () =
    // OWNED ERROR: this test first used THREE equal candidates, on the assumption that
    // 1/3+1/3+1/3 misses 1.0 in IEEE-754. It does not — that one is exact, and the test failed
    // on its own claim. SEVEN equal candidates is a real witness (0.9999999999999998), measured
    // rather than assumed, which is the only reason it is the number written here.
    let sv = (SV.ofWeighted [ for i in 0..6 -> cand i, 1.0 ]).Value
    let floatTotal = SV.candidates sv |> List.sumBy snd
    Assert.NotEqual(1.0, floatTotal) // the reason this projection exists

    match SV.toExact 999L sv with
    | Error e -> failwithf "toExact declined: %A" e
    | Ok exact ->
        let total =
            exact |> WS.toSeq |> Seq.map snd |> Seq.fold (fun acc w -> Q.Add(acc, w)) PS.zero

        Assert.Equal(PS.one, total)

[<Fact>]
let ``boundary: the wire form is invariant under the order the belief was built in`` () =
    let pairs = [ cand 3, 2.0; cand 1, 5.0; cand 2, 3.0 ]

    let bytesOf (xs: (DynamicValue * float) list) =
        match SV.toWire 10_000L (SV.ofWeighted xs).Value with
        | Ok b -> b
        | Error e -> failwithf "toWire declined: %A" e

    let reference = bytesOf pairs

    // every permutation of the same evidence must produce byte-identical shared state
    let rec perms xs =
        match xs with
        | [] -> [ [] ]
        | _ -> xs |> List.collect (fun x -> perms (List.filter (fun y -> y <> x) xs) |> List.map (fun r -> x :: r))

    for p in perms pairs do
        Assert.Equal<byte[]>(reference, bytesOf p)

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ASSOCIATIVITY IS THE REASON FOR THE BOUNDARY
// ═══════════════════════════════════════════════════════════════════════════════

/// The witness: `1 + 1e-16 + 1e-16` differs by an ulp depending on where the parentheses go.
/// Verified numerically before being written down, and asserted here so the claim is checkable.
let private floatWitness = [ 1.0; 1e-16; 1e-16 ]

[<Fact>]
let ``associativity: the FLOAT weight ring is NOT associative — the negative control`` () =
    let k = key (cand 0)

    let foldIn (order: float list) =
        order |> Seq.map (fun w -> k, w) |> WS.ofSeq R |> WS.weight R k

    let ascending = foldIn (List.sortBy id floatWitness)
    let descending = foldIn (List.sortByDescending id floatWitness)

    // If this ever starts passing as EQUAL, the boundary this PR draws has no reason to exist —
    // so the test asserts the inequality rather than assuming it.
    Assert.NotEqual(ascending, descending)

[<Fact>]
let ``associativity: the EXACT ring folds identically under 200 seeded permutations`` () =
    // S = 4, the common seed.
    let rng = Random(4)
    let k0, k1, k2 = key (cand 0), key (cand 1), key (cand 2)

    let entries =
        [ k0, PS.rat 1L 3L
          k1, PS.rat 1L 7L
          k2, PS.rat 5L 11L
          k0, PS.rat 2L 9L
          k1, PS.rat 3L 13L ]

    let reference = WS.ofSeq Q entries

    for _ in 1..200 do
        let shuffled = entries |> List.sortBy (fun _ -> rng.Next())
        // structural equality on the whole tensor — not a per-key tolerance check
        Assert.Equal(reference, WS.ofSeq Q shuffled)

[<Fact>]
let ``associativity: the same 200 permutations DO break the float ring — non-vacuity`` () =
    // Without this arm the test above could be passing because the permutations are trivial.
    let rng = Random(4)
    let k = key (cand 0)

    let entries = [ k, 1.0; k, 1e-16; k, 1e-16; k, 1e-16; k, 1e-16 ]
    let reference = WS.ofSeq R entries

    let differing =
        [ 1..200 ]
        |> List.filter (fun _ ->
            let shuffled = entries |> List.sortBy (fun _ -> rng.Next())
            WS.ofSeq R shuffled <> reference)
        |> List.length

    Assert.True(differing > 0, "the permutation set never reordered the float fold — the control is vacuous")

// ═══════════════════════════════════════════════════════════════════════════════
// 4. THE TIE-BREAK THAT CAME FREE (and is reported as a behaviour change)
// ═══════════════════════════════════════════════════════════════════════════════

[<Fact>]
let ``resolve: ties now break by ascending candidate, matching the C#/TS/Rust oracles`` () =
    // C# `Argmax` is `OrderByDescending(value).ThenBy(key, Ordinal)`; TS sorts the keys before
    // scanning. F#'s `List.maxBy` takes the FIRST maximum, which over an arrival-ordered list
    // meant "whichever tied candidate was mentioned first" — a genuine cross-oracle divergence
    // that the golden seed happens not to exercise. Ordinal storage removes it.
    let built = (SV.ofWeighted [ DynamicValue.String "b", 1.0; DynamicValue.String "a", 1.0 ]).Value
    Assert.Equal<DynamicValue option>(Some(DynamicValue.String "a"), SV.resolve 0.5 built)

    // and the mirror ordering agrees, which is the whole point of it being order-free
    let mirrored = (SV.ofWeighted [ DynamicValue.String "a", 1.0; DynamicValue.String "b", 1.0 ]).Value
    Assert.Equal<DynamicValue option>(SV.resolve 0.5 built, SV.resolve 0.5 mirrored)
