module Zeta.Tests.ZetaIrMinimalSetTests

open global.Xunit
open FsCheck
open FsCheck.Xunit

// The reductions:
// 1. xorshr s == xshrxor [s]
// 2. rotl r == xrotxor [0; r]

let rotl (x: uint64) (k: int) =
    let k = ((k % 64) + 64) % 64
    if k = 0 then x else (x <<< k) ||| (x >>> (64 - k))

[<Property>]
let ``xorshr s reduces exactly to xshrxor [s]`` (x: uint64) (s: int) =
    let s = ((s % 64) + 64) % 64
    let v1_xorshr = x ^^^ (x >>> s)
    let v3_xshrxor = x ^^^ (x >>> s)
    v1_xorshr = v3_xshrxor

[<Property>]
let ``rotl r reduces exactly to xrotxor [0; r]`` (x: uint64) (r: int) =
    let v2_rotl = rotl x r
    // xrotxor [0; r] = x ^ rotl(x, 0) ^ rotl(x, r)
    // Since rotl(x, 0) = x, this is x ^ x ^ rotl(x, r) = rotl(x, r)
    let v3_xrotxor = x ^^^ rotl x 0 ^^^ rotl x r
    v2_rotl = v3_xrotxor

[<Property>]
let ``the self-cancellation trick works for any width`` (x: uint32) (r: int) =
    let rotl32 (v: uint32) (k: int) =
        let k = ((k % 32) + 32) % 32
        if k = 0 then v else (v <<< k) ||| (v >>> (32 - k))
    
    let v2_rotl = rotl32 x r
    let v3_xrotxor = x ^^^ rotl32 x 0 ^^^ rotl32 x r
    v2_rotl = v3_xrotxor
