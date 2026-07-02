module Zeta.Tests.EventEnvelopeTests

// EVENT ENVELOPES — CloudEvents / Debezium as metadata⊕payload categories on the value-tree
// port (shadow*, Aaron 2026-07-02: "we want cloud events/debezium envelopes too … one graph,
// many surfaces"; "yes on next slice — either both").
//
// Proofs:
//   1. CloudEvents 1.0 — the constructor carries the four required context attributes;
//      validate passes on a well-formed event and fails (naming the gap) on a missing one.
//   2. Debezium op ≈ Z-SET WEIGHT — create/read ASSERT (+1), delete RETRACTS (−1), update is
//      retract-then-assert (−1 then +1). The distinctive Zeta content: a CDC envelope folds
//      straight into DBSP Z-set deltas.
//   3. ENVELOPES RIDE THE WHOLE CODEC STACK — an event is just a value tree, so it round-trips
//      through parity-json / cbor / parity-asn1 identically (no new codec; a shape on the port).
//
// Anchors: CloudEvents (CNCF spec 1.0); Debezium (CDC); Z-set/DBSP (retraction = correction).

open global.Xunit
open Zeta.Core

module EE = EventEnvelope
module VTC = ValueTreeCodec

[<Fact>]
let ``CloudEvents 1.0: constructor carries required context attributes; validate accepts it`` () =
    let ev =
        EE.cloudEvent "id-42" "zeta://meter/cosem/7" "com.zeta.reading" (DynamicValue.Int 240L)
    Assert.Equal(Ok(), EE.validateCloudEvent ev)
    Assert.Equal(Some(DynamicValue.String "1.0"), DynamicValue.tryField "specversion" ev)
    Assert.Equal(Some(DynamicValue.String "id-42"), DynamicValue.tryField "id" ev)
    Assert.Equal(Some(DynamicValue.Int 240L), DynamicValue.tryField "data" ev)

[<Fact>]
let ``CloudEvents validate fails and names the gap when a required attribute is missing`` () =
    // an Object with no `source`/`type` — validate must reject and say which are missing
    let bad = DynamicValue.Object [ "specversion", DynamicValue.String "1.0"; "id", DynamicValue.String "x" ]
    match EE.validateCloudEvent bad with
    | Error msg ->
        Assert.Contains("source", msg)
        Assert.Contains("type", msg)
    | Ok() -> Assert.Fail "validate must reject a CloudEvent missing required attributes"
    // a non-object is likewise rejected
    Assert.True(
        (match EE.validateCloudEvent (DynamicValue.Int 1L) with
         | Error _ -> true
         | Ok _ -> false)
    )

[<Fact>]
let ``Debezium op is a Z-set weight: create/read = +1 assert, delete = -1 retract, update = -1 then +1`` () =
    let before = DynamicValue.Object [ "v", DynamicValue.Int 1L ]
    let after = DynamicValue.Object [ "v", DynamicValue.Int 2L ]
    let src = DynamicValue.String "zeta://db/meters"
    let z op = EE.debeziumToZSet (EE.debeziumEnvelope before after op src)
    Assert.Equal<Result<(DynamicValue * int) list, string>>(Ok [ after, +1 ], z EE.Create)
    Assert.Equal<Result<(DynamicValue * int) list, string>>(Ok [ after, +1 ], z EE.Read)
    Assert.Equal<Result<(DynamicValue * int) list, string>>(Ok [ before, -1 ], z EE.Delete)
    Assert.Equal<Result<(DynamicValue * int) list, string>>(Ok [ before, -1; after, +1 ], z EE.Update)

[<Fact>]
let ``Debezium update NETS to the after-row: -1 before + +1 after leaves weight 0 on before, +1 on after`` () =
    // the Z-set correction discipline — an update is not a duplicate; before is retracted.
    let before = DynamicValue.String "old"
    let after = DynamicValue.String "new"
    let src = DynamicValue.Null
    match EE.debeziumToZSet (EE.debeziumEnvelope before after EE.Update src) with
    | Ok deltas ->
        let net r = deltas |> List.filter (fun (row, _) -> row = r) |> List.sumBy snd
        Assert.Equal(-1, net before) // before-row retracted
        Assert.Equal(+1, net after) // after-row asserted
    | Error e -> Assert.Fail(sprintf "unexpected: %s" e)

[<Fact>]
let ``unknown or missing Debezium op is a clean Error`` () =
    Assert.True(
        (match EE.parseOp "x" with
         | Error _ -> true
         | Ok _ -> false)
    )
    let noOp = DynamicValue.Object [ "before", DynamicValue.Null; "after", DynamicValue.Null ]
    Assert.True(
        (match EE.debeziumToZSet noOp with
         | Error _ -> true
         | Ok _ -> false)
    )

[<Fact>]
let ``ENVELOPES RIDE THE WHOLE CODEC STACK: a CloudEvent / Debezium tree round-trips through parity-json, cbor, parity-asn1`` () =
    // An event is just a value tree ⇒ it inherits every codec on the port; no new codec.
    let ce =
        EE.cloudEvent "e1" "zeta://svc/a" "com.zeta.reading" (DynamicValue.Array [ DynamicValue.Int 1L; DynamicValue.Bool true ])
    let dbz =
        EE.debeziumEnvelope
            (DynamicValue.Object [ "v", DynamicValue.Int 1L ])
            (DynamicValue.Object [ "v", DynamicValue.Int 2L ])
            EE.Update
            (DynamicValue.String "zeta://db/x")
    let codecs = [ VTC.parity VTC.json; VTC.cbor; VTC.parity VTC.asn1 ]
    Assert.Empty(VTC.crossVerify codecs ce)
    Assert.Empty(VTC.crossVerify codecs dbz)
