module Zeta.Core.Tests.CliffordE8BladeMask

open Xunit
open Zeta.Core

// ── Cross-language byte-lock: F# oracle vs TypeScript oracle ─────────────────
// The golden numbers below are banked from the TS measurement (2026-08-09).
// If the F# and TS results disagree, the byte-lock is broken — one of the two
// implementations has a logic error. Integer arithmetic throughout; deterministic.

let private m = CliffordE8BladeMask.measure ()

[<Fact>]
let ``BM-1: Construction A yields exactly 240 roots, all norm² = 4`` () =
    let roots = CliffordE8BladeMask.e8Roots ()
    Assert.Equal(240, roots.Length)
    Assert.True(roots |> Array.forall (fun r -> Array.sumBy (fun v -> v * v) r = 4))
    // No duplicates
    let distinct = roots |> Array.map (fun r -> System.String.Join(",", r)) |> Set.ofArray
    Assert.Equal(240, distinct.Count)

[<Fact>]
let ``BM-2: classical ℝ⁸ reflection preserves ALL 57,600 pairs (construction fidelity)`` () =
    Assert.Equal(57600, m.ClassicalPreserved)

[<Fact>]
let ``BM-3: exactly 32 bridged roots are versor-normed (cross-language byte-lock)`` () =
    Assert.Equal(32, m.VersorNormedCount)

[<Fact>]
let ``BM-4: versor-normed supports are exactly 8 singletons + {0,3,4,7} + {1,2,5,6}`` () =
    let expected =
        [ "0"; "0+3+4+7"; "1"; "1+2+5+6"; "2"; "3"; "4"; "5"; "6"; "7" ]
    Assert.Equal<string list>(expected, m.VersorNormedSupports)

[<Fact>]
let ``BM-5: the 32 versor-normed elements each preserve ALL 240 roots (7,680 total)`` () =
    Assert.Equal(32 * 240, m.VersorPreserved)

[<Fact>]
let ``BM-6: sandwich is NOT a reflection action — 11,776 of 57,600 root images`` () =
    Assert.Equal(33024, m.IntegerImages)
    Assert.Equal(11776, m.RootImages)
    Assert.Equal(352, m.IdentityFixedPairs)

[<Fact>]
let ``BM-7: quantized per-A histogram {0:160, 64:32, 128:16, 240:32} (cross-language byte-lock)`` () =
    let expected = [ (0, 160); (64, 32); (128, 16); (240, 32) ]
    Assert.Equal<(int * int) list>(expected, m.PerAHistogram)

// ── I-closure criterion (F# oracle, corrected PR #10230) ─────────────────────
// The correct criterion is CLOSURE UNDER i ↦ i⊕7 (pseudoscalar XOR).
// Grade-completeness was wrong: {1,2,5,6} has grades {1,1,2,2} and contains
// neither the scalar nor the pseudoscalar — so it cannot be the criterion.

let private iClosed (s : int[]) =
    let set = Set.ofArray s
    s |> Array.forall (fun i -> Set.contains (i ^^^ 7) set)

let private gradeOf (i : int) = [|0;1;1;2;1;2;2;3|].[i]

[<Fact>]
let ``IC-F1: I-closure selects EXACTLY the two survivors {0,3,4,7} and {1,2,5,6}`` () =
    // Enumerate the actual Hamming code weight-4 supports (same generator as allCodewords)
    let generator = [| [|1;0;0;0;0;1;1;1|]; [|0;1;0;0;1;0;1;1|]
                       [|0;0;1;0;1;1;0;1|]; [|0;0;0;1;1;1;1;0|] |]
    let weight4Supports =
        [| for m in 0..15 do
               let cw = Array.init 8 (fun j ->
                   let mutable acc = 0
                   for i in 0..3 do acc <- acc ^^^ (((m >>> i) &&& 1) &&& generator.[i].[j])
                   acc)
               if Array.sum cw = 4 then
                   yield cw |> Array.mapi (fun j v -> if v = 1 then j else -1) |> Array.filter (fun j -> j >= 0) |]
    let survivors = weight4Supports |> Array.filter iClosed
    Assert.Equal(2, survivors.Length)
    let supportStrs = survivors |> Array.map (fun s -> s |> Array.sort |> Array.map string |> String.concat "+") |> Array.sort
    Assert.Equal<string[]>([|"0+3+4+7"; "1+2+5+6"|], supportStrs)

[<Fact>]
let ``IC-F2: grade-completeness is wrong — {1,2,5,6} has grades {1,1,2,2}, not grade-complete`` () =
    let grades = [|1;2;5;6|] |> Array.map gradeOf |> Array.sort
    Assert.Equal<int[]>([|1;1;2;2|], grades)
    Assert.False(Array.contains 0 grades) // no scalar
    Assert.False(Array.contains 3 grades) // no pseudoscalar

[<Fact>]
let ``IC-F3: closure is coset-invariant — {1,2,5,6} = 1 XOR {0,3,4,7} and is also I-closed`` () =
    // {1,2,5,6} is the coset of {0,3,4,7} under XOR-1
    let coset = [|0;3;4;7|] |> Array.map (fun i -> i ^^^ 1) |> Array.sort
    Assert.Equal<int[]>([|1;2;5;6|], coset)
    // The coset is also I-closed
    Assert.True(iClosed coset)
    // But "contains 7" does not survive coset translation
    Assert.False(Array.contains 7 coset)

[<Fact>]
let ``IC-F4: XOR-closure is necessary but not sufficient — 3 subgroups qualify, only 2 survive I-closure`` () =
    let xorClosed =
        [| [|0;1;4;5|]; [|0;2;4;6|]; [|0;3;4;7|] |]
        |> Array.filter (fun sg ->
            let set = Set.ofArray sg
            sg |> Array.forall (fun a -> sg |> Array.forall (fun b -> Set.contains (a ^^^ b) set)))
    Assert.Equal(3, xorClosed.Length) // 3 XOR-closed subgroups
    let iClosedSubgroups = xorClosed |> Array.filter iClosed
    Assert.Equal(1, iClosedSubgroups.Length) // only 1 is also I-closed
    Assert.Equal<int[]>([|0;3;4;7|], iClosedSubgroups.[0])

// ── D₄⊕D₄ reflection closure (labelling-dependency caveat) ──────────────────
// The 32 versor-normed roots are NOT a sub-root-system of E8.
// Their reflection closure (orbit under all E8 reflections) is D₄⊕D₄ = 48 roots.
// This is a Borel–de Siebenthal maximal-rank subsystem, not a sub-root-system.
// Caveat: "32" is labelling-dependent; only the 16 single blades are invariant.

[<Fact>]
let ``RC-1: the 32 versor-normed roots are NOT closed under E8 reflections (not a sub-root-system)`` () =
    let roots = CliffordE8BladeMask.e8Roots ()
    let rootSet = System.Collections.Generic.HashSet<string>(
                      roots |> Array.map (fun r -> System.String.Join(",", r)))
    let vn = CliffordE8BladeMask.versorNormedRoots ()
    let vnSet = System.Collections.Generic.HashSet<string>(
                    vn |> Array.map (fun r -> System.String.Join(",", r)))
    // Apply one E8 reflection to a versor-normed root and check if the image is versor-normed
    // Reflection of x in r: x' = x - 2(x·r)/(r·r)·r = x - (x·r)/2·r (since r·r=4)
    let reflect (r : int[]) (x : int[]) =
        let dot = Array.map2 (*) r x |> Array.sum
        Array.init 8 (fun j -> x.[j] - dot * r.[j] / 2)
    // Find at least one E8 reflection that maps a versor-normed root outside the versor-normed set
    let mutable foundEscape = false
    for r in roots do
        for x in vn do
            let image = reflect r x
            let imageStr = System.String.Join(",", image)
            if rootSet.Contains(imageStr) && not (vnSet.Contains(imageStr)) then
                foundEscape <- true
    Assert.True(foundEscape, "Expected at least one E8 reflection to map a versor-normed root outside the versor-normed set")

[<Fact>]
let ``RC-2: E8 reflection closure of the 32 versor-normed roots is the full E8 root system (240)`` () =
    // The 32 versor-normed roots are NOT a sub-root-system (RC-1 shows escapes exist).
    // Their orbit under all 240 E8 reflections closes to the full E8 root system (240 roots).
    // NOTE: Otto's doc claims "reflection closure is D4+D4 = 48" — this refers to closure
    // under reflections IN the 32 versor-normed roots themselves (the sub-group they generate),
    // NOT closure under all 240 E8 reflections. The E8 reflection closure is 240 (measured here).
    let roots = CliffordE8BladeMask.e8Roots ()
    let rootSet = System.Collections.Generic.HashSet<string>(
                      roots |> Array.map (fun r -> System.String.Join(",", r)))
    let vn = CliffordE8BladeMask.versorNormedRoots ()
    let reflect (r : int[]) (x : int[]) =
        let dot = Array.map2 (*) r x |> Array.sum
        Array.init 8 (fun j -> x.[j] - dot * r.[j] / 2)
    let closure = System.Collections.Generic.HashSet<string>(
                      vn |> Array.map (fun r -> System.String.Join(",", r)))
    let mutable frontier = vn |> Array.toList
    let mutable changed = true
    while changed do
        changed <- false
        let newFrontier = System.Collections.Generic.List<int[]>()
        for r in roots do
            for x in frontier do
                let image = reflect r x
                let imageStr = System.String.Join(",", image)
                if rootSet.Contains(imageStr) && closure.Add(imageStr) then
                    changed <- true
                    newFrontier.Add(image)
        frontier <- newFrontier |> Seq.toList
    Assert.Equal(240, closure.Count)  // Full E8 root system

[<Fact>]
let ``RC-3: closure under reflections IN the 32 versor-normed roots themselves (D4+D4 claim)`` () =
    // Otto's doc: "reflection closure is D4+D4 = 48" — tests closure under the 32 VN roots only.
    let roots = CliffordE8BladeMask.e8Roots ()
    let rootSet = System.Collections.Generic.HashSet<string>(
                      roots |> Array.map (fun r -> System.String.Join(",", r)))
    let vn = CliffordE8BladeMask.versorNormedRoots ()
    let reflect (r : int[]) (x : int[]) =
        let dot = Array.map2 (*) r x |> Array.sum
        Array.init 8 (fun j -> x.[j] - dot * r.[j] / 2)
    let closure = System.Collections.Generic.HashSet<string>(
                      vn |> Array.map (fun r -> System.String.Join(",", r)))
    let mutable frontier = vn |> Array.toList
    let mutable changed = true
    while changed do
        changed <- false
        let newFrontier = System.Collections.Generic.List<int[]>()
        for r in vn do  // Only reflect in the 32 versor-normed roots
            for x in frontier do
                let image = reflect r x
                let imageStr = System.String.Join(",", image)
                if rootSet.Contains(imageStr) && closure.Add(imageStr) then
                    changed <- true
                    newFrontier.Add(image)
        frontier <- newFrontier |> Seq.toList
    // MEASURED 2026-08-09: exactly 48. The old bounds (>32, <=240) could not fail for any
    // plausible implementation — they admitted 33 and 240 alike, so the test recorded nothing.
    let actualSize = closure.Count
    Assert.Equal(48, actualSize)

    // 48 alone does NOT identify D4+D4 — F4 also has 48 roots. Assert the invariants that
    // exclude it (.claude/rules/numerology-vs-number-theory.md).
    let closureRoots =
        closure |> Seq.map (fun s -> s.Split(',') |> Array.map int) |> Seq.toArray

    // (1) one norm class ⇒ simply-laced ⇒ not F4 (which has long and short roots)
    let norms = closureRoots |> Array.map (fun r -> Array.map2 (*) r r |> Array.sum) |> Array.distinct
    Assert.Equal<int[]>([| 4 |], norms)

    // (2) two orthogonal components of 24 roots each ⇒ D4 + D4 (D4 is the unique
    //     simply-laced 24-root system), not a single rank-8 system of 48 roots
    let n = closureRoots.Length
    let parent = Array.init n id
    let rec find i = if parent.[i] = i then i else (parent.[i] <- find parent.[i]; parent.[i])
    let union a b = let ra, rb = find a, find b in if ra <> rb then parent.[ra] <- rb
    for i in 0 .. n - 1 do
        for j in i + 1 .. n - 1 do
            if (Array.map2 (*) closureRoots.[i] closureRoots.[j] |> Array.sum) <> 0 then union i j

    let componentSizes =
        [ 0 .. n - 1 ] |> List.groupBy find |> List.map (snd >> List.length) |> List.sort
    Assert.Equal<int list>([ 24; 24 ], componentSizes)

[<Fact>]
let ``LI-1: the 16 single-blade versor-normed roots are invariant — singleton supports always versor-normed`` () =
    // The 32 versor-normed roots include 16 with singleton supports (the 8 ±2·eᵢ even roots).
    // These are invariant because singleton supports are trivially I-closed under any relabelling.
    // (A singleton {i} satisfies closure under i ↦ i⊕k iff the image is also in the set —
    //  but a singleton only has one element, so it's closed iff i⊕k = i, i.e. k=0.
    //  The actual invariance is: singleton supports always qualify as versor-normed because
    //  A·Ã for a single-blade A is always scalar — it's the norm squared.)
    let vn = CliffordE8BladeMask.versorNormedRoots ()
    // Count roots with exactly one non-zero component
    let singletons = vn |> Array.filter (fun r -> r |> Array.filter (fun v -> v <> 0) |> Array.length = 1)
    Assert.Equal(16, singletons.Length)  // 8 positive + 8 negative single-blade roots

[<Fact>]
let ``LI-2: the 16 non-singleton versor-normed roots come from the two I-closed 4-element supports`` () =
    let vn = CliffordE8BladeMask.versorNormedRoots ()
    // The 16 non-singleton versor-normed roots have 4-element supports {0,3,4,7} or {1,2,5,6}
    let nonSingletons = vn |> Array.filter (fun r -> r |> Array.filter (fun v -> v <> 0) |> Array.length > 1)
    Assert.Equal(16, nonSingletons.Length)
    // Their supports must be exactly {0,3,4,7} or {1,2,5,6}
    let supports =
        nonSingletons
        |> Array.map (fun r -> r |> Array.mapi (fun i v -> if v <> 0 then i else -1) |> Array.filter (fun i -> i >= 0))
        |> Array.map (fun s -> s |> Array.sort |> Array.map string |> String.concat "+")
        |> Array.distinct
        |> Array.sort
    Assert.Equal<string[]>([|"0+3+4+7"; "1+2+5+6"|], supports)
