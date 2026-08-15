module Zeta.Tests.CollationCrossOracleTreatyTests

// ── The collation TREATY: one name must denote one relation in every oracle ────────────────────
//
// `.claude/rules/culture-invariant-by-default.md` picks "codepoint ≡ UTF-8 byte order" as the one
// canonical collation. `Zeta.Core.Collation.binary` implements it. These tests pin the treaty
// itself rather than a point on it, and they name — as EXPLICITLY SKIPPED tests carrying the
// reason — the two places the treaty is currently not honoured.
//
// Decision doc:
//   docs/research/2026-08-15-canonical-collation-is-utf8-byte-order-sql-servers-bin2-utf8-not-nvarchar-bin2.md
// Work-item: 081M02PEST7087G0R00253HRV0
//
// A skipped test here is a NAMED GAP, not a disabled test. Deleting the `Skip` must make it fail;
// that is the property that keeps it out of the vacuity class.

open System
open System.Text
open global.Xunit
open Zeta.Core
open Zeta.Core.Consensus

/// U+FF3A FULLWIDTH LATIN CAPITAL LETTER Z — high BMP, 3 UTF-8 bytes (EF BC BA), 1 UTF-16 unit.
let private highBmp = Char.ConvertFromUtf32 0xFF3A

/// U+10000 LINEAR B SYLLABLE B008 A — astral, 4 UTF-8 bytes (F0 90 80 80), surrogate pair D800 DC00.
let private astral = Char.ConvertFromUtf32 0x10000

/// TRUE lexicographic UTF-8 byte order — `memcmp` semantics, the DEFINITION of the canonical
/// collation (Unicode Standard 2.5.3: "A binary sort of UTF-8 strings gives the same ordering as
/// a binary sort of Unicode code points").
///
/// Written out longhand deliberately. `compare (Encoding.UTF8.GetBytes a) (...)` would NOT do —
/// F# structural comparison on ARRAYS is length-first, not lexicographic (pinned below).
let private utf8ByteOrder (a: string) (b: string) : int =
    let ba = Encoding.UTF8.GetBytes a
    let bb = Encoding.UTF8.GetBytes b
    let n = min ba.Length bb.Length
    let mutable i = 0
    let mutable r = 0
    while r = 0 && i < n do
        r <- compare ba.[i] bb.[i]
        i <- i + 1
    if r <> 0 then r else compare ba.Length bb.Length

/// Independently derived second reference: code-point sequence order. F# LIST comparison is
/// lexicographic (unlike array comparison), so this is an honest cross-check rather than a
/// restatement of the implementation.
let private codePointOrder (a: string) (b: string) : int =
    let points (s: string) = s.EnumerateRunes() |> Seq.map (fun r -> r.Value) |> List.ofSeq
    compare (points a) (points b)

/// Alphabet chosen to straddle every UTF-8 length boundary AND the surrogate boundary — the only
/// places the three candidate orders can disagree. A vector that never crosses a boundary pins
/// nothing.
let private boundaryAlphabet =
    [ 0x41      // 'A'            1 UTF-8 byte
      0x7A      // 'z'            1 byte  — discriminates length-first from lexicographic
      0x80      //                2 bytes (first)
      0x7FF     //                2 bytes (last)
      0x800     //                3 bytes (first)
      0xD7FF    //                3 bytes, last before the surrogate block
      0xE000    //                3 bytes, first after the surrogate block
      0xFF3A    // the headline high-BMP character
      0xFFFF    //                3 bytes (last BMP)
      0x10000   // the headline astral character, 4 bytes (first)
      0x1082C
      0x1F643
      0x10FFFF ] //               4 bytes (last legal code point)
    |> List.map Char.ConvertFromUtf32

/// All strings of length 0..3 over the boundary alphabet.
let private probes =
    [ yield ""
      for a in boundaryAlphabet do
          yield a
          for b in boundaryAlphabet do
              yield a + b
              for c in boundaryAlphabet do
                  yield a + b + c ]
    |> List.distinct

// ── GREEN: the canonical collation IS UTF-8 byte order, differentially ─────────────────────────

[<Fact>]
let ``Collation.binary agrees with UTF-8 byte order on every boundary-straddling pair`` () =
    // The falsifier for the whole decision: if `binary` were UTF-16 code-unit order (i.e. plain
    // StringComparer.Ordinal) this fails on every pair straddling the surrogate boundary.
    let mismatches =
        [ for x in probes do
            for y in probes do
                if Math.Sign(Collation.binary.Compare(x, y)) <> Math.Sign(utf8ByteOrder x y) then
                    yield (x, y) ]
    Assert.Empty mismatches

[<Fact>]
let ``Collation.binary agrees with code-point order on every boundary-straddling pair`` () =
    // Second, independently derived reference. Unicode 2.5.3 says these two must coincide; this
    // asserts our implementation sits on the theorem rather than near it.
    let mismatches =
        [ for x in probes do
            for y in probes do
                if Math.Sign(Collation.binary.Compare(x, y)) <> Math.Sign(codePointOrder x y) then
                    yield (x, y) ]
    Assert.Empty mismatches

[<Fact>]
let ``the divergence being governed is real: .NET ordinal disagrees with the canonical collation`` () =
    // Pins the FACT the work-item measured, so the treaty cannot be quietly satisfied by claiming
    // there was never a difference. U+FF3A vs U+10000:
    //   UTF-16 code units  FF3A  vs  D800 DC00  →  D800 < FF3A  →  astral FIRST
    //   UTF-8 bytes        EF..  vs  F0..       →  EF   < F0    →  astral SECOND
    Assert.True(String.CompareOrdinal(highBmp, astral) > 0, "UTF-16 code-unit order: astral first")
    Assert.True(Collation.binary.Compare(highBmp, astral) < 0, "canonical order: astral second")
    // And the canonical answer is the one Rust's native `Ord for String` already gives.
    Assert.True(utf8ByteOrder highBmp astral < 0)

// ── GREEN: the §5c trap — why the work-item's proposed fix would have been WRONG ───────────────

[<Fact>]
let ``F# array comparison is LENGTH-first, so compare on UTF-8 byte arrays is not UTF-8 order`` () =
    // Work-item 081M02PEST7087G0R00253HRV0 proposes comparing UTF-8 bytes via F# `compare`, citing
    //     compare [|1uy;2uy|] [|1uy|] = 1
    // That example passes under BOTH length-first and lexicographic ordering, so it cannot support
    // the claim. This is the discriminating case, and it shows the claim is false.
    Assert.Equal(1, compare [| 1uy; 2uy |] [| 1uy |]) // the work-item's non-discriminating example
    Assert.Equal(1, compare [| 65uy; 65uy |] [| 122uy |]) // LENGTH-first: "AA" > "z"
    Assert.True(utf8ByteOrder "AA" "z" < 0) // UTF-8 byte order (and Rust, and memcmp): "AA" < "z"
    // F# LIST comparison, by contrast, IS lexicographic — the contrast is the lesson.
    Assert.True(compare [ 65uy; 65uy ] [ 122uy ] < 0)

// ── GREEN: the SQL Server vocabulary a DBA would reach for ─────────────────────────────────────

[<Fact>]
let ``Latin1_General_100_BIN2_UTF8 is the exact SQL Server name for the canonical collation`` () =
    // _BIN2_UTF8 stores as UTF-8, which has no surrogates, so BIN2 over it is TRUE code-point
    // order. It is the only SQL Server collation name that denotes exactly our canonical order.
    Assert.Same(Collation.binary, Collation.byNameOrDefault "Latin1_General_100_BIN2_UTF8")
    // Alias lookup stays case-insensitive, as elsewhere in the catalog.
    Assert.Same(Collation.binary, Collation.byNameOrDefault "latin1_general_100_bin2_utf8")

// ── NAMED GAPS: skipped with a reason, and they FAIL if the Skip is removed ────────────────────

[<Fact(Skip = "NAMED GAP 081M02PEST7087G0R00253HRV0 — Consensus.decide tie-breaks with F# structural "
              + "comparison (UTF-16 code-unit order), not Zeta.Core.Collation.binary, so it diverges "
              + "from the Rust oracle on an astral-straddling tie. Fixing it is a design call: "
              + "decide<'T when 'T: comparison> is generic and code-point order is undefined for an "
              + "arbitrary 'T. See the decision doc, inventory item 2. Removing this Skip must fail.")>]
let ``decide's tie-break uses the canonical collation`` () =
    // A 1-1 tie at n=2 reaches quorum, so the tie-break is observable. Values straddle the
    // astral/high-BMP boundary. Canonical order puts U+FF3A first; F#'s native order puts U+10000
    // first, which is what Rust would NOT commit.
    let stamp = DateTimeOffset.UnixEpoch

    let votes =
        [ { Node = NodeId "n0"; Value = highBmp; Timestamp = stamp }
          { Node = NodeId "n1"; Value = astral; Timestamp = stamp } ]

    match decide votes with
    | Committed(v, _, _) -> Assert.Equal<string>(highBmp, v)
    | Rejected(r, _, _) -> Assert.Fail $"expected a commit, got: {r}"

[<Fact(Skip = "NAMED GAP 081M02PEST7087G0R00253HRV0 — the catalog name 'invariant' denotes DIFFERENT "
              + "relations per oracle: .NET maps it to the linguistic StringComparer.InvariantCulture "
              + "(a < B) while the TypeScript catalog aliases it to binary (B < a). Reachable on two "
              + "ASCII letters. The recommendation is to REMOVE culture-aware rows from the shared "
              + "catalog (TypeScript cannot faithfully implement InvariantCulture — Intl.Collator is "
              + "ICU-version-dependent), which is a breaking change and needs Aaron. Decision doc "
              + "sections 5a and 7 item 4. Removing this Skip must fail.")>]
let ``every shared catalog name denotes the same relation in every oracle`` () =
    // The TS oracle's `catalog["invariant"]` is `stringCompare`, i.e. binary. If the shared catalog
    // is a treaty, .NET's row must agree with it.
    let dotNetInvariant = Collation.byNameOrDefault "invariant"
    Assert.Equal(Math.Sign(Collation.binary.Compare("a", "B")), Math.Sign(dotNetInvariant.Compare("a", "B")))
