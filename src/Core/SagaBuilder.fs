namespace Zeta.Core

open System.Threading.Tasks

/// Saga<'T> — a workflow function that threads IntrCtx explicitly and returns
/// a Task<Result<'T, InterruptFeedback>>.
type Saga<'T> = IntrCtx -> Task<Result<'T, InterruptFeedback>>

/// SagaBuilder — the F# Computation Expression builder for `saga { ... }`.
/// Threading `IntrCtx` explicitly through monadic bind and delays, demonstrating
/// that F# can propagate tracing, logging, and trust contexts without ambient AsyncLocal.
type SagaBuilder() =
    member _.Return(x: 'T) : Saga<'T> =
        fun _ -> Task.FromResult(Ok x)

    member _.ReturnFrom(s: Saga<'T>) : Saga<'T> =
        s

    member _.Bind(s: Saga<'T>, f: 'T -> Saga<'U>) : Saga<'U> =
        fun ctx ->
            task {
                let! res = s ctx
                match res with
                | Ok x -> return! f x ctx
                | Error e -> return Error e
            }

    member _.Bind(t: Task<Result<'T, InterruptFeedback>>, f: 'T -> Saga<'U>) : Saga<'U> =
        fun ctx ->
            task {
                let! res = t
                match res with
                | Ok x -> return! f x ctx
                | Error e -> return Error e
            }

    member _.Bind(t: Task<'T>, f: 'T -> Saga<'U>) : Saga<'U> =
        fun ctx ->
            task {
                let! x = t
                return! f x ctx
            }

    member _.Zero() : Saga<unit> =
        fun _ -> Task.FromResult(Ok ())

    member _.Delay(f: unit -> Saga<'T>) : Saga<'T> =
        fun ctx -> f () ctx

    member _.Run(s: Saga<'T>) : Saga<'T> =
        s

    member _.Combine(s1: Saga<unit>, s2: Saga<'T>) : Saga<'T> =
        fun ctx ->
            task {
                let! res = s1 ctx
                match res with
                | Ok () -> return! s2 ctx
                | Error e -> return Error e
            }

    member _.TryWith(s: Saga<'T>, handler: exn -> Saga<'T>) : Saga<'T> =
        fun ctx ->
            task {
                try
                    return! s ctx
                with ex ->
                    return! handler ex ctx
            }

    member _.TryFinally(s: Saga<'T>, compensation: unit -> unit) : Saga<'T> =
        fun ctx ->
            task {
                try
                    return! s ctx
                finally
                    compensation ()
            }

[<AutoOpen>]
module SagaGlobals =
    /// The global saga builder instance.
    let saga = SagaBuilder()

    /// liftISR — lift a standard ISR arrow into a Saga monad.
    let liftISR (isr: ISR<'A, 'B>) (arg: 'A) : Saga<'B> =
        fun ctx -> isr ctx arg
