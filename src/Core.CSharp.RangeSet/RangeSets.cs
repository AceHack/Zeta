using System.Globalization;

namespace Zeta.Core.CSharp.RangeSet;

/// <summary>
/// RangeSet operations — the C# oracle (#3 of TS/F#/C#/Rust) for the sparse-integer-set
/// primitive in compact range notation (<c>"1-5,8,10-17"</c>). The TS reference
/// (<c>src/Core.TypeScript/range-set/</c>) authors the shared <c>golden-vectors.json</c>; this
/// replays it: <c>Render(Parse(input))</c> equals the <b>canonical</b> form, and <c>Contains</c>
/// agrees. "The compilers don't lie."
///
/// <para>Canonical form (the cross-oracle byte-diff contract): intervals sorted, disjoint, and
/// <b>non-adjacent</b> (overlapping AND touching coalesce, <c>1-3,4-6 → 1-6</c>), each emitted as
/// <c>n</c> when <c>Lo == Hi</c> else <c>Lo-Hi</c>, joined by <c>,</c> with no spaces; the empty
/// set renders <c>""</c>. Non-negative JS-safe integers. (The set is an
/// <see cref="IReadOnlyList{Interval}"/> in the canonical invariant.)</para>
/// </summary>
public static class RangeSets
{
    // the shared JS-safe-integer ceiling (2^53 - 1) — the int wire domain (matches Bonsai)
    private const long MaxSafeInt = 9007199254740991L;

    private static Result<IReadOnlyList<Interval>, RangeSetFeedback>.Err Decline(RangeSetFeedback f) => new(f);

    /// <summary>Parse a non-negative integer token strictly: digits only, within the safe range.</summary>
    private static long? ParseNat(string token)
    {
        if (token.Length == 0)
        {
            return null;
        }

        foreach (var c in token)
        {
            if (c is < '0' or > '9')
            {
                return null;
            }
        }

        return long.TryParse(token, NumberStyles.None, CultureInfo.InvariantCulture, out var n) && n >= 0 && n <= MaxSafeInt
            ? n
            : null;
    }

    /// <summary>Normalize raw intervals to the canonical invariant: sort, then coalesce overlapping/adjacent.</summary>
    private static List<Interval> Normalize(List<Interval> ranges)
    {
        if (ranges.Count == 0)
        {
            return [];
        }

        ranges.Sort((a, b) => a.Lo != b.Lo ? a.Lo.CompareTo(b.Lo) : a.Hi.CompareTo(b.Hi));
        var merged = new List<Interval>();
        foreach (var r in ranges)
        {
            var last = merged.Count > 0 ? merged[^1] : null;
            // coalesce when the next interval overlaps OR touches the previous (Lo <= last.Hi + 1)
            if (last is not null && r.Lo <= last.Hi + 1)
            {
                merged[^1] = last with { Hi = Math.Max(last.Hi, r.Hi) };
            }
            else
            {
                merged.Add(r);
            }
        }

        return merged;
    }

    /// <summary>Parse one token ("n" or "lo-hi") into an interval, or decline.</summary>
    private static Result<Interval, RangeSetFeedback> ParseToken(string token)
    {
        var parts = token.Split('-');
        if (parts.Length == 1)
        {
            var n = ParseNat(parts[0]);
            return n is null
                ? new Result<Interval, RangeSetFeedback>.Err(new RangeSetFeedback.NotInteger(token))
                : new Result<Interval, RangeSetFeedback>.Ok(new Interval(n.Value, n.Value));
        }

        if (parts.Length == 2)
        {
            // an empty sub-token ("-3", "5-") is structurally missing, not a bad number
            if (parts[0].Length == 0 || parts[1].Length == 0)
            {
                return new Result<Interval, RangeSetFeedback>.Err(new RangeSetFeedback.Malformed(token));
            }

            var lo = ParseNat(parts[0]);
            var hi = ParseNat(parts[1]);
            if (lo is null)
            {
                return new Result<Interval, RangeSetFeedback>.Err(new RangeSetFeedback.NotInteger(parts[0]));
            }

            if (hi is null)
            {
                return new Result<Interval, RangeSetFeedback>.Err(new RangeSetFeedback.NotInteger(parts[1]));
            }

            return lo.Value > hi.Value
                ? new Result<Interval, RangeSetFeedback>.Err(new RangeSetFeedback.InvertedRange(lo.Value, hi.Value))
                : new Result<Interval, RangeSetFeedback>.Ok(new Interval(lo.Value, hi.Value));
        }

        return new Result<Interval, RangeSetFeedback>.Err(new RangeSetFeedback.Malformed(token));
    }

    /// <summary>Parse compact range notation into a canonical range set. Empty string → empty set.</summary>
    /// <param name="s">The compact range expression.</param>
    public static Result<IReadOnlyList<Interval>, RangeSetFeedback> Parse(string s)
    {
        // result-over-throw / no-exception-crosses-boundary: a null input declines a feedback
        // variant rather than throwing (matches the sibling oracle BonsaiCodec.Parse on null).
        if (s is null)
        {
            return Decline(new RangeSetFeedback.Malformed("input was not a string"));
        }

        var trimmed = s.Trim();
        if (trimmed.Length == 0)
        {
            return new Result<IReadOnlyList<Interval>, RangeSetFeedback>.Ok([]);
        }

        var ranges = new List<Interval>();
        foreach (var raw in trimmed.Split(','))
        {
            var token = raw.Trim();
            if (token.Length == 0)
            {
                return Decline(new RangeSetFeedback.Malformed(raw));
            }

            switch (ParseToken(token))
            {
                case Result<Interval, RangeSetFeedback>.Ok ok:
                    ranges.Add(ok.Value);
                    break;
                case Result<Interval, RangeSetFeedback>.Err err:
                    return Decline(err.Error);
                default:
                    return Decline(new RangeSetFeedback.Malformed(token));
            }
        }

        return new Result<IReadOnlyList<Interval>, RangeSetFeedback>.Ok(Normalize(ranges));
    }

    /// <summary>Render a range set to its canonical compact string.</summary>
    /// <param name="rs">The range set.</param>
    public static string Render(IReadOnlyList<Interval> rs) =>
        string.Join(
            ",",
            rs.Select(r => r.Lo == r.Hi
                ? r.Lo.ToString(CultureInfo.InvariantCulture)
                : $"{r.Lo.ToString(CultureInfo.InvariantCulture)}-{r.Hi.ToString(CultureInfo.InvariantCulture)}"));

    /// <summary>Whether <paramref name="n"/> is a member (intervals are sorted, so the scan early-exits).</summary>
    /// <param name="rs">The range set.</param>
    /// <param name="n">The integer to test.</param>
    public static bool Contains(IReadOnlyList<Interval> rs, long n)
    {
        foreach (var r in rs)
        {
            if (n < r.Lo)
            {
                return false;
            }

            if (n <= r.Hi)
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>The union of two range sets, re-normalized to canonical form.</summary>
    /// <param name="a">The first set.</param>
    /// <param name="b">The second set.</param>
    public static IReadOnlyList<Interval> Union(IReadOnlyList<Interval> a, IReadOnlyList<Interval> b) =>
        Normalize([.. a, .. b]);

    /// <summary>Add a single integer to the set (returns a new canonical set).</summary>
    /// <param name="rs">The range set.</param>
    /// <param name="n">The integer to add.</param>
    public static IReadOnlyList<Interval> Add(IReadOnlyList<Interval> rs, long n) =>
        Normalize([.. rs, new Interval(n, n)]);

    /// <summary>The total count of integers covered by the set.</summary>
    /// <param name="rs">The range set.</param>
    public static long Size(IReadOnlyList<Interval> rs)
    {
        long total = 0;
        foreach (var r in rs)
        {
            total += r.Hi - r.Lo + 1;
        }

        return total;
    }
}
