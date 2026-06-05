namespace Zeta.Mediator;

/// <summary>
/// A cross-cutting behavior wrapping handler execution for a <typeparamref name="TMessage"/> — the
/// seam for logging, validation, tracing, uncertainty/observe, and the homeostat feedback loop (the
/// place metadata rides alongside the value). Behaviors run in registered order around the handler.
/// </summary>
/// <typeparam name="TMessage">The message type the behavior applies to.</typeparam>
/// <typeparam name="TResponse">The response type.</typeparam>
public interface IPipelineBehavior<TMessage, TResponse> : global::Mediator.IPipelineBehavior<TMessage, TResponse>
    where TMessage : IMessage;
