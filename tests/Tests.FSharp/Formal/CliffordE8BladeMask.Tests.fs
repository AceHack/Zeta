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

// ── Grade-profile proof (F# oracle) ─────────────────────────────────────────
// The grade of a blade index in Cl(3,0) is its popcount.
let private gradeOf (i : int) = [|0;1;1;2;1;2;2;3|].[i]

[<Fact>]
let ``GP-F1: {0,3,4,7} spans all 4 grades {0,1,2,3} — unique among XOR-closed subgroups`` () =
    let grades = [|0;3;4;7|] |> Array.map gradeOf |> Array.sort
    Assert.Equal<int[]>([|0;1;2;3|], grades)
    Assert.True(Array.contains 3 grades) // contains pseudoscalar

[<Fact>]
let ``GP-F2: {0,1,4,5} and {0,2,4,6} are grade-incomplete (missing grade 3)`` () =
    let g1 = [|0;1;4;5|] |> Array.map gradeOf |> Array.sort
    let g2 = [|0;2;4;6|] |> Array.map gradeOf |> Array.sort
    Assert.Equal<int[]>([|0;1;1;2|], g1)
    Assert.Equal<int[]>([|0;1;1;2|], g2)
    Assert.False(Array.contains 3 g1)
    Assert.False(Array.contains 3 g2)

[<Fact>]
let ``GP-F3: {0,3,4,7} is the ONLY grade-complete XOR-closed subgroup (F# oracle)`` () =
    let subgroups = [| [|0;1;4;5|]; [|0;2;4;6|]; [|0;3;4;7|] |]
    let gradeComplete =
        subgroups |> Array.filter (fun sg ->
            sg |> Array.map gradeOf |> Set.ofArray |> Set.count = 4)
    Assert.Equal(1, gradeComplete.Length)
    Assert.Equal<int[]>([|0;3;4;7|], gradeComplete.[0])
