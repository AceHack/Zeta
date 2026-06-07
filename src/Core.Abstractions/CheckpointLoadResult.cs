using System;

namespace Zeta.Core;

/// <summary>
/// Result structure for a checkpoint load operation.
/// </summary>
public sealed class CheckpointLoadResult
{
    /// <summary>The logical tick of the checkpoint.</summary>
    public long Tick { get; }

    /// <summary>The saved states for each operator ID.</summary>
    public Tuple<int, ICheckpointReader>[] States { get; }

    public CheckpointLoadResult(long tick, Tuple<int, ICheckpointReader>[] states)
    {
        Tick = tick;
        States = states ?? throw new ArgumentNullException(nameof(states));
    }
}
