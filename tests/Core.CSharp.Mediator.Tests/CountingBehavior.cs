using Zeta.Mediator;

namespace Zeta.Tests.CSharp.Mediator;

/// <summary>
/// An open-generic pipeline behavior (via the Zeta port) that bumps a <see cref="BehaviorSink"/> before
/// delegating to the next stage — proves the cross-cutting seam runs around handler execution. The only
/// package type a behavior author touches is the <c>next</c> continuation delegate.
/// </summary>
/// <typeparam name="TMessage">The wrapped message type.</typeparam>
/// <typeparam name="TResponse">The response type.</typeparam>
public sealed class CountingBehavior<TMessage, TResponse>(BehaviorSink sink) : IPipelineBehavior<TMessage, TResponse>
    where TMessage : IMessage
{
    /// <summary>Count the invocation, then run the rest of the pipeline.</summary>
    public ValueTask<TResponse> Handle(
        TMessage message,
        global::Mediator.MessageHandlerDelegate<TMessage, TResponse> next,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(next);
        sink.Hit();
        return next(message, cancellationToken);
    }
}
