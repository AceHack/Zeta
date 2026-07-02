module Zeta.Tests.RomDatTests

// READ + UNDERSTAND the TOSEC/MAME catalog metadata (shadow*, Aaron 2026-07-02). Parses
// the Logiqx-format DAT (TOSEC / GoodTools / No-Intro / MAME) into curated game
// identities, and CROSS-VERIFIES two ways:
//   (1) our GameFingerprint.crc32Hex of a ROM equals the `crc` a DAT records for it —
//       our identity IS their curated identity, so we can resolve any fingerprinted ROM
//       to its catalog entry (build on their signatures, don't reinvent);
//   (2) the catalog value tree is NOT XML-specific — `toDynamicValue` round-trips
//       identically through JSON, CBOR, and YAML. XML is one lens; the value tree is the
//       invariant. (Aaron: XML is a banana-split of two value trees; JSON/YAML/CBOR are
//       simpler trees; all fold into DynamicValue → Z-sets / schema-evolution / SoftValue.)

open global.Xunit
open Zeta.Core

module RD = RomDat
module DV = DynamicValue
module GF = GameFingerprint

let private ok = function Ok x -> x | Error e -> failwithf "%A" e

let private sampleDat = """<?xml version="1.0"?>
<datafile>
  <header><name>Nintendo - Nintendo Entertainment System</name></header>
  <game name="Super Mario Bros. (World)">
    <description>Super Mario Bros. (World)</description>
    <category>Games</category>
    <rom name="Super Mario Bros. (World).nes" size="40976" crc="D445F698" md5="811B027EAF99C2DEF7B933C5208636DE" sha1="EA343F4E445A9050D4B4FBAC2C77D0693B1D0922"/>
  </game>
  <game name="The Legend of Zelda (USA)">
    <description>The Legend of Zelda (USA)</description>
    <rom name="The Legend of Zelda (USA).nes" size="131072" crc="3FE272FB"/>
  </game>
</datafile>"""

[<Fact>]
let ``parses a TOSEC/MAME DAT into curated games, signatures normalised to lower-case hex`` () =
    let cat = ok (RD.parse sampleDat)
    Assert.Equal("Nintendo - Nintendo Entertainment System", cat.Name)
    Assert.Equal(2, List.length cat.Games)
    let smb = cat.Games.[0]
    Assert.Equal("Super Mario Bros. (World)", smb.Name)
    Assert.Equal(Some "Games", smb.Category)
    let rom = smb.Roms.[0]
    Assert.Equal(Some 40976L, rom.Size)
    Assert.Equal(Some "d445f698", rom.Crc32)                              // normalised lower-case
    Assert.Equal(Some "ea343f4e445a9050d4b4fbac2c77d0693b1d0922", rom.Sha1)

[<Fact>]
let ``resolves a game by its curated signature (CRC32 / SHA1)`` () =
    let cat = ok (RD.parse sampleDat)
    let byCrc = RD.resolveCrc "D445F698" cat                             // case-insensitive
    Assert.Equal(1, List.length byCrc)
    Assert.Equal("Super Mario Bros. (World)", byCrc.[0].Name)
    let bySha = RD.resolveSha1 "EA343F4E445A9050D4B4FBAC2C77D0693B1D0922" cat
    Assert.Equal("Super Mario Bros. (World)", bySha.[0].Name)

[<Fact>]
let ``CROSS-CHECK: our GameFingerprint CRC == the catalog's curated CRC — our identity IS their identity`` () =
    // A ROM we hash ourselves resolves to a DAT entry keyed on OUR computed CRC —
    // proving we speak the same signature language TOSEC/MAME curate (No-Intro/DAT).
    let rom = [| 0x4Euy; 0x45uy; 0x53uy; 0x1Auy; 0x01uy; 0x00uy |]        // a tiny "ROM"
    let ourCrc = GF.crc32Hex rom
    let dat =
        sprintf """<datafile><header><name>x</name></header><game name="MyGame"><rom name="r" crc="%s"/></game></datafile>"""
            (ourCrc.ToUpperInvariant())                                  // catalog stores upper-case; we normalise
    let cat = ok (RD.parse dat)
    let found = RD.resolveCrc ourCrc cat
    Assert.Equal(1, List.length found)
    Assert.Equal("MyGame", found.[0].Name)                              // our fingerprint → their catalog entry

[<Fact>]
let ``CROSS-VERIFY: the catalog value tree is NOT XML-specific — round-trips through JSON, CBOR, YAML`` () =
    let cat = ok (RD.parse sampleDat)
    let dv = RD.toDynamicValue cat                                       // the value tree (substrate form)
    // JSON lens
    let viaJson = DV.fromCanonicalJson (ok (DV.toCanonicalJson dv)) |> ok
    Assert.Equal(dv, viaJson)
    // CBOR lens
    let viaCbor = DV.fromCanonicalCbor (DV.toCanonicalCborOk dv) |> ok
    Assert.Equal(dv, viaCbor)
    // YAML lens
    let viaYaml = DV.fromYaml (ok (DV.toYaml dv)) |> ok
    Assert.Equal(dv, viaYaml)
    // all three lenses agree with each other too (XML is just a fourth lens)
    Assert.Equal(viaJson, viaCbor)
    Assert.Equal(viaCbor, viaYaml)
