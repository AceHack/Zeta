using System;
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
    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    internal readonly struct Struct
    {
        public long EventTime { get; }
        public int Source { get; }

        public Struct(long eventTime, int source)
        {
            EventTime = eventTime;
            Source = source;
        }

        public static readonly Struct MinValue = new Struct(long.MinValue, 0);
        public static readonly Struct MaxValue = new Struct(long.MaxValue, 0);
    }

    internal readonly struct Timestamped<T>
    {
        public T Value { get; }
        public long EventTime { get; }

        public Timestamped(T value, long eventTime)
        {
            Value = value;
            EventTime = eventTime;
        }
    }

    internal enum StrategyKind
    {
        Monotonic,
        BoundedLateness,
        Periodic
    }

    internal sealed class Strategy
    {
        public StrategyKind Kind { get; }
        public long MaxLatenessMs { get; }
        public long IntervalMs { get; }

        private Strategy(StrategyKind kind, long maxLatenessMs, long intervalMs)
        {
            Kind = kind;
            MaxLatenessMs = maxLatenessMs;
            IntervalMs = intervalMs;
        }

        public static Strategy Monotonic() => new Strategy(StrategyKind.Monotonic, 0, 0);
        public static Strategy BoundedLateness(long maxLatenessMs) => new Strategy(StrategyKind.BoundedLateness, maxLatenessMs, 0);
        public static Strategy Periodic(long intervalMs, long latenessMs) => new Strategy(StrategyKind.Periodic, latenessMs, intervalMs);
    }

    internal sealed class Tracker
    {
        private long _maxSeen = long.MinValue;
        private long _lastEmitted = long.MinValue;

        public Strategy Strategy { get; }

        public Tracker(Strategy strategy)
        {
            Strategy = strategy;
        }

        private long CandidateFor(long observedMax)
        {
            switch (Strategy.Kind)
            {
                case StrategyKind.Monotonic:
                    return observedMax;
                case StrategyKind.BoundedLateness:
                    if (observedMax <= long.MinValue + Strategy.MaxLatenessMs)
                        return long.MinValue;
                    return observedMax - Strategy.MaxLatenessMs;
                case StrategyKind.Periodic:
                    if (observedMax <= long.MinValue + Strategy.MaxLatenessMs)
                        return long.MinValue;
                    return observedMax - Strategy.MaxLatenessMs;
                default:
                    throw new ArgumentOutOfRangeException(nameof(observedMax), "Invalid strategy kind");
            }
        }

        public long Observe(long eventTime)
        {
            if (eventTime > _maxSeen)
            {
                _maxSeen = eventTime;
            }
            var candidate = CandidateFor(_maxSeen);
            if (candidate > _lastEmitted)
            {
                _lastEmitted = candidate;
            }
            return _lastEmitted;
        }

        public long Current => _lastEmitted;
        public long MaxObserved => _maxSeen;
    }

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
                : (maxSeen <= long.MinValue + lateness ? long.MinValue : maxSeen - lateness);
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
