// Cross-verify generator for the canonical-JSON byte-lock — C# oracle (slice 8.8.2).
//
// Reads tests/cross-verification/canonical-json/vectors.json, exercises the C# seam
// (Zeta.Core.CSharp.AceCanonical.AceCanonical.Canonicalize), and writes cs-output.json
// byte-identical to the committed ts-/rust-/fsharp-output.json reference files.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp.AceCanonical;

namespace Zeta.Tests.CSharp.CanonicalJson;

public class CrossVerifyTests
{
    // ------------------------------------------------------------------
    // Repo-root walk (identical pattern to ZetaId/CrossVerifyTests.cs)
    // ------------------------------------------------------------------

    private static string RepoRoot()
    {
        // Walk up from the test assembly looking for Zeta.sln (sentinel at repo root).
        // .git is unreliable in a worktree (it is a file, not a directory).
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(CrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
            dir = dir.Parent;
        return dir?.FullName
            ?? throw new InvalidOperationException(
                "Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    // ------------------------------------------------------------------
    // Output-file string escaping — JS JSON.stringify equivalent
    // ------------------------------------------------------------------

    /// <summary>
    /// Escape one string as a <c>"…"</c>-wrapped JSON string the way JS
    /// <c>JSON.stringify</c> does: short-form escapes for
    /// <c>" \ \b \f \n \r \t</c>, lowercase <c>\u00XX</c> for other control
    /// chars &lt; 0x20, and EVERYTHING else (including non-ASCII / astral)
    /// emitted RAW.  This is what ts-output.json (JSON.stringify) and
    /// rust-output.json (serde_json) produce.
    ///
    /// NOTE: this is for wrapping the OUTPUT MAP into cs-output.json — NOT the
    /// canonical content itself (that is the seam's Canonicalize).  We do NOT use
    /// System.Text.Json's serializer for the wrap because even its
    /// UnsafeRelaxedJsonEscaping encoder escapes astral characters as
    /// \uXXXX\uXXXX surrogate pairs, which is byte-distinct from the raw-UTF-8
    /// astral that JSON.stringify / serde_json emit.  The map's keys + values
    /// here are all well-formed UTF-16 (canonical strings or "&lt;rejected&gt;"),
    /// so no lone-surrogate handling is needed.
    /// </summary>
    private static string JsonEscape(string s)
    {
        var sb = new StringBuilder();
        sb.Append('"');
        foreach (var ch in s)
        {
            switch (ch)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b"); break;
                case '\f': sb.Append("\\f"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    var code = (int)ch;
                    if (code <= 0x1f)
                        sb.Append("\\u").Append(code.ToString("x4", CultureInfo.InvariantCulture));
                    else
                        sb.Append(ch);
                    break;
            }
        }
        sb.Append('"');
        return sb.ToString();
    }

    // ------------------------------------------------------------------
    // Per-block helpers (factored out to stay within the method-length limit)
    // ------------------------------------------------------------------

    private static (List<(string Key, string Value)> Results, int Mismatches)
        ProcessCanonicalVectors(JsonElement canonical)
    {
        var results = new List<(string Key, string Value)>();
        var mismatches = 0;
        foreach (var vec in canonical.EnumerateArray())
        {
            var id = vec.GetProperty("id").GetString()!;
            var expected = vec.GetProperty("expected_canonical_json").GetString()!;
            var value = vec.GetProperty("value");
            // Canonical vectors MUST canonicalize — no catch here. If the seam throws,
            // that is a genuine bug for a vector we expect to succeed, so let it
            // propagate and fail the test loudly (no generic catch masking it).
            var actual = AceCanonical.Canonicalize(value);
            results.Add(($"canonical:{id}", actual));
            if (!string.Equals(actual, expected, StringComparison.Ordinal)) mismatches++;
        }
        return (results, mismatches);
    }

    private static (List<(string Key, string Value)> Results, int Mismatches)
        ProcessInvalidVectors(JsonElement invalid)
    {
        var results = new List<(string Key, string Value)>();
        var mismatches = 0;
        foreach (var vec in invalid.EnumerateArray())
        {
            var id = vec.GetProperty("id").GetString()!;
            string actual;
            try
            {
                var value = vec.GetProperty("value");
                actual = AceCanonical.Canonicalize(value);
                // If we reach here, the seam accepted an invalid vector (a mismatch
                // recorded below). Typed catches below — NOT a generic catch — so only
                // the two expected rejection paths map to "<rejected>"; any unexpected
                // exception propagates and fails the test (CodeQL cs/catch-of-all-exceptions).
            }
            // The seam's fail-loud rejection (float / unsafe-int / unsupported / lone surrogate
            // detected in EncodeString).
            catch (AceCanonicalException) { actual = "<rejected>"; }
            // System.Text.Json transcode throw at GetString()/Name for a lone-surrogate
            // value or key — also a legitimate rejection.
            catch (InvalidOperationException) { actual = "<rejected>"; }
            results.Add(($"invalid:{id}", actual));
            if (!string.Equals(actual, "<rejected>", StringComparison.Ordinal)) mismatches++;
        }
        return (results, mismatches);
    }

    private static void WriteOutputFile(string outputPath, List<(string Key, string Value)> results)
    {
        // Match the committed ts-/rust-/fsharp-output.json byte shape EXACTLY by
        // hand-emitting the flat `{ "key": "value", ... }` object the way JS
        // JSON.stringify(obj, null, 2) does:
        //   - 2-space indent, ": " (colon-space) separator, ",\n" between entries;
        //   - strings escaped via JsonEscape (raw non-ASCII/astral — NOT \uXXXX pairs);
        //   - LF line endings and a single trailing newline (reference files end "}\n").
        var lines = new List<string>(results.Count);
        foreach (var (k, v) in results)
            lines.Add("  " + JsonEscape(k) + ": " + JsonEscape(v));
        var json = "{\n" + string.Join(",\n", lines) + "\n}\n";
        // Write UTF-8 with NO BOM (matches the reference files).
        File.WriteAllText(outputPath, json, new UTF8Encoding(false));
    }

    // ------------------------------------------------------------------
    // Cross-verify fact
    // ------------------------------------------------------------------

    [Fact]
    public void CrossVerifyCanonicalJsonVectorsMatchExpectedCanonicalJson()
    {
        var root = RepoRoot();
        // Path.Join (not Path.Combine) — CodeQL flags Path.Combine when later
        // segments could be rooted; Path.Join always concatenates with separators.
        var dir = Path.Join(root, "tests", "cross-verification", "canonical-json");
        var vectorsPath = Path.Join(dir, "vectors.json");
        var vectorsText = File.ReadAllText(vectorsPath);

        // The WHOLE vectors.json parses cleanly even with lone-surrogate \uD800
        // escapes inside the invalid block: System.Text.Json stores those as raw
        // JSON and only THROWS at GetString()/Name transcode time.  We therefore
        // parse once here, then wrap each per-vector seam call in try/catch so
        // a transcode-throw OR an AceCanonicalException both record "<rejected>".
        using var doc = JsonDocument.Parse(vectorsText);
        var rootEl = doc.RootElement;

        // Insertion-ordered results: canonical[*] (vectors.json order) then invalid[*],
        // matching the committed ts-/rust-/fsharp-output.json byte order.
        var (canonicalResults, canonicalMismatches) =
            ProcessCanonicalVectors(rootEl.GetProperty("canonical"));
        var (invalidResults, invalidMismatches) =
            ProcessInvalidVectors(rootEl.GetProperty("invalid"));

        var allResults = new List<(string Key, string Value)>(
            canonicalResults.Count + invalidResults.Count);
        allResults.AddRange(canonicalResults);
        allResults.AddRange(invalidResults);

        var outputPath = Path.Join(dir, "cs-output.json");
        WriteOutputFile(outputPath, allResults);

        Assert.Equal(0, canonicalMismatches + invalidMismatches);
    }
}
