module Zeta.Tests.Storage.FastCdcTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


[<Fact>]
let ``FastCdc chunkAll of empty is empty`` () =
    let chunks = FastCdc.chunkAll [||]
    chunks.Length |> should equal 0


[<Fact>]
let ``FastCdc chunkAll of short buffer emits single chunk`` () =
    // Shorter than minChunkSize (2048) → single flushed chunk.
    let bytes = Array.init 512 byte
    let chunks = FastCdc.chunkAll bytes
    chunks.Length |> should equal 1
    chunks.[0].Length |> should equal 512


[<Fact>]
let ``FastCdc chunker reconstructs original bytes losslessly`` () =
    // 300 KB of pseudo-random bytes; chunks must concatenate back to input.
    let rng = Random 42
    let input = Array.init (300 * 1024) (fun _ -> byte (rng.Next 256))
    let chunks = FastCdc.chunkAll input
    // Every chunk is non-empty.
    for c in chunks do c.Length |> should greaterThan 0
    // Concatenation equals original.
    let reassembled : byte array =
        let mutable offset = 0
        let out = Array.zeroCreate<byte> input.Length
        for c in chunks do
            Buffer.BlockCopy(c, 0, out, offset, c.Length)
            offset <- offset + c.Length
        out
    reassembled |> should equal input


[<Fact>]
let ``FastCdc push-one-byte-at-a-time matches push-all-at-once`` () =
    // Regression guard: Push should amortise to O(n), and output should
    // not depend on Push granularity (persistent scanCursor + hash).
    let rng = Random 99
    let input = Array.init (128 * 1024) (fun _ -> byte (rng.Next 256))
    // Push all at once.
    let oneShot = FastCdc.chunkAll input
    // Push one byte at a time.
    let chunker = FastCdcChunker(minChunkSize = 2048, avgChunkSize = 8192, maxChunkSize = 65536)
    for i in 0 .. input.Length - 1 do
        chunker.Push(ReadOnlySpan<byte>(input, i, 1))
    chunker.Flush()
    let byByte = chunker.DrainChunks()
    // Same boundary set → same chunk-length sequence.
    let oneShotLens = oneShot |> Array.map (fun c -> c.Length)
    let byByteLens = byByte |> Array.map (fun c -> c.Length)
    byByteLens |> should equal oneShotLens
