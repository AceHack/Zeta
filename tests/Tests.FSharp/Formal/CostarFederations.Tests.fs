module Zeta.Tests.Formal.CostarFederationsTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

module F = Zeta.Core.CostarFederations
module I = Zeta.Core.ImdbDataset

// ═══════════════════════════════════════════════════════════════════
// CostarFederations — the end-to-end IMDb through-line: reverse-mint
// co-star links (rated by shared titles) → federation health → cached
// reified graph. Fixture: Bacon chain + a repeat title (tt004) so the
// Bacon↔B link is rated 2 (objective rating varies).
// ═══════════════════════════════════════════════════════════════════

let private principals =
    I.parsePrincipals
        [ "tconst\tordering\tnconst\tcategory\tjob\tcharacters"
          "tt001\t1\tnm0001\tactor\t\\N\t\\N"
          "tt001\t2\tnm0002\tactress\t\\N\t\\N"
          "tt002\t1\tnm0002\tactress\t\\N\t\\N"
          "tt002\t2\tnm0003\tactor\t\\N\t\\N"
          "tt003\t1\tnm0003\tactor\t\\N\t\\N"
          "tt003\t2\tnm0004\tactor\t\\N\t\\N"
          "tt004\t1\tnm0001\tactor\t\\N\t\\N" // a SECOND Bacon–B title
          "tt004\t2\tnm0002\tactress\t\\N\t\\N" ]

[<Fact>]
let ``reverse-mint produces the co-star links, objectively rated by shared-title count`` () =
    let links = F.reverseMint principals
    links
    |> should
        equal
        [ { F.A = "nm0001"; F.B = "nm0002"; F.SharedTitles = 2 } // Bacon–B share tt001 + tt004
          { F.A = "nm0002"; F.B = "nm0003"; F.SharedTitles = 1 }
          { F.A = "nm0003"; F.B = "nm0004"; F.SharedTitles = 1 } ]

[<Fact>]
let ``report carries federation health + Bacon numbers`` () =
    let r = F.report 4 7 "nm0001" principals
    r.Links.Length |> should equal 3
    r.BaconFrom.["nm0001"] |> should equal 0
    r.BaconFrom.["nm0004"] |> should equal 3
    r.Health.Diversity |> should be (greaterThanOrEqualTo 1)

[<Fact>]
let ``cachedGraph sources on miss, then serves from cache within TTL (respects the source)`` () =
    let c0 = TtlCache.empty
    let g1, c1 = F.cachedGraph 1000L 500L "imdb:costar" 4 7 principals c0
    TtlCache.liveCount 1000L c1 |> should equal 1 // populated
    let g2, _ = F.cachedGraph 1200L 500L "imdb:costar" 4 7 principals c1 // within TTL → cache hit
    g1.Identity |> should equal g2.Identity
    g2.N |> should equal 4

[<Fact>]
let ``the pipeline is deterministic (DST) — same principals/seed → same report`` () =
    let a = F.report 4 7 "nm0001" principals
    let b = F.report 4 7 "nm0001" principals
    a.Links |> should equal b.Links
    a.Health |> should equal b.Health
