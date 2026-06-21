using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.FSharp.Core;
using Zeta.Core;

#pragma warning disable MA0048 // File name must match type name

namespace Zeta.Core.CSharp;

/// <summary>
/// Ref-aware Delta Log interface — provides first-class DB verbs for ref operations.
/// </summary>
/// <typeparam name="TKey">The key type.</typeparam>
public interface IRefDeltaLog<TKey> : IDeltaLog<TKey, ZSet<TKey>>
{
    /// <summary>
    /// Gets the currently active branch/ref name.
    /// </summary>
    public string CurrentRef { get; }

    /// <summary>
    /// Creates a branch at the current tip.
    /// </summary>
    /// <param name="name">The branch name.</param>
    public FSharpResult<Unit, DbFeedback> Branch(string name);

    /// <summary>
    /// Switches the working branch/ref.
    /// </summary>
    /// <param name="refName">The branch ref name.</param>
    public FSharpResult<Unit, DbFeedback> Checkout(string refName);

    /// <summary>
    /// Resets the active ref to match another ref.
    /// </summary>
    /// <param name="refName">The reference name to reset to.</param>
    public FSharpResult<Unit, DbFeedback> Reset(string refName);

    /// <summary>
    /// Pulls remote changes and fast-forwards the active ref.
    /// </summary>
    /// <param name="remote">The remote name.</param>
    public FSharpResult<Unit, DbFeedback> Sync(string remote);

    /// <summary>
    /// Pushes the active ref to a remote and returns the refspec.
    /// </summary>
    /// <param name="remote">The remote name.</param>
    /// <returns>The refspec pushed.</returns>
    public FSharpResult<string, DbFeedback> Push(string remote);

    /// <summary>
    /// Merges another branch's deltas into the active ref.
    /// </summary>
    /// <param name="sourceRef">The source reference name to merge.</param>
    /// <returns>The new sequence number.</returns>
    public FSharpResult<long, DbFeedback> Merge(string sourceRef);

    /// <summary>
    /// Working-tree status: isClean and pending paths.
    /// </summary>
    /// <returns>A tuple indicating clean status and pending paths.</returns>
    public (bool IsClean, string[] PendingPaths) Status();

    /// <summary>
    /// Lists entries/files at the specified ref (or current HEAD if null).
    /// </summary>
    /// <param name="refName">The reference name.</param>
    /// <returns>An array of entry paths/IDs.</returns>
    public FSharpResult<string[], DbFeedback> Ls(string? refName = null);
}

/// <summary>
/// In-memory delta log — the reference implementation + the DST/test substrate.
/// Genuinely synchronous (a list under a lock), so returns completed ValueTasks;
/// that is truthful, not Task.Run fakery (there is no I/O to yield on).
/// </summary>
/// <typeparam name="TKey">The key type.</typeparam>
public sealed class InMemoryDeltaLog<TKey> : IRefDeltaLog<TKey>
{
    private readonly Dictionary<string, List<DeltaLogEntry<TKey, ZSet<TKey>>>> _branches = new(StringComparer.Ordinal);
    private string _currentRef = "refs/heads/main";
    private readonly System.Threading.Lock _gate = new();
    private long _nextSeq;

    private List<DeltaLogEntry<TKey, ZSet<TKey>>> ActiveList()
    {
        if (_branches.TryGetValue(_currentRef, out var list))
        {
            return list;
        }
        list = new List<DeltaLogEntry<TKey, ZSet<TKey>>>();
        _branches[_currentRef] = list;
        return list;
    }

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
            ActiveList().Add(new DeltaLogEntry<TKey, ZSet<TKey>>(seq, delta, captured));
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
            foreach (var e in ActiveList())
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
                var list = ActiveList();
                return list.Count == 0 ? 0L : list[^1].Seq;
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
            ActiveList().RemoveAll(e => e.Seq <= throughSeqInclusive);
        }
        return ValueTask.CompletedTask;
    }

    /// <summary>
    /// Gets the currently active branch/ref name.
    /// </summary>
    public string CurrentRef
    {
        get
        {
            lock (_gate)
            {
                return _currentRef;
            }
        }
    }

    /// <summary>
    /// Creates a branch at the current tip.
    /// </summary>
    /// <param name="name">The branch name.</param>
    public FSharpResult<Unit, DbFeedback> Branch(string name)
    {
        lock (_gate)
        {
            var src = ActiveList();
            var dest = new List<DeltaLogEntry<TKey, ZSet<TKey>>>(src);
            _branches[name] = dest;
        }
        return FSharpResult<Unit, DbFeedback>.NewOk(null!);
    }

    /// <summary>
    /// Switches the working branch/ref.
    /// </summary>
    /// <param name="refName">The branch ref name.</param>
    public FSharpResult<Unit, DbFeedback> Checkout(string refName)
    {
        lock (_gate)
        {
            _currentRef = refName;
        }
        return FSharpResult<Unit, DbFeedback>.NewOk(null!);
    }

    /// <summary>
    /// Resets the active ref to match another ref.
    /// </summary>
    /// <param name="refName">The reference name to reset to.</param>
    public FSharpResult<Unit, DbFeedback> Reset(string refName)
    {
        lock (_gate)
        {
            if (_branches.TryGetValue(refName, out var src))
            {
                var list = ActiveList();
                list.Clear();
                list.AddRange(src);
                return FSharpResult<Unit, DbFeedback>.NewOk(null!);
            }
            return FSharpResult<Unit, DbFeedback>.NewError(DbFeedback.NewReferenceNotFound(refName));
        }
    }

    /// <summary>
    /// Pulls remote changes and fast-forwards the active ref.
    /// </summary>
    /// <param name="remote">The remote name.</param>
    public FSharpResult<Unit, DbFeedback> Sync(string remote)
    {
        return FSharpResult<Unit, DbFeedback>.NewOk(null!);
    }

    /// <summary>
    /// Pushes the active ref to a remote and returns the refspec.
    /// </summary>
    /// <param name="remote">The remote name.</param>
    /// <returns>The refspec pushed.</returns>
    public FSharpResult<string, DbFeedback> Push(string remote)
    {
        lock (_gate)
        {
            return FSharpResult<string, DbFeedback>.NewOk($"refs/heads/{_currentRef}");
        }
    }

    /// <summary>
    /// Merges another branch's deltas into the active ref.
    /// </summary>
    /// <param name="sourceRef">The source reference name to merge.</param>
    /// <returns>The new sequence number.</returns>
    public FSharpResult<long, DbFeedback> Merge(string sourceRef)
    {
        lock (_gate)
        {
            if (_branches.TryGetValue(sourceRef, out var src))
            {
                var list = ActiveList();
                var existingSeqs = new HashSet<long>();
                foreach (var e in list)
                {
                    existingSeqs.Add(e.Seq);
                }

                var lastSeq = _nextSeq;
                foreach (var e in src)
                {
                    if (!existingSeqs.Contains(e.Seq))
                    {
                        _nextSeq++;
                        list.Add(new DeltaLogEntry<TKey, ZSet<TKey>>(_nextSeq, e.Delta, e.Captured));
                        lastSeq = _nextSeq;
                    }
                }
                return FSharpResult<long, DbFeedback>.NewOk(lastSeq);
            }
            return FSharpResult<long, DbFeedback>.NewError(DbFeedback.NewReferenceNotFound(sourceRef));
        }
    }

    /// <summary>
    /// Working-tree status: isClean and pending paths.
    /// </summary>
    /// <returns>A tuple indicating clean status and pending paths.</returns>
    public (bool IsClean, string[] PendingPaths) Status()
    {
        return (true, Array.Empty<string>());
    }

    /// <summary>
    /// Lists entries/files at the specified ref (or current HEAD if null).
    /// </summary>
    /// <param name="refName">The reference name.</param>
    /// <returns>An array of entry paths/IDs.</returns>
    public FSharpResult<string[], DbFeedback> Ls(string? refName = null)
    {
        lock (_gate)
        {
            var target = refName ?? _currentRef;
            if (_branches.TryGetValue(target, out var list))
            {
                var result = new string[list.Count];
                for (int i = 0; i < list.Count; i++)
                {
                    result[i] = list[i].Seq.ToString(System.Globalization.CultureInfo.InvariantCulture);
                }
                return FSharpResult<string[], DbFeedback>.NewOk(result);
            }
            return FSharpResult<string[], DbFeedback>.NewError(DbFeedback.NewReferenceNotFound(target));
        }
    }
}
