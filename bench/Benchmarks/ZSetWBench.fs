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
