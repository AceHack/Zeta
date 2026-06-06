namespace Zeta.Core

open System.Threading
open System.Threading.Tasks


/// **DurableSaga** — a long-running deterministic workflow whose state evolves by
/// applying ordered, **signed** events through a pure `step` reducer, with every
/// event persisted to an `IDeltaLog` so the saga survives crashes. Recovery =
/// replay the logged events through `step` (persist inputs, recompute derived).
///
/// **Retraction-driven compensation (the load-bearing capability).** `step`
/// receives the event AND its **signed weight**: `+1` = apply, `-1` = *compensate*
/// (undo). Data-plane retraction is free (a Z-set `-1`); but external / side-
/// effecting surfaces are NOT natively retractable. A saga makes them consistently
/// retractable: when a retraction event flows through, the saga reacts and emits
/// the compensating action. So retraction stays consistent across the whole world,
/// not just the Z-set data plane (classic saga compensating-transaction pattern,
/// unified with Z-set sign).
///
/// Sits at the control-plane → data-plane seam (vision doc §5b): the saga's
/// *events are the deltas* the data plane logs; its *logic* is the deterministic
/// `step` (a `YinYang.Cell`'s yang/`Bonsai.Expr` is the natural source). `step`
/// MUST be deterministic (DST §7); non-determinism goes in the event payload /
/// `captured`, never in `step`.
///
/// Events ride the ZSet `IDeltaLog`: `AppendAsync` logs a `+1`, `RetractAsync` a
/// `-1`. v1 recovers by FULL log replay; a `'TState` snapshot is a follow-up once
/// a `'TState` codec lands (same serialization seam as the disk log).
[<Sealed>]
type DurableSaga<'TState, 'Event when 'Event : comparison>
    (log: IDeltaLog<'Event>,
     step: 'TState -> 'Event -> int64 -> 'TState,
     initialState: 'TState,
     initialSeq: int64) =

    let mutable state = initialState
    let mutable appliedSeq = initialSeq

    /// The current saga state (the fold of all applied + compensated events).
    member _.State : 'TState = state
    /// Highest event-log sequence folded into the current state.
    member _.AppliedSeq : int64 = appliedSeq
    member _.Log = log

    member private this.EmitAsync(event, weight, captured, ct) : Task<int64> =
        task {
            let! seq = log.AppendAsync(ZSet.ofSeq [ event, weight ], captured, ct)
            state <- step state event weight
            appliedSeq <- seq
            return seq
        }

    /// Apply an event (weight `+1`): persist it, advance the saga via `step`.
    member this.AppendAsync
        (event: 'Event, ?captured: Map<string, string>, ?cancellationToken: CancellationToken)
        : Task<int64> =
        this.EmitAsync(event, 1L, defaultArg captured Map.empty,
                       defaultArg cancellationToken CancellationToken.None)

    /// Retract an event (weight `-1`): persist the retraction and let `step`
    /// COMPENSATE — undo the effect, including on non-retractable surfaces.
    member this.RetractAsync
        (event: 'Event, ?captured: Map<string, string>, ?cancellationToken: CancellationToken)
        : Task<int64> =
        this.EmitAsync(event, -1L, defaultArg captured Map.empty,
                       defaultArg cancellationToken CancellationToken.None)

    /// Resume from the durable log: replay every logged event (in seq order, with
    /// its sign) through `step`, rebuilding state — applies and compensations alike.
    static member ResumeAsync
        (log: IDeltaLog<'Event>,
         step: 'TState -> 'Event -> int64 -> 'TState,
         initial: 'TState,
         ?cancellationToken: CancellationToken)
        : Task<DurableSaga<'TState, 'Event>> =
        let ct = defaultArg cancellationToken CancellationToken.None
        task {
            let! entries = log.ReplayAsync(0L, ct)
            // Flatten to (event, weight, seq) tuples OUTSIDE any Span context
            // (a ReadOnlySpan can't cross the task state machine).
            let events =
                [ for e in entries do
                    for entry in e.Delta do      // ZSet : IEnumerable<ZEntry<'K>>
                        if entry.Weight <> 0L then
                            yield entry.Key, entry.Weight, e.Seq ]
            let mutable state = initial
            let mutable appliedSeq = 0L
            for (ev, w, seq) in events do
                state <- step state ev w
                appliedSeq <- seq
            return DurableSaga<'TState, 'Event>(log, step, state, appliedSeq)
        }


[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module DurableSaga =

    /// Start a fresh saga over the given event log + signed reducer + initial state.
    let start
        (log: IDeltaLog<'Event>)
        (step: 'TState -> 'Event -> int64 -> 'TState)
        (initial: 'TState)
        : DurableSaga<'TState, 'Event> =
        DurableSaga<'TState, 'Event>(log, step, initial, 0L)
