namespace Zeta.Core

open System
open System.Collections.Generic
open System.Collections.Immutable

// ═══════════════════════════════════════════════════════════════════
//  MergeKernel — ONE sorted two-pointer merge-sum for every Z-set shape
//  (081KWFXTHJY step 3: the reframe).
//
//  Before this file, the DBSP hot op existed twice: `ZSet.(+)` (int64-
//  specialised) and `ZSetW.sumBy` (semiring-generic) — byte-for-byte the
//  same algorithm, maintained in two places (drift risk; the generator-
//  is-the-ECC rule says the special case must be *derivable* from the
//  free one, not hand-copied). Now both delegate here.
//
//  Zero-overhead recipe (proven by ZSetWBench before extraction):
//   • the ring `'R : struct` — JIT monomorphises per value-type ring and
//     devirtualises `Add`/`Zero` to inlined primitives;
//   • the entry shape `'O : struct` — same treatment for Key/Weight/Make;
//   • `inline` + `internal` — the body inlines into each public wrapper,
//     and internal-inline may use the internal `KeyComparerCache`
//     (public-inline could not — FS1113);
//   • `Pool.Rent` workspace + single `Pool.FreezeSlice` — exactly one
//     heap allocation (the output array), the `ZSet.(+)` discipline.
//
//  Collation: the key order is ALWAYS `KeyComparerCache` = the shipped
//  `binary` collation default (DB model, 081KT07NV) — never
//  `Comparer<'K>.Default`.
// ═══════════════════════════════════════════════════════════════════

/// Internal entry-shape provider: how the kernel reads/makes one entry
/// type. Implemented as a stateless struct per entry type so the JIT
/// devirtualises + inlines the accessors (same trick as the struct ring).
type internal IZEntryOps<'K, 'W, 'E> =
    abstract Key: 'E -> 'K
    abstract Weight: 'E -> 'W
    abstract Make: 'K * 'W -> 'E

/// Struct adapter carrying a BOXED `ISemiring<'W>` into struct-ring-shaped
/// call sites (the kernel). This is the instance-passing COLD path made
/// kernel-compatible: the adapter itself devirtualises; its `inner` calls
/// stay virtual — the same cost the boxed path always paid, now routed
/// through the one kernel instead of a hand-copied merge. Semiring-tier by
/// design: the kernel's merge only ever needs Add/Zero (081KWG9JQ9H).
[<Struct>]
type internal BoxedRing<'W>(inner: ISemiring<'W>) =
    interface ISemiring<'W> with
        member _.Zero = inner.Zero
        member _.One = inner.One
        member _.Add(a, b) = inner.Add(a, b)
        member _.Mul(a, b) = inner.Mul(a, b)

[<RequireQualifiedAccess>]
module internal MergeKernel =

    /// Sorted merge-sum: `(a + b)(k) = a(k) ⊕ b(k)`, zero-weight entries
    /// dropped, output sorted by the binary-collation key order. Inputs
    /// MUST already be sorted by that same order (the Z-set invariant).
    /// Returns the merged entries; empty ⇒ `ImmutableArray.Empty`.
    let inline sum<'K, 'W, 'E, 'R, 'O
                    when 'K : comparison
                    and 'R : struct and 'R :> ISemiring<'W>
                    and 'O : struct and 'O :> IZEntryOps<'K, 'W, 'E>>
        (ops: 'O) (ring: 'R)
        (sa: ReadOnlySpan<'E>) (sb: ReadOnlySpan<'E>) : ImmutableArray<'E> =
        let zero = ring.Zero
        let weq = EqualityComparer<'W>.Default
        let cmp = KeyComparerCache<'K>.Instance
        let cap = sa.Length + sb.Length
        let rented = Pool.Rent<'E> cap
        try
            let mutable i = 0
            let mutable j = 0
            let mutable k = 0
            while i < sa.Length && j < sb.Length do
                let c = cmp.Compare(ops.Key sa.[i], ops.Key sb.[j])
                if c < 0 then rented.[k] <- sa.[i]; i <- i + 1; k <- k + 1
                elif c > 0 then rented.[k] <- sb.[j]; j <- j + 1; k <- k + 1
                else
                    let combined = ring.Add(ops.Weight sa.[i], ops.Weight sb.[j])
                    if not (weq.Equals(combined, zero)) then
                        rented.[k] <- ops.Make(ops.Key sa.[i], combined); k <- k + 1
                    i <- i + 1; j <- j + 1
            while i < sa.Length do rented.[k] <- sa.[i]; i <- i + 1; k <- k + 1
            while j < sb.Length do rented.[k] <- sb.[j]; j <- j + 1; k <- k + 1
            Pool.FreezeSlice(rented, k)
        finally
            Pool.Return rented
