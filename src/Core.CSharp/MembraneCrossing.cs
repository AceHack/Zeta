// MembraneCrossing — one line of the membrane log (the RecordedSource wire form). C# parity oracle;
// mirrors src/Core/RecordedSource.fs (the F# oracle that LOCKED the membrane-log treaty) and the TS/Rust
// siblings. MEMBRANE-LOG TREATY: ToLine/OfLine must reproduce the shared golden lines byte-for-byte
// (src/Core.TypeScript/recorded-source/golden-vectors.lines) — the channel-reliability surface.

using System;
using System.Globalization;
using System.Text;

namespace Zeta.Core.CSharp;

/// <summary>
/// One membrane crossing: <c>tick</c> + interrupt <c>Kind</c> + a typed arg (int-kinds carry
/// <see cref="IntArg"/>, string-kinds carry <see cref="StrArg"/>, SentinelMissing carries none).
/// </summary>
public sealed record MembraneCrossing(int Tick, string Kind, int? IntArg, string? StrArg)
{
    private static readonly string[] IntKinds =
        ["TimerElapsed", "DotGitSaturation", "RoundsElapsedSinceFreeTime", "PeerPRMerged"];

    private static readonly string[] StrKinds =
        ["RateLimitExhausted", "OperatorMessageArrived", "CIFailureDetected"];

    private static bool IsIntKind(string k) => Array.IndexOf(IntKinds, k) >= 0;

    private static bool IsStrKind(string k) => Array.IndexOf(StrKinds, k) >= 0;

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

    /// <summary>Serialize to the canonical wire line (byte-identical to the F# oracle).</summary>
    public string ToLine()
    {
        if (IsIntKind(Kind)) return FormattableString.Invariant($"{Tick}\t{Kind}\t{IntArg!.Value}");
        if (IsStrKind(Kind)) return FormattableString.Invariant($"{Tick}\t{Kind}\t{Esc(StrArg!)}");
        return FormattableString.Invariant($"{Tick}\t{Kind}");
    }

    /// <summary>Parse a canonical wire line; null on malformed/unknown-kind (honest refusal).</summary>
    public static MembraneCrossing? OfLine(string line)
    {
        var parts = line.Split('\t');
        if (parts.Length < 2) return null;
        if (!int.TryParse(parts[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out var tick)) return null;
        var kind = parts[1];

        if (string.Equals(kind, "SentinelMissing", StringComparison.Ordinal))
        {
            return parts.Length == 2 ? new MembraneCrossing(tick, kind, null, null) : null;
        }

        if (IsIntKind(kind))
        {
            return parts.Length == 3
                && int.TryParse(parts[2], NumberStyles.Integer, CultureInfo.InvariantCulture, out var v)
                ? new MembraneCrossing(tick, kind, v, null)
                : null;
        }

        if (IsStrKind(kind))
        {
            return parts.Length == 3 ? new MembraneCrossing(tick, kind, null, Unesc(parts[2])) : null;
        }

        return null; // unknown kind
    }
}
