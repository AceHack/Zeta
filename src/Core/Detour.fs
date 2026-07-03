namespace Zeta.Core

/// **Detour — runtime interception as a max-generic endomorphism** (Aaron 2026-07-02:
/// *"this is just Microsoft Detours — make F# generic to the max"*).
///
/// Microsoft Detours (Hunt & Brubacher, MSR 1999) reduced to its irreducible shape:
/// a detour is an **endomorphism on the hooked function**, `Detour<'F> = 'F -> 'F`.
/// Every hook — before / after / around advice, argument or result transformation —
/// is a *special case* of this one shape (only-the-irreducible-is-primitive). The
/// runtime (a CLR profiler, a chip9 opcode dispatcher, a CSS render loop) chooses only
/// WHERE the endomorphism attaches; the algebra is the same everywhere.
///
/// **Scope (load-bearing):** this instruments OUR OWN functions — the observe -> report
/// -> improve loop over the cluster's own runtime. It is NOT a tool against foreign or
/// protected software; hooking someone else's binary is out of scope (mirrors
/// `hooks/README.md` and `dual-use-detection-is-neutral-oracle-decides`).
///
/// **Weight-free + noninterference:** detours are pure shape with no captured state,
/// and the *observe* channel is an explicitly injected sink (`Observe<'t>`) — the one
/// declared door effects cross, never ambient. Inject a deterministic sink for DST;
/// the *observe* constructors provably cannot change the hooked computation's result
/// (report is read-only by construction), so only the *improve* constructors alter
/// behaviour — and they say so in their names.
[<RequireQualifiedAccess>]
module Detour =

    /// The irreducible shape. A detour rewrites a function into another function of
    /// the SAME type. Detours form a monoid under `compose` with `identity` as unit.
    type Detour<'F> = 'F -> 'F

    /// The identity detour — attaches nothing (the monoid unit).
    let identity (f: 'F) : 'F = f

    /// Compose two detours: `inner` is applied to the target first, then `outer`
    /// wraps the result — so `outer` observes/alters "further out". Associative;
    /// `compose identity d = compose d identity = d`.
    let compose (outer: Detour<'F>) (inner: Detour<'F>) : Detour<'F> =
        fun target -> outer (inner target)

    /// Fold a list of detours into one. Head is OUTERMOST (applied last, observes
    /// first on the way in). Empty list = `identity`.
    let composeAll (detours: Detour<'F> list) : Detour<'F> =
        List.foldBack compose detours identity

    /// Apply (attach) a detour to a target function — the functional analogue of
    /// `DetourAttach`. The original `target` closure IS the trampoline: an `around`
    /// detour still holds and can call it.
    let attach (detour: Detour<'F>) (target: 'F) : 'F = detour target

    /// An observation channel — the ONE declared door effects cross (noninterference).
    /// Inject a deterministic sink (e.g. append to a buffer) for DST-replayable runs.
    type Observe<'t> = 't -> unit

    // ---- OBSERVE / REPORT constructors (read-only: never change the result) -------

    /// Observe the argument before the original runs; result unchanged.
    let before (obs: Observe<'a>) : Detour<'a -> 'b> =
        fun target arg ->
            obs arg
            target arg

    /// Observe the result after the original runs; result unchanged.
    let after (obs: Observe<'b>) : Detour<'a -> 'b> =
        fun target arg ->
            let result = target arg
            obs result
            result

    /// Observe both sides (find-what-writes: arg + result) via a paired sink;
    /// result unchanged. This is the "report" probe of the observe->report->improve loop.
    let around (obs: Observe<'a * 'b>) : Detour<'a -> 'b> =
        fun target arg ->
            let result = target arg
            obs (arg, result)
            result

    // ---- IMPROVE constructors (deliberately transform — named so it is explicit) --

    /// Transform the argument before the original runs (the "improve" half).
    let mapArg (transform: 'a -> 'a) : Detour<'a -> 'b> =
        fun target arg -> target (transform arg)

    /// Transform the result after the original runs (the "improve" half).
    let mapResult (transform: 'b -> 'b) : Detour<'a -> 'b> =
        fun target arg -> transform (target arg)
