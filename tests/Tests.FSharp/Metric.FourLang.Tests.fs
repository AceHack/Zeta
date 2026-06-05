module Zeta.Tests.MetricFourLangTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Metric / aggregation (PROVEN-CORE-MAP #6) — the 4-lang leg (F# ↔ C#, first of the ports).
// The C# oracle (Zeta.Core.CSharp.Metric) replicates the byte-lockable CORE of each sketch:
//   • Bloom: keys → XXH3-128 (shared System.IO.Hashing) → (h1,h2) → bucket + probe bits.
//   • CountMin: Add(baseHash) → SplitMix row seed + SplitMix mix + fastrange column.
// So the table is BYTE-IDENTICAL across F# and C# over the same inputs. (Rust + TS ports
// next.) The .NET HashCode.Combine convenience path is NOT portable and is excluded — the
// cross-language surface is the deterministic baseHash/bytes entry points.
// ═══════════════════════════════════════════════════════════════════

let private genInts : Gen<int64 list> =
    Gen.listOf (Gen.choose (-100000, 100000) |> Gen.map int64)

type IntsArb() =
    static member I() = Arb.fromGen genInts

// ── Bloom: F# ↔ C# byte-identical table over the same int64 keys (XXH3-128 core) ──

[<Property(Arbitrary = [| typeof<IntsArb> |])>]
let ``Metric/Bloom × 4-lang: F# and C# produce byte-identical tables over the same keys`` (keys: int64 list) =
    let fsF = BlockedBloomFilter(256, 4)
    let csF = Zeta.Core.CSharp.BlockedBloomFilter(256, 4)
    for k in keys do
        fsF.Add k
        csF.Add k
    (fsF.Table = csF.Table)
    && (keys |> List.forall (fun k -> fsF.MayContain k = csF.MayContain k))

[<Fact>]
let ``Metric/Bloom × 4-lang: F# ↔ C# byte-lock on fixed keys (incl. found + absent)`` () =
    let fsF = BlockedBloomFilter(256, 4)
    let csF = Zeta.Core.CSharp.BlockedBloomFilter(256, 4)
    for k in [ 0L; 1L; -1L; 9000000000L; 42L ] do
        fsF.Add k
        csF.Add k
    Assert.Equal<uint64[]>(fsF.Table, csF.Table)
    for k in [ 0L; 42L; 999L; -77L ] do
        Assert.Equal(fsF.MayContain k, csF.MayContain k)

// ── CountMin: F# ↔ C# byte-identical table over the same baseHashes (SplitMix + fastrange) ──

let private genHashes : Gen<uint64 list> =
    Gen.listOf (Gen.choose (0, 1000000000) |> Gen.map (fun i -> uint64 i * 0x9E3779B97F4A7C15UL))

type HashesArb() =
    static member H() = Arb.fromGen genHashes

[<Property(Arbitrary = [| typeof<HashesArb> |])>]
let ``Metric/CountMin × 4-lang: F# and C# produce byte-identical tables over the same baseHashes`` (hashes: uint64 list) =
    let fsC = CountMinSketch(4, 64, 777L)
    let csC = Zeta.Core.CSharp.CountMinSketch(4, 64, 777L)
    for h in hashes do
        fsC.Add(h, 1L)
        csC.Add(h, 1L)
    (fsC.Snapshot() = csC.Snapshot())
    && (hashes |> List.forall (fun h -> fsC.Estimate h = csC.Estimate h))

[<Fact>]
let ``Metric/CountMin × 4-lang: F# ↔ C# byte-lock on fixed baseHashes`` () =
    let fsC = CountMinSketch(4, 64, 777L)
    let csC = Zeta.Core.CSharp.CountMinSketch(4, 64, 777L)
    for h in [ 1UL; 2UL; 0xDEADBEEFUL; 0xFFFFFFFFFFFFFFFFUL; 123456789UL ] do
        fsC.Add(h, 3L)
        csC.Add(h, 3L)
    Assert.Equal<int64[]>(fsC.Snapshot(), csC.Snapshot())
    for h in [ 1UL; 0xDEADBEEFUL; 999UL ] do
        Assert.Equal(fsC.Estimate h, csC.Estimate h)
