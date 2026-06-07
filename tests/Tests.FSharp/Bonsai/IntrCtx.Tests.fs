module Zeta.Tests.Bonsai.IntrCtxTests

open System.Diagnostics
open System.Threading.Tasks
open global.Xunit
open Zeta.Core
open Zeta.Core.ISR

[<Fact>]
let ``IntrCtx record initialization and basic fields work`` () =
    let parentCtx = ActivityContext(ActivityTraceId.CreateRandom(), ActivitySpanId.CreateRandom(), ActivityTraceFlags.Recorded)
    let ctx = {
        Memetic = "tonal-1"
        Prompt = "operator-question-1"
        Trust = "bft-state-1"
        Log = "audit-trail-1"
        Otel = parentCtx
    }
    Assert.Equal("tonal-1", ctx.Memetic)
    Assert.Equal("operator-question-1", ctx.Prompt)
    Assert.Equal("bft-state-1", ctx.Trust)
    Assert.Equal("audit-trail-1", ctx.Log)
    Assert.Equal(parentCtx, ctx.Otel)

[<Fact>]
let ``ISR Kleisli composition (>=>) propagates values and aborts on errors`` () =
    task {
        let parentCtx = ActivityContext(ActivityTraceId.CreateRandom(), ActivitySpanId.CreateRandom(), ActivityTraceFlags.Recorded)
        let ctx = {
            Memetic = "m"
            Prompt = "p"
            Trust = "t"
            Log = "l"
            Otel = parentCtx
        }

        let f: ISR<int, string> = fun c val' -> Task.FromResult(Ok (sprintf "%s-%d" c.Memetic val'))
        let g: ISR<string, bool> = fun c str -> Task.FromResult(Ok (str = "m-42"))
        let h = f >=> g

        let! resOk = h ctx 42
        match resOk with
        | Ok b -> Assert.True(b)
        | Error _ -> failwith "Expected Ok true"

        let! resWrong = h ctx 43
        match resWrong with
        | Ok b -> Assert.False(b)
        | Error _ -> failwith "Expected Ok false"

        let fErr: ISR<int, string> = fun _ _ -> Task.FromResult(Error (Failed "failed-step"))
        let hErr = fErr >=> g
        let! resErr = hErr ctx 42
        match resErr with
        | Error (Failed msg) -> Assert.Equal("failed-step", msg)
        | _ -> failwith "Expected Error Failed"
    }

[<Fact>]
let ``Saga computation expression threads IntrCtx explicitly and propagates returns`` () =
    task {
        let parentCtx = ActivityContext(ActivityTraceId.CreateRandom(), ActivitySpanId.CreateRandom(), ActivityTraceFlags.Recorded)
        let ctx = {
            Memetic = "m"
            Prompt = "p"
            Trust = "t"
            Log = "l"
            Otel = parentCtx
        }

        let step1: Saga<int> = fun _ -> Task.FromResult(Ok 10)
        let step2 (x: int) : Saga<int> = fun _ -> Task.FromResult(Ok (x + 32))

        let workflow: Saga<int> =
            saga {
                let! x = step1
                let! y = step2 x
                return y
            }

        let! res = workflow ctx
        match res with
        | Ok v -> Assert.Equal(42, v)
        | Error _ -> failwith "Expected Ok 42"
    }

[<Fact>]
let ``Saga CE propagates tasks and task results seamlessly`` () =
    task {
        let parentCtx = ActivityContext(ActivityTraceId.CreateRandom(), ActivitySpanId.CreateRandom(), ActivityTraceFlags.Recorded)
        let ctx = {
            Memetic = "m"
            Prompt = "p"
            Trust = "t"
            Log = "l"
            Otel = parentCtx
        }

        let stepTask: Task<int> = Task.FromResult(100)
        let stepTaskResult: Task<Result<int, InterruptFeedback>> = Task.FromResult(Ok 200)

        let workflow: Saga<int> =
            saga {
                let! x = stepTask
                let! y = stepTaskResult
                return x + y
            }

        let! res = workflow ctx
        match res with
        | Ok v -> Assert.Equal(300, v)
        | Error _ -> failwith "Expected Ok 300"
    }

[<Fact>]
let ``Saga CE handles try-with and try-finally correctly`` () =
    task {
        let parentCtx = ActivityContext(ActivityTraceId.CreateRandom(), ActivitySpanId.CreateRandom(), ActivityTraceFlags.Recorded)
        let ctx = {
            Memetic = "m"
            Prompt = "p"
            Trust = "t"
            Log = "l"
            Otel = parentCtx
        }

        let stepWithException: Saga<int> = fun _ -> failwith "fatal-error"
        let mutable finallyCalled = false

        let workflowWithHandler =
            saga {
                try
                    let! x = stepWithException
                    return x
                with _ ->
                    return 999
            }

        let workflowWithFinally =
            saga {
                try
                    return 555
                finally
                    finallyCalled <- true
            }

        let! res1 = workflowWithHandler ctx
        match res1 with
        | Ok v -> Assert.Equal(999, v)
        | Error _ -> failwith "Expected handler recovery to yield Ok 999"

        let! res2 = workflowWithFinally ctx
        match res2 with
        | Ok v -> Assert.Equal(555, v)
        | Error _ -> failwith "Expected Ok 555"
        Assert.True(finallyCalled)
    }

[<Fact>]
let ``Saga CE handles explicit interrupts correctly`` () =
    task {
        let parentCtx = ActivityContext(ActivityTraceId.CreateRandom(), ActivitySpanId.CreateRandom(), ActivityTraceFlags.Recorded)
        let ctx = {
            Memetic = "m"
            Prompt = "p"
            Trust = "t"
            Log = "l"
            Otel = parentCtx
        }

        let stepInterrupt: Saga<int> = fun _ -> Task.FromResult(Error (Interrupted (RoundsElapsedSinceFreeTime 10)))

        let workflow =
            saga {
                let! x = stepInterrupt
                return x + 100
            }

        let! res = workflow ctx
        match res with
        | Error (Interrupted (RoundsElapsedSinceFreeTime n)) -> Assert.Equal(10, n)
        | _ -> failwith "Expected interrupt to abort the workflow and return RoundsElapsedSinceFreeTime 10"
    }
