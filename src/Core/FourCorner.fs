namespace Zeta.Core

/// FourCorner — the bidirectional-feedback I/O object, **graduated `tools → src`** (Aaron 2026-06-10:
/// "yes let's put 4 corners in src"). The F# port of `FourCornerOwnership<TIn, TOut, TOutFeedback,
/// TInFeedback>` from `tools/workflow-engine/types.ts` (used by `tools/observe/observe.ts` — the
/// observe/emit primitive, "we've had this since the beginning"). Per the tools→src rule (`tools/` is the
/// dependency *shield*, not where our-own primitives live), this is our-own and belongs in `src/`.
///
/// **The four corners** = a 2×2 of (data × feedback) × (in × out), with implicit directionality (each axis
/// directed) ⇒ a compass **N S E W = {1, i, −1, −i} = C₄ = `i`-rotation** (the harmonic four-corner phase;
/// why Cayley-Dickson is everywhere). `TInFeedback` is **co-owned — both sides contribute** — which is
/// "each is backpressure from the other's perspective" (frame-relative, no absolute backpressure). The
/// fusion target (B-1022): the `ISR` arrow's feedback channel becomes this object. Pure record, no classes.
[<RequireQualifiedAccess>]
module FourCorner =

    /// The four-corner ownership object: data flows forward (`TIn` → `TOut`), feedback flows back
    /// (`TOutFeedback` / `TInFeedback`). `TIn` is required; the other three corners are optional (a tick
    /// may not have emitted output / authored feedback / received an ack yet) — mirrors the TS `?` fields.
    type FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback> =
        { /// what comes in (e.g. an OperatorMessage)
          TIn: 'TIn
          /// what the agent emits back (e.g. an OperatorResponse)
          TOut: 'TOut option
          /// control-flow the agent authors on the channel (e.g. ConvFeedback)
          TOutFeedback: 'TOutFeedback option
          /// the co-owned channel — BOTH sides contribute (e.g. a keepalive/ack); each side's contribution
          /// is the other side's backpressure
          TInFeedback: 'TInFeedback option }

    /// Just the input — no output, no feedback yet (the resting corner: only `TIn` set).
    let ofIn (tIn: 'TIn) : FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback> =
        { TIn = tIn; TOut = None; TOutFeedback = None; TInFeedback = None }

    /// Set the emitted output (`TOut`).
    let withOut (tOut: 'TOut) (o: FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback>) =
        { o with TOut = Some tOut }

    /// Set the agent-authored feedback (`TOutFeedback`).
    let withOutFeedback (fb: 'TOutFeedback) (o: FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback>) =
        { o with TOutFeedback = Some fb }

    /// Set the co-owned feedback (`TInFeedback`) — the other side's contribution = your backpressure.
    let withInFeedback (fb: 'TInFeedback) (o: FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback>) =
        { o with TInFeedback = Some fb }

    /// Has the tick produced output yet? (the forward corner is filled)
    let hasOutput (o: FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback>) : bool = o.TOut.IsSome

    /// Has feedback crossed in either direction? (the backpressure corners)
    let hasFeedback (o: FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback>) : bool =
        o.TOutFeedback.IsSome || o.TInFeedback.IsSome
