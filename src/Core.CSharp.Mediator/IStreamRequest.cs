namespace Zeta.Mediator;

/// <summary>A request that streams zero or more <typeparamref name="TResponse"/> values
/// (an <see cref="IAsyncEnumerable{T}"/>) — the bridge to the DBSP/Rx stream layer.</summary>
/// <typeparam name="TResponse">The element type streamed back.</typeparam>
public interface IStreamRequest<out TResponse> : IMessage, global::Mediator.IStreamRequest<TResponse>;
