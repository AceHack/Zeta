using Zeta.Mediator;

namespace Zeta.Mediator.Handlers;

/// <summary>Handles the <see cref="AgentMessageObserved"/> notification by folding the message id into
/// the <see cref="AgentBus"/> G-Set — the pub-sub / agent-bus path through the mediator.</summary>
public sealed class AgentMessageObservedHandler(AgentBus bus) : INotificationHandler<AgentMessageObserved>
{
    /// <summary>Record the observed message (idempotent).</summary>
    public ValueTask Handle(AgentMessageObserved notification, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(notification);
        bus.Observe(notification.MessageId);
        return default;
    }
}
