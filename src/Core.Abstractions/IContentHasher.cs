namespace Zeta.Core;

/// <summary>
/// <b>Content-hashing PORT (hexagonal) — we OWN the interface; algorithms are pluggable adapters.</b>
/// </summary>
public interface IContentHasher
{
    /// <summary>A stable name for the algorithm (for golden-vector labelling + diagnostics).</summary>
    string Name { get; }

    /// <summary>Hash bytes to a MerkleHash content address.</summary>
    MerkleHash Hash(byte[] value);
}
