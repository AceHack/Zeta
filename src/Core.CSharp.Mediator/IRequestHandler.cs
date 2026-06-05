namespace Zeta.Mediator;

/// <summary>Handles a <typeparamref name="TRequest"/>, returning a <typeparamref name="TResponse"/>.</summary>
/// <typeparam name="TRequest">The request type handled.</typeparam>
/// <typeparam name="TResponse">The response produced.</typeparam>
public interface IRequestHandler<in TRequest, TResponse> : global::Mediator.IRequestHandler<TRequest, TResponse>
    where TRequest : IRequest<TResponse>;

/// <summary>Handles a void <typeparamref name="TRequest"/>, returning <see cref="Unit"/>.</summary>
/// <typeparam name="TRequest">The void request type handled.</typeparam>
public interface IRequestHandler<in TRequest> : IRequestHandler<TRequest, Unit>
    where TRequest : IRequest<Unit>;
