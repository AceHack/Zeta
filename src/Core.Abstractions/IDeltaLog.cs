using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Zeta.Core;

/// <summary>
/// Append-only delta log — the durable-tier mechanism for "persist inputs, recompute derived".
/// </summary>
/// <typeparam name="TKey">The key type.</typeparam>
/// <typeparam name="TDelta">The delta representation type (e.g. ZSet or ITensor).</typeparam>
public interface IDeltaLog<TKey, TDelta>
{
    /// <summary>
    /// Append a committed delta; returns the assigned sequence number (monotonic, starting at 1).
    /// </summary>
    ValueTask<long> AppendAsync(TDelta delta, IReadOnlyDictionary<string, string> captured, CancellationToken ct);

    /// <summary>
    /// Replay entries with seq strictly greater than <paramref name="fromSeqExclusive"/>, in order.
    /// </summary>
    ValueTask<DeltaLogEntry<TKey, TDelta>[]> ReplayAsync(long fromSeqExclusive, CancellationToken ct);

    /// <summary>Highest assigned sequence number (0 if empty).</summary>
    long HighWater { get; }

    /// <summary>
    /// GC entries with seq &lt;= <paramref name="throughSeqInclusive"/> — the log tail a durable snapshot has already absorbed.
    /// </summary>
    ValueTask TruncateAsync(long throughSeqInclusive, CancellationToken ct);
}
