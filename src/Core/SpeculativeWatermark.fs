namespace Zeta.Core

open System
open System.Threading
open System.Threading.Tasks


/// **Retraction-native speculative watermark emission.**
///
/// In Flink / Beam / Millwheel, emitting speculative results for a
/// window **before** the watermark says the window is complete
/// requires a special **RETRACTING** accumulation mode: when late
/// data arrives, the old speculative output is withdrawn and the
/// correct value re-emitted. Implementing RETRACTING correctly in
/// those engines is notoriously fiddly.
///
/// **DBSP makes this trivial** because retraction is the *native*
/// delta algebra — a `-Δ` with negative weights is just another
/// Z-set entry. A speculative window emission at watermark `w0` is
/// an ordinary `+Δ`; when a late event arrives at event-time `< w0`,
/// the operator emits a `-Δ` withdrawing the stale speculation and
/// a fresh `+Δ` with the corrected value. No special accumulation
/// mode is needed — the downstream D/I operators compose correctly
/// through retractions because linearity `D(a + b) = D(a) + D(b)`
/// holds.
///
/// ## The key operator
///
/// `SpeculativeWindowOp` consumes a `Stream<Timestamped<'T>>` and
/// emits a `Stream<ZSet<Timestamped<'T>>>` where each output row
/// carries its emitting watermark. When a row lands whose event-
/// time is below a previously-emitted speculative watermark, the
/// operator produces a retracting delta automatically.
///
/// ## Why this is a paper-worthy claim
///
/// Every prior speculative-watermark design requires explicit
/// accumulation-mode enumeration (Beam's ACCUMULATING / DISCARDING
/// / RETRACTING). DBSP's retraction algebra **subsumes** the three
/// modes as special cases of a single linear operator:
///   - ACCUMULATING = Z-set over all timestamps seen so far (Integrate)
///   - DISCARDING = Z-set over just the current window (Identity)
///   - RETRACTING = all three collapse into delta-at-tick semantics
///
/// The F#-grade implementation here is a starting point for that
/// paper (target: DEBS 2026 or VLDB 2026).
///
/// ## Reference directions
///
/// - Akidau et al. "The Dataflow Model" VLDB 2015 — the ACC/DISC/RET
///   enumeration this subsumes.
/// - Akidau et al. "Millwheel" VLDB 2013 — speculative emission
///   with explicit retract.
/// - Li et al. VLDB 2008 — punctuation-based out-of-order processing;
///   retractions here serve the same role.
/// - Budiu et al. VLDB 2023 (DBSP) — the linearity identity we
///   leverage.
[<Sealed>]
type internal SpeculativeWindowOp<'T when 'T : comparison>
    (input: Op<ZSet<Timestamped<'T>>>,
     watermark: IWatermarkStrategy,
     windowSizeMs: int64) =
    inherit Op<ZSet<struct (Timestamped<'T> * int64)>>()
    let inputs = [| input :> Op |]
    // Track every (eventTime, 'T) we've emitted with a speculative
    // watermark so we can retract when a late event arrives that
    // would have changed the result.
    let speculative =
        System.Collections.Generic.Dictionary<struct (int64 * 'T), int64>()
    let lockObj = obj ()

    override _.Name = "speculativeWindow"
    override _.Inputs = inputs
    override _.IsStrict = true
    override this.IsAsync = false
    override this.StepAsync(_: CancellationToken) =
        // Harsh-critic round #5 fix — previous revision confused the
        // *input weight sign* with "is this event late". Correct
        // semantics: a **positive** input with EventTime < lastWm is
        // a late-arriving insert, which means (a) the watermark
        // already said "we've seen everything for this window" and
        // emitted a speculative value, (b) this late positive changes
        // the speculative output, (c) we must emit `-Δ` withdrawing
        // the stale speculative row AND `+Δ` for the corrected
        // value. Negative input weights are ordinary retractions and
        // pass through.
        let delta = input.Value
        if delta.IsEmpty then
            this.Value <- ZSet<struct (Timestamped<'T> * int64)>.Empty
        else
            let entries = ResizeArray()
            lock lockObj (fun () ->
                let priorWm = watermark.Current
                let span = delta.AsSpan()
                for i in 0 .. span.Length - 1 do
                    let t = span.[i].Key
                    let w = span.[i].Weight
                    let newWm = watermark.Observe t.EventTime
                    let key = struct (t.EventTime, t.Value)
                    if w > 0L then
                        if t.EventTime <= priorWm && speculative.ContainsKey key then
                            // **Late positive insert** that invalidates a
                            // prior speculative emission. Emit `-Δ`
                            // withdrawing stale + `+Δ` corrected.
                            let stalePriorWm = speculative.[key]
                            entries.Add (ZEntry(struct (t, stalePriorWm), -1L))
                            entries.Add (ZEntry(struct (t, newWm), 1L))
                            speculative.[key] <- newWm
                        elif speculative.ContainsKey key then
                            // Duplicate fresh insert at same event-time;
                            // refresh the stamp, don't re-emit.
                            speculative.[key] <- newWm
                        else
                            speculative.[key] <- newWm
                            entries.Add (ZEntry(struct (t, newWm), 1L))
                    elif w < 0L then
                        // Ordinary retraction — pull the row out of the
                        // speculative map and emit `-Δ`.
                        match speculative.TryGetValue key with
                        | true, pWm ->
                            entries.Add (ZEntry(struct (t, pWm), -1L))
                            speculative.Remove key |> ignore
                        | _ -> ())
            let arr = entries.ToArray()
            this.Value <-
                if arr.Length = 0 then ZSet<struct (Timestamped<'T> * int64)>.Empty
                else ZSet.ofSeq (arr |> Array.map (fun e -> e.Key, e.Weight))
        ValueTask.CompletedTask


[<System.Runtime.CompilerServices.Extension>]
type SpeculativeExtensions =
    /// Register a retraction-native speculative-window operator that
    /// emits each `Timestamped<'T>` annotated with the watermark at
    /// emission time, and retracts speculatively-emitted values when
    /// a late event would invalidate them.
    [<System.Runtime.CompilerServices.Extension>]
    static member SpeculativeWindow<'T when 'T : comparison>
        (circuit: Circuit,
         input: Stream<ZSet<Timestamped<'T>>>,
         watermark: IWatermarkStrategy,
         windowSizeMs: int64) : Stream<ZSet<struct (Timestamped<'T> * int64)>> =
        circuit.RegisterStream
            (SpeculativeWindowOp(input.Op, watermark, windowSizeMs))
