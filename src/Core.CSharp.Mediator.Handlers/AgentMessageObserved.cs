using Zeta.Mediator;

namespace Zeta.Mediator.Handlers;

/// <summary>An agent-bus event: a message (by id) has been observed. Published through the mediator to
/// any number of handlers (the fire-and-forget notification / pub-sub shape).</summary>
/// <param name="MessageId">The observed message's identity.</param>
public sealed record AgentMessageObserved(string MessageId) : INotification;
