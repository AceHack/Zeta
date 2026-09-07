module Zeta.Tests.ZetaFsCollatorTests

open System
open System.Text
open global.Xunit
open Zeta.Core

let private utf8 (s: string) = Encoding.UTF8.GetBytes s

let private sameBytes (a: byte[]) (b: byte[]) =
    a.Length = b.Length
    && MemoryExtensions.SequenceEqual(ReadOnlySpan<byte> a, ReadOnlySpan<byte> b)

[<Fact>]
let ``Ascii folds A-Z only and leaves other bytes`` () =
    let folded = ZetaFsCollator.fold ZetaFsCollator.Ascii (utf8 "Notes.md")
    Assert.True(sameBytes (utf8 "notes.md") folded)
    let high = [| 0xC0uy; 65uy |]
    let foldedHigh = ZetaFsCollator.fold ZetaFsCollator.Ascii high
    Assert.True(sameBytes [| 0xC0uy; 97uy |] foldedHigh)

[<Fact>]
let ``Ordinal does not fold case`` () =
    let name = utf8 "Notes.md"
    let folded = ZetaFsCollator.fold ZetaFsCollator.Ordinal name
    Assert.True(Object.ReferenceEquals(name, folded) || sameBytes name folded)
    match ZetaFsCollator.refuseCreate ZetaFsCollator.Ordinal [ utf8 "notes.md" ] name with
    | Ok() -> ()
    | Error e -> Assert.Fail(sprintf "ordinal must allow Notes.md next to notes.md, got %A" e)

[<Fact>]
let ``Ascii refuses a second live name that collides under the fold`` () =
    match ZetaFsCollator.refuseCreate ZetaFsCollator.Ascii [ utf8 "notes.md" ] (utf8 "Notes.md") with
    | Error(ZetaFsCollator.ConfusableWithExisting existing) ->
        Assert.True(sameBytes (utf8 "notes.md") existing)
    | Ok() -> Assert.Fail("Ascii must refuse Notes.md when notes.md is live")

[<Fact>]
let ``Ordinal refuses exact same bytes and Ascii does too`` () =
    let name = utf8 "notes.md"
    match ZetaFsCollator.refuseCreate ZetaFsCollator.Ordinal [ name ] name with
    | Error(ZetaFsCollator.ConfusableWithExisting existing) -> Assert.True(sameBytes name existing)
    | Ok() -> Assert.Fail("exact same bytes is EEXIST")
    match ZetaFsCollator.refuseCreate ZetaFsCollator.Ascii [ name ] name with
    | Error(ZetaFsCollator.ConfusableWithExisting existing) -> Assert.True(sameBytes name existing)
    | Ok() -> Assert.Fail("exact same bytes is EEXIST")

[<Fact>]
let ``existing Ascii collisions enumerate as facts and do not merge`` () =
    let a = utf8 "Notes.md"
    let b = utf8 "notes.md"
    let pairs = ZetaFsCollator.confusablePairs ZetaFsCollator.Ascii [| a; b |]
    Assert.Equal(1, pairs.Length)
    let left, right = pairs.[0]
    Assert.True(sameBytes a left)
    Assert.True(sameBytes b right)
    let ordinalPairs = ZetaFsCollator.confusablePairs ZetaFsCollator.Ordinal [| a; b |]
    Assert.Equal(0, ordinalPairs.Length)

[<Fact>]
let ``Linux default is ordinal; FUSE-T default is Ascii`` () =
    Assert.Equal(ZetaFsCollator.Ordinal, ZetaFsCollator.linuxDefault)
    Assert.Equal(ZetaFsCollator.Ascii, ZetaFsCollator.fuseTDefault)
