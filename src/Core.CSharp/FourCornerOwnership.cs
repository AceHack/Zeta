// FourCorner — the bidirectional-feedback I/O object (four corners = data×feedback × in×out).
// C# parity oracle; mirrors src/Core/FourCorner.fs (the F# oracle that LOCKED the treaty bytes) and the
// original src/Core.TypeScript/workflow-engine/types.ts FourCornerOwnership. TInFeedback is co-owned — both sides
// contribute — "each is backpressure from the other's perspective".
//
// TREATY (B-1022 trigger fired: "we are the consumer for our treaties"): ToLine/OfLine is the canonical
// text wire form for the string-quad instantiation; this oracle MUST produce/consume byte-identical
// lines to the F# oracle against src/Core.TypeScript/four-corner/golden-vectors.lines.

using System;
using System.Text;

namespace Zeta.Core.CSharp;

/// <summary>
/// The four-corner ownership object: data flows forward (<see cref="TIn"/> → <see cref="TOut"/>),
/// feedback flows back (<see cref="TOutFeedback"/> / <see cref="TInFeedback"/>). <c>TIn</c> is required;
/// the other corners are optional (<c>null</c> = not yet filled — mirrors the F# <c>option</c> / TS <c>?</c>).
/// </summary>
public sealed record FourCornerOwnership(
    string TIn,
    string? TOut,
    string? TOutFeedback,
    string? TInFeedback)
{
    /// <summary>Just the input — no output, no feedback yet (the resting corner).</summary>
    public static FourCornerOwnership OfIn(string tIn) => new(tIn, null, null, null);

    /// <summary>Has the tick produced output yet? (the forward corner is filled)</summary>
    public bool HasOutput => TOut is not null;

    /// <summary>Has feedback crossed in either direction? (the backpressure corners)</summary>
    public bool HasFeedback => TOutFeedback is not null || TInFeedback is not null;

    private static string Esc(string s) =>
        s.Replace("\\", "\\\\").Replace("\t", "\\t").Replace("\n", "\\n").Replace("\r", "\\r");

    private static string Unesc(string s)
    {
        var sb = new StringBuilder();
        for (var i = 0; i < s.Length; i++)
        {
            if (s[i] == '\\' && i + 1 < s.Length)
            {
                sb.Append(s[i + 1] switch { 't' => '\t', 'n' => '\n', 'r' => '\r', var c => c });
                i++;
            }
            else
            {
                sb.Append(s[i]);
            }
        }

        return sb.ToString();
    }

    private static string OptToText(string? v) => v is null ? "-" : "+" + Esc(v);

    private static bool TryOptOfText(string s, out string? value)
    {
        if (string.Equals(s, "-", StringComparison.Ordinal)) { value = null; return true; }
        if (s.StartsWith('+')) { value = Unesc(s[1..]); return true; }
        value = null;
        return false; // malformed
    }

    /// <summary>Serialize to the canonical treaty line (byte-identical to the F# oracle).</summary>
    public string ToLine() =>
        $"fourcorner1\t{Esc(TIn)}\t{OptToText(TOut)}\t{OptToText(TOutFeedback)}\t{OptToText(TInFeedback)}";

    /// <summary>Parse a canonical treaty line; <c>null</c> on malformed input (honest refusal).</summary>
    public static FourCornerOwnership? OfLine(string line)
    {
        var parts = line.Split('\t');
        if (parts.Length != 5 || !string.Equals(parts[0], "fourcorner1", StringComparison.Ordinal)) return null;
        if (!TryOptOfText(parts[2], out var tOut)) return null;
        if (!TryOptOfText(parts[3], out var tOutFb)) return null;
        if (!TryOptOfText(parts[4], out var tInFb)) return null;
        return new FourCornerOwnership(Unesc(parts[1]), tOut, tOutFb, tInFb);
    }
}
