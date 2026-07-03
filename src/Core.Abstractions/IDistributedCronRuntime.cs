using System;
using System.Threading.Tasks;

namespace Zeta.Core.Abstractions;

/// <summary>
/// The hexagonal port (interface) that any distributed actor runtime must implement.
/// In Zeta, a "tick source" is something that naturally attracts attention with no
/// outside force needed. A distributed cron (like Orleans, Temporal, or Dapr Actors)
/// is the physical realization of this tick source.
/// </summary>
public interface IDistributedCronRuntime
{
    /// <summary>
    /// Registers a new tick source in the distributed runtime.
    /// Returns a unique identifier for the actor.
    /// </summary>
    public Task RegisterTickSource(string id, CronConfig config);

    /// <summary>
    /// Retrieves the current state of a distributed tick source.
    /// </summary>
    public Task<CronState> GetState(string id);

    /// <summary>
    /// Suspends a ticking actor (stops the cron).
    /// </summary>
    public Task Suspend(string id, string reason);

    /// <summary>
    /// Resumes a suspended actor.
    /// </summary>
    public Task ResumeCron(string id);

    /// <summary>
    /// Binds a callback to the tick event. When the distributed runtime fires,
    /// this callback is executed.
    /// </summary>
    public Task OnTick(string id, Func<DateTime, Task> callback);
}
