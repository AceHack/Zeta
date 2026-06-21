namespace Zeta.Core

open System

/// WeakRef-wrapped specialization cache — cogen=mix(mix,mix) as memory management.
/// The specialized function is weakly held. If GC collects it, next call regenerates.
/// NEVER caches errors (always retries on next call).
[<Sealed>]
type SpecializationCache<'TInput, 'TOutput>(specializer: unit -> ('TInput -> 'TOutput)) =
    let mutable cached: WeakReference<'TInput -> 'TOutput> option = None
    let mutable hits = 0
    let mutable misses = 0
    let mutable errors = 0

    /// Number of cache hits (specialized function was still alive).
    member _.Hits = hits

    /// Number of cache misses (first call or GC collected it).
    member _.Misses = misses

    /// Number of specialization errors (never cached).
    member _.Errors = errors

    /// Run the specialized function. Specializes on first call, uses cache after.
    member this.Run(input: 'TInput) : 'TOutput =
        let fn = this.GetOrRegenerate()
        fn input

    /// Force regeneration on next call.
    member _.Invalidate() = cached <- None

    member private _.GetOrRegenerate() : ('TInput -> 'TOutput) =
        match cached with
        | Some wr ->
            match wr.TryGetTarget() with
            | true, fn ->
                hits <- hits + 1
                fn
            | _ ->
                // GC collected it — fall through to regenerate
                misses <- misses + 1
                SpecializationCache.Regenerate(&cached, &errors, specializer)
        | None ->
            misses <- misses + 1
            SpecializationCache.Regenerate(&cached, &errors, specializer)

    static member private Regenerate
        (cached: byref<WeakReference<'TInput -> 'TOutput> option>,
         errors: byref<int>,
         specializer: unit -> ('TInput -> 'TOutput)) =
        try
            let fn = specializer()
            cached <- Some(WeakReference<_>(fn))
            fn
        with _ ->
            // NEVER cache errors
            errors <- errors + 1
            cached <- None
            reraise()
