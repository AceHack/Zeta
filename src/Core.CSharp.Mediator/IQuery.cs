namespace Zeta.Mediator;

/// <summary>A CQRS query (a read) producing a <typeparamref name="TResponse"/>. A marker over our own
/// <see cref="IRequest{TResponse}"/> (not the package's IQuery) so the CQRS layer is fully ours.</summary>
/// <typeparam name="TResponse">The response the query handler returns.</typeparam>
public interface IQuery<out TResponse> : IRequest<TResponse>;
