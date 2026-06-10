module Zeta.Tests.FingerprintPrismTests

open System.Text
open global.Xunit
open Zeta.Core

let private bytes (s: string) = Encoding.UTF8.GetBytes s

// A HARD rainbow over the exact SHA-256 key (GameFingerprint.key).
let private hardTable =
    FingerprintPrism.empty GameFingerprint.key
    |> FingerprintPrism.add (bytes "GAME-ALPHA-rom-contents")
    |> FingerprintPrism.add (bytes "GAME-BETA-rom-contents")

[<Fact>]
let ``hard prism: exact match recognizes a known game; unknown -> None`` () =
    let p = FingerprintPrism.hard hardTable
    Assert.Equal<byte[] option>(Some(bytes "GAME-ALPHA-rom-contents"), p.Match(bytes "GAME-ALPHA-rom-contents"))
    Assert.Equal<byte[] option>(None, p.Match(bytes "totally-different-rom"))

[<Fact>]
let ``hard prism law: Build = id; Match (Build w) = Some w for a known w`` () =
    let p = FingerprintPrism.hard hardTable
    let w = bytes "GAME-BETA-rom-contents"
    Assert.Equal<byte[]>(w, p.Build w)
    Assert.Equal<byte[] option>(Some w, p.Match(p.Build w))

[<Fact>]
let ``soft byte fingerprint: identical -> 1.0; disjoint -> low`` () =
    let a = FingerprintPrism.softBytes (bytes "the quick brown fox jumps over the lazy dog")
    Assert.Equal(1.0, FingerprintPrism.softBytesSimilarity a a, 10)
    let b = FingerprintPrism.softBytes (bytes "ZZZZZZZZ completely unrelated payload 9999999")
    Assert.True(FingerprintPrism.softBytesSimilarity a b < 0.2)

[<Fact>]
let ``soft byte fingerprint: a one-region edit stays HIGHLY similar (insertion-robust)`` () =
    let orig = bytes "the quick brown fox jumps over the lazy dog twelve times in a row today"
    let edited = bytes "the quick brown fox JUMPED over the lazy dog twelve times in a row today"
    let s = FingerprintPrism.softBytesSimilarity (FingerprintPrism.softBytes orig) (FingerprintPrism.softBytes edited)
    Assert.True(s > 0.6, $"expected high similarity for a small edit, got {s}")

[<Fact>]
let ``soft prism: recognizes a NEAR game (switch/stay-soft), rejects a far one`` () =
    // rainbow keyed by the soft sketch's hash set size (any 'fp works; recognition is via similarity)
    let table =
        FingerprintPrism.empty (fun (w: byte[]) -> w.Length)
        |> FingerprintPrism.add (bytes "the quick brown fox jumps over the lazy dog twelve times in a row today")
    let sim (x: byte[]) (y: byte[]) =
        FingerprintPrism.softBytesSimilarity (FingerprintPrism.softBytes x) (FingerprintPrism.softBytes y)
    let p = FingerprintPrism.soft sim 0.6 table
    // a near-variant resolves to the known game (stay soft across the edit)
    match p.Match(bytes "the quick brown fox JUMPED over the lazy dog twelve times in a row today") with
    | Some _ -> ()
    | None -> Assert.Fail "soft prism should recognize the near-variant"
    // a far payload does not
    Assert.Equal<byte[] option>(None, p.Match(bytes "ZZZZ unrelated ZZZZ unrelated ZZZZ unrelated ZZZZ"))
