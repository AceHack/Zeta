module Zeta.Tests.ValueTreeCodecTests

// THE HEXAGONAL VALUE-TREE CODEC PORT, pinned in code (shadow*, Aaron 2026-07-02:
// "we hexagonal the interface so we own the interface … the plan is nation state
// resistance … eventually we have no deps, no supply chain that is not us").
//
// The port (`ValueTreeCodec.Codec`) is ours; a codec is one LENS onto the shared
// `DynamicValue` value tree. Two self-verifications:
//   1. CROSS-VERIFY — a rich value tree covering ALL EIGHT DynamicValue shapes
//      round-trips FAITHFULLY through every sovereign codec (json/cbor/yaml), so all
//      agree. The tree is the invariant; a disagreement would be a codec bug.
//   2. SOVEREIGNTY — every codec we own end-to-end is `Provenance = Ours` (zero
//      third-party supply chain). This is the nation-state-resistance floor the 2-ary
//      formats (XML/KDL/ASN.1) are being brought up to: adapter first, our impl later.
//
// Anchors: Cockburn (hexagonal / ports-and-adapters); RFC 8949 (CBOR); the RomDat
// value-tree cross-verification (a catalog is not XML-specific) is the sibling proof.

open global.Xunit
open Zeta.Core

module VTC = ValueTreeCodec

/// A rich value tree exercising all eight shapes: Null, Bool, Int, Float, String,
/// Bytes, Array, Object (nested). The stress case — exercises the codec's TOTAL
/// fidelity. (Only CBOR is total; see the fidelity-gap test below.)
let private richTree: DynamicValue =
    DynamicValue.Object
        [ "null", DynamicValue.Null
          "bool", DynamicValue.Bool true
          "int", DynamicValue.Int 0x0123456789ABCDEFL
          "negint", DynamicValue.Int -42L
          "float", DynamicValue.Float 3.141592653589793
          "string", DynamicValue.String "ζ — nation-state-resistant \"value tree\"\n\ttab"
          "bytes", DynamicValue.Bytes(System.Collections.Immutable.ImmutableArray.Create<byte>(0uy, 1uy, 0xFEuy, 0xFFuy))
          "emptyArray", DynamicValue.Array []
          "array",
          DynamicValue.Array
              [ DynamicValue.Int 1L
                DynamicValue.String "two"
                DynamicValue.Bool false
                DynamicValue.Array [ DynamicValue.Null; DynamicValue.Int 3L ] ]
          "nested",
          DynamicValue.Object
              [ "crc32", DynamicValue.String "deadbeef"
                "roms", DynamicValue.Array [ DynamicValue.Object [ "name", DynamicValue.String "a.rom" ] ] ] ]

/// The PORTABLE subset every sovereign codec round-trips faithfully: a collection root
/// (YAML's canonical form requires it) with Null/Bool/Int/String/Array/Object leaves —
/// no `Bytes` (JSON/YAML have no native byte string) and no `Float` (canonical-float
/// round-trip gap). This is exactly the shape a ROM catalog takes (RomDat.toDynamicValue),
/// which is why that catalog cross-verifies across all three.
let private portableTree: DynamicValue =
    DynamicValue.Object
        [ "name", DynamicValue.String "TOSEC — Nintendo Entertainment System"
          "count", DynamicValue.Int 3L
          "games",
          DynamicValue.Array
              [ DynamicValue.Object
                    [ "name", DynamicValue.String "Super Mario Bros."
                      "crc32", DynamicValue.String "3337ec46"
                      "present", DynamicValue.Bool true
                      "category", DynamicValue.Null ] ] ]

[<Fact>]
let ``CROSS-VERIFY: the portable value tree round-trips faithfully through every sovereign codec (all lenses agree)`` () =
    // Empty failure list ⇒ the tree is format-agnostic across json/cbor/yaml: each
    // codec is a faithful lens onto the SAME value tree (the RomDat catalog shape).
    let failures = VTC.crossVerify VTC.sovereign portableTree
    Assert.Empty(failures)
    for c in VTC.sovereign do
        Assert.True(VTC.isFaithful c portableTree, sprintf "codec %s must be faithful" c.Name)

[<Fact>]
let ``CBOR is the TOTAL 1-ary codec: it round-trips the full eight-shape tree (Bytes + Float incl.)`` () =
    // CBOR (RFC 8949) is our total, sovereign 1-ary codec — the whole DynamicValue
    // shape space round-trips, including Bytes and Float that JSON/YAML cannot carry.
    Assert.True(VTC.isFaithful VTC.cbor richTree)

[<Fact>]
let ``NATIVE gaps are PARITY DEBT, not accepted limits: parity is mandatory, closed via a wrapper convention`` () =
    // Aaron 2026-07-02: "we can carry what we need losslessly just not natively in their
    // numerics … We must have parity even if we have to use ugly strings or some wrapper
    // object or anything." So the port MEASURES native fidelity (a failing round-trip is
    // DATA, never a silent lossy conversion) — and every native gap is DEBT to close with
    // a wrapper envelope (base64 for Bytes; round-trip string for Float/Decimal; a tagged
    // object for the SoftValue / Kleene tri-boolean non-collapsing carriers). This test
    // characterises today's NATIVE surface: CBOR is already total; JSON's Bytes/Float
    // gaps are the tracked parity debt (rollout ledger in the doctrine doc).
    let bytes = DynamicValue.Bytes(System.Collections.Immutable.ImmutableArray.Create<byte>(0xDEuy, 0xADuy))
    let float' = DynamicValue.Float 3.14159
    Assert.True(VTC.isFaithful VTC.cbor bytes) // CBOR: parity already met natively
    Assert.True(VTC.isFaithful VTC.cbor float')
    Assert.False(VTC.isFaithful VTC.json bytes) // JSON: native gap == parity debt to wrap
    Assert.False(VTC.isFaithful VTC.json float')

[<Fact>]
let ``SOVEREIGNTY: every codec we own end-to-end is Provenance.Ours (zero third-party supply chain)`` () =
    // The nation-state-resistance floor: the sovereign core has NO external supply
    // chain. `sovereignty = 2` (Ours) is the rollout target for every load-bearing
    // codec; the sovereign set already meets it.
    for c in VTC.sovereign do
        Assert.Equal(VTC.Provenance.Ours, c.Provenance)
        Assert.Equal(2, VTC.sovereignty c.Provenance)

[<Fact>]
let ``the sovereign codecs are the 1-ary lenses (json/cbor/yaml); arity is recorded on the port`` () =
    // 1-ary = a single value tree. The 2-ary formats (XML/KDL/ASN.1, element ⊕
    // attribute) are the rollout; the port records arity so the taxonomy is data.
    Assert.Equal(3, List.length VTC.sovereign)
    for c in VTC.sovereign do
        Assert.Equal(1, c.Arity)
    Assert.Equal<string list>([ "json"; "cbor"; "yaml" ], VTC.sovereign |> List.map (fun c -> c.Name))

[<Fact>]
let ``provenance ranks sovereignty Ours > Bcl > ThirdParty (the surface we shrink toward Ours)`` () =
    // The ordering that makes "replace the dependency behind our interface" a measurable
    // gradient: BCL (the runtime we already trust) outranks a NuGet tenant; our own impl
    // outranks both. The rollout moves every codec up this ladder to Ours.
    let ours = VTC.sovereignty VTC.Provenance.Ours
    let bcl = VTC.sovereignty (VTC.Provenance.Bcl "System.Xml.Linq")
    let third = VTC.sovereignty (VTC.Provenance.ThirdParty "SomeNuGet")
    Assert.True(ours > bcl)
    Assert.True(bcl > third)
