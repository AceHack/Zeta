using Zeta.Core.CSharp;

namespace Zeta.Mediator.Handlers;

/// <summary>
/// The agent-bus: a grow-only set of observed message ids (the proven <see cref="GSet{T}"/> CRDT). A
/// DI-singleton sink for <see cref="AgentMessageObserved"/> notifications. Observing is idempotent —
/// re-observing the same id is a no-op (the G-Set union property), so redelivery is safe, exactly as the
/// agent-bus's append-only folder treats a duplicate-id write as success.
/// </summary>
public sealed class AgentBus
{
    private readonly System.Threading.Lock _gate = new();
    private GSet<string> _observed = GSet.Empty<string>();

    /// <summary>Record an observed message id (idempotent: a duplicate is absorbed by the G-Set union).</summary>
    public void Observe(string messageId)
    {
        lock (_gate)
        {
            _observed = _observed.Add(messageId);
        }
    }

    /// <summary>Whether a message id has been observed.</summary>
    public bool Has(string messageId)
    {
        lock (_gate)
        {
            return _observed.Contains(messageId);
        }
    }

    /// <summary>The number of distinct observed message ids.</summary>
    public int Count
    {
        get
        {
            lock (_gate)
            {
                return _observed.Count;
            }
        }
    }
}
