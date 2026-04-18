namespace Zeta.Core

open System
open System.Numerics
open System.Runtime.CompilerServices

/// SIMD helpers using `System.Numerics.Vector<T>` — always in the BCL, no
/// extra package needed. `Vector<T>` auto-dispatches to AVX-512 / AVX2 /
/// SSE4.1 / ARM NEON / SVE2 / scalar based on runtime CPU support; the JIT
/// emits the widest ISA available and folds the `IsHardwareAccelerated`
/// check to a constant after tiered compilation.
[<AbstractClass; Sealed>]
type Simd =

    /// Sum a `ReadOnlySpan<int64>` with SIMD when available, scalar fallback
    /// otherwise. Roughly 2-4× faster than a scalar loop on 1K+ elements.
    static member Sum(span: ReadOnlySpan<int64>) : int64 =
        if span.IsEmpty then 0L
        elif not Vector.IsHardwareAccelerated || span.Length < Vector<int64>.Count * 4 then
            let mutable total = 0L
            for i in 0 .. span.Length - 1 do total <- total + span.[i]
            total
        else
            let width = Vector<int64>.Count
            let mutable acc = Vector<int64>.Zero
            let mutable i = 0
            while i + width <= span.Length do
                acc <- acc + Vector<int64>(span.Slice(i, width))
                i <- i + width
            let mutable total = Vector.Sum acc
            while i < span.Length do total <- total + span.[i]; i <- i + 1
            total

    /// Sum a `ReadOnlySpan<int32>`.
    static member Sum(span: ReadOnlySpan<int32>) : int32 =
        if span.IsEmpty then 0
        elif not Vector.IsHardwareAccelerated || span.Length < Vector<int32>.Count * 4 then
            let mutable total = 0
            for i in 0 .. span.Length - 1 do total <- total + span.[i]
            total
        else
            let width = Vector<int32>.Count
            let mutable acc = Vector<int32>.Zero
            let mutable i = 0
            while i + width <= span.Length do
                acc <- acc + Vector<int32>(span.Slice(i, width))
                i <- i + width
            let mutable total = Vector.Sum acc
            while i < span.Length do total <- total + span.[i]; i <- i + 1
            total

    static member IsAccelerated : bool = Vector.IsHardwareAccelerated
    static member VectorWidth : int = Vector<int64>.Count
