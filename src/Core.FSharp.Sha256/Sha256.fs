module Zeta.Core.FSharp.Sha256

open System
open System.Security.Cryptography

/// Compute SHA-256 of a byte array. Returns 32 bytes.
let sha256 (bytes: byte[]) : byte[] =
    SHA256.HashData bytes

/// Compute SHA-256 and return as lowercase hex string (64 chars).
/// Uses Convert.ToHexStringLower (net9+/net10 BCL) for lowercase output
/// matching the TS and Rust oracles.
let sha256Hex (bytes: byte[]) : string =
    Convert.ToHexStringLower(sha256 bytes)
