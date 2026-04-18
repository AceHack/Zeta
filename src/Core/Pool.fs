namespace Zeta.Core

open System
open System.Buffers
open System.Collections.Immutable
open System.Runtime.CompilerServices
open System.Runtime.InteropServices

/// Low-level allocation primitives. Every method is JIT-specialized per `'T`;
/// `RuntimeHelpers.IsReferenceOrContainsReferences<'T>()` is a compile-time
/// intrinsic that the JIT constant-folds, so the `clearArray` branch collapses
/// to a fixed value for any concrete type.
///
/// We deliberately avoid a higher-order `Build(fill)` helper because
/// `Span<'T>`-typed function parameters are not permissible in CIL signatures.
/// Instead, every hot path inlines the rent → fill → allocate-exact → copy →
/// wrap pattern directly; the duplication is a small code-size trade for a
/// large allocation and virtual-dispatch win.
[<AbstractClass; Sealed>]
type Pool =

    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    static member Rent<'T>(minLength: int) : 'T array =
        if minLength <= 0 then Array.Empty<'T>()
        else ArrayPool<'T>.Shared.Rent minLength

    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    static member Return<'T>(buffer: 'T array) : unit =
        if buffer.Length > 0 then
            ArrayPool<'T>.Shared.Return(buffer, RuntimeHelpers.IsReferenceOrContainsReferences<'T>())

    /// Exact-size `T[]` skipping zero-init for blittable `'T`. For
    /// reference-containing types the runtime zeroes as required.
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    static member AllocateExact<'T>(length: int) : 'T array =
        if length = 0 then Array.Empty<'T>()
        else GC.AllocateUninitializedArray<'T>(length, pinned = false)

    /// Wrap a fully-populated `T[]` as `ImmutableArray<T>` without copying.
    ///
    /// **Contract:** caller transfers ownership. After this call the array
    /// MUST NOT be mutated or referenced by any other code. The `ImmutableArray`
    /// becomes the sole owner. Used as the final step of a rent → fill →
    /// allocate-exact → freeze pipeline where the only reference to the array
    /// is the local binding about to return.
    ///
    /// This uses `ImmutableCollectionsMarshal.AsImmutableArray`, the
    /// documented BCL idiom for zero-copy construction. It is safe when the
    /// ownership contract is honoured — enforced here by the single-use
    /// pattern in every caller inside this assembly (pool.fs, ZSet.fs,
    /// IndexedZSet.fs, Shard.fs).
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    [<System.ComponentModel.EditorBrowsable(System.ComponentModel.EditorBrowsableState.Advanced)>]
    static member Freeze<'T>(array: 'T array) : ImmutableArray<'T> =
        ImmutableCollectionsMarshal.AsImmutableArray<'T> array


    /// Copy a slice of `source` into a newly-allocated exact-sized array and
    /// wrap it. The single allocation is unavoidable (the immutable output).
    ///
    /// Overload: `source[0..length)` → `ImmutableArray<T>` of exactly `length`.
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    static member FreezeSlice<'T>(source: 'T array, length: int) : ImmutableArray<'T> =
        if length <= 0 then ImmutableArray<'T>.Empty
        else
            let exact = GC.AllocateUninitializedArray<'T>(length, pinned = false)
            Array.Copy(source, exact, length)
            ImmutableCollectionsMarshal.AsImmutableArray<'T> exact
