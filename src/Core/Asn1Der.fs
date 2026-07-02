namespace Zeta.Core

open System
open System.Collections.Immutable

/// **Asn1Der — an our-own ASN.1 DER (X.690) codec for the DynamicValue value tree.**
/// (Aaron 2026-07-02, shadow*: "ASN.1 is very important in like ANSI standards DLMS COSEM
/// standards for meters and other low level hardware specific formats for constrained
/// devices … the plan is nation state resistance … no supply chain that is not us.")
///
/// The first **2-ary** value-tree codec, and built OUR-OWN from the start — DER is a simple
/// tag-length-value grammar, so it needs NO external library (`Provenance = Ours` immediately,
/// not adapter-then-own). The **tag** is the second channel (the type/attribute axis) beside
/// the **value** — the 2-ary shape Aaron names, the analogue of XML element ⊕ attribute.
///
/// Native mapping (DER canonical, X.690 §8):
///   Null   → NULL           `05 00`
///   Bool   → BOOLEAN        `01 01 (00|FF)`   (DER: true = 0xFF)
///   Int    → INTEGER        `02 <len> <minimal two's-complement big-endian>`
///   String → UTF8String     `0C <len> <utf8>`
///   Bytes  → OCTET STRING   `04 <len> <raw>`
///   Array  → SEQUENCE       `30 <len> <elements…>`
///   Object → [0] constructed `A0 <len> <SEQUENCE{ UTF8String key, value }…>`  (ordered)
///
/// `Float` is ASN.1 REAL (X.690 §8.5) — deliberately NOT implemented here: it is this
/// codec's parity debt, closed the uniform way by `ValueTreeCodec.parity` (the versioned
/// envelope), so we do not hand-roll the fiddly REAL binary encoding. `asn1` natively
/// carries 7 of 8 shapes; `parity asn1` is total.
///
/// Doctrine: docs/research/2026-07-02-hexagonal-value-tree-codec-ports-nation-state-
/// supply-chain-resistance-own-the-interface-zero-dep-endgame.md (the 2-ary column).
[<RequireQualifiedAccess>]
module Asn1Der =

    [<Literal>]
    let tagBool = 0x01uy
    [<Literal>]
    let tagInt = 0x02uy
    [<Literal>]
    let tagOctet = 0x04uy
    [<Literal>]
    let tagNull = 0x05uy
    [<Literal>]
    let tagUtf8 = 0x0Cuy
    [<Literal>]
    let tagSeq = 0x30uy // constructed SEQUENCE — Array, and each Object entry
    [<Literal>]
    let tagObj = 0xA0uy // context [0] constructed — Object (SEQUENCE OF {key,value})

    // ── encode ──

    let private encodeLen (n: int) (out: ResizeArray<byte>) : unit =
        if n < 0x80 then
            out.Add(byte n)
        else
            let lenBytes = ResizeArray<byte>()
            let mutable v = n
            while v > 0 do
                lenBytes.Insert(0, byte (v &&& 0xFF))
                v <- v >>> 8
            out.Add(byte (0x80 ||| lenBytes.Count))
            out.AddRange lenBytes

    let private tlv (tag: byte) (content: byte[]) (out: ResizeArray<byte>) : unit =
        out.Add tag
        encodeLen content.Length out
        out.AddRange content

    /// Minimal two's-complement big-endian INTEGER content (X.690 §8.3.2).
    let private encodeInt (n: int64) : byte[] =
        if n = 0L then
            [| 0x00uy |]
        else
            let be = Array.rev (BitConverter.GetBytes n) // GetBytes is little-endian ⇒ reverse
            let mutable i = 0
            // drop redundant leading 0x00 (positive) / 0xFF (negative) while sign is preserved
            while i < 7
                  && ((be.[i] = 0x00uy && be.[i + 1] &&& 0x80uy = 0uy)
                      || (be.[i] = 0xFFuy && be.[i + 1] &&& 0x80uy <> 0uy)) do
                i <- i + 1
            be.[i..]

    let private utf8 (s: string) : byte[] = System.Text.Encoding.UTF8.GetBytes s

    let rec private enc (dv: DynamicValue) (out: ResizeArray<byte>) : Result<unit, string> =
        match dv with
        | DynamicValue.Null ->
            tlv tagNull [||] out
            Ok()
        | DynamicValue.Bool b ->
            tlv tagBool [| (if b then 0xFFuy else 0x00uy) |] out
            Ok()
        | DynamicValue.Int n ->
            tlv tagInt (encodeInt n) out
            Ok()
        | DynamicValue.String s ->
            tlv tagUtf8 (utf8 s) out
            Ok()
        | DynamicValue.Bytes b ->
            tlv tagOctet (b.AsSpan().ToArray()) out
            Ok()
        | DynamicValue.Array xs ->
            let child = ResizeArray<byte>()
            let rec loop =
                function
                | [] -> Ok()
                | x :: rest -> enc x child |> Result.bind (fun () -> loop rest)
            loop xs
            |> Result.map (fun () -> tlv tagSeq (child.ToArray()) out)
        | DynamicValue.Object kvs ->
            let child = ResizeArray<byte>()
            let rec loop =
                function
                | [] -> Ok()
                | (k, v) :: rest ->
                    let pair = ResizeArray<byte>()
                    tlv tagUtf8 (utf8 k) pair
                    enc v pair
                    |> Result.bind (fun () ->
                        tlv tagSeq (pair.ToArray()) child
                        loop rest)
            loop kvs
            |> Result.map (fun () -> tlv tagObj (child.ToArray()) out)
        | DynamicValue.Float _ ->
            Error "asn1: Float is this codec's parity debt (ASN.1 REAL not implemented) — use ValueTreeCodec.parity"

    /// Encode a value tree to canonical DER bytes. `Error` on the parity-debt shape (Float).
    let encode (dv: DynamicValue) : Result<byte[], string> =
        let out = ResizeArray<byte>()
        enc dv out |> Result.map (fun () -> out.ToArray())

    // ── decode ──

    /// Read a definite-length octet count (X.690 §8.1.3). Returns (length, content-start).
    let private readLen (bytes: byte[]) (pos: int) : Result<int * int, string> =
        if pos >= bytes.Length then
            Error "asn1: unexpected end (length octet)"
        else
            let b0 = bytes.[pos]
            if b0 < 0x80uy then
                Ok(int b0, pos + 1)
            elif b0 = 0x80uy then
                Error "asn1: indefinite length not allowed in DER"
            else
                let n = int (b0 &&& 0x7Fuy)
                if n > 4 then
                    // > 4 length octets ⇒ > ~2 GiB claim: unsupported / hostile, refuse.
                    Error "asn1: long-form length exceeds 4 octets"
                elif pos + 1 + n > bytes.Length then
                    Error "asn1: truncated long-form length"
                else
                    let mutable v = 0
                    for i in 1..n do
                        v <- (v <<< 8) ||| int bytes.[pos + i]
                    // n≤4 can still overflow int32's sign bit (e.g. 84 FF FF FF FF) → negative;
                    // reject rather than let a negative length slip past the bounds check.
                    if v < 0 then Error "asn1: length overflow" else Ok(v, pos + 1 + n)

    let private decodeInt (bytes: byte[]) (start: int) (len: int) : int64 =
        if len = 0 then
            0L
        else
            let mutable v = 0L
            for i in 0 .. len - 1 do
                v <- (v <<< 8) ||| int64 bytes.[start + i]
            // sign-extend when the high bit of the first octet is set (negative) and len < 8
            if bytes.[start] &&& 0x80uy <> 0uy && len < 8 then
                v - (1L <<< (8 * len))
            else
                v

    /// Recursion-depth ceiling: a hostile deeply-nested DER stream must not overflow the
    /// stack (a decode-side DoS). Far above any real value tree; a stream past it is refused.
    [<Literal>]
    let private maxDepth = 512

    let rec private dec (bytes: byte[]) (pos: int) (depth: int) : Result<DynamicValue * int, string> =
        if depth > maxDepth then
            Error "asn1: nesting exceeds maximum depth"
        elif pos >= bytes.Length then
            Error "asn1: unexpected end (tag octet)"
        else
            let tag = bytes.[pos]
            readLen bytes (pos + 1)
            |> Result.bind (fun (len, contentStart) ->
                // Overflow-safe bound: len ≥ 0 (readLen guarantees) and both sides non-negative,
                // so this never wraps the way `contentStart + len > bytes.Length` could.
                if len > bytes.Length - contentStart then
                    Error "asn1: content length exceeds input"
                else
                    let contentEnd = contentStart + len
                    if tag = tagNull then
                        if len <> 0 then Error "asn1: NULL must have zero length" else Ok(DynamicValue.Null, contentEnd)
                    elif tag = tagBool then
                        if len <> 1 then
                            Error "asn1: BOOLEAN must have length 1"
                        else
                            Ok(DynamicValue.Bool(bytes.[contentStart] <> 0x00uy), contentEnd)
                    elif tag = tagInt then
                        if len > 8 then
                            Error "asn1: INTEGER exceeds 8 octets (does not fit int64)"
                        else
                            Ok(DynamicValue.Int(decodeInt bytes contentStart len), contentEnd)
                    elif tag = tagUtf8 then
                        Ok(DynamicValue.String(System.Text.Encoding.UTF8.GetString(bytes, contentStart, len)), contentEnd)
                    elif tag = tagOctet then
                        Ok(DynamicValue.Bytes(ImmutableArray.CreateRange(bytes.[contentStart .. contentEnd - 1])), contentEnd)
                    elif tag = tagSeq then
                        decodeSeq bytes contentStart contentEnd (depth + 1)
                        |> Result.map (fun xs -> DynamicValue.Array xs, contentEnd)
                    elif tag = tagObj then
                        decodeSeq bytes contentStart contentEnd (depth + 1)
                        |> Result.bind (fun elems ->
                            let rec conv acc =
                                function
                                | [] -> Ok(DynamicValue.Object(List.rev acc), contentEnd)
                                | DynamicValue.Array [ DynamicValue.String k; v ] :: rest -> conv ((k, v) :: acc) rest
                                | other :: _ -> Error(sprintf "asn1: malformed object entry: %A" other)
                            conv [] elems)
                    else
                        Error(sprintf "asn1: unsupported tag 0x%02X" tag))

    and private decodeSeq (bytes: byte[]) (start: int) (endPos: int) (depth: int) : Result<DynamicValue list, string> =
        let rec loop pos acc =
            if pos = endPos then Ok(List.rev acc)
            elif pos > endPos then Error "asn1: element overran its container"
            else
                match dec bytes pos depth with
                | Ok(dv, next) -> loop next (dv :: acc)
                | Error e -> Error e
        loop start []

    /// Decode canonical DER bytes back to a value tree. Rejects trailing bytes. Total on
    /// ALL inputs — a malformed or hostile stream yields an `Error`, never an exception.
    let decode (bytes: byte[]) : Result<DynamicValue, string> =
        dec bytes 0 0
        |> Result.bind (fun (dv, pos) ->
            if pos = bytes.Length then Ok dv else Error(sprintf "asn1: %d trailing bytes" (bytes.Length - pos)))
