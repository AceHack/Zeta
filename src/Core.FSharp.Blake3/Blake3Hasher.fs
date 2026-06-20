namespace Zeta.Core.FSharp.Blake3

open System
open System.Buffers.Binary
open Zeta.Core

/// **BLAKE3 adapter for the `IContentHasher` port** — the tamper-evident (cryptographic) content hash for
/// the git-replacement store (Aaron's decision). The external `Blake3` dependency is isolated to this
/// project; the rest of the codebase depends only on `IContentHasher` (hexagonal). BLAKE3 is the same hash
/// the Rust oracle uses natively, so cross-language content addresses agree byte-for-byte (4-lang parity).
///
/// `MerkleHash` is the first 16 bytes of the 256-bit BLAKE3 digest, read little-endian — the SAME
/// convention as `MerkleHash.ofBytes` (lo = bytes[0..8), hi = bytes[8..16)) — so it composes with
/// `ZSetMerkle.rootWith` / `ContentStore.create` unchanged.
[<Sealed>]
type Blake3Hasher() =
    static do
        ContentHash256.setOfBytesHook (fun bytes ->
            let digest = Blake3.Hasher.Hash(ReadOnlySpan<byte> bytes)
            { Raw = digest.AsSpan().ToArray() }
        )

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
    /// The BLAKE3 content hasher as the port type (select this for the tamper-evident store).
    let hasher: IContentHasher = Blake3Hasher() :> IContentHasher
