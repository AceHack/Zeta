namespace Zeta.Core

open System

/// **Content-hashing PORT (hexagonal) — we OWN the interface; algorithms are pluggable adapters.**
///
/// Aaron 2026-06-07: *"hexagonal the blake dep and make sure we own the interface; also we can go generic —
/// there are many algos that could match our interface, not just blake."* So the store/Merkle depend on
/// THIS port, never on a concrete hash library. XxHash128 (`MerkleHash.ofBytes`) is the default adapter
/// today; **BLAKE3** (cryptographic, tamper-evident — the decided git-replacement hash) drops in as an
/// adapter behind this port *without touching callers* and with the external dependency isolated to its
/// adapter; SHA-256, etc. equally conform. `ZSetMerkle.rootWith` / `ContentStore.create` already take the
/// hash as a function — `IContentHasher.Hash` IS that function, now behind a named, ownable boundary.
// IContentHasher is defined in Zeta.Core.Abstractions C# project.

[<RequireQualifiedAccess>]
module ContentHasher =

    /// The default adapter: **XxHash128** (fast, non-cryptographic — dedup/history grade; 081KT07NV0008QG0R001YDB73K-adjacent).
    /// NOT tamper-evident — for the git-replacement store, select a BLAKE3 adapter behind this same port.
    [<Sealed>]
    type XxHash128Hasher() =
        interface IContentHasher with
            member _.Name = "xxhash128"
            member _.Hash(bytes: byte[]) : MerkleHash = MerkleHash.ofBytes(ReadOnlySpan<byte> bytes)

    /// The shipped default hasher (XxHash128). Swap to a BLAKE3 adapter for tamper-evidence.
    /// Core does not take the Blake3 NuGet. The tamper-evident store's composition root is
    /// `Zeta.Core.FSharp.Blake3.ZetaFsStore.deltaLog`.
    let defaultHasher: IContentHasher = XxHash128Hasher() :> IContentHasher

    /// Adapt a port to the plain `byte[] -> MerkleHash` function `ZSetMerkle.rootWith` / `ContentStore`
    /// consume — so callers depend on the port, not a concrete algorithm.
    let hashOf (hasher: IContentHasher) : byte[] -> MerkleHash = hasher.Hash

    // BLAKE3: own spec impl is the store hasher (`OwnBlake3Hasher` / `ZetaFsStore.deltaLog`).
    // The NuGet adapter is a test oracle. Do not pull Blake3 into Core.
