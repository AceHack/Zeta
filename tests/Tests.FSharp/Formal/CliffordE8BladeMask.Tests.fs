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
