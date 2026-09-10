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
    /// Appends into `sb` so catalog persist does not allocate a 64-char string
    /// per id. Nibbles are appended as chars, not `ToString("x2")`.
    member this.AppendHex(sb: System.Text.StringBuilder) : System.Text.StringBuilder =
        if isNull this.Raw then
            sb
        else
            let mutable i = 0

            while i < this.Raw.Length do
                let b = int this.Raw.[i]
                let hi = b >>> 4
                let lo = b &&& 0xF
                sb.Append(if hi < 10 then char (48 + hi) else char (87 + hi))
                |> ignore
                sb.Append(if lo < 10 then char (48 + lo) else char (87 + lo))
                |> ignore
                i <- i + 1

            sb

    member this.ToHex() : string =
        let sb = System.Text.StringBuilder(64)
        this.AppendHex(sb).ToString()

    override this.Equals(o: obj) : bool =
        match o with
        | :? ContentHash256 as h -> System.MemoryExtensions.SequenceEqual(ReadOnlySpan<byte>(this.Raw), ReadOnlySpan<byte>(h.Raw))
        | _ -> false

    override this.GetHashCode() : int =
        // first 4 bytes are plenty of spread for a hash code over a 256-bit digest
        if isNull this.Raw || this.Raw.Length < 4 then 0
        else int (BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan<byte>(this.Raw, 0, 4)))

[<RequireQualifiedAccess>]
module ContentHash256 =

    let mutable private ofBytesHook : (byte[] -> ContentHash256) option = None

    /// Set the implementation hook for computing the BLAKE3 digest from bytes.
    let setOfBytesHook (f: byte[] -> ContentHash256) =
        ofBytesHook <- Some f

    /// The full raw BLAKE3-256 digest of `bytes` (32 bytes, raw order). Identity-of-record for the proof tier.
    let ofBytes (bytes: byte[]) : ContentHash256 =
        match ofBytesHook with
        | Some f -> f bytes
        | None -> failwith "ContentHash256.ofBytes hook is not initialized. Make sure Zeta.Core.FSharp.Blake3 is loaded/initialized."

    /// Parse a 32-byte BLAKE3-256 digest from its hex string representation (allows optional 'blake3:' prefix).
    let ofHex (hex: string) : ContentHash256 =
        let hexClean = if hex.StartsWith("blake3:", StringComparison.Ordinal) then hex.Substring(7) else hex
        { Raw = Convert.FromHexString(hexClean) }

    /// Derive the compact `ContentAddress128` (`MerkleHash`) from the full digest: lower 16 bytes read as a
    /// little-endian UInt128 (lo = bytes[0..8), hi = bytes[8..16)) — the SAME value `Blake3Hasher` produces,
    /// so a 128-bit handle is always verifiable against its full `ContentHash256`.
    let toContentAddress128 (h: ContentHash256) : MerkleHash =
        let lo = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan<byte>(h.Raw, 0, 8))
        let hi = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan<byte>(h.Raw, 8, 8))
        MerkleHash(hi, lo)
