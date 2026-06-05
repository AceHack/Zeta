namespace Zeta.Mediator;

/// <summary>
/// The adapter that bridges the Zeta.Mediator port to the underlying martinothamar/Mediator
/// implementation. This is the ONLY type that names <c>global::Mediator.IMediator</c> at runtime;
/// replacing the package means rewriting this one class. Our <see cref="IRequest{TResponse}"/> and
/// <see cref="INotification"/> inherit the package interfaces, so the calls pass straight through.
/// </summary>
internal sealed class ZetaMediator(global::Mediator.IMediator inner) : IMediator
{
    public ValueTask<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default) =>
        inner.Send(request, cancellationToken);

    public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default) =>
        inner.CreateStream(request, cancellationToken);

    public ValueTask Publish<TNotification>(TNotification notification, CancellationToken cancellationToken = default)
        where TNotification : INotification =>
        inner.Publish(notification, cancellationToken);
}
