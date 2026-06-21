namespace Zeta.Core

open System.Threading.Tasks

/// IsrLift — the 081KTQD8A0008QG0R0005EFYPV fusion, executed the way Rodney's Razor cut it (2026-06-10): **fusion by
/// instantiation + lift, not by refactor.**
///
/// Rodney's verdict on the as-written acceptance ("ISR's feedback channel becomes FourCornerOwnership"):
/// categorical mismatch — `InterruptFeedback` is a *sum* on the Result **error** position (short-circuit
/// under `>=>`); `FourCornerOwnership` is a *product* of per-tick I/O state. Forcing the product into the
/// error slot would rewrite `>=>`, grow every `ISR`/`Handler` signature by four type parameters, and churn
/// all proven tests — accidental complexity, the very thing 081KTQD8A0008QG0R0005EFYPV set out to remove.
///
/// **The fusion already exists as a type application:** `ISR<FourCornerOwnership<...>, FourCornerOwnership<...>>`
/// — the corners flow through the **value** channel (handlers fill `TOut`/`TOutFeedback`/`TInFeedback` as
/// the tick advances), and genuine interrupts stay in `Result`'s error channel where short-circuit
/// semantics are *correct*. Zero structural change; `IntrCtx.fs`, `SoftScheduler.fs`, CHIP-8 untouched.
/// The instantiation is *proven* in `tests/Tests.FSharp/FourCornerFusion.Tests.fs`.
///
/// This file adds the one genuinely missing piece: **lifts into the arrow.**
[<RequireQualifiedAccess>]
module IsrLift =

    /// Lift a pure `Policy` into the ISR arrow — "Policy = a decision-arrow over it" (081KTQD8A0008QG0R0005EFYPV acceptance
    /// #2), done as a lift instead of a rewrite. The policy SELECTS (decision + why); the arrow carries it.
    let ofPolicy
        (p: Policy.Policy<'input, 'decision, 'feedback>)
        : ISR<'input, Policy.PolicyResult<'decision, 'feedback>> =
        fun _ctx input -> Task.FromResult(Ok(p input))

    /// Lift any pure function into the ISR arrow (the unit of the Kleisli structure — `arr` in arrow terms).
    let ofPure (f: 'a -> 'b) : ISR<'a, 'b> =
        fun _ctx a -> Task.FromResult(Ok(f a))
