namespace Zeta.Mediator;

/// <summary>Handles a <typeparamref name="TRequest"/> by streaming <typeparamref name="TResponse"/> values.</summary>
/// <typeparam name="TRequest">The stream request type handled.</typeparam>
/// <typeparam name="TResponse">The element type streamed back.</typeparam>
public interface IStreamRequestHandler<in TRequest, out TResponse> : global::Mediator.IStreamRequestHandler<TRequest, TResponse>
    where TRequest : IStreamRequest<TResponse>;
