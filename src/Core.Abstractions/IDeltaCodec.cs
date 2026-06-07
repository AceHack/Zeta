namespace Zeta.Core;

/// <summary>
/// Pluggable serialization seam for the durable delta log. Encodes state to bytes and back.
/// </summary>
/// <typeparam name="TKey">The key type.</typeparam>
/// <typeparam name="TState">The state representation type (e.g. ZSet or ITensor).</typeparam>
public interface IDeltaCodec<TKey, TState>
{
    /// <summary>Encode state to bytes.</summary>
    byte[] Encode(TState state);

    /// <summary>Decode state from bytes.</summary>
    TState Decode(byte[] bytes);
}
