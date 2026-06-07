module Zeta.Tests.CasStoreTests

open System
open global.Xunit
open Zeta.Core

module CAS = Zeta.Core.CasStore

let private encI (i: int) : byte[] =
    let b = Array.zeroCreate<byte> 4
    System.Buffers.Binary.BinaryPrimitives.WriteInt32LittleEndian(Span<byte> b, i)
    b

let private store () : CAS.Store<string, ZSet<int>> = CAS.create (ZSetMerkle.root encI)
let private v xs = ZSet.ofSeq xs

[<Fact>]
let ``CAS-create (expected None) succeeds on an absent row; read round-trips`` () =
    match CAS.trySwap "k" None (v [ 1, 1L ]) (store ()) with
    | Ok s ->
        Assert.True((CAS.currentHash "k" s).IsSome)
        Assert.Equal<ZSet<int> option>(Some(v [ 1, 1L ]), CAS.read "k" s |> Option.map snd)
    | Error _ -> Assert.Fail "expected create to succeed on absent row"

[<Fact>]
let ``CAS-create fails (Error current) if the row already exists`` () =
    let s = match CAS.trySwap "k" None (v [ 1, 1L ]) (store ()) with Ok s -> s | Error _ -> failwith "setup"
    let h = (CAS.currentHash "k" s).Value
    match CAS.trySwap "k" None (v [ 2, 2L ]) s with
    | Error cur -> Assert.Equal<MerkleHash option>(Some h, cur) // returns the actual current address
    | Ok _ -> Assert.Fail "expected create to fail on existing row"

[<Fact>]
let ``CAS-update succeeds when expected matches; a stale expected conflicts (lost-update prevention)`` () =
    let s0 = match CAS.trySwap "k" None (v [ 1, 1L ]) (store ()) with Ok s -> s | Error _ -> failwith "setup"
    let h0 = (CAS.currentHash "k" s0).Value
    // writer A swaps with the observed hash -> Ok
    let s1 = match CAS.trySwap "k" (Some h0) (v [ 2, 2L ]) s0 with Ok s -> s | Error _ -> failwith "A"
    let h1 = (CAS.currentHash "k" s1).Value
    Assert.NotEqual(h0, h1)
    // writer B held the STALE h0 and applies to s1 -> conflict, returns the real current h1, value unchanged
    match CAS.trySwap "k" (Some h0) (v [ 9, 9L ]) s1 with
    | Error cur ->
        Assert.Equal<MerkleHash option>(Some h1, cur)
        Assert.Equal<ZSet<int> option>(Some(v [ 2, 2L ]), CAS.read "k" s1 |> Option.map snd) // unchanged
    | Ok _ -> Assert.Fail "expected stale CAS to conflict"

[<Fact>]
let ``update applies f to the current value, swapping the result`` () =
    let s0 = match CAS.trySwap "k" None (v [ 1, 1L ]) (store ()) with Ok s -> s | Error _ -> failwith "setup"
    let s1 = s0 |> CAS.update "k" (fun cur -> (cur |> Option.defaultValue ZSet.Empty) + v [ 2, 1L ])
    Assert.Equal<ZSet<int> option>(Some(ZSet.ofSeq [ 1, 1L; 2, 1L ]), CAS.read "k" s1 |> Option.map snd)
