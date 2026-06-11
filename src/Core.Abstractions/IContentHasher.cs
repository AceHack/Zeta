namespace Zeta.Core;

/// <summary>
/// <b>Content-hashing PORT (hexagonal) — we OWN the interface; algorithms are pluggable adapters.</b>
/// </summary>
public interface IContentHasher
{
    /// <summary>A stable name for the algorithm (for golden-vector labelling + diagnostics).</summary>
    public string Name { get; }

    /// <summary>Hash bytes to a MerkleHash content address.</summary>
    public MerkleHash Hash(byte[] value);
}
