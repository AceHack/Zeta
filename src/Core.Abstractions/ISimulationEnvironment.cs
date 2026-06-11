using System;
using System.Threading;
using System.Threading.Tasks;

namespace Zeta.Core;

/// <summary>
/// Minimal side-effect surface for deterministic simulation.
/// </summary>
public interface ISimulationEnvironment
{
    /// <summary>Current logical time.</summary>
    public DateTimeOffset UtcNow();

    /// <summary>Monotonically-increasing ticks counter.</summary>
    public long Ticks();

    /// <summary>Next 64-bit integer from the environment's RNG.</summary>
    public long NextInt64();

    /// <summary>Fresh GUID.</summary>
    public Guid NewGuid();

    /// <summary>Wait timeout.</summary>
    public Task Delay(TimeSpan timeout, CancellationToken cancellationToken);
}
