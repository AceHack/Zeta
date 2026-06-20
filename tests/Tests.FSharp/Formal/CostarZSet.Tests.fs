module Zeta.Tests.Formal.CostarZSetTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

module Z = Zeta.Core.CostarZSet
module I = Zeta.Core.ImdbDataset

// ═══════════════════════════════════════════════════════════════════
// CostarZSet — the co-star link-set as a DBSP ZSet: reverse-mint = a
// ZSet fold (weight = shared-title count); add/remove-title = deltas
// (IVM correctness + Z-set antiparticle); link DynamicValue rides
// SchemaEvolution for zero-downtime schema change.
// ═══════════════════════════════════════════════════════════════════

let private baseLines =
    [ "tconst\tordering\tnconst\tcategory\tjob\tcharacters"
      "tt001\t1\tnm0001\tactor\t\\N\t\\N"
      "tt001\t2\tnm0002\tactress\t\\N\t\\N"
      "tt002\t1\tnm0002\tactress\t\\N\t\\N"
      "tt002\t2\tnm0003\tactor\t\\N\t\\N" ]

let private tt003 = [ "tt003\t1\tnm0003\tactor\t\\N\t\\N"; "tt003\t2\tnm0004\tactor\t\\N\t\\N" ]

[<Fact>]
let ``reverse-mint AS a ZSet: a link's weight is its shared-title count`` () =
    let withRepeat =
        I.parsePrincipals (
            baseLines
            @ [ "tt004\t1\tnm0001\tactor\t\\N\t\\N"; "tt004\t2\tnm0002\tactress\t\\N\t\\N" ]
        ) // a SECOND nm0001–nm0002 title
    let z = Z.ofPrincipals withRepeat
    Z.sharedTitles "nm0001" "nm0002" z |> should equal 2L // tt001 + tt004
    Z.sharedTitles "nm0002" "nm0003" z |> should equal 1L
    Z.sharedTitles "nm0001" "nm9999" z |> should equal 0L // absent → 0

[<Fact>]
let ``incremental addTitle equals a full recompute (DBSP IVM correctness)`` () =
    let incremental = Z.ofPrincipals (I.parsePrincipals baseLines) |> Z.addTitle [ "nm0003"; "nm0004" ]
    let full = Z.ofPrincipals (I.parsePrincipals (baseLines @ tt003))
    incremental |> should equal full

[<Fact>]
let ``removeTitle retracts (the Z-set antiparticle): add then remove = identity`` () =
    let baseZ = Z.ofPrincipals (I.parsePrincipals baseLines)
    let roundTrip = baseZ |> Z.addTitle [ "nm0003"; "nm0004" ] |> Z.removeTitle [ "nm0003"; "nm0004" ]
    roundTrip |> should equal baseZ

[<Fact>]
let ``the link DynamicValue rides SchemaEvolution: additive expand then contract round-trips (zero-downtime)`` () =
    let dv = Z.toDynamicValue 2L ({ A = "nm0001"; B = "nm0002" }: Z.Link)
    let expanded = SchemaEvolution.addField "medium" (DynamicValue.String "film") dv
    expanded |> should not' (equal dv) // the new field is present (expand)
    let contracted = SchemaEvolution.removeField "medium" expanded
    contracted |> should equal dv // expand → contract is identity on the core (no data loss)
