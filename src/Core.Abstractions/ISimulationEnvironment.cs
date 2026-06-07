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
    DateTimeOffset UtcNow();

    /// <summary>Monotonically-increasing ticks counter.</summary>
    long Ticks();

    /// <summary>Next 64-bit integer from the environment's RNG.</summary>
    long NextInt64();

    /// <summary>Fresh GUID.</summary>
    Guid NewGuid();

    /// <summary>Wait timeout.</summary>
    Task Delay(TimeSpan timeout, CancellationToken cancellationToken);
}
