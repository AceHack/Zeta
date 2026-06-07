module Zeta.Tests.DvKeyTests

open global.Xunit
open Zeta.Core

module CDC = Zeta.Core.DebeziumCdc

let private row (kvs: (string * DynamicValue) list) = DvKey.ofValue (DynamicValue.Object kvs)

[<Fact>]
let ``equal DynamicValue rows give equal keys; distinct give distinct keys`` () =
    let a = row [ "id", DynamicValue.Int 1L; "name", DynamicValue.String "x" ]
    let a2 = row [ "id", DynamicValue.Int 1L; "name", DynamicValue.String "x" ]
    let b = row [ "id", DynamicValue.Int 2L; "name", DynamicValue.String "x" ]
    Assert.Equal<DvKey>(a, a2)
    Assert.Equal(a.GetHashCode(), a2.GetHashCode())
    Assert.NotEqual<DvKey>(a, b)

[<Fact>]
let ``DvKey rows work as ZSet keys (DynamicValue rows in a Z-set)`` () =
    let z = ZSet.ofSeq [ row [ "id", DynamicValue.Int 1L ], 1L; row [ "id", DynamicValue.Int 2L ], 1L ]
    Assert.Equal(2, z.Count)
    Assert.Equal(1L, ZSet.lookup (row [ "id", DynamicValue.Int 1L ]) z)

[<Fact>]
let ``Debezium change events over DynamicValue rows convert to Z-set deltas (end-to-end)`` () =
    let before = row [ "id", DynamicValue.Int 1L; "v", DynamicValue.String "old" ]
    let after = row [ "id", DynamicValue.Int 1L; "v", DynamicValue.String "new" ]
    // an update of a DynamicValue row = retract old + insert new
    Assert.Equal<ZSet<DvKey>>(ZSet.ofSeq [ before, -1L; after, 1L ], CDC.toZSetDelta (CDC.update before after))
    // and the delta round-trips at the delta level
    let delta = CDC.toZSetDelta (CDC.create after)
    let rt = CDC.ofZSetDelta delta |> List.map CDC.toZSetDelta |> List.fold (+) ZSet.Empty
    Assert.Equal<ZSet<DvKey>>(delta, rt)
