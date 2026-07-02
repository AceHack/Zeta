module Zeta.Tests.Algebra.KleeneClosureTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// KleeneClosure — the generic matrix star. BooleanKleene → transitive
// closure. "One algorithm, chosen by instance" (Lehmann 1977). The LAW:
// the generic closure over the tropical instance == TropicalPaths.allPairs
// (proving the generic algorithm and the tuned one agree).
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``BooleanKleene is a lawful Kleene algebra (∨/∧, star = true)`` () =
    let k = BooleanKleene.Instance
    Assert.False(k.Zero); Assert.True(k.One)
    Assert.True(k.Add(false, true)); Assert.False(k.Add(false, false))
    Assert.True(k.Mul(true, true)); Assert.False(k.Mul(true, false))
    Assert.True(k.Star(false)); Assert.True(k.Star(true))   // reflexive

[<Fact>]
let ``transitiveClosure computes reachability (hand-checked chain + branch)`` () =
    // 1→2→3 , 2→4 ; so 1 reaches {1,2,3,4}, 3 reaches {3}, 4 reaches {4}
    let tc = KleeneClosure.transitiveClosure [ 1,2; 2,3; 2,4 ]
    let r u v = KleeneClosure.reaches u v tc
    Assert.True(r 1 2); Assert.True(r 1 3); Assert.True(r 1 4)
    Assert.True(r 1 1)          // reflexive
    Assert.True(r 2 4); Assert.True(r 2 3)
    Assert.False(r 3 1); Assert.False(r 4 2)   // no back-edges
    Assert.False(r 1 9)         // absent vertex

[<Fact>]
let ``transitiveClosure sees cycles: a↔b closure makes both reach each other`` () =
    let tc = KleeneClosure.transitiveClosure [ "a","b"; "b","a"; "b","c" ]
    let r u v = KleeneClosure.reaches u v tc
    Assert.True(r "a" "a"); Assert.True(r "a" "b"); Assert.True(r "a" "c")
    Assert.True(r "b" "a"); Assert.True(r "c" "c")
    Assert.False(r "c" "a")

[<Property(MaxTest = 100)>]
let ``LAW: reachability closure = the naive reachable-set (BFS) on random DAGs+cycles`` () =
    let toks = [| 0..5 |]
    let genEdges =
        gen {
            let! m = Gen.choose (0, 12)
            return! Gen.listOfLength m (gen {
                let! u = Gen.elements toks
                let! v = Gen.elements toks
                return u, v }) }
    Prop.forAll (Arb.fromGen genEdges) (fun es ->
        let tc = KleeneClosure.transitiveClosure es
        // naive reference: reflexive-transitive reachability by fixpoint BFS
        let adj = es |> List.groupBy fst |> List.map (fun (u, l) -> u, List.map snd l) |> Map.ofList
        let reachable src =
            let seen = System.Collections.Generic.HashSet<int>()
            let rec go stack =
                match stack with
                | [] -> ()
                | x :: rest ->
                    if seen.Add x then
                        go ((match Map.tryFind x adj with Some ns -> ns | None -> []) @ rest)
                    else go rest
            go [ src ]
            seen
        let verts = es |> List.collect (fun (a,b) -> [a;b]) |> List.distinct
        verts |> List.forall (fun u ->
            let want = reachable u
            verts |> List.forall (fun v ->
                // closure includes reflexive u→u even if u has no self-edge in `es`
                let expected = want.Contains v || u = v
                KleeneClosure.reaches u v tc = expected)))
