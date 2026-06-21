using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Zeta.Core.CSharp;

/// <summary>
/// In-memory delta log — the reference implementation + the DST/test substrate.
/// Genuinely synchronous (a list under a lock), so returns completed ValueTasks;
/// that is truthful, not Task.Run fakery (there is no I/O to yield on).
/// </summary>
/// <typeparam name="TKey">The key type.</typeparam>
public sealed class InMemoryDeltaLog<TKey> : IDeltaLog<TKey, ZSet<TKey>>
{
    private readonly List<DeltaLogEntry<TKey, ZSet<TKey>>> _entries = new();
    private readonly System.Threading.Lock _gate = new();
    private long _nextSeq;

    /// <summary>
    /// Appends a committed delta; returns the assigned sequence number.
    /// </summary>
    /// <param name="delta">The delta payload.</param>
    /// <param name="captured">The captured non-determinism metadata.</param>
    /// <param name="ct">The cancellation token.</param>
    /// <returns>The assigned sequence number.</returns>
    public ValueTask<long> AppendAsync(ZSet<TKey> delta, IReadOnlyDictionary<string, string> captured, CancellationToken ct)
    {
        long seq;
        lock (_gate)
        {
            _nextSeq++;
            seq = _nextSeq;
            _entries.Add(new DeltaLogEntry<TKey, ZSet<TKey>>(seq, delta, captured));
        }
        return ValueTask.FromResult(seq);
    }

    /// <summary>
    /// Replays entries with sequence numbers strictly greater than fromSeqExclusive.
    /// </summary>
    /// <param name="fromSeqExclusive">The sequence number threshold (exclusive).</param>
    /// <param name="ct">The cancellation token.</param>
    /// <returns>The array of matching DeltaLogEntries in sequence order.</returns>
    public ValueTask<DeltaLogEntry<TKey, ZSet<TKey>>[]> ReplayAsync(long fromSeqExclusive, CancellationToken ct)
    {
        DeltaLogEntry<TKey, ZSet<TKey>>[] tail;
        lock (_gate)
        {
            var matched = new List<DeltaLogEntry<TKey, ZSet<TKey>>>();
            foreach (var e in _entries)
            {
                if (e.Seq > fromSeqExclusive)
                {
                    matched.Add(e);
                }
            }
            tail = matched.ToArray();
        }
        return ValueTask.FromResult(tail);
    }

    /// <summary>
    /// Gets the highest assigned sequence number (0 if empty).
    /// </summary>
    public long HighWater
    {
        get
        {
            lock (_gate)
            {
                return _nextSeq;
            }
        }
    }

    /// <summary>
    /// Truncates the log up to the specified sequence number (inclusive).
    /// </summary>
    /// <param name="throughSeqInclusive">The sequence number up to which to truncate.</param>
    /// <param name="ct">The cancellation token.</param>
    /// <returns>A ValueTask representing completion.</returns>
    public ValueTask TruncateAsync(long throughSeqInclusive, CancellationToken ct)
    {
        lock (_gate)
        {
            _entries.RemoveAll(e => e.Seq <= throughSeqInclusive);
        }
        return ValueTask.CompletedTask;
    }
}
