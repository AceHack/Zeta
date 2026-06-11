namespace Zeta.Core;

/// <summary>
/// Whole-entry serialization seam — encodes a full DeltaLogEntry to canonical bytes and back.
/// </summary>
/// <typeparam name="TKey">The key type.</typeparam>
/// <typeparam name="TDelta">The delta representation type (e.g. ZSet or ITensor).</typeparam>
public interface IEntryCodec<TKey, TDelta>
{
    /// <summary>Encode a DeltaLogEntry to bytes.</summary>
    public byte[] Encode(DeltaLogEntry<TKey, TDelta> entry);

    /// <summary>Decode a DeltaLogEntry from bytes.</summary>
    public DeltaLogEntry<TKey, TDelta> Decode(byte[] bytes);
}
