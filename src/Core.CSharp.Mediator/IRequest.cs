namespace Zeta.Mediator;

/// <summary>A request that produces a <typeparamref name="TResponse"/> when sent.</summary>
/// <typeparam name="TResponse">The response the handler returns.</typeparam>
public interface IRequest<out TResponse> : IMessage, global::Mediator.IRequest<TResponse>;

/// <summary>A request that produces no meaningful result — its response is <see cref="Unit"/>.</summary>
public interface IRequest : IRequest<Unit>;
