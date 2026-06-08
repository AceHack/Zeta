module Zeta.Tests.TableStreamTests

open global.Xunit
open Zeta.Core
open Zeta.Core.TableStream

// homoiconic value helper: a DynamicValue.String (#7038 — values are DynamicValue, not string)
let private dv (s: string) = DynamicValue.String s

[<Fact>]
let ``table = fold(stream): deltas materialize to current state`` () =
    let s = [ Upsert("a", dv "1"); Upsert("b", dv "2"); Upsert("a", dv "3"); Retract "b" ]
    let t = toTable s
    Assert.Equal(dv "3", t.["a"])
    Assert.False(t.ContainsKey "b")

[<Fact>]
let ``duality: toTable (toStream t) = t`` () =
    let t = Map [ "a", dv "1"; "b", dv "2"; "c", dv "3" ]
    Assert.Equal<Table>(t, toTable (toStream t))

[<Fact>]
let ``toStream is deterministic: keys ordinal-sorted`` () =
    let t = Map [ "b", dv "2"; "a", dv "1" ]
    Assert.Equal<Stream>([ Upsert("a", dv "1"); Upsert("b", dv "2") ], toStream t)

[<Fact>]
let ``idempotency: applying the same upsert twice == once`` () =
    Assert.Equal<Table>(toTable [ Upsert("a", dv "1") ], toTable [ Upsert("a", dv "1"); Upsert("a", dv "1") ])

[<Fact>]
let ``values are homoiconic DynamicValue: int and string coexist on the same stream`` () =
    // #7038/#7041: a value is any DynamicValue (Int, String, ...), not just a string.
    let s = [ Upsert("count", DynamicValue.Int 42L); Upsert("name", dv "zeta") ]
    let t = toTable s
    Assert.Equal(DynamicValue.Int 42L, t.["count"])
    Assert.Equal(dv "zeta", t.["name"])

[<Fact>]
let ``meta events live on the SAME stream as data; toMeta folds only them`` () =
    // #7032: stream-metadata is an event within the same stream as the data (in-band).
    // #7038: meta values are the SAME DynamicValue shape as data values (homoiconic).
    let s = [ Upsert("a", dv "1"); Meta("schema", dv "v2"); Upsert("b", dv "2"); Meta("owner", dv "aaron") ]
    let data = toTable s
    let meta = toMeta s
    // data view sees only data events
    Assert.Equal<string list>([ "a"; "b" ], data |> Map.toList |> List.map fst)
    // meta view sees only meta events — same one stream, same value shape
    Assert.Equal(dv "v2", meta.["schema"])
    Assert.Equal(dv "aaron", meta.["owner"])
    Assert.False(meta.ContainsKey "a")
