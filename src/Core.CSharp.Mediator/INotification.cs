namespace Zeta.Mediator;

/// <summary>A fire-and-forget message broadcast to zero or more handlers (the agent-bus shape).</summary>
public interface INotification : IMessage, global::Mediator.INotification;
