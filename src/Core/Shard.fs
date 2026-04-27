namespace Zeta.Core
#nowarn "9"

open System
open System.Collections.Generic
open System.IO.Hashing
open System.Runtime.CompilerServices
open System.Runtime.InteropServices
open System.Threading
open System.Threading.Tasks


/// Cache-line-padded counter (128 bytes on Apple Silicon + x86/64, the
/// conservative padding that covers adjacent-line prefetch on all targets).
/// Use when multiple threads increment independent counters; avoids
/// false sharing on the hot atomic op.
[<Struct; StructLayout(LayoutKind.Explicit, Size = 128)>]
type PaddedCounter =
    [<FieldOffset(0)>]
    val mutable Value: int64

    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    member this.Increment() = Interlocked.Increment(&this.Value) |> ignore


/// Deterministic hash-shard assignment. `fastrange(h, n) = ⌊h·n / 2^32⌋`
/// avoids a modulo and gives a uniform distribution for any `n`, not just
/// powers-of-two.
///
/// **HashDoS mitigation:** we mix in a per-process random `Salt` on every
/// `OfKey` call. An attacker can no longer craft a stream of keys that all
/// collide on shard 0 and pin one worker — the salt is unknown across
/// process restarts. Callers who need a cross-process-stable shard
/// assignment (e.g. for sticky partitioning across a restart) should call
/// `OfFixed` which skips the salt.
[<AbstractClass; Sealed>]
type Shard =

    /// Per-process random hash salt. Reset on every startup. The hash of
    /// a given key is unpredictable across processes — this is the
    /// defence against HashDoS for anyone wiring up user-controlled keys.
    static member val Salt : uint32 =
        let buf = Array.zeroCreate<byte> 4
        System.Security.Cryptography.RandomNumberGenerator.Fill(Span<byte> buf)
        BitConverter.ToUInt32(buf, 0)

    /// `fastrange` hash-to-shard mapping.
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    static member Of(hash: uint32, shards: int) : int =
        int ((uint64 hash * uint64 (uint32 shards)) >>> 32)

    /// Shard a key using `HashCode.Combine` mixed with the per-process
    /// salt. Good default for any ingest path that touches user-controlled
    /// keys — rules out the HashDoS attack.
    ///
    /// **Intentionally non-deterministic across processes.** `HashCode.Combine`
    /// is process-randomized by .NET design; combining with the per-process
    /// `Shard.Salt` doubles down on that. Two processes will assign the same
    /// key to different shards. That is the *point* — it's HashDoS defence:
    /// an attacker cannot pre-compute a worst-case input set for our shard
    /// distribution because they don't know our seed.
    ///
    /// If you need cross-process / cross-restart determinism, use
    /// `OfFixed`, which uses `XxHash3` instead.
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    static member OfKey(key: 'K, shards: int) : int =
        let h = uint32 (HashCode.Combine(key, Shard.Salt))
        Shard.Of(h, shards)

    /// Shard without the per-process salt — stable across restarts.
    /// Prefer `OfKey` unless you *specifically* need cross-process
    /// determinism (e.g. for Kafka key-to-partition consistency).
    ///
    /// **Determinism contract** (Otto-281 honesty audit):
    ///
    /// - For **value-type keys** (`int`, `int64`, `uint32`, `byte`, etc.):
    ///   fully deterministic across processes. `int.GetHashCode()` returns
    ///   `this` and the rest is deterministic mixing.
    /// - For **string keys**: NOT deterministic across processes.
    ///   `string.GetHashCode()` is per-process-randomized in .NET Core+
    ///   (anti-hash-flooding), and we cannot recover from that within a
    ///   generic `'K` API. String-key callers who need cross-process
    ///   consistency MUST hash their UTF-8 bytes themselves and call
    ///   `Shard.Of(uint32 hash, shards)` directly — for example with
    ///   `XxHash3.HashToUInt64(Encoding.UTF8.GetBytes(s))`.
    /// - For **other reference types**: deterministic only if the type's
    ///   `GetHashCode()` is deterministic (most user-defined records are;
    ///   classes that depend on instance identity are not).
    ///
    /// Otto-281 fix replaced an earlier implementation that used
    /// `HashCode.Combine key`, which is *also* process-randomized for
    /// value types (because `HashCode.Combine`'s mixer is randomized
    /// regardless of input). The new implementation is strictly better
    /// for value types and no-worse for strings.
    ///
    /// String-key cross-process consistency is tracked as a separate
    /// follow-up: typed overloads `OfFixedString(s: string, shards)` and
    /// `OfFixedBytes(bytes: ReadOnlySpan&lt;byte&gt;, shards)`.
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    static member OfFixed(key: 'K, shards: int) : int =
        // Null-safe AND non-boxing hash path. Per Copilot review
        // on LFG #649 (P1/perf): the prior `box key` form allocated
        // on every call for value-type 'K (struct boxing → GC
        // regression on hot paths). EqualityComparer<'K>.Default is
        // null-safe for reference types and non-boxing for structs;
        // it returns the correct null-tolerant hash without the
        // allocation cost. Original null-safety fix from Copilot
        // review on PR #26 (prior version called key.GetHashCode()
        // directly which crashed on null reference keys) is
        // preserved — the comparer's default behavior treats null
        // refs as hash 0.
        let intHash = EqualityComparer<'K>.Default.GetHashCode(key)
        let bytes = BitConverter.GetBytes intHash
        let h64 = XxHash3.HashToUInt64 (ReadOnlySpan bytes)
        Shard.Of(uint32 h64, shards)

    /// Shard a UTF-8 byte sequence without per-process salt — fully
    /// deterministic across processes and machines. Use this for any
    /// cross-process / cross-restart shard assignment where the key
    /// has a canonical byte representation.
    ///
    /// String callers: `Shard.OfFixedBytes(Encoding.UTF8.GetBytes s, shards)`
    /// is the cross-process-consistent shard for `s`. The plain
    /// `Shard.OfFixed("...", shards)` is NOT (see `OfFixed` doc).
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    static member OfFixedBytes(bytes: ReadOnlySpan<byte>, shards: int) : int =
        let h64 = XxHash3.HashToUInt64 bytes
        Shard.Of(uint32 h64, shards)


/// Exchange operator — partitions a Z-set across `shards` sub-streams by
/// hash of a key. Each downstream shard sees only entries whose key hashes
/// to its index. This is the primitive behind multi-worker parallelism:
/// spawn N workers, give each one its own sub-circuit reading from its own
/// shard, and the outputs can be gathered back with `GatherShards`.
[<Sealed>]
type internal ExchangeOp<'K when 'K : comparison>
    (input: Op<ZSet<'K>>, shards: int, key: Func<'K, uint32>) =
    inherit Op<ZSet<'K> array>()
    let inputs = [| input :> Op |]
    let mutable outputs = Array.zeroCreate<ZSet<'K>> shards
    override _.Name = "exchange"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        if span.IsEmpty then
            for i in 0 .. shards - 1 do outputs.[i] <- ZSet<'K>.Empty
            this.Value <- outputs
        else
            // Hoist hashes: previously we called `key.Invoke` twice per
            // entry (histogram + scatter). A hash of a string / tuple
            // allocates; calling it twice doubles GC pressure on the
            // shard hot path. Rent a uint8-wide shard index per entry
            // (we support ≤256 shards per exchange) so the scatter pass
            // is a zero-hash lookup.
            let shardOfEntry = Pool.Rent<int> span.Length
            let counts = Pool.Rent<int> shards
            try
                for i in 0 .. shards - 1 do counts.[i] <- 0
                for i in 0 .. span.Length - 1 do
                    let s = Shard.Of(key.Invoke span.[i].Key, shards)
                    shardOfEntry.[i] <- s
                    counts.[s] <- counts.[s] + 1
                // Scatter pass: reuse the hashes from the histogram.
                let buffers = Array.zeroCreate<ZEntry<'K> array> shards
                let indices = Pool.Rent<int> shards
                try
                    for i in 0 .. shards - 1 do
                        buffers.[i] <- Pool.AllocateExact<ZEntry<'K>> counts.[i]
                        indices.[i] <- 0
                    for i in 0 .. span.Length - 1 do
                        let s = shardOfEntry.[i]
                        buffers.[s].[indices.[s]] <- span.[i]
                        indices.[s] <- indices.[s] + 1
                    for i in 0 .. shards - 1 do
                        outputs.[i] <-
                            if buffers.[i].Length = 0 then ZSet<'K>.Empty
                            else ZSet(Pool.Freeze buffers.[i])
                    this.Value <- outputs
                finally
                    Pool.Return indices
            finally
                Pool.Return counts
                Pool.Return shardOfEntry
        ValueTask.CompletedTask


/// Reverse of Exchange — merge a set of shard outputs into a single Z-set.
[<Sealed>]
type internal GatherOp<'K when 'K : comparison>(shards: Op<ZSet<'K>> array) =
    inherit Op<ZSet<'K>>()
    let inputs = shards |> Array.map (fun o -> o :> Op)
    override _.Name = "gather"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        // Sum all shard outputs — each sharded Z-set has disjoint support
        // by construction, so `add` is effectively concatenation.
        let mutable acc = ZSet<'K>.Empty
        for op in shards do
            if not op.Value.IsEmpty then
                acc <- if acc.IsEmpty then op.Value else ZSet.add acc op.Value
        this.Value <- acc
        ValueTask.CompletedTask


/// Extract one shard from an exchange output.
[<Sealed>]
type internal ShardSelectOp<'K when 'K : comparison>
    (input: Op<ZSet<'K> array>, index: int) =
    inherit Op<ZSet<'K>>()
    let inputs = [| input :> Op |]
    override _.Name = $"shard#%d{index}"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <- input.Value.[index]
        ValueTask.CompletedTask


[<Extension>]
type ShardExtensions =

    /// Hash-partition a stream into `shards` sub-streams. Returns the
    /// array-op plus convenient per-shard `Stream<ZSet<'K>>` handles.
    [<Extension>]
    static member Exchange<'K when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>, shards: int, key: Func<'K, uint32>)
        : Stream<ZSet<'K>> array =
        if shards <= 0 then invalidArg (nameof shards) "must be positive"
        let exchange = this.Register (ExchangeOp(s.Op, shards, key))
        Array.init shards (fun i ->
            this.RegisterStream (ShardSelectOp(exchange, i)))

    /// Default Exchange using the salted `Shard.OfKey` mixer. Flows the
    /// per-process random salt into every hash so an attacker can't craft
    /// keys that collide on one worker. (The prior revision called
    /// `HashCode.Combine k` without the salt — bypassing the HashDoS
    /// defence the Shard type advertises.)
    [<Extension>]
    static member ExchangeByKey<'K when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>, shards: int) : Stream<ZSet<'K>> array =
        this.Exchange(s, shards, Func<_, _>(fun k -> uint32 (HashCode.Combine(k, Shard.Salt))))

    /// Gather shards back into a single stream.
    [<Extension>]
    static member GatherShards<'K when 'K : comparison>
        (this: Circuit, shards: Stream<ZSet<'K>> array) : Stream<ZSet<'K>> =
        let ops = shards |> Array.map (fun s -> s.Op)
        this.RegisterStream (GatherOp(ops))
