namespace Zeta.Core.FSharp.Blake3

open System
open System.Buffers.Binary
open Zeta.Core

/// **NuGet BLAKE3 adapter — TEST ORACLE, not the composition root.**
///
/// Own impl: `Blake3Spec` / `OwnBlake3Hasher` (published spec; DST + formal
/// analysis). This type wraps `Blake3.Hasher` so tests can byte-lock own vs
/// nuget and we can file bugs upstream. Do not select this at the store
/// root. Isolated NuGet, hexagonal `IContentHasher`.
///
/// `MerkleHash` is the first 16 bytes of the 256-bit BLAKE3 digest, read little-endian — the SAME
/// convention as `MerkleHash.ofBytes` (lo = bytes[0..8), hi = bytes[8..16)).
[<Sealed>]
type Blake3Hasher() =

    interface IContentHasher with
        member _.Name = "blake3"

        member _.Hash(bytes: byte[]) : MerkleHash =
            let digest = Blake3.Hasher.Hash(ReadOnlySpan<byte> bytes)
            let span = digest.AsSpan()
            let lo = BinaryPrimitives.ReadUInt64LittleEndian(span.Slice(0, 8))
            let hi = BinaryPrimitives.ReadUInt64LittleEndian(span.Slice(8, 8))
            MerkleHash(hi, lo)

[<RequireQualifiedAccess>]
module Blake3Hasher =
    /// NuGet oracle adapter. Production store uses `OwnBlake3Hasher.hasher`.
    let hasher: IContentHasher = Blake3Hasher() :> IContentHasher
