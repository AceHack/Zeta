module Zeta.Tests.StoredProcTests

open global.Xunit
open Zeta.Core
open Zeta.Core.TableStream
open Zeta.Core.StoredProc

let private dv (s: string) = DynamicValue.String s

// the deltas exercised by the differential check (data + meta + non-string value)
let private deltas =
    [ Upsert("a", dv "1")
      Upsert("count", DynamicValue.Int 42L)
      Retract "a"
      Meta("schema", dv "v2") ]

[<Fact>]
let ``encode/decode round-trips every delta`` () =
    for d in deltas do
        Assert.Equal<Result<Delta, string>>(Ok d, decodeDelta (encodeDelta d))

[<Fact>]
let ``DIFFERENTIAL: native applyDelta == interpreted stored-proc (the per-test, #7049)`` () =
    // Across several starting tables and every op, the F#-native fold and the independent interpreter agree.
    let tables =
        [ emptyTable
          Map [ "a", dv "old" ]
          Map [ "a", dv "x"; "count", DynamicValue.Int 1L ] ]

    for t in tables do
        for d in deltas do
            let native = applyDelta t d
            let interpreted =
                match interpretApply t (encodeDelta d) with
                | Ok r -> r
                | Error e -> failwithf "interpret failed: %s" e
            Assert.Equal<Table>(native, interpreted)

[<Fact>]
let ``interpret surfaces a malformed stored-proc as Error (no silent failure)`` () =
    Assert.True(
        match interpretApply emptyTable (DynamicValue.String "not-an-object") with
        | Error _ -> true
        | Ok _ -> false
    )
    Assert.True(
        match interpretApply emptyTable (DynamicValue.Object [ "op", DynamicValue.String "frob" ]) with
        | Error _ -> true
        | Ok _ -> false
    )

[<Fact>]
let ``decode rejects an unknown op`` () =
    Assert.True(
        match decodeDelta (DynamicValue.Object [ "op", DynamicValue.String "frob"; "key", dv "k" ]) with
        | Error _ -> true
        | Ok _ -> false
    )
