// C# oracle for the Ace canonical-JSON byte-lock (slice 8.8.2).
//
// This is the fourth language (after TS, Rust, F#) in
// `tests/cross-verification/canonical-json/`. Its output must byte-match the
// committed contract EXACTLY.
//
// Canonical rules reproduced from the TS seam (`canonicalBytes` / `encodeString`)
// and mirrored from the F# oracle (slice 8.8.1), which shares the same .NET runtime:
//   - object keys SORTED by String.CompareOrdinal (UTF-16 code-unit order = JS
//     Object.keys().sort()); C# matches natively, including astral keys, no special-case;
//   - arrays keep INSERTION order;
//   - numbers are integers ONLY, |v| <= 9007199254740991 (JS Number.isSafeInteger);
//     float / NaN / Infinity / out-of-range are rejected;
//   - strings + object keys must be well-formed UTF-16 — a lone surrogate is rejected
//     (System.Text.Json throws at GetString()/Name on transcode, caught per-vector);
//   - minified; raw unicode (astral preserved); escape only `"`, `\`,
//     the \b \f \n \r \t short-forms, and other control chars < 0x20 as lowercase \u00XX.

using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Text.Json;

namespace Zeta.Core.CSharp.AceCanonical;

/// <summary>
/// Ace canonical-JSON seam for C#.  Mirrors <c>tools/ace/canonical.ts</c>
/// <c>canonicalBytes</c> byte-for-byte.
/// </summary>
// MA0049: class name 'AceCanonical' matches the trailing segment of the namespace
// 'Zeta.Core.CSharp.AceCanonical'. Intentional — the class IS the canonical
// entry-point for this single-purpose library (mirrors Sha256 pattern).
#pragma warning disable MA0049
public static class AceCanonical
#pragma warning restore MA0049
{
    /// <summary>The JS <c>Number.MAX_SAFE_INTEGER</c> bound.</summary>
    private const long MaxSafeInteger = 9007199254740991L;

    /// <summary>
    /// Render <paramref name="element"/> to canonical JSON.
    /// Throws <see cref="AceCanonicalException"/> if the value is not Ace-canonical
    /// (float, unsafe-int, or unsupported kind).  For lone-surrogate strings/keys,
    /// <see cref="System.Text.Json"/> throws <see cref="System.InvalidOperationException"/> at
    /// <c>GetString()</c>/<c>Name</c> — that constitutes a rejection; the caller may
    /// catch either exception type.
    /// </summary>
    public static string Canonicalize(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Null => "null",
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",

            JsonValueKind.Number => CanonicalizeNumber(element),

            // GetString() may throw InvalidOperationException for a lone surrogate
            // stored in the JSON UTF-8; that throw propagates as a rejection.
            JsonValueKind.String => EncodeString(element.GetString()!),

            JsonValueKind.Array => CanonicalizeArray(element),
            JsonValueKind.Object => CanonicalizeObject(element),

            var other => throw new AceCanonicalException(
                $"unsupported JSON value kind {other}"),
        };
    }

    // ------------------------------------------------------------------
    // Number
    // ------------------------------------------------------------------

    private static string CanonicalizeNumber(JsonElement element)
    {
        // TryGetInt64 fails for any float / NaN / Infinity (and out-of-int64 range).
        // The explicit range check then enforces the JS Number.isSafeInteger bound.
        // NB: compare against the bounds directly rather than Math.Abs(v) — Math.Abs
        // throws OverflowException for long.MinValue, which would escape the documented
        // AceCanonicalException rejection contract; the direct comparison rejects
        // long.MinValue (and every other out-of-range value) cleanly as an
        // AceCanonicalException, matching the F#/Rust oracles' magnitude check.
        if (!element.TryGetInt64(out var v) || v < -MaxSafeInteger || v > MaxSafeInteger)
            throw new AceCanonicalException(
                "not a safe integer — Ace canonical content has no Float fields and " +
                "integers must be within the safe-integer range");

        // InvariantCulture: locale-safe decimal, matches Rust to_string / F# sprintf %d / JS String(n).
        return v.ToString(CultureInfo.InvariantCulture);
    }

    // ------------------------------------------------------------------
    // String / key encoding — mirrors TS encodeString char-by-char
    // ------------------------------------------------------------------

    /// <summary>
    /// Produce a <c>"…"</c>-wrapped, escape-safe JSON string value, exactly as
    /// the shared TS <c>encodeString</c> does: short-form escapes for
    /// <c>" \ \b \f \n \r \t</c>, lowercase <c>\u00XX</c> for other control
    /// chars &lt; 0x20, raw for everything else (including astral code units).
    /// Lone (unpaired) surrogates are rejected.
    /// </summary>
    private static string EncodeString(string s)
    {
        var sb = new StringBuilder();
        sb.Append('"');
        var i = 0;
        while (i < s.Length)
        {
            var ch = s[i];
            if (char.IsHighSurrogate(ch))
            {
                // A high surrogate must be immediately followed by a low surrogate.
                if (i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))
                {
                    // Well-formed astral pair: append both code units raw.
                    sb.Append(ch).Append(s[i + 1]);
                    i += 2;
                }
                else
                {
                    throw new AceCanonicalException(
                        "lone surrogate (unpaired high surrogate, not well-formed UTF-16)");
                }
            }
            else if (char.IsLowSurrogate(ch))
            {
                // A low surrogate without a preceding high is unpaired.
                throw new AceCanonicalException(
                    "lone surrogate (unpaired low surrogate, not well-formed UTF-16)");
            }
            else
            {
                AppendEscapedChar(sb, ch);
                i++;
            }
        }
        sb.Append('"');
        return sb.ToString();
    }

    /// <summary>
    /// Append the canonical escape of one .NET char (UTF-16 code unit, guaranteed
    /// not a surrogate) to <paramref name="sb"/>.
    /// </summary>
    private static void AppendEscapedChar(StringBuilder sb, char ch)
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
                    // Lowercase 4-digit hex (matches JS code.toString(16).padStart(4,"0")).
                    sb.Append("\\u").Append(code.ToString("x4", CultureInfo.InvariantCulture));
                else
                    sb.Append(ch);
                break;
        }
    }

    // ------------------------------------------------------------------
    // Array
    // ------------------------------------------------------------------

    private static string CanonicalizeArray(JsonElement element)
    {
        var parts = new List<string>();
        foreach (var item in element.EnumerateArray())
            parts.Add(Canonicalize(item));
        return "[" + string.Join(",", parts) + "]";
    }

    // ------------------------------------------------------------------
    // Object (keys sorted by String.CompareOrdinal = UTF-16 code-unit = JS sort)
    // ------------------------------------------------------------------

    private static string CanonicalizeObject(JsonElement element)
    {
        // Collect (key, value) pairs.
        var pairs = new List<(string Key, JsonElement Value)>();
        foreach (var prop in element.EnumerateObject())
        {
            // prop.Name may throw InvalidOperationException for a lone-surrogate key
            // (System.Text.Json transcodes UTF-8 → UTF-16 here); that throw propagates
            // as a rejection from the caller's try/catch.
            pairs.Add((prop.Name, prop.Value));
        }

        // Sort by key: String.CompareOrdinal is UTF-16 code-unit order = JS .sort().
        pairs.Sort((a, b) => string.CompareOrdinal(a.Key, b.Key));

        var parts = new List<string>(pairs.Count);
        foreach (var (key, value) in pairs)
        {
            var keyJson = EncodeString(key);
            var valJson = Canonicalize(value);
            parts.Add(keyJson + ":" + valJson);
        }
        return "{" + string.Join(",", parts) + "}";
    }
}
