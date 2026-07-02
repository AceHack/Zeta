module Zeta.Tests.FrontmatterTests

// FRONTMATTER ⇄ VALUE-TREE split (shadow*, Aaron 2026-07-02: "very similar to frontmatter,
// same kind of graph … one graph, many surfaces"). The metadata⊕payload shape: a head
// between `---` fences + a body ↔ Object [ head; body ], head kept VERBATIM. Proofs:
//   1. LOSSLESS BIJECTION — parse (render vt) = vt on ANY frontmatter (head verbatim).
//   2. NO-FENCE ⇔ EMPTY HEAD — a plain string is empty-head body; render of empty head is
//      the plain body (the inverses agree).
//   3. CONCRETE PARSE — a literal document splits into the expected verbatim head + body.
//   4. BEST-EFFORT tryMeta — canonical YAML head parses to a tree; a human YAML head returns
//      a clean Error (HONEST: strict-canonical codec; lenient parsing awaits the combinator layer).
//   5. RIDES THE CODEC STACK — the split tree cross-verifies through parity-json/cbor/asn1.
//
// Anchor: the metadata⊕payload frame shared with EventEnvelope; §8 of the codec-ports doctrine.

open global.Xunit
open Zeta.Core

module FM = Frontmatter
module VTC = ValueTreeCodec

let private doc: DynamicValue =
    FM.make "title: The Anchor Taxonomy\norder: 7" "# Body\n\nSome markdown with a [[link]]."

[<Fact>]
let ``LOSSLESS BIJECTION: parse (render doc) = doc (head verbatim)`` () =
    match FM.render doc |> Result.bind FM.parse with
    | Ok rt -> Assert.Equal(doc, rt)
    | Error e -> Assert.Fail(sprintf "round-trip failed: %s" e)

[<Fact>]
let ``NO-FENCE ⇔ EMPTY HEAD: a plain string is empty-head body; render of empty head is the plain body`` () =
    let plain = "just a body\nno frontmatter here"
    match FM.parse plain with
    | Ok tree ->
        Assert.Equal(Some(DynamicValue.String ""), DynamicValue.tryField "head" tree)
        Assert.Equal(Some(DynamicValue.String plain), DynamicValue.tryField "body" tree)
    | Error e -> Assert.Fail(sprintf "parse failed: %s" e)
    Assert.Equal(Ok "just a body", FM.render (FM.make "" "just a body"))

[<Fact>]
let ``CONCRETE PARSE: a literal document splits into the expected verbatim head and body`` () =
    let literal = "---\ntitle: Foo\ncount: 3\n---\nHello body\n"
    match FM.parse literal with
    | Ok tree ->
        Assert.Equal(Some(DynamicValue.String "title: Foo\ncount: 3"), DynamicValue.tryField "head" tree)
        match DynamicValue.tryField "body" tree with
        | Some(DynamicValue.String b) -> Assert.StartsWith("Hello body", b)
        | _ -> Assert.Fail "missing body"
    | Error e -> Assert.Fail(sprintf "parse failed: %s" e)

[<Fact>]
let ``an opening fence with no closing fence is a clean Error, not a crash`` () =
    Assert.True(
        (match FM.parse "---\ntitle: Foo\nno closing fence" with
         | Error _ -> true
         | Ok _ -> false)
    )

[<Fact>]
let ``BEST-EFFORT tryMeta: canonical YAML head parses; human YAML head is a clean Error (honest boundary)`` () =
    // A head that IS our canonical YAML (produced by toYaml) parses back to its tree.
    let tree = DynamicValue.Object [ "k", DynamicValue.String "v"; "n", DynamicValue.Int 2L ]
    let canonicalHead =
        match DynamicValue.toYaml tree with
        | Ok s -> s
        | Error e -> failwithf "toYaml: %A" e
    match FM.tryMeta (FM.make canonicalHead "body") with
    | Ok meta -> Assert.Equal(tree, meta)
    | Error e -> Assert.Fail(sprintf "canonical head should parse: %s" e)
    // A human (non-canonical) YAML head returns a clean Error — the honest boundary, not a crash.
    Assert.True(
        (match FM.tryMeta (FM.make "title: Foo\ncount: 3" "body") with
         | Error _ -> true
         | Ok _ -> false)
    )

[<Fact>]
let ``RIDES THE CODEC STACK: a frontmatter split tree cross-verifies through parity-json, cbor, parity-asn1`` () =
    let codecs = [ VTC.parity VTC.json; VTC.cbor; VTC.parity VTC.asn1 ]
    Assert.Empty(VTC.crossVerify codecs doc)
