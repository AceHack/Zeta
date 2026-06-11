using System.Threading;
using System.Threading.Tasks;

namespace Zeta.Core;

/// <summary>
/// Snapshot store with stable, manifest-tracked addressing.
/// </summary>
/// <typeparam name="TKey">The key type.</typeparam>
/// <typeparam name="TState">The state representation type (e.g. ZSet or ITensor).</typeparam>
public interface ISnapshotStore<TKey, TState>
{
    /// <summary>Persist state at seq; update the durable manifest; return the pointer.</summary>
    public Task<SnapshotPointer> WriteAsync(long seq, TState state, CancellationToken ct);

    /// <summary>Load a snapshot by pointer.</summary>
    public Task<TState> ReadAsync(SnapshotPointer snapshot, CancellationToken ct);

    /// <summary>The latest snapshot pointer from the manifest, or null if none written.</summary>
    public Task<SnapshotPointer?> LatestAsync(CancellationToken ct);
}
