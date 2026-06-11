using System;
using System.Threading;
using System.Threading.Tasks;

namespace Zeta.Core;

/// <summary>
/// Checkpoint store — persists operator states keyed by operator ID.
/// </summary>
public interface ICheckpointStore
{
    public ValueTask SaveCheckpointAsync(
        string circuitId,
        long tick,
        Tuple<int, ICheckpointable>[] states,
        CancellationToken ct);

    public ValueTask<CheckpointLoadResult?> LoadCheckpointAsync(
        string circuitId,
        CancellationToken ct);
}
