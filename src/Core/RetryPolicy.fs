namespace Zeta.Core

/// # Retry policy — the decision kernel at the resilience junction (081KT7YW00008QG0R003N6PF8A #3)
///
/// The VALIDATING instance for the cross-junction thesis: the same `Policy` kernel
/// (Predicate + `Policy<input, decision, feedback>`) that decides XML structure (μF,
/// serialization junction) and stream routing (νF, routing junction) also decides
/// retry/backoff/circuit-break (the resilience junction, Polly-shaped). Same kernel,
/// a genuinely different junction — proving "decision-over-shape" generalizes beyond
/// serialization, exactly as Kestrel/Amara framed it.
///
/// Select-not-mutate (Amara's blade): the policy DECIDES (Retry/CircuitBreak/…) and
/// says WHY (feedback); it never sleeps, retries, or trips anything — the executor
/// performs the action. This module is pure + total, so the decision is auditable and
/// testable without any clock or side effect.
///
/// Scope discipline (Amara): ONE runtime interpreter to validate the generalization —
/// NOT all of trust/routing/dispatch. Those compose later, as real needs appear.
module RetryPolicy =

    /// What the policy decides ON (the resilience junction's input shape).
    type RetryContext =
        { /// 0-based attempt index (0 = first try).
          Attempt: int
          /// Elapsed time across attempts (ms) — for time-budget policies.
          ElapsedMs: int64
          /// Caller-classified error (e.g. "transient", "fatal", "throttled").
          ErrorClass: string }

    /// The typed decision (Polly-shaped). `Retry` carries the delay the executor should
    /// wait; the others are terminal.
    type RetryDecision =
        | Retry of delayMs: int64
        | CircuitBreak
        | FailClosed
        | Stop

    /// A retry policy = the kernel at the resilience junction.
    type RetryPolicy = Policy.Policy<RetryContext, RetryDecision, string>

    /// Exponential backoff: Retry with delay = baseDelayMs * 2^Attempt, until
    /// `maxAttempts` is reached, then `FailClosed`. (Pure: computes the delay, does not
    /// wait.)
    let exponentialBackoff (maxAttempts: int) (baseDelayMs: int64) : RetryPolicy =
        fun ctx ->
            if ctx.Attempt >= maxAttempts then
                Policy.result FailClosed (sprintf "fail-closed: attempt %d reached max %d" ctx.Attempt maxAttempts)
            else
                // baseDelayMs * 2^Attempt, via left shift on the attempt index
                let delay = baseDelayMs <<< ctx.Attempt
                Policy.result (Retry delay) (sprintf "retry: attempt %d, backoff %dms" ctx.Attempt delay)

    /// Wrap a policy with a circuit breaker: once `Attempt` reaches `threshold`, trip to
    /// `CircuitBreak` regardless of the inner policy; otherwise delegate to `inner`.
    let withCircuitBreaker (threshold: int) (inner: RetryPolicy) : RetryPolicy =
        fun ctx ->
            if ctx.Attempt >= threshold then
                Policy.result CircuitBreak (sprintf "circuit-break: attempt %d reached threshold %d" ctx.Attempt threshold)
            else
                inner ctx

    /// Wrap a policy to fail closed immediately when an error class is fatal (decided by
    /// the Predicate kernel); otherwise delegate to `inner`. Composes the predicate
    /// algebra at the resilience junction.
    let failClosedOn (isFatal: Predicate.Predicate<RetryContext>) (inner: RetryPolicy) : RetryPolicy =
        fun ctx ->
            if isFatal ctx then
                Policy.result FailClosed (sprintf "fail-closed: fatal error class %A" ctx.ErrorClass)
            else
                inner ctx

    /// Convenience: an error class is fatal iff it is in the given set (predicate-kernel
    /// membership over the error class).
    let fatalClasses (classes: Set<string>) : Predicate.Predicate<RetryContext> =
        fun ctx -> Set.contains ctx.ErrorClass classes
