module Zeta.Benchmarks.ZSetWBench

open BenchmarkDotNet.Attributes
open Zeta.Core

/// Dispatch benchmark for the polymorphic Z-set (work-item 081KWFXTHJY, step 2b/3).
///
/// Three ways to compute the same int64 Z-set sum:
///   * `ZSetAdd`  — the current specialised int64 hot path (`ZSet.add`). BASELINE.
///   * `ZSetWInstance` — `ZSetW.sum` with a BOXED `ISemiring<int64>` (instance-passing,
///     path 1): a virtual `ISemiring.Add` call per merged weight.
///   * `ZSetWStructRing` — `ZSetW.sumBy` with a struct `IntegerRing` passed BY VALUE
///     (paths 2+3): inline + struct generic, so the JIT can devirtualise `Add` to a
///     bare `int64 +`.
///
/// The step-3 reframe (`type ZSet = ZSetW<_,int64,_>`) is gated on this: it lands
/// only if `ZSetWStructRing` matches `ZSetAdd` on time AND Gen0 alloc, and the boxed
/// `ZSetWInstance` is the one that pays. `MemoryDiagnoser` reports the per-op alloc.
[<MemoryDiagnoser>]
type ZSetWDispatch() =

    let iring = IntegerRing.Instance   // boxed once, for the instance-passing path

    [<DefaultValue(false)>] val mutable private za: ZSet<int>
    [<DefaultValue(false)>] val mutable private zb: ZSet<int>
    [<DefaultValue(false)>] val mutable private wa: ZSetW<int, int64>
    [<DefaultValue(false)>] val mutable private wb: ZSetW<int, int64>

    [<Params(16, 256, 4096)>]
    member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        this.za <- ZSet.ofSeq [ for i in 0 .. this.Size - 1 -> i, 1L ]
        this.zb <- ZSet.ofSeq [ for i in 0 .. this.Size - 1 -> i + this.Size / 2, 1L ]
        this.wa <- ZSetW.ofZSetIntegerRing this.za
        this.wb <- ZSetW.ofZSetIntegerRing this.zb

    /// Baseline: the specialised int64 hot path we must not regress against.
    [<Benchmark(Baseline = true)>]
    member this.ZSetAdd() = ZSet.add this.za this.zb

    /// Instance-passing (boxed ring, virtual call per weight) — the cold path.
    [<Benchmark>]
    member this.ZSetWInstance() = ZSetW.sum iring this.wa this.wb

    /// Struct-ring by value (inline + monomorphized) — the zero-overhead target.
    [<Benchmark>]
    member this.ZSetWStructRing() = ZSetW.sumBy (IntegerRing()) this.wa this.wb


/// STRING-key variant (Naledi sign-off follow-up #9): the practical DBSP key
/// type. Exercises what the int-key bench cannot — the shared-generics path
/// (`__Canon`): the ordinal `KeyComparerCache` comparer stays an interface
/// call per comparison, and `Pool.Return` must CLEAR the rented buffer
/// (`IsReferenceOrContainsReferences<ZEntry<string>>` = true), an O(cap)
/// pass per merge invisible with int keys. Keys are zero-padded so ordinal
/// order == numeric order (realistic sorted-key workload).
[<MemoryDiagnoser>]
type ZSetWDispatchString() =

    let iring = IntegerRing.Instance

    [<DefaultValue(false)>] val mutable private za: ZSet<string>
    [<DefaultValue(false)>] val mutable private zb: ZSet<string>
    [<DefaultValue(false)>] val mutable private wa: ZSetW<string, int64>
    [<DefaultValue(false)>] val mutable private wb: ZSetW<string, int64>

    [<Params(16, 256, 4096)>]
    member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        this.za <- ZSet.ofSeq [ for i in 0 .. this.Size - 1 -> sprintf "key-%06d" i, 1L ]
        this.zb <- ZSet.ofSeq [ for i in 0 .. this.Size - 1 -> sprintf "key-%06d" (i + this.Size / 2), 1L ]
        this.wa <- ZSetW.ofZSetIntegerRing this.za
        this.wb <- ZSetW.ofZSetIntegerRing this.zb

    [<Benchmark(Baseline = true)>]
    member this.ZSetAdd() = ZSet.add this.za this.zb

    [<Benchmark>]
    member this.ZSetWInstance() = ZSetW.sum iring this.wa this.wb

    [<Benchmark>]
    member this.ZSetWStructRing() = ZSetW.sumBy (IntegerRing()) this.wa this.wb


/// Large-size point (Naledi follow-up #10): pool-miss / LOH behaviour.
/// 65536⊕65536 rents a 131072-entry workspace (16 B entries ⇒ 2 MB) —
/// above the 85 KB LOH threshold when a pool-miss allocates, still under
/// `ArrayPool.Shared`'s 2^20-element bucket cap so steady-state stays pooled.
[<MemoryDiagnoser>]
type ZSetWDispatchLarge() =

    [<DefaultValue(false)>] val mutable private za: ZSet<int>
    [<DefaultValue(false)>] val mutable private zb: ZSet<int>
    [<DefaultValue(false)>] val mutable private wa: ZSetW<int, int64>
    [<DefaultValue(false)>] val mutable private wb: ZSetW<int, int64>

    [<Params(65536)>]
    member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        this.za <- ZSet.ofSeq [ for i in 0 .. this.Size - 1 -> i, 1L ]
        this.zb <- ZSet.ofSeq [ for i in 0 .. this.Size - 1 -> i + this.Size / 2, 1L ]
        this.wa <- ZSetW.ofZSetIntegerRing this.za
        this.wb <- ZSetW.ofZSetIntegerRing this.zb

    [<Benchmark(Baseline = true)>]
    member this.ZSetAdd() = ZSet.add this.za this.zb

    [<Benchmark>]
    member this.ZSetWStructRing() = ZSetW.sumBy (IntegerRing()) this.wa this.wb
