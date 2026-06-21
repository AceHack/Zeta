module Zeta.Tests.FSharp.Yaml.EncoderRoundTripTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core.FSharp.Yaml.Dom
open Zeta.Core.FSharp.Yaml.Encoder

// 081KT5CF90008QG0R001P4CQ09 — the canonical YAML encoder is a true inverse of the parser:
// Dom.parse (encode v) = Ok v. YAML is the standard STORAGE format (everything is
// stored in YAML), so it needs full rigor — canonical + (later) cross-language
// agreement, NOT merely round-trip. The CBOR byte-lock is moot if the data lives
// in YAML (Aaron 2026-06-04). Round-trip is step 1; the full format-agreement
// matrix (every format-pair agrees + converts losslessly, byte + parse level) is
// the larger owed work.

let private roundtrips (v: YamlValue) : bool =
    match parse (encode v) with
    | Ok back -> back = v
    | Error _ -> false

// Scalars are tested as map VALUES (the real storage form). The block parser does
// not accept a top-level BARE scalar document (null/0/true/"x" alone all fail with
// UnsupportedConstruct — plain or quoted); a document must be a mapping or sequence.
// That is an owed PARSER gap (081KT5CF90008QG0R001P4CQ09), orthogonal to the encoder, which is correct.
[<Fact>]
let ``scalars round-trip as map values`` () =
    for v in [ VNull; VBool true; VBool false; VInt 0L; VInt -7L; VInt 9000000000L
               VFloat 1.0; VFloat 3.14; VFloat -2.5 ] do
        roundtrips (VMap [ "v", v ]) |> should equal true

// Strings are exercised as MAP VALUES (the real storage case — configs are maps).
// A top-level BARE quoted scalar document ("123" alone) is a known parser gap
// (the block reader handles top-level plain scalars but not quoted ones — 081KT5CF90008QG0R001P4CQ09);
// values/keys/items all round-trip, which is what real storage uses.
[<Fact>]
let ``ambiguous strings stay strings as map values (quoted, not auto-resolved)`` () =
    for s in [ "123"; "-7"; "1.0"; "true"; "false"; "null"; ""; "  spaced  "
               "a: b"; "# not a comment"; "- dash"; "[bracket"; "{brace"; "&anchor" ] do
        roundtrips (VMap [ "v", VStr s ]) |> should equal true

[<Fact>]
let ``strings with escapes round-trip as map values`` () =
    for s in [ "line\nbreak"; "tab\tsep"; "quote\"here"; "back\\slash"; "ret\rurn"; "nul\000byte" ] do
        roundtrips (VMap [ "v", VStr s ]) |> should equal true

[<Fact>]
let ``flat map preserves insertion order + mixed scalar values`` () =
    let m = VMap [ "z", VInt 1L; "a", VStr "x"; "m", VBool true; "n", VNull ]
    roundtrips m |> should equal true
    match parse (encode m) with
    | Ok(VMap pairs) -> pairs |> List.map fst |> should equal [ "z"; "a"; "m"; "n" ]
    | _ -> failwith "expected map"

[<Fact>]
let ``sequences + nesting round-trip`` () =
    for v in [ VSeq [ VInt 1L; VInt 2L; VStr "three" ]
               VMap [ "outer", VMap [ "inner", VInt 5L ] ]
               VMap [ "list", VSeq [ VInt 1L; VInt 2L ] ]
               VSeq [ VMap [ "a", VInt 1L ]; VMap [ "b", VInt 2L ] ]
               VMap [ "deep", VSeq [ VMap [ "k", VSeq [ VStr "x"; VStr "y" ] ] ] ] ] do
        roundtrips v |> should equal true

[<Fact>]
let ``canonical: same value encodes to the same bytes every time (determinism)`` () =
    let v = VMap [ "b", VInt 2L; "a", VSeq [ VStr "x"; VBool true ] ]
    encode v |> should equal (encode v)
