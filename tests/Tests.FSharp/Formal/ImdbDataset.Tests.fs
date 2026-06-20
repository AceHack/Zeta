module Zeta.Tests.Formal.ImdbDatasetTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

module I = Zeta.Core.ImdbDataset

// ═══════════════════════════════════════════════════════════════════
// ImdbDataset — typed offline binding over the IMDb non-commercial TSV
// datasets: parse → co-star graph → Bacon number → CoEmpowerGraph.
// Fixture: a Bacon chain  nm0001(Bacon)–nm0002–nm0003–nm0004  via three
// shared titles. Deterministic, offline, byte-lockable.
// ═══════════════════════════════════════════════════════════════════

// name.basics.tsv (header + 4 persons; \N = missing)
let private nameLines =
    [ "nconst\tprimaryName\tbirthYear\tdeathYear\tprimaryProfession\tknownForTitles"
      "nm0001\tKevin Bacon\t1958\t\\N\tactor\ttt001"
      "nm0002\tActor B\t\\N\t\\N\tactress\ttt001"
      "nm0003\tActor C\t\\N\t\\N\tactor\ttt002"
      "nm0004\tActor D\t\\N\t\\N\tactor\ttt003" ]

// title.principals.tsv (header + a Bacon chain: tt001 {Bacon,B}, tt002 {B,C}, tt003 {C,D})
let private principalLines =
    [ "tconst\tordering\tnconst\tcategory\tjob\tcharacters"
      "tt001\t1\tnm0001\tactor\t\\N\t[\"Ren\"]"
      "tt001\t2\tnm0002\tactress\t\\N\t\\N"
      "tt002\t1\tnm0002\tactress\t\\N\t\\N"
      "tt002\t2\tnm0003\tactor\t\\N\t\\N"
      "tt003\t1\tnm0003\tactor\t\\N\t\\N"
      "tt003\t2\tnm0004\tactor\t\\N\t\\N" ]

[<Fact>]
let ``parseNames skips the header, parses nconst+primaryName, and normalizes \N`` () =
    let names = I.parseNames nameLines
    names.Length |> should equal 4
    names.[0] |> should equal { I.Nconst = "nm0001"; I.PrimaryName = "Kevin Bacon" }
    names |> List.map (fun n -> n.Nconst) |> should equal [ "nm0001"; "nm0002"; "nm0003"; "nm0004" ]

[<Fact>]
let ``parsePrincipals skips the header and parses tconst/nconst/category`` () =
    let ps = I.parsePrincipals principalLines
    ps.Length |> should equal 6
    ps.[0] |> should equal ({ Tconst = "tt001"; Nconst = "nm0001"; Category = "actor" }: I.Principal)

[<Fact>]
let ``the co-star graph links persons who share a title (the Bacon chain)`` () =
    let persons, adj = I.coStarAdjacency (I.parsePrincipals principalLines)
    // persons ordinal-sorted: nm0001..nm0004 → indices 0..3
    persons |> should equal [| "nm0001"; "nm0002"; "nm0003"; "nm0004" |]
    adj.[0] |> should equal [| 1 |] // Bacon — B
    adj.[1] |> should equal [| 0; 2 |] // B — Bacon, C
    adj.[2] |> should equal [| 1; 3 |] // C — B, D
    adj.[3] |> should equal [| 2 |] // D — C

[<Fact>]
let ``Bacon number is the six-degrees BFS distance from Kevin Bacon`` () =
    let persons, adj = I.coStarAdjacency (I.parsePrincipals principalLines)
    let bn = I.baconNumber persons adj "nm0001"
    bn.["nm0001"] |> should equal 0
    bn.["nm0002"] |> should equal 1
    bn.["nm0003"] |> should equal 2
    bn.["nm0004"] |> should equal 3

[<Fact>]
let ``projection to CoEmpowerGraph is deterministic, all-Creator, adjacency-faithful`` () =
    let ps = I.parsePrincipals principalLines
    let _, g1 = I.toCoEmpowerGraph 4 7 ps
    let persons, g2 = I.toCoEmpowerGraph 4 7 ps
    g1.Identity |> should equal g2.Identity // DST: same args → same graph
    g2.N |> should equal 4
    persons |> should equal [| "nm0001"; "nm0002"; "nm0003"; "nm0004" |]
    g2.Role |> Array.forall (fun r -> r = CoEmpowerGraph.Creator) |> should equal true
    g2.Adjacency.[1] |> should equal [| 0; 2 |] // the co-star adjacency carried through
