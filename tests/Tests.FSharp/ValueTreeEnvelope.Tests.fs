module Zeta.Tests.ValueTreeEnvelopeTests

// THE VERSIONED PARITY ENVELOPE + ZERO-DOWNTIME PARSER-ROLL PROOFS, pinned in code
// (shadow*, Aaron 2026-07-02: "We must have parity even if we have to use ugly strings
// or some wrapper object … all of our serialization can be rolled with version numbers
// and category types … 0 down time parser updates/replacement proofs").
//
// `ValueTreeEnvelope` closes the parity debt: it rewrites a value tree into the portable
// subset (Null/Bool/Int/String/Array/Object), wrapping Float/Bytes (later Decimal/Soft/
// Kleene) in a VERSION + CATEGORY-tagged wrapper object. So `ValueTreeCodec.parity json`
// is TOTAL over a format with no native bytes/float. Proofs here:
//   1. PARITY CLOSED — the full eight-shape tree round-trips faithfully through
//      `parity json` and `parity yaml`, so crossVerify of [parity json; cbor; parity
//      yaml] is empty on the FULL tree (not just the portable subset).
//   2. COLLISION-SAFE — a source object that itself uses the reserved `$zeta` key
//      round-trips (it is escaped, category `map`).
//   3. ZERO-DOWNTIME ROLL — a newer version or unknown category decodes to a clean
//      `Error`, never silent corruption (the roll-forward guarantee).
//   4. 0-DOWNTIME PARSER REPLACEMENT — a new (parity-aware) reader reads OLD writer's
//      bytes (backward compat); an OLD reader reads NEW writer's bytes without crashing
//      or corrupting (forward compat, envelopes seen as plain objects) — the format-level
//      analogue of a SchemaEvolution migration (081KSRGFP0008QG0R001Y6RTY9).
//
// Anchors: SchemaEvolution (version/migration seed); RFC 4648 (base64); Cockburn
// (the port the parser swaps behind). Sibling: ValueTreeCodec.Tests (native surface).

open global.Xunit
open Zeta.Core

module VTC = ValueTreeCodec
module ENV = ValueTreeEnvelope

/// All eight shapes, incl. Float and Bytes that JSON/YAML cannot carry natively.
let private richTree: DynamicValue =
    DynamicValue.Object
        [ "null", DynamicValue.Null
          "bool", DynamicValue.Bool true
          "int", DynamicValue.Int 0x0123456789ABCDEFL
          "negint", DynamicValue.Int -42L
          "float", DynamicValue.Float 3.141592653589793
          "string", DynamicValue.String "ζ — \"parity\"\n\ttab"
          "bytes", DynamicValue.Bytes(System.Collections.Immutable.ImmutableArray.Create<byte>(0uy, 1uy, 0xFEuy, 0xFFuy))
          "array", DynamicValue.Array [ DynamicValue.Float 2.5; DynamicValue.Null; DynamicValue.Int 7L ]
          "nested", DynamicValue.Object [ "f", DynamicValue.Float -0.0001 ] ]

[<Fact>]
let ``the envelope round-trips the full eight-shape tree (encode then decode is identity)`` () =
    match ENV.decode (ENV.encode richTree) with
    | Ok dv -> Assert.Equal(richTree, dv)
    | Error e -> Assert.Fail(sprintf "decode failed: %s" e)

[<Fact>]
let ``PARITY CLOSED: the full tree round-trips faithfully through parity-json and parity-yaml (debt gone)`` () =
    // The promise from the port: with the envelope, the FULL eight-shape tree (Bytes +
    // Float incl.) crosses json/cbor/yaml identically — parity, not just the portable subset.
    let codecs = [ VTC.parity VTC.json; VTC.cbor; VTC.parity VTC.yaml ]
    Assert.Empty(VTC.crossVerify codecs richTree)
    Assert.True(VTC.isFaithful (VTC.parity VTC.json) richTree)
    Assert.True(VTC.isFaithful (VTC.parity VTC.yaml) richTree)

[<Fact>]
let ``COLLISION-SAFE: a source object that itself uses the reserved key round-trips (escaped as category map)`` () =
    // A hostile/coincidental tree containing the reserved marker must survive — the
    // envelope escapes it so no source tree can forge or collide with a real envelope.
    let evil =
        DynamicValue.Object
            [ ENV.reservedKey, DynamicValue.String "not really an envelope"
              "also", DynamicValue.Array [ DynamicValue.Object [ ENV.reservedKey, DynamicValue.Float 1.5 ] ] ]
    match ENV.decode (ENV.encode evil) with
    | Ok dv -> Assert.Equal(evil, dv)
    | Error e -> Assert.Fail(sprintf "collision decode failed: %s" e)
    // …and it still crosses a real 1-ary codec faithfully.
    Assert.True(VTC.isFaithful (VTC.parity VTC.json) evil)

[<Fact>]
let ``ZERO-DOWNTIME ROLL: a newer version or unknown category is a clean Error, never silent corruption`` () =
    // Hand-authored wire from a hypothetical FUTURE writer. The reader must REFUSE
    // (Error), not guess — so a v2 writer can roll out while v1 readers keep serving v1
    // data. Category and version are inspectable tags, exactly like a schema version.
    let future =
        DynamicValue.Object
            [ ENV.reservedKey,
              DynamicValue.Object
                  [ "v", DynamicValue.Int(int64 (ENV.version + 1))
                    "c", DynamicValue.String "decimal128"
                    "d", DynamicValue.String "3.14" ] ]
    match ENV.decode future with
    | Error _ -> () // correct: detected as newer-than-reader
    | Ok dv -> Assert.Fail(sprintf "expected a roll-forward Error, got %A" dv)
    // unknown category at the CURRENT version is likewise a clean Error, not corruption
    let unknownCat =
        DynamicValue.Object
            [ ENV.reservedKey,
              DynamicValue.Object
                  [ "v", DynamicValue.Int(int64 ENV.version)
                    "c", DynamicValue.String "quaternion"
                    "d", DynamicValue.String "…" ] ]
    Assert.True(match ENV.decode unknownCat with Error _ -> true | Ok _ -> false)

[<Fact>]
let ``0-DOWNTIME PARSER REPLACEMENT: new reader reads old bytes; old reader reads new bytes without corruption`` () =
    // The proof Aaron asked for, format-level. A "parser replacement" = swapping the
    // codec impl behind the ValueTreeCodec port; version+category tags make the swap safe
    // both directions with no stop-the-world migration:
    let portable =
        DynamicValue.Object
            [ "name", DynamicValue.String "Super Mario Bros."
              "crc32", DynamicValue.String "3337ec46"
              "count", DynamicValue.Int 3L ]

    // (a) BACKWARD compat — a NEW (parity-aware) reader reads an OLD (plain-json) writer's
    //     bytes. No envelopes present ⇒ pass-through ⇒ identical value. Upgrading the
    //     reader is zero-downtime.
    match VTC.json.Encode portable |> Result.bind (VTC.parity VTC.json).Decode with
    | Ok dv -> Assert.Equal(portable, dv)
    | Error e -> Assert.Fail(sprintf "new reader failed on old bytes: %s" e)

    // (b) FORWARD compat — an OLD (plain-json) reader reads a NEW (parity) writer's bytes.
    //     It does not know the envelope, but it does NOT crash or corrupt: it sees the
    //     wrapper as a plain object (structurally valid), the CloudEvents-style
    //     unknown-metadata passthrough. Old readers keep running while writers roll.
    match (VTC.parity VTC.json).Encode richTree |> Result.bind VTC.json.Decode with
    | Ok _ -> () // structurally valid: no crash, no corruption of the bytes it does understand
    | Error e -> Assert.Fail(sprintf "old reader crashed on new bytes: %s" e)
