module Zeta.Tests.FSharp.Yaml.ReaderTests

// L1 reader facts (one per canonical vector, hard-coded expected YamlEvent list straight
// from tests/cross-verification/yaml/vectors.json) + decline-path facts + a handful of L2
// DOM facts. The cross-language oracle is vectors.json; these facts re-assert the same 10
// expected arrays in F# so the reader is verified independently of the cross-verify file IO.

open Xunit
open Zeta.Core.FSharp.Yaml
open Zeta.Core.FSharp.Yaml.Dom

// Convenience constructors keeping the expected-event arrays terse + readable.
let private ss = StreamStart
let private se = StreamEnd
let private ms = MappingStart
let private me = MappingEnd
let private seqs = SequenceStart
let private seqe = SequenceEnd
let private sc raw kind style = Scalar(raw, kind, style)
let private key raw = Scalar(raw, Str, Plain)

let private ok (text: string) : YamlEvent list =
    match readEvents text with
    | Ok events -> events
    | Error f -> failwithf "expected Ok, got Error %A" f

// --- Canonical vectors (L1) ---------------------------------------------------------

[<Fact>]
let ``vector empty-map-value`` () =
    Assert.Equal<YamlEvent list>(
        [ ss; ms; key "a"; sc "" Null Plain; me; se ],
        ok "a:\n"
    )

[<Fact>]
let ``vector flat-scalars`` () =
    Assert.Equal<YamlEvent list>(
        [ ss
          ms
          key "name"; sc "zeta" Str Plain
          key "count"; sc "42" Int Plain
          key "ratio"; sc "3.14" Float Plain
          key "ok"; sc "true" Bool Plain
          key "gone"; sc "null" Null Plain
          me
          se ],
        ok "name: zeta\ncount: 42\nratio: 3.14\nok: true\ngone: null\n"
    )

[<Fact>]
let ``vector quoted-forces-string`` () =
    Assert.Equal<YamlEvent list>(
        [ ss
          ms
          key "a"; sc "42" Str DoubleQuoted
          key "b"; sc "3.14" Str SingleQuoted
          me
          se ],
        ok "a: \"42\"\nb: '3.14'\n"
    )

[<Fact>]
let ``vector double-quote-escapes`` () =
    Assert.Equal<YamlEvent list>(
        [ ss
          ms
          key "msg"; sc "he said \"hi\"\nbye" Str DoubleQuoted
          me
          se ],
        ok "msg: \"he said \\\"hi\\\"\\nbye\"\n"
    )

[<Fact>]
let ``vector single-quote-escape`` () =
    Assert.Equal<YamlEvent list>(
        [ ss; ms; key "a"; sc "it's" Str SingleQuoted; me; se ],
        ok "a: 'it''s'\n"
    )

[<Fact>]
let ``vector nested-map`` () =
    Assert.Equal<YamlEvent list>(
        [ ss
          ms
          key "outer"
          ms
          key "inner"; sc "1" Int Plain
          me
          me
          se ],
        ok "outer:\n  inner: 1\n"
    )

[<Fact>]
let ``vector sequence`` () =
    Assert.Equal<YamlEvent list>(
        [ ss; seqs; sc "a" Str Plain; sc "b" Str Plain; seqe; se ],
        ok "- a\n- b\n"
    )

[<Fact>]
let ``vector sequence-of-maps`` () =
    Assert.Equal<YamlEvent list>(
        [ ss
          ms
          key "items"
          seqs
          ms
          key "id"; sc "x" Str Plain
          key "n"; sc "1" Int Plain
          me
          ms
          key "id"; sc "y" Str Plain
          key "n"; sc "2" Int Plain
          me
          seqe
          me
          se ],
        ok "items:\n  - id: x\n    n: 1\n  - id: y\n    n: 2\n"
    )

[<Fact>]
let ``vector comments`` () =
    Assert.Equal<YamlEvent list>(
        [ ss
          ms
          key "a"; sc "1" Int Plain
          key "b"; sc "2" Int Plain
          me
          se ],
        ok "# top\na: 1  # trail\nb: 2\n"
    )

[<Fact>]
let ``vector null-forms-and-strings`` () =
    Assert.Equal<YamlEvent list>(
        [ ss
          ms
          key "a"; sc "~" Null Plain
          key "b"; sc "" Null Plain
          key "c"; sc "12abc" Str Plain
          key "d"; sc "-2.5" Float Plain
          me
          se ],
        ok "a: ~\nb:\nc: 12abc\nd: -2.5\n"
    )

// --- Decline paths ------------------------------------------------------------------

[<Fact>]
let ``decline tab indentation`` () =
    Assert.Equal(Error TabIndentation, readEvents "\tx: 1\n")

[<Fact>]
let ``decline unterminated quote`` () =
    Assert.Equal(Error UnterminatedQuote, readEvents "a: \"unterminated\n")

[<Fact>]
let ``decline unsupported anchor`` () =
    Assert.Equal(Error UnsupportedConstruct, readEvents "a: &x\n")

[<Fact>]
let ``decline unsupported flow seq`` () =
    Assert.Equal(Error UnsupportedConstruct, readEvents "a: [1, 2]\n")

[<Fact>]
let ``decline document marker`` () =
    Assert.Equal(Error UnsupportedConstruct, readEvents "---\na: 1\n")

[<Fact>]
let ``decline bad double-quote escape`` () =
    Assert.Equal(Error UnexpectedCharacter, readEvents "a: \"x\\qy\"\n")

// --- L2 DOM facts (fold over the event stream) --------------------------------------

let private domOk (text: string) : YamlValue =
    match Dom.parse text with
    | Ok v -> v
    | Error f -> failwithf "expected Ok, got Error %A" f

[<Fact>]
let ``dom flat-scalars typed`` () =
    Assert.Equal<YamlValue>(
        VMap [ ("name", VStr "zeta")
               ("count", VInt 42L)
               ("ratio", VFloat 3.14)
               ("ok", VBool true)
               ("gone", VNull) ],
        domOk "name: zeta\ncount: 42\nratio: 3.14\nok: true\ngone: null\n"
    )

[<Fact>]
let ``dom nested-map`` () =
    Assert.Equal<YamlValue>(
        VMap [ ("outer", VMap [ ("inner", VInt 1L) ]) ],
        domOk "outer:\n  inner: 1\n"
    )

[<Fact>]
let ``dom sequence`` () =
    Assert.Equal<YamlValue>(VSeq [ VStr "a"; VStr "b" ], domOk "- a\n- b\n")

[<Fact>]
let ``dom sequence-of-maps`` () =
    Assert.Equal<YamlValue>(
        VMap [ ("items",
                VSeq [ VMap [ ("id", VStr "x"); ("n", VInt 1L) ]
                       VMap [ ("id", VStr "y"); ("n", VInt 2L) ] ]) ],
        domOk "items:\n  - id: x\n    n: 1\n  - id: y\n    n: 2\n"
    )

[<Fact>]
let ``dom map order preserved`` () =
    // Insertion order, not sorted: b before a.
    match domOk "b: 1\na: 2\n" with
    | VMap entries ->
        Assert.Equal("b", fst entries.[0])
        Assert.Equal("a", fst entries.[1])
    | other -> failwithf "expected VMap, got %A" other

[<Fact>]
let ``dom propagates decline`` () =
    Assert.Equal(Error TabIndentation, Dom.parse "\tx: 1\n")
