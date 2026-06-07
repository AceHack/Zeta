module Zeta.Tests.CloudEventsTests

open global.Xunit
open Zeta.Core

module CE = Zeta.Core.CloudEvents

[<Fact>]
let ``create yields a valid v1.0 event; validate catches a missing required attribute`` () =
    let e = CE.create "id-1" "/zeta/source" "com.zeta.change" (Some(DynamicValue.Int 7L))
    Assert.Equal("1.0", e.SpecVersion)
    Assert.Equal<Result<unit, string>>(Ok(), CE.validate e)
    match CE.validate { e with Id = "" } with
    | Error msg -> Assert.Contains("id", msg)
    | Ok () -> Assert.Fail "expected missing-id error"

[<Fact>]
let ``toDynamic ∘ ofDynamic round-trips (required + optionals + extensions + data)`` () =
    let e =
        { CE.create "id-2" "/s" "t" (Some(DynamicValue.String "payload")) with
            Time = Some "2026-06-07T00:00:00Z"
            DataSchema = Some "schema://v2"
            Extensions = [ "iodebeziumop", "c"; "traceparent", "abc" ] }
    Assert.Equal<Result<CE.CloudEvent, string>>(Ok e, CE.ofDynamic (CE.toDynamic e))

[<Fact>]
let ``ofDynamic rejects a non-object and an object missing required attributes`` () =
    Assert.True(match CE.ofDynamic (DynamicValue.Int 1L) with Error _ -> true | _ -> false)
    Assert.True(
        match CE.ofDynamic (DynamicValue.Object [ "id", DynamicValue.String "x" ]) with
        | Error _ -> true
        | _ -> false
    ) // missing source/type

[<Fact>]
let ``unknown string keys become extension attributes, core keys do not`` () =
    let dv =
        DynamicValue.Object
            [ "specversion", DynamicValue.String "1.0"
              "id", DynamicValue.String "i"
              "source", DynamicValue.String "s"
              "type", DynamicValue.String "t"
              "myext", DynamicValue.String "v"
              "data", DynamicValue.Int 5L ]
    match CE.ofDynamic dv with
    | Ok e ->
        Assert.Equal<(string * string) list>([ "myext", "v" ], e.Extensions)
        Assert.Equal<DynamicValue option>(Some(DynamicValue.Int 5L), e.Data)
    | Error m -> Assert.Fail m
