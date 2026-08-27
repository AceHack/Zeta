module Zeta.Tests.WSetFourCornerTraceTreatyTests

// The FourCornerTrace TREATY byte-lock. `FourCornerTrace` (src/Core/WSet.fs, #10992) landed in
// exactly ONE oracle; this file is the F# half of the parity check that keeps it from drifting the
// way `compareTagged` / `ZSet.ofSeq` did (081KT07NV0008QG0R001YDB73K — the same collation bug
// reappearing verbatim in TypeScript because the two sides drifted).
//
// F# is the SOURCE OF TRUTH: `FourCornerTrace.foldRecorded` computes the turns, this file only
// FORMATS them, and the TypeScript conformer
// (src/Core.TypeScript/algebra/wset-four-corner-trace.test.ts) must produce byte-identical lines
// from the same scenarios.
//
// NOTE on where the formatter lives: `FourCorner.toLine` lives in `src/`, but `FourCornerTrace`
// has no codec and `src/Core/WSet.fs` is Vera's and must not be edited to add one. So the F#-side
// formatter lives HERE, in the test. That is a deliberate, named asymmetry (the TS side exports
// its codec from the module): what the golden file locks is the FOLD SEMANTICS — sequence
// numbering, delta contents, consolidated ordering, and the recording of EMPTY deltas — with the
// line format acting purely as the observation instrument. If a codec is ever wanted in `src/`,
// the F# side moves first and this file shrinks to a caller.

open System.IO
open System.Text
open global.Xunit
open Zeta.Core

// ── the ℤ '*'-ring (`IntegerRing.Star`, same instance as the law pack) ────────────────────
let private intStar: IStarRing<int64> = IntegerRing.Star

let private isZeroI (w: int64) = w = 0L

// ── the worked loop, STRING-KEYED (the collation half of the treaty) ────────────────────────
type private Relabel = Map<string, string>

let private reread: FourCornerTrace.Generator<string list, Relabel, string, int64> =
    fun (interp: Relabel) (history: string list) ->
        history
        |> List.map (fun x ->
            let label =
                match Map.tryFind x interp with
                | Some y -> y
                | None -> x

            label, 1L)

let private update (interp: Relabel) ((raw, label): string * string) : Relabel = Map.add raw label interp

// ── the codec ────────────────────────────────────────────────────────────────────────────────
// Escapes: \\ \t \n \r plus the two field separators \; and \=  (the RecordedSource house style
// extended). Mirrors `esc` in the TS module exactly, INCLUDING the order (backslash first).

let private esc (s: string) =
    s
        .Replace("\\", "\\\\")
        .Replace("\t", "\\t")
        .Replace("\n", "\\n")
        .Replace("\r", "\\r")
        .Replace(";", "\\;")
        .Replace("=", "\\=")

/// "-" when EMPTY, else "+" + "k=v" pairs joined by ";". The "-" is what makes a RECORDED no-op
/// turn visible as a line rather than as an absence.
let private pairsToText (pairs: (string * string) list) =
    if List.isEmpty pairs then
        "-"
    else
        let sb = StringBuilder().Append '+'

        pairs
        |> List.iteri (fun i (k, v) ->
            if i > 0 then sb.Append ';' |> ignore
            sb.Append(esc k).Append('=').Append(esc v) |> ignore)

        sb.ToString()

/// A consolidated ℤ-weighted WSet is ALREADY in canonical order — `WSet.consolidate` ends with
/// `List.sortBy fst`, and F#'s structural comparison on `string` is `String.CompareOrdinal`
/// (culture-INVARIANT). The TS side reproduces that with `ordinalCompareKeys`, never
/// `localeCompare`. This function must NOT re-sort: re-sorting here would hide a drift in
/// `consolidate` itself, which is exactly the class of defect the treaty exists to catch.
let private wsetToText (s: WSet.WSet<string, int64>) =
    pairsToText (s |> List.map (fun (k, w) -> k, string w))

let private interpretationToText (interp: Relabel) =
    pairsToText (interp |> Map.toList |> List.map (fun (k, v) -> k, v))

let private turnToLine (turn: FourCornerTrace.TraceTurn<string * string, string, int64>) =
    let raw, label = turn.Feedback
    sprintf "wsettrace/turn/1\t%O\t%s:%s\t%s" turn.Sequence (esc raw) (esc label) (wsetToText turn.Delta)

let private stateToLine (nextSequence: bigint) (interp: Relabel) (emitted: WSet.WSet<string, int64>) =
    sprintf "wsettrace/state/1\t%O\t%s\t%s" nextSequence (interpretationToText interp) (wsetToText emitted)

// ── the scenarios (identical to the TS conformer's SCENARIOS, in the same order) ─────────────
// The non-ASCII key is written as an explicit escape on BOTH sides so no source-file
// normalization pass can silently change the bytes under the byte-lock.

let private eAcute = "\u00E9"

let private scenarios: (string * string list * bigint * (string * string) list) list =
    [ "opening-only", [ "a"; "B"; "a"; eAcute; "_"; "Z" ], 0I, []
      "empty-delta-is-recorded", [ "a"; "B" ], 12I, [ ("q", "Q"); ("a", "Z") ]
      "idempotent-replay", [ "a"; "a"; "B" ], 100I, [ ("a", eAcute); ("a", eAcute) ]
      "correction-appends", [ "a" ], 7I, [ ("a", "B"); ("a", "Z") ]
      "escaping", [ "k=1"; "s;t" ], 0I, [ ("k=1", "new\tline") ] ]

/// Run every scenario through the REAL `FourCornerTrace` and flatten to the canonical line list.
let private producedLines () =
    scenarios
    |> List.collect (fun (_, history, firstSequence, feedbacks) ->
        let st0 = fst (FourCornerTrace.start intStar isZeroI reread history Map.empty)

        let recorded =
            FourCornerTrace.foldRecorded firstSequence intStar isZeroI reread update history feedbacks st0

        (recorded.Turns |> List.map turnToLine)
        @ [ stateToLine recorded.NextSequence recorded.State.Interpretation recorded.State.Emitted ])

// ── the golden file ─────────────────────────────────────────────────────────────────────────
let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)

    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    dir.FullName

let private goldenPath =
    Path.Combine(
        repoRoot (),
        "src",
        "Core.TypeScript",
        "algebra",
        "wset-four-corner-trace-golden-vectors.lines"
    )

let private goldenLines () =
    File.ReadAllLines goldenPath
    |> Array.filter (fun l -> not (l.StartsWith("#", System.StringComparison.Ordinal)) && l.Length > 0)
    |> Array.toList

[<Fact>]
let ``BYTE-LOCK: the F# fold serializes to the golden lines exactly`` () =
    let expected = goldenLines ()
    let actual = producedLines ()
    Assert.Equal<string list>(expected, actual)

// The property the mirror exists to protect, asserted on the FILE rather than in memory: a turn
// whose feedback changed nothing is a LINE ending in "-", not an absent line. A `foldRecorded`
// that skipped no-ops would emit fewer turn lines and this fails.
[<Fact>]
let ``EMPTY DELTAS ARE RECORDED: one turn line per feedback, including the no-ops`` () =
    let golden = goldenLines ()
    let turnLines = golden |> List.filter (fun l -> l.StartsWith("wsettrace/turn/1\t", System.StringComparison.Ordinal))
    let totalFeedbacks = scenarios |> List.sumBy (fun (_, _, _, fbs) -> List.length fbs)
    Assert.Equal(totalFeedbacks, List.length turnLines)
    // exactly two of them are no-op turns: (q,Q) touches nothing, and the (a,é) replay is idempotent
    let emptyDeltaTurns = turnLines |> List.filter (fun l -> l.EndsWith("\t-", System.StringComparison.Ordinal))
    Assert.Equal(2, List.length emptyDeltaTurns)

// The collation half, stated as a CHECKED anchor rather than a cited one: F#'s structural
// comparison on strings is ordinal (`String.CompareOrdinal`), NOT culture-sensitive. If that were
// ever untrue, `WSet.consolidate`'s `List.sortBy fst` would order the golden keys differently from
// the TS `ordinalCompareKeys` and the byte-lock above would go red — so this asserts the mechanism
// directly instead of relying on the byte-lock to notice.
[<Fact>]
let ``COLLATION: F# structural string comparison is ORDINAL, and the golden keys discriminate`` () =
    let keys = [ "a"; "B"; eAcute; "_"; "Z" ]
    Assert.Equal<string list>([ "B"; "Z"; "_"; "a"; eAcute ], List.sort keys)

    // the same order F#'s `compare` produces IS String.CompareOrdinal's order, pairwise
    for x in keys do
        for y in keys do
            Assert.Equal(sign (compare x y), sign (System.String.CompareOrdinal(x, y)))

    // and it genuinely differs from a culture-sensitive sort — otherwise the vectors would not
    // discriminate and this whole guard would be vacuous
    let culture =
        keys |> List.sortWith (fun a b -> System.String.Compare(a, b, System.StringComparison.InvariantCulture))

    Assert.NotEqual<string list>(List.sort keys, culture)

// The gap, MEASURED on this side too so neither oracle can drift alone. `String.CompareOrdinal` —
// and therefore F#'s structural `compare`, and therefore `WSet.consolidate`'s `List.sortBy fst` —
// orders by UTF-16 code UNIT. The repo's CANONICAL collation is code POINT
// (src/Core.TypeScript/collation/collation.ts `stringCompare`; the SQL Server note in that file
// spells out the same distinction: _BIN2_UTF8 is true code-point order, BIN2 over nvarchar is
// code-unit and "agrees on the BMP, DIVERGES above it").
//
// So a consolidated WSet with an ASTRAL string key is ordered off-treaty. Every golden key above
// is BMP, so the byte-lock is exact and this changes nothing today — but the gap is real, it lives
// in `WSet.consolidate` (not in the mirror), and it is filed as 081M060AYN9087G0R0006E6FWZ.
// Asserted rather than described so that fixing `consolidate` makes this test say so out loud.
[<Fact>]
let ``KNOWN GAP: F# ordinal is UTF-16 code UNIT, not the canonical code POINT collation`` () =
    let astral = System.Char.ConvertFromUtf32 0x1F600 // U+1F600, lead surrogate D83D
    let bmp = "�"

    // code-UNIT order: the lead surrogate D83D sorts BELOW FFFD, so the astral key comes first
    Assert.True(compare astral bmp < 0)
    Assert.True(System.String.CompareOrdinal(astral, bmp) < 0)

    // code-POINT order would be the other way round (0x1F600 > 0xFFFD) — the divergence, in one line
    Assert.True(System.Char.ConvertToUtf32(astral, 0) > 0xFFFD)
