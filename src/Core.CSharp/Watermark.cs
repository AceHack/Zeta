using System.Collections.Generic;

namespace Zeta.Core.CSharp;

/// <summary>
/// Watermark — the event-time watermark of Akidau et al. (The Dataflow Model, VLDB 2015), C# oracle.
/// Conforms to the F# canonical shape (<c>src/Core/Watermark.fs</c>) by agreeing on the shared seed
/// (<c>src/Core.TypeScript/watermark/golden-vectors.json</c>) that the F#/TS/Rust oracles also verify.
/// All <c>long</c> arithmetic — no floats, byte-lockable in the safe-integer range.
/// </summary>
public static class Watermark
{
    /// <summary>
    /// The <c>WatermarkTracker</c> fold: the emitted watermark after each observed event time.
    /// maxSeen = running max; candidate = maxSeen (monotonic) or maxSeen - lateness (bounded; the
    /// Periodic formula too); clamped monotone non-decreasing.
    /// </summary>
    public static IReadOnlyList<long> Observe(string strategy, long lateness, IReadOnlyList<long> events)
    {
        var maxSeen = long.MinValue;
        var lastEmitted = long.MinValue;
        var outp = new List<long>(events.Count);
        foreach (var e in events)
        {
            if (e > maxSeen)
            {
                maxSeen = e;
            }

            var candidate = string.Equals(strategy, "monotonic", System.StringComparison.Ordinal)
                ? maxSeen
                : (maxSeen == long.MinValue ? long.MinValue : maxSeen - lateness);
            if (candidate > lastEmitted)
            {
                lastEmitted = candidate;
            }

            outp.Add(lastEmitted);
        }

        return outp;
    }

    /// <summary>Is <paramref name="eventTime"/> late according to the current watermark?</summary>
    public static bool IsLate(long wm, long eventTime) => eventTime <= wm;

    /// <summary>Combine per-source watermarks downstream: min (can't progress past the slowest input).</summary>
    public static long Combine(IReadOnlyList<long> sources)
    {
        var min = long.MaxValue;
        var any = false;
        foreach (var s in sources)
        {
            any = true;
            if (s < min)
            {
                min = s;
            }
        }

        return any ? min : long.MinValue;
    }
}
