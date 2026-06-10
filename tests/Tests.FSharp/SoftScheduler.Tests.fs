module Zeta.Tests.SoftSchedulerTests

open System.Diagnostics
open System.Threading.Tasks
open global.Xunit
open Zeta.Core

let private ctx () : IntrCtx =
    { Memetic = "m"
      Prompt = "p"
      Trust = "t"
      Log = "l"
      Otel = ActivityContext(ActivityTraceId.CreateRandom(), ActivitySpanId.CreateRandom(), ActivityTraceFlags.Recorded) }

let private isTimer =
    function
    | TimerElapsed _ -> true
    | _ -> false

let private isOperator =
    function
    | OperatorMessageArrived _ -> true
    | _ -> false

/// A handler that increments an int every time its interrupt fires (the CHIP-8 60Hz timer = the
/// canonical scheduler workload: one tick advances the count).
let private counter name matches : SoftScheduler.Handler<int> =
    SoftScheduler.handler name matches (fun _ s -> Task.FromResult(Ok(s + 1)))

[<Fact>]
let ``timer handler advances once per tick — 60 ticks => 60`` () =
    task {
        let sched = SoftScheduler.runDeterministic [ counter "timer" isTimer ]
        let! r = sched (ctx ()) 1234L 0 60
        Assert.Equal<Result<int, InterruptFeedback>>(Ok 60, r)
    }

[<Fact>]
let ``deterministic: same (seed, budget) => identical final state (DST replay)`` () =
    task {
        let handlers = [ counter "timer" isTimer; counter "op" isOperator ]
        let! a = SoftScheduler.runDeterministic handlers (ctx ()) 99L 0 600
        let! b = SoftScheduler.runDeterministic handlers (ctx ()) 99L 0 600
        Assert.Equal<Result<int, InterruptFeedback>>(a, b)
    }

[<Fact>]
let ``different seeds produce different operator-arrival schedules (the seed IS the entropy)`` () =
    // the seed determines WHICH ticks raise an operator message; two seeds must differ in that set
    // (compare the schedules directly — folded counts can coincide even when the schedules differ).
    let opTicks seed =
        let src = SoftScheduler.seedSource seed
        [ for n in 0..599 do
              if List.exists isOperator (src n) then
                  yield n ]
    Assert.NotEqual<int list>(opTicks 1L, opTicks 2L)

[<Fact>]
let ``an Error interrupt stops the run and surfaces (the room does not swallow it)`` () =
    task {
        let boom: SoftScheduler.Handler<int> =
            SoftScheduler.handler "boom" isTimer (fun _ _ -> Task.FromResult(Error(Interrupted SentinelMissing)))
        let! r = SoftScheduler.runDeterministic [ boom ] (ctx ()) 7L 0 60
        Assert.Equal<Result<int, InterruptFeedback>>(Error(Interrupted SentinelMissing), r)
    }

[<Fact>]
let ``handlers fold in registration order via the ISR arrow (composition is deterministic)`` () =
    task {
        // two timer handlers: first +1, second *10. Per tick state goes s -> (s+1)*10.
        // from 0, one tick => 10; two ticks => 110; three => 1110.
        let add: SoftScheduler.Handler<int> =
            SoftScheduler.handler "add" isTimer (fun _ s -> Task.FromResult(Ok(s + 1)))
        let mul: SoftScheduler.Handler<int> =
            SoftScheduler.handler "mul" isTimer (fun _ s -> Task.FromResult(Ok(s * 10)))
        // budget 3, only the timer fires (operator may also fire but these handlers ignore it)
        let sched = SoftScheduler.drive [ add; mul ] (fun _ -> [ TimerElapsed 17 ])
        let! r = sched.Run (ctx ()) 0L 0 3
        Assert.Equal<Result<int, InterruptFeedback>>(Ok 1110, r)
    }
