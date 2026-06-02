namespace Zeta.Core.CSharp.Sha256;

/// <summary>
/// BCL-clean SHA-256 helpers. Delegates entirely to System.Security.Cryptography.SHA256.
/// Zero external dependencies.
/// </summary>
// MA0049: class name 'Sha256' matches the trailing segment of the namespace
// 'Zeta.Core.CSharp.Sha256'. This is intentional — the class is the canonical
// entry-point for this single-purpose library (mirrors pattern of BCL Math, GC, etc.).
#pragma warning disable MA0049
public static class Sha256
#pragma warning restore MA0049
{
    /// <summary>Compute SHA-256 of the given bytes. Returns exactly 32 bytes.</summary>
    public static byte[] Hash(ReadOnlySpan<byte> bytes) =>
        System.Security.Cryptography.SHA256.HashData(bytes);

    /// <summary>
    /// Compute SHA-256 and return as a lowercase 64-character hex string,
    /// matching the TS / F# / Rust oracles.
    /// </summary>
    public static string HashHex(ReadOnlySpan<byte> bytes) =>
        Convert.ToHexStringLower(Hash(bytes));
}
