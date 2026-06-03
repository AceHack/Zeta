module Zeta.Tests.FSharp.CanonicalJson.CrossVerifyTests

open System
open System.IO
open System.Text
open System.Text.Json
open Xunit
open Zeta.Core.FSharp.AceCanonical

// ---------------------------------------------------------------------------
// Repo-root walk (Zeta.sln sentinel; mirrors Sha256 CrossVerifyTests)
// ---------------------------------------------------------------------------

/// A trivial type local to this module, used only as the assembly handle for repoRoot
/// (so the walk anchors on THIS test assembly's location, like the Sha256 oracle's YamlValue).
type private Marker = class end

/// Walk up from the test assembly looking for Zeta.sln (sentinel at repo root).
/// .git is unreliable (in a worktree it is a file, not a directory).
let private repoRoot () : string =
    let assembly = typeof<Marker>.Assembly
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(assembly.Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then
        raise (InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location."))
    dir.FullName

// ---------------------------------------------------------------------------
// Output-file string escaping (JS JSON.stringify equivalent)
// ---------------------------------------------------------------------------

/// Escape one string as a `"`-wrapped JSON string the way JS `JSON.stringify` does: short-form
/// escapes for `" \ \b \f \n \r \t`, lowercase `\u00XX` for other control chars `< 0x20`, and
/// EVERYTHING else (including non-ASCII / astral) emitted RAW. This is what the committed
/// ts-output.json (JSON.stringify) and rust-output.json (serde_json) produce.
///
/// Note: this is for wrapping the OUTPUT MAP into fsharp-output.json — NOT the canonical content
/// itself (that is the library's aceCanonicalJson). We do not use System.Text.Json's serializer
/// for the wrap because even its UnsafeRelaxedJsonEscaping encoder escapes astral characters as
/// `\uXXXX\uXXXX` surrogate pairs, which is byte-distinct from the raw-UTF-8 astral that
/// JSON.stringify / serde_json emit. The map's keys + values here are all well-formed UTF-16
/// (canonical strings or "<rejected>"), so no lone-surrogate handling is needed.
let private jsonEscape (s: string) : string =
    let sb = StringBuilder()
    sb.Append '"' |> ignore
    for ch in s do
        match ch with
        | '"' -> sb.Append "\\\"" |> ignore
        | '\\' -> sb.Append "\\\\" |> ignore
        | '\b' -> sb.Append "\\b" |> ignore
        | '\012' -> sb.Append "\\f" |> ignore // form feed (U+000C)
        | '\n' -> sb.Append "\\n" |> ignore
        | '\r' -> sb.Append "\\r" |> ignore
        | '\t' -> sb.Append "\\t" |> ignore
        | _ ->
            let code = int ch
            if code <= 0x1f then sb.Append("\\u").Append(code.ToString("x4")) |> ignore
            else sb.Append ch |> ignore
    sb.Append '"' |> ignore
    sb.ToString()

// ---------------------------------------------------------------------------
// Cross-verify fact
// ---------------------------------------------------------------------------

[<Fact>]
let ``cross-verify canonical-json vectors match TS+Rust`` () =
    let root = repoRoot ()
    let dir = Path.Join(root, "tests", "cross-verification", "canonical-json")
    let vectorsPath = Path.Join(dir, "vectors.json")
    let vectorsText = File.ReadAllText(vectorsPath)

    // The WHOLE vectors.json parses cleanly even with lone-surrogate escapes inside the
    // `invalid` block: System.Text.Json stores `\uD800` as raw JSON and only THROWS at
    // GetString()/PropertyName transcode time. We therefore parse once here, then wrap each
    // per-vector seam call in try/with so a transcode-throw OR an aceCanonicalJson Error both
    // record the "<rejected>" contract. (If a future change made the whole-file parse throw,
    // this top-level call would surface it — the byte-lock would fail loud, not silently skip.)
    use doc = JsonDocument.Parse(vectorsText)
    let rootEl = doc.RootElement

    // Insertion-ordered (key, value) results: canonical[*] (vectors.json order) then invalid[*],
    // matching the committed ts-/rust-output.json byte order. (compare.ts sorts keys so it is
    // order-insensitive; this order is for the exact byte-lock against the reference files.)
    let results = ResizeArray<string * string>()
    let mutable mismatches = 0

    // canonical[*]: each value must render to its expected_canonical_json byte-for-byte.
    let canonical = rootEl.GetProperty("canonical")
    for vec in canonical.EnumerateArray() do
        let id = vec.GetProperty("id").GetString()
        let expected = vec.GetProperty("expected_canonical_json").GetString()
        let value = vec.GetProperty("value")
        let actual =
            try
                match aceCanonicalJson value with
                | Ok s -> s
                | Error _ -> "<rejected>"
            with _ -> "<rejected>"
        results.Add(sprintf "canonical:%s" id, actual)
        if not (String.Equals(actual, expected, StringComparison.Ordinal)) then
            mismatches <- mismatches + 1

    // invalid[*]: each value MUST reject — either the seam returns Error, or GetString/Name
    // throws while transcoding a lone surrogate. Both are wrapped to "<rejected>".
    let invalid = rootEl.GetProperty("invalid")
    for vec in invalid.EnumerateArray() do
        let id = vec.GetProperty("id").GetString()
        let actual =
            try
                let value = vec.GetProperty("value")
                match aceCanonicalJson value with
                | Ok _ -> "ACCEPTED" // should never happen for the invalid block
                | Error _ -> "<rejected>"
            with _ -> "<rejected>"
        results.Add(sprintf "invalid:%s" id, actual)
        if not (String.Equals(actual, "<rejected>", StringComparison.Ordinal)) then
            mismatches <- mismatches + 1

    // Write fsharp-output.json so compare.ts can verify TS == Rust == F#.
    // Match the committed rust-output.json / ts-output.json byte shape EXACTLY by hand-emitting
    // the flat `{ "key": "value", ... }` object the way JS `JSON.stringify(obj, null, 2)` does:
    //   - 2-space indent, ": " (colon-space) separator, ",\n" between entries;
    //   - strings escaped via jsonEscape (raw non-ASCII/astral — NOT \uXXXX surrogate pairs,
    //     which is the byte-distinct shape System.Text.Json's serializer would produce);
    //   - LF line endings (no CRLF) and a trailing newline (the reference files end "}\n").
    let body =
        results
        |> Seq.map (fun (k, v) -> "  " + jsonEscape k + ": " + jsonEscape v)
        |> String.concat ",\n"
    let json = "{\n" + body + "\n}\n"
    let outputPath = Path.Join(dir, "fsharp-output.json")
    // Write UTF-8 with NO BOM (matches the reference files); LF preserved by the explicit \n above.
    File.WriteAllText(outputPath, json, UTF8Encoding(false))

    Assert.Equal(0, mismatches)
