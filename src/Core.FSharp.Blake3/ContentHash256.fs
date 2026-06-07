namespace Zeta.Core.FSharp.Blake3

open System
open System.Buffers.Binary
open Zeta.Core

/// **`ContentHash256` — the full 256-bit raw BLAKE3 digest (the proof tier; treaty `081KTH59TVZ`).**
///
/// The security boundary for content-addressing **files / packages (Ace) / blocks (Zeta) / anything
/// signed-or-exported** (Vera + Lior): 128-bit truncation is ~64-bit collision resistance — adversarially
/// feasible — so the full 256 is the identity-of-record. **Raw byte order, NO reversal** (empty input ⇒
/// `af1349b9f5f9a1a6a0404dea36dcc949…`), distinct on purpose from the LE-rendered `ContentAddress128`
/// (`MerkleHash`, `49c9dc…`). The compact 128-bit address is **derivable from** this (lower 16 bytes, LE)
/// so a short handle stays verifiable against the full digest.
[<CustomEquality; NoComparison>]
type ContentHash256 =
    { Raw: byte[] } // exactly 32 bytes, raw BLAKE3-256 digest order

    /// Lowercase hex of the raw 32 bytes (no reversal) — the canonical proof rendering.
    member this.ToHex() : string =
        let sb = System.Text.StringBuilder(64)
        for b in this.Raw do
            sb.Append(b.ToString("x2")) |> ignore
        sb.ToString()

    override this.Equals(o: obj) : bool =
        match o with
        | :? ContentHash256 as h -> System.MemoryExtensions.SequenceEqual(System.ReadOnlySpan<byte>(this.Raw), System.ReadOnlySpan<byte>(h.Raw))
        | _ -> false

    override this.GetHashCode() : int =
        // first 4 bytes are plenty of spread for a hash code over a 256-bit digest
        if isNull this.Raw || this.Raw.Length < 4 then 0
        else int (BinaryPrimitives.ReadUInt32LittleEndian(System.ReadOnlySpan<byte>(this.Raw, 0, 4)))

[<RequireQualifiedAccess>]
module ContentHash256 =

    /// The full raw BLAKE3-256 digest of `bytes` (32 bytes, raw order). Identity-of-record for the proof tier.
    let ofBytes (bytes: byte[]) : ContentHash256 =
        let digest = Blake3.Hasher.Hash(ReadOnlySpan<byte> bytes)
        { Raw = digest.AsSpan().ToArray() }

    /// Derive the compact `ContentAddress128` (`MerkleHash`) from the full digest: lower 16 bytes read as a
    /// little-endian UInt128 (lo = bytes[0..8), hi = bytes[8..16)) — the SAME value `Blake3Hasher` produces,
    /// so a 128-bit handle is always verifiable against its full `ContentHash256`.
    let toContentAddress128 (h: ContentHash256) : MerkleHash =
        let lo = BinaryPrimitives.ReadUInt64LittleEndian(System.ReadOnlySpan<byte>(h.Raw, 0, 8))
        let hi = BinaryPrimitives.ReadUInt64LittleEndian(System.ReadOnlySpan<byte>(h.Raw, 8, 8))
        MerkleHash(hi, lo)
