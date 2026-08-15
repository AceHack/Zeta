namespace Zeta.Core

/// **SchedulerShedHeat — the shed→heat classifier for the scheduler/throttle layer.**
///
/// Aaron's framing: *the Zeta scheduler and Rodney's-Razor big-O future-branch pruning burn future
/// spacetime branches, that causes heat, and it should read similar to backpressure.* The deciding
/// test is already carved in `SchedulerZeta`'s weak-referenced fixed-point table:
///
/// > *"Because the fixed points are **derived**, drop-and-recompute is **lossless**."*
///
/// So a shed is classified by what survives it, not by how it feels:
///
///   • **Regenerable — something still retains a seed ⇒ PRESSURE** (`Backpressure` / `Denied`,
///     `HeatSignal.isPressure = true`). Deferral. `SoftThrottle.boat` hands its `remaining` back;
///     `SoftThrottle.wrapHandler` carries `Inner` through bit-for-bit; `Vision.predictBranches`
///     returns its pruned branches in `report.Deferred`. Nothing was destroyed, so nothing is owed.
///     This is why `SchedulerZeta` correctly emits no heat at all — its orbit states are derived
///     and weak-held **by design**.
///   • **Annihilated — nothing retains a seed ⇒ LOSS** (`Forgotten` / `Invalid`,
///     `HeatSignal.isPressure = false`). It pays. `CellScheduler.deliver` to a cell that does not
///     exist returns the state UNCHANGED — the post-state is identical for every possible payload,
///     so the message is unrecoverable from anything the society still holds.
///
/// This mirrors the `WSet` measurement of the same distinction: `negate` (the retraction) costs
/// 0 bits because it is reversible; `consolidate` costs bits because it annihilates — two states to
/// one. Free negation, paid annihilation (Landauer 1961: only the IRREVERSIBLE step has a cost).
///
/// **Vocabulary is CONSUMED, never extended.** Every kind here resolves through `HeatSignal.ofKind`
/// into the existing treaty'd cases (`src/Core/Heat.fs`, `src/Core.QSharp.ReferenceOracle/HeatSignals.qs`,
/// `heat-signals-treaty.json`). No `HeatSignal` case is added — see this module's tests, which assert
/// the classification lands inside the ratified vocabulary.
///
/// **`MassPpm` is a bounded FRACTION, never a raw byte count.** `HeatSignature.ofMass` scales by 1e6
/// into an `int64`, so a byte-denominated mass would overflow on a large budget; every mass below is a
/// dimensionless ratio in `[0,1]` (skip fraction, unboarded fraction), with the absolute counts in
/// `Units` and `Detail`. Same ppm scale the `TemperatureReadout` lane already uses.
[<RequireQualifiedAccess>]
module SchedulerShedHeat =

    // ── Sources (the `HeatSignature.Source` field) ──

    [<Literal>]
    let CellSchedulerSource = "cell-scheduler"

    [<Literal>]
    let CellOutboxSource = "cell-scheduler.outbox"

    [<Literal>]
    let SoftThrottleSource = "soft-throttle"

    [<Literal>]
    let BranchBudgetSource = "vision-branch-budget"

    // ── Kinds: the treaty'd tokens, consumed verbatim from `HeatSignal.token`. ──

    /// Annihilation with no decode failure — the payload is simply gone.
    [<Literal>]
    let ForgottenKind = "forgotten"

    /// Annihilation of something that failed to decode (a malformed outbox entry).
    [<Literal>]
    let InvalidKind = "invalid"

    /// Deferral — the payload is still held by someone.
    [<Literal>]
    let BackpressureKind = "backpressure"

    /// The classification predicate, stated once: a signature is LOSS exactly when its shed
    /// disposition is `Annihilated`. Loss and pressure are complementary by construction, so a
    /// misclassification cannot hide in a gap between them.
    ///
    /// This now reads the emitter's **declared** `Disposition` (via `HeatSignal.dispositionOfSignature`),
    /// falling back to the kind-string inference only for emitters that have not declared one. Every
    /// signature built in this module declares, so none of them depends on the substring match.
    let isLoss (heat: HeatSignature) : bool =
        heat |> HeatSignal.dispositionOfSignature = ShedDisposition.Annihilated

    let isPressure (heat: HeatSignature) : bool =
        heat |> HeatSignal.dispositionOfSignature = ShedDisposition.Deferred

    // ══════════════════════════════════════════════════════════════
    //  LOSS — the annihilating sheds
    // ══════════════════════════════════════════════════════════════

    /// **LOSS.** One message the cell scheduler's routing annihilated. `deliver` to an unknown cell
    /// returns the state unchanged, so no reachable state distinguishes this payload from any other —
    /// drop-and-recompute is NOT lossless here, and there is no queue that will redeliver it.
    let cellShedSignature (shed: CellScheduler.CellShed<'Msg>) : HeatSignature =
        match shed with
        | CellScheduler.CellShed.UndeliverableMessage(target, _) ->
            HeatSignature.ofMassWithDisposition
                ShedDisposition.Annihilated
                CellSchedulerSource
                ForgottenKind
                1
                1.0
                ("undeliverable message: no cell '" + target + "' exists to receive it")

    /// **LOSS.** One `__outbox__` entry the decoder annihilated. `routeOutbox` strips the whole
    /// `__outbox__` key from the returned state, so a malformed entry survives in neither the state
    /// nor the emission list.
    let outboxShedSignature (shed: CellScheduler.OutboxShed) : HeatSignature =
        match shed with
        | CellScheduler.OutboxShed.MalformedOutboxEntry _ ->
            HeatSignature.ofMassWithDisposition
                ShedDisposition.Annihilated
                CellOutboxSource
                InvalidKind
                1
                1.0
                "malformed __outbox__ entry (expected [String target; message]) — stripped with the outbox"
        | CellScheduler.OutboxShed.MalformedOutbox _ ->
            HeatSignature.ofMassWithDisposition
                ShedDisposition.Annihilated
                CellOutboxSource
                InvalidKind
                1
                1.0
                "__outbox__ present but not an Array — the whole outbox was stripped, nothing emitted"

    let cellShedSignatures (sheds: CellScheduler.CellShed<'Msg> list) : HeatSignature list =
        sheds |> List.map cellShedSignature

    let outboxShedSignatures (sheds: CellScheduler.OutboxShed list) : HeatSignature list =
        sheds |> List.map outboxShedSignature

    /// A whole run's routing loss rolled into ONE signature — `Units` = messages annihilated,
    /// `MassPpm` = 1.0 per message capped at unity (the run WAS lossy, at this many units).
    /// `None` when nothing was lost: empty heat stays cold, and a caller must not spend heat-channel
    /// capacity to say that nothing happened (`BoundedHeat.signature`'s convention).
    let cellRunSignature (sheds: CellScheduler.CellShed<'Msg> list) : HeatSignature option =
        match List.length sheds with
        | 0 -> None
        | n ->
            let targets =
                sheds
                |> List.map (fun (CellScheduler.CellShed.UndeliverableMessage(target, _)) -> target)
                |> List.distinct
                |> List.sortWith (fun a b -> System.String.CompareOrdinal(a, b))
            Some(
                HeatSignature.ofMassWithDisposition
                    ShedDisposition.Annihilated
                    CellSchedulerSource
                    ForgottenKind
                    n
                    1.0
                    ("undeliverable messages to unknown cells: " + System.String.Join(",", targets))
            )

    // ══════════════════════════════════════════════════════════════
    //  PRESSURE — the deferring sheds. Recoverable, so they never pay loss.
    // ══════════════════════════════════════════════════════════════

    /// **PRESSURE, not loss.** `SoftThrottle.wrapHandler`'s soft skip (harmonic gradient said not-now,
    /// or the flux tank was dry). `Inner` is carried through bit-for-bit and the wrapper never held the
    /// arrival as data — `SoftScheduler.Handler.Run` is `ISR<'S,'S>` and cannot see the crossing, while
    /// `SoftScheduler.Source` is `int -> InterruptKind list`, a pure function of the tick that the
    /// scheduler retains for the whole run. Derived ⇒ drop-and-recompute is lossless ⇒ pressure.
    ///
    /// `MassPpm` = the skip fraction `Skipped / (Served + Skipped)` in ppm; `Units` = skipped arrivals.
    /// `None` when nothing was skipped.
    let throttlePressure (state: SoftThrottle.Throttled<'S>) : HeatSignature option =
        if state.Skipped <= 0 then
            None
        else
            let total = max 1 (state.Served + state.Skipped)
            let fraction = float state.Skipped / float total
            Some(
                HeatSignature.ofMassWithDisposition
                    ShedDisposition.Deferred
                    SoftThrottleSource
                    BackpressureKind
                    state.Skipped
                    fraction
                    "soft-throttle skipped arrivals (gradient or dry tank) — inner state untouched, arrival regenerable from the injected Source"
            )

    /// **PRESSURE, not loss.** Rodney's-Razor future-branch pruning (`Vision.predictBranches`): the
    /// branches the flux tank would not fund are RETURNED in `report.Deferred`, in full, alongside the
    /// tank state that refused them. The caller holds every pruned branch and can widen the budget and
    /// re-board it, so pruning by a complexity bound reads exactly as Aaron framed it — *similar to
    /// backpressure* — and not as forgetting.
    ///
    /// `MassPpm` = the unboarded fraction `1 - Confidence` in ppm (bounded, so no byte-count overflow);
    /// `Units` = deferred branches. `None` when every branch boarded.
    let branchPressure (report: Vision.PredictionReport<'S>) : HeatSignature option =
        match report.Deferred with
        | [] -> None
        | deferred ->
            let unboarded = report.Confidence |> (-) 1.0 |> max 0.0 |> min 1.0
            Some(
                HeatSignature.ofMassWithDisposition
                    ShedDisposition.Deferred
                    BranchBudgetSource
                    BackpressureKind
                    (List.length deferred)
                    unboarded
                    "branches pruned by the byte budget — returned in report.Deferred, so a wider tank re-boards them"
            )

    // ══════════════════════════════════════════════════════════════
    //  Emission through the injected sink (the declared, metered channel, §13).
    // ══════════════════════════════════════════════════════════════

    /// Emit a run's routing loss through an injected `IHeatSink`. `Ok()` when there was nothing to
    /// emit — silence is the correct output for a lossless run.
    let emitCellRun
        (sink: IHeatSink)
        (sheds: CellScheduler.CellShed<'Msg> list)
        : Result<unit, HeatSinkFeedback> =
        match cellRunSignature sheds with
        | None -> Ok()
        | Some heat -> sink.Emit heat

    /// Emit a throttled state's accumulated pressure through an injected `IHeatSink`.
    let emitThrottlePressure
        (sink: IHeatSink)
        (state: SoftThrottle.Throttled<'S>)
        : Result<unit, HeatSinkFeedback> =
        match throttlePressure state with
        | None -> Ok()
        | Some heat -> sink.Emit heat

    /// Emit a prediction report's branch-pruning pressure through an injected `IHeatSink`.
    let emitBranchPressure
        (sink: IHeatSink)
        (report: Vision.PredictionReport<'S>)
        : Result<unit, HeatSinkFeedback> =
        match branchPressure report with
        | None -> Ok()
        | Some heat -> sink.Emit heat
