using System;
using System.Collections.Generic;

namespace Zeta.Core;

/// <summary>
/// One entry in the delta log — the durable record of a committed input.
/// </summary>
/// <typeparam name="TKey">The key type.</typeparam>
/// <typeparam name="TDelta">The delta representation type (e.g. ZSet or ITensor).</typeparam>
public sealed class DeltaLogEntry<TKey, TDelta>
{
    /// <summary>Logical sequence number of the entry.</summary>
    public long Seq { get; }

    /// <summary>The delta payload.</summary>
    public TDelta Delta { get; }

    /// <summary>Captured non-determinism metadata (e.g. clock read, random seed).</summary>
    public IReadOnlyDictionary<string, string> Captured { get; }

    /// <summary>Construct a new DeltaLogEntry.</summary>
    public DeltaLogEntry(long seq, TDelta delta, IReadOnlyDictionary<string, string> captured)
    {
        Seq = seq;
        Delta = delta;
        Captured = captured ?? throw new ArgumentNullException(nameof(captured));
    }
}
