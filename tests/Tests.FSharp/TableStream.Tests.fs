module Zeta.Tests.TableStreamTests

open global.Xunit
open Zeta.Core
open Zeta.Core.TableStream

[<Fact>]
let ``table = fold(stream): deltas materialize to current state`` () =
    let s = [ Upsert("a", "1"); Upsert("b", "2"); Upsert("a", "3"); Retract "b" ]
    let t = toTable s
    Assert.Equal("3", t.["a"])
    Assert.False(t.ContainsKey "b")

[<Fact>]
let ``duality: toTable (toStream t) = t`` () =
    let t = Map [ "a", "1"; "b", "2"; "c", "3" ]
    Assert.Equal<Table>(t, toTable (toStream t))

[<Fact>]
let ``toStream is deterministic: keys ordinal-sorted`` () =
    let t = Map [ "b", "2"; "a", "1" ]
    Assert.Equal<Stream>([ Upsert("a", "1"); Upsert("b", "2") ], toStream t)

[<Fact>]
let ``idempotency: applying the same upsert twice == once`` () =
    Assert.Equal<Table>(toTable [ Upsert("a", "1") ], toTable [ Upsert("a", "1"); Upsert("a", "1") ])

[<Fact>]
let ``meta events live on the SAME stream as data; toMeta folds only them`` () =
    // #7032: stream-metadata is an event within the same stream as the data (in-band).
    let s = [ Upsert("a", "1"); Meta("schema", "v2"); Upsert("b", "2"); Meta("owner", "aaron") ]
    let data = toTable s
    let meta = toMeta s
    // data view sees only data events
    Assert.Equal<string list>([ "a"; "b" ], data |> Map.toList |> List.map fst)
    // meta view sees only meta events — same one stream
    Assert.Equal("v2", meta.["schema"])
    Assert.Equal("aaron", meta.["owner"])
    Assert.False(meta.ContainsKey "a")
