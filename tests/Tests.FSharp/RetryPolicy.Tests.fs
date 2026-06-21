module Zeta.Tests.RetryPolicyTests

open global.Xunit
open FsUnit.Xunit
open Zeta.Core
open Zeta.Core.RetryPolicy

// 081KT7YW00008QG0R003N6PF8A #3 — the retry policy is the VALIDATING instance for the cross-junction kernel:
// the same Policy<input,decision,feedback> kernel that decides XML structure (μF) and
// stream routing (νF) decides retry/backoff/circuit-break here (resilience junction).
// Pure + total — decisions are tested without any clock or side effect (select-not-mutate).

let private ctx attempt errorClass : RetryContext =
    { Attempt = attempt; ElapsedMs = 0L; ErrorClass = errorClass }

[<Fact>]
let ``exponential backoff doubles the delay each attempt, then fails closed at max`` () =
    let p = exponentialBackoff 3 10L
    (p (ctx 0 "transient")).Decision |> should equal (Retry 10L)
    (p (ctx 1 "transient")).Decision |> should equal (Retry 20L)
    (p (ctx 2 "transient")).Decision |> should equal (Retry 40L)
    (p (ctx 3 "transient")).Decision |> should equal FailClosed
    (p (ctx 9 "transient")).Decision |> should equal FailClosed

[<Fact>]
let ``circuit breaker trips at the threshold and delegates below it`` () =
    let p = exponentialBackoff 100 10L |> withCircuitBreaker 2
    (p (ctx 0 "transient")).Decision |> should equal (Retry 10L) // below threshold -> inner
    (p (ctx 1 "transient")).Decision |> should equal (Retry 20L)
    (p (ctx 2 "transient")).Decision |> should equal CircuitBreak // at threshold -> trip
    (p (ctx 5 "transient")).Decision |> should equal CircuitBreak

[<Fact>]
let ``fail-closed-on-fatal short-circuits before the inner policy (predicate kernel reuse)`` () =
    let p = exponentialBackoff 100 10L |> failClosedOn (fatalClasses (set [ "fatal"; "auth" ]))
    (p (ctx 0 "transient")).Decision |> should equal (Retry 10L) // non-fatal -> inner
    (p (ctx 0 "fatal")).Decision |> should equal FailClosed // fatal -> short-circuit
    (p (ctx 0 "auth")).Decision |> should equal FailClosed

[<Fact>]
let ``composition order: fatal check wraps circuit breaker wraps backoff`` () =
    let p =
        exponentialBackoff 100 10L
        |> withCircuitBreaker 3
        |> failClosedOn (fatalClasses (set [ "fatal" ]))
    (p (ctx 1 "transient")).Decision |> should equal (Retry 20L) // through both wrappers to backoff
    (p (ctx 3 "transient")).Decision |> should equal CircuitBreak // breaker trips
    (p (ctx 3 "fatal")).Decision |> should equal FailClosed // fatal beats the breaker (outermost)

[<Fact>]
let ``decisions carry feedback explaining why (auditable, select-not-mutate)`` () =
    let p = exponentialBackoff 2 5L
    (p (ctx 0 "transient")).Feedback |> should haveSubstring "retry"
    (p (ctx 2 "transient")).Feedback |> should haveSubstring "fail-closed"
