module Zeta.Tests.SchedulerShedHeatTests

// ═══════════════════════════════════════════════════════════════════════════
//  Every check in this file is built to FAIL when the metering is wrong.
//  The three shapes, in decreasing strength:
//
//   1. CONSERVATION (mechanical, cannot be vacuous) — an identity over a run:
//      every message offered to the router is inboxed, consumed, or REPORTED.
//      A new unmetered drop anywhere in the routing breaks the identity by
//      exactly the number it swallowed. This is the guard that catches paths
//      that do not exist yet.
//   2. CLASSIFICATION — annihilation must land on a NON-pressure signal and
//      deferral on a pressure one. Swapping them goes red.
//   3. ANNOTATION INVENTORY — the `SHED:` markers in the source must match the
//      inventory below exactly. Coverage boundary, stated honestly: this
//      catches an ANNOTATED site that was never classified, and an annotation
//      that was removed or edited. It does NOT catch an unannotated new drop —
//      that is (1)'s job, and (1) covers the routing and boat paths mechanically.
//
//  Anti-vacuity: the conservation tests assert the shed count is > 0 across the
//  generated corpus, so a run that never sheds cannot pass them by doing nothing.
// ═══════════════════════════════════════════════════════════════════════════

open System
open System.IO
open global.Xunit
open Zeta.Core

// ── A deterministic society generator (DST: seed in, same society out) ──

type private TMsg = { Tag: uint64; Hops: int }

let private cellIds = [| for i in 0 .. 7 -> sprintf "c%d" i |]

/// Targets that are deliberately NOT cells — routing to one of these is the
/// annihilating shed under measurement.
let private ghostIds = [| "ghost-a"; "ghost-b"; "ghost-c" |]

let private pick (arr: string[]) (h: uint64) = arr.[int ((h >>> 8) % uint64 arr.Length)]

/// Emission targets are a pure function of the message — never of a mutable RNG —
/// so the same society replays identically at any degree of parallelism.
let private targetsFor (m: TMsg) : CellId list =
    let h = SplitMix64.mix (m.Tag + uint64 m.Hops * SplitMix64.GoldenRatio)
    let fanout = int (h % 3UL) // 0..2
    [ for i in 0 .. fanout - 1 do
        let hi = SplitMix64.mix (h + uint64 (i + 1) * SplitMix64.GoldenRatio)
        // ~1 in 4 emissions names a cell that does not exist
        if hi % 4UL = 0UL then yield pick ghostIds hi else yield pick cellIds hi ]

/// The step, instrumented: counts its own invocations (= messages CONSUMED) and
/// the messages it OFFERS to the router. `Interlocked` so the DoP=N ferry path
/// can use the identical step.
let private countingStep (consumed: int ref) (offered: int ref) =
    fun (acc: int) (m: TMsg) ->
        System.Threading.Interlocked.Increment consumed |> ignore
        let emitted =
            if m.Hops <= 0 then
                []
            else
                [ for t in targetsFor m -> t, { Tag = SplitMix64.mix (m.Tag + 1UL); Hops = m.Hops - 1 } ]
        System.Threading.Interlocked.Add(offered, List.length emitted) |> ignore
        acc + 1, emitted

let private societyFor (seed: uint64) =
    let cells = [ for id in cellIds -> id, 0 ]
    let seedMsgs =
        [ for i in 0 .. 3 do
            let h = SplitMix64.mix (seed + uint64 (i + 1) * SplitMix64.GoldenRatio)
            // seed messages may themselves name a ghost — init must report those too
            let target = if h % 5UL = 0UL then pick ghostIds h else pick cellIds h
            yield target, { Tag = h; Hops = 4 } ]
    cells, seedMsgs

// ═══════════════════════════════════════════════════════════════════════════
//  1. CONSERVATION — the guard that catches a drop path that does not exist yet
// ═══════════════════════════════════════════════════════════════════════════

[<Fact>]
let ``routing conservation: every offered message is consumed or reported as shed — DoP=1`` () =
    let mutable totalShed = 0
    for seed in 1UL .. 200UL do
        let cells, seedMsgs = societyFor seed
        let consumed = ref 0
        let offeredByStep = ref 0
        let state, initShed = CellScheduler.initWithShed cells seedMsgs
        match CellScheduler.runToQuiescenceWithShed 1_000_000 (countingStep consumed offeredByStep) state with
        | Error e -> failwithf "seed %d did not quiesce: %s" seed e
        | Ok(final, runShed) ->
            // at quiescence every inbox is empty, so nothing is still in flight
            Assert.Equal(cellIds.Length, Map.count final)
            let offered = List.length seedMsgs + offeredByStep.Value
            let shed = List.length initShed + List.length runShed
            // THE IDENTITY. A new unmetered drop breaks it by exactly what it swallowed.
            Assert.Equal(offered, consumed.Value + shed)
            totalShed <- totalShed + shed
    // anti-vacuity: the corpus must actually exercise the shed path
    Assert.True(totalShed > 0, "the generated corpus never shed — the conservation identity was vacuous")

[<Fact>]
let ``routing conservation holds at DoP=N, and the shed is identical to DoP=1 (the scale-free heat law)`` () =
    let mutable totalShed = 0
    for seed in 1UL .. 40UL do
        let cells, seedMsgs = societyFor seed
        let state, initShed = CellScheduler.initWithShed cells seedMsgs

        let runAt dop =
            let consumed = ref 0
            let offeredByStep = ref 0
            let task =
                CellScheduler.runFerryToQuiescenceWithShed
                    (FerryThrottlerConfig.withFerries dop)
                    (countingStep consumed offeredByStep)
                    1_000_000
                    state
            match task.GetAwaiter().GetResult() with
            | Error e -> failwithf "seed %d dop %d did not quiesce: %s" seed dop e
            | Ok(final, shed) -> final, shed, consumed.Value, offeredByStep.Value

        let final1, shed1, consumed1, offered1 = runAt 1
        let final4, shed4, consumed4, offered4 = runAt 4
        let final16, shed16, consumed16, offered16 = runAt 16

        // the existing scale-free law
        Assert.Equal<Map<CellId, int>>(final1, final4)
        Assert.Equal<Map<CellId, int>>(final1, final16)
        // ...now extended to the HEAT channel: same run ⇒ same shed, same order
        Assert.Equal<CellScheduler.CellShed<TMsg> list>(shed1, shed4)
        Assert.Equal<CellScheduler.CellShed<TMsg> list>(shed1, shed16)
        // and conservation at every DoP
        for consumed, offeredByStep, shed in
            [ consumed1, offered1, shed1; consumed4, offered4, shed4; consumed16, offered16, shed16 ] do
            Assert.Equal(List.length seedMsgs + offeredByStep, consumed + List.length initShed + List.length shed)
        totalShed <- totalShed + List.length shed1
    Assert.True(totalShed > 0, "the generated corpus never shed — the conservation identity was vacuous")

[<Fact>]
let ``outbox conservation: every __outbox__ entry is routed or reported`` () =
    let mutable totalShed = 0
    for seed in 1UL .. 300UL do
        let h0 = SplitMix64.mix seed
        let n = int (h0 % 6UL)
        let items =
            [ for i in 0 .. n - 1 do
                let h = SplitMix64.mix (h0 + uint64 (i + 1) * SplitMix64.GoldenRatio)
                match h % 4UL with
                | 0UL -> yield DynamicValue.Array [ DynamicValue.String "c0"; DynamicValue.Int(int64 i) ] // well-formed
                | 1UL -> yield DynamicValue.Array [ DynamicValue.Int 1L; DynamicValue.Int(int64 i) ] // target not a String
                | 2UL -> yield DynamicValue.String "not-a-pair"
                | _ -> yield DynamicValue.Array [ DynamicValue.String "c1"; DynamicValue.Int(int64 i) ] ] // well-formed
        let next =
            DynamicValue.Object [ "keep", DynamicValue.Int 7L; CellScheduler.OutboxKey, DynamicValue.Array items ]
        let stripped, emitted, shed = CellScheduler.routeOutboxWithShed next
        // THE IDENTITY: entries are partitioned, never dropped on the floor
        Assert.Equal(List.length items, List.length emitted + List.length shed)
        // the outbox key really is stripped (which is WHY a dropped entry is annihilation)
        match stripped with
        | DynamicValue.Object kvs -> Assert.DoesNotContain(CellScheduler.OutboxKey, kvs |> List.map fst)
        | other -> failwithf "expected an Object, got %A" other
        // the un-shed variant stays byte-identical
        Assert.Equal<DynamicValue * (CellId * DynamicValue) list>(
            CellScheduler.routeOutbox next,
            (stripped, emitted))
        totalShed <- totalShed + List.length shed
    Assert.True(totalShed > 0, "the generated corpus never shed a malformed entry — the identity was vacuous")

[<Fact>]
let ``a non-Array __outbox__ annihilates the whole outbox — and says so`` () =
    let next =
        DynamicValue.Object [ CellScheduler.OutboxKey, DynamicValue.String "oops"; "keep", DynamicValue.Int 1L ]
    let _, emitted, shed = CellScheduler.routeOutboxWithShed next
    Assert.Empty emitted
    Assert.Equal(1, List.length shed)
    Assert.Equal(CellScheduler.OutboxShed.MalformedOutbox(DynamicValue.String "oops"), List.head shed)

// ═══════════════════════════════════════════════════════════════════════════
//  2. CLASSIFICATION — annihilation pays, deferral does not
// ═══════════════════════════════════════════════════════════════════════════

[<Fact>]
let ``an undeliverable message is LOSS: Forgotten, and NOT a pressure signal`` () =
    let shed = CellScheduler.CellShed.UndeliverableMessage("ghost-a", 42)
    let heat = SchedulerShedHeat.cellShedSignature shed
    Assert.Equal(HeatSignal.Forgotten, HeatSignal.ofSignature heat)
    Assert.False(HeatSignal.isPressure(HeatSignal.ofSignature heat))
    Assert.True(SchedulerShedHeat.isLoss heat)
    Assert.False(SchedulerShedHeat.isPressure heat)
    Assert.Equal(1, heat.Units)

[<Fact>]
let ``a malformed outbox entry is LOSS: Invalid, and NOT a pressure signal`` () =
    for shed in
        [ CellScheduler.OutboxShed.MalformedOutboxEntry(DynamicValue.String "junk")
          CellScheduler.OutboxShed.MalformedOutbox(DynamicValue.Int 3L) ] do
        let heat = SchedulerShedHeat.outboxShedSignature shed
        Assert.Equal(HeatSignal.Invalid, HeatSignal.ofSignature heat)
        Assert.True(SchedulerShedHeat.isLoss heat)

[<Fact>]
let ``a soft-throttle skip is PRESSURE: Backpressure, never loss`` () =
    let st: SoftThrottle.Throttled<int> =
        { Inner = 0; Tank = SoftThrottle.tank 1.0 1.0; Tick = 10; Served = 7; Skipped = 3 }
    match SchedulerShedHeat.throttlePressure st with
    | None -> failwith "3 skips must read as pressure"
    | Some heat ->
        Assert.Equal(HeatSignal.Backpressure, HeatSignal.ofSignature heat)
        Assert.True(HeatSignal.isPressure(HeatSignal.ofSignature heat))
        Assert.True(SchedulerShedHeat.isPressure heat)
        Assert.False(SchedulerShedHeat.isLoss heat)
        Assert.Equal(3, heat.Units)
        Assert.Equal(300_000L, heat.MassPpm) // 3/10 as a bounded fraction, in ppm

[<Fact>]
let ``an unskipped throttle stays COLD — empty heat spends no channel capacity`` () =
    let st: SoftThrottle.Throttled<int> =
        { Inner = 0; Tank = SoftThrottle.tank 1.0 1.0; Tick = 10; Served = 10; Skipped = 0 }
    Assert.True((SchedulerShedHeat.throttlePressure st).IsNone)
    Assert.Equal(Ok(), SchedulerShedHeat.emitThrottlePressure (NullHeatSink()) st)

[<Fact>]
let ``Rodney's-Razor branch pruning is PRESSURE: the pruned branches come back in report.Deferred`` () =
    let cost bytes : Vision.BranchCost =
        { SpaceBytes = bytes; TimeTicks = 0; BytesPerTick = 0L; UncertaintyResolutionBits = 0 }
    let branches: Vision.FutureBranch<int> list =
        [ { Label = "a"; State = 1; Cost = cost 40L }
          { Label = "b"; State = 2; Cost = cost 40L }
          { Label = "c"; State = 3; Cost = cost 40L } ]
    // a tank that funds two of the three branches
    match Vision.predictBranches branches (SoftThrottle.tank 100.0 0.0) with
    | Error e -> failwithf "budgeting failed: %A" e
    | Ok report ->
        Assert.Equal(Vision.PartiallyAdmitted, report.Outcome)
        // THE DECIDING FACT: the pruned branch is HANDED BACK, so it is recoverable
        Assert.Equal(1, List.length report.Deferred)
        Assert.Equal<Vision.FutureBranch<int> list>(branches, report.Boarded @ report.Deferred)
        match SchedulerShedHeat.branchPressure report with
        | None -> failwith "a deferred branch must read as pressure"
        | Some heat ->
            Assert.Equal(HeatSignal.Backpressure, HeatSignal.ofSignature heat)
            Assert.True(SchedulerShedHeat.isPressure heat)
            Assert.False(SchedulerShedHeat.isLoss heat)
            Assert.Equal(1, heat.Units)

[<Fact>]
let ``every branch boarded stays COLD — a fully-funded prediction emits nothing`` () =
    let cost bytes : Vision.BranchCost =
        { SpaceBytes = bytes; TimeTicks = 0; BytesPerTick = 0L; UncertaintyResolutionBits = 0 }
    let branches: Vision.FutureBranch<int> list = [ { Label = "a"; State = 1; Cost = cost 10L } ]
    match Vision.predictBranches branches (SoftThrottle.tank 1000.0 0.0) with
    | Error e -> failwithf "budgeting failed: %A" e
    | Ok report ->
        Assert.Empty report.Deferred
        Assert.True((SchedulerShedHeat.branchPressure report).IsNone)

[<Fact>]
let ``no signature this module emits falls OUTSIDE the ratified HeatSignal vocabulary`` () =
    // `HeatSignal.Other` is the escape hatch; nothing here may need it. This is the
    // "we did not add a treaty case" claim, made executable.
    let signatures =
        [ SchedulerShedHeat.cellShedSignature (CellScheduler.CellShed.UndeliverableMessage("g", 0))
          SchedulerShedHeat.outboxShedSignature (CellScheduler.OutboxShed.MalformedOutboxEntry DynamicValue.Null)
          SchedulerShedHeat.outboxShedSignature (CellScheduler.OutboxShed.MalformedOutbox DynamicValue.Null)
          (SchedulerShedHeat.throttlePressure
              { Inner = 0; Tank = SoftThrottle.tank 1.0 1.0; Tick = 2; Served = 1; Skipped = 1 })
              .Value ]
    for heat in signatures do
        match HeatSignal.ofSignature heat with
        | HeatSignal.Other kind -> failwithf "kind '%s' escaped the ratified vocabulary" kind
        | _ -> ()

[<Fact>]
let ``a lossy run emits through the injected sink; a clean run emits nothing`` () =
    let sink = RecordingHeatSink()
    Assert.Equal(Ok(), SchedulerShedHeat.emitCellRun sink ([]: CellScheduler.CellShed<int> list))
    Assert.Empty sink.Signatures
    let sheds =
        [ CellScheduler.CellShed.UndeliverableMessage("ghost-b", 1)
          CellScheduler.CellShed.UndeliverableMessage("ghost-a", 2) ]
    Assert.Equal(Ok(), SchedulerShedHeat.emitCellRun sink sheds)
    Assert.Equal(1, sink.Signatures.Count)
    Assert.Equal(2, sink.Signatures.[0].Units)
    Assert.True(SchedulerShedHeat.isLoss sink.Signatures.[0])
    // targets are ordinal-sorted, so the detail is replay-stable across machines
    Assert.Contains("ghost-a,ghost-b", sink.Signatures.[0].Detail)

// ═══════════════════════════════════════════════════════════════════════════
//  3. SoftThrottle — the NEGATIVE result, locked. It defers; it never annihilates.
// ═══════════════════════════════════════════════════════════════════════════

[<Fact>]
let ``SoftThrottle.boat partitions its input EXACTLY: boarded then remaining rebuilds items`` () =
    let mutable sawPartial = false
    for seed in 1UL .. 300UL do
        let h0 = SplitMix64.mix seed
        let n = int (h0 % 12UL)
        let items = [ for i in 0 .. n - 1 -> int (SplitMix64.mix (h0 + uint64 i) % 50UL) ]
        let capacity = float (h0 % 200UL)
        let tank = SoftThrottle.tank capacity 0.0
        let boarded, remaining, _ = SoftThrottle.boatBytes id items tank
        // THE IDENTITY: nothing is created, nothing is destroyed, order preserved
        Assert.Equal<int list>(items, boarded @ remaining)
        if not (List.isEmpty remaining) && not (List.isEmpty boarded) then sawPartial <- true
    Assert.True(sawPartial, "the corpus never produced a partial boat — the conservation law was vacuous")

[<Fact>]
let ``a soft-throttle skip preserves Inner bit-for-bit and keeps Served + Skipped = Tick`` () =
    let ctx: IntrCtx =
        { Memetic = "t"; Prompt = ""; Trust = ""; Log = ""; Otel = Diagnostics.ActivityContext() }
    // an inner handler that MUTATES the inner state, so a skip that ran it would show
    let inner =
        SoftScheduler.handler "counter" (fun _ -> true) (fun _ (n: int) -> Threading.Tasks.Task.FromResult(Ok(n + 1)))
    // pressure = 5 ⇒ the gradient refuses nearly everything; tank capacity 0 ⇒ dry
    let wrapped = SoftThrottle.wrapHandler 8.0 1234L 1.0 (fun _ -> 5.0) inner
    let st0 = SoftThrottle.throttled 0 (SoftThrottle.tank 0.0 0.0)
    let mutable st = st0
    for _ in 1 .. 50 do
        match (wrapped.Run ctx st).GetAwaiter().GetResult() with
        | Ok st' -> st <- st'
        | Error e -> failwithf "the soft skip must never fail hard: %A" e
    // the arrivals were all skipped, and the inner state is UNTOUCHED — no annihilation
    Assert.Equal(50, st.Tick)
    Assert.Equal(st.Tick, st.Served + st.Skipped)
    Assert.True(st.Skipped > 0, "the run never skipped — the preservation law was vacuous")
    Assert.Equal(st0.Inner, st.Inner)
    // and what it DID accumulate reads as pressure, never as loss
    match SchedulerShedHeat.throttlePressure st with
    | None -> failwith "skips must surface as pressure"
    | Some heat -> Assert.True(SchedulerShedHeat.isPressure heat)

[<Fact>]
let ``no reachable Throttled state can produce a loss signature`` () =
    // exhaustive over a grid of (Served, Skipped) — the pressure classification must
    // hold for every one, so "SoftThrottle only ever defers" is not a spot check
    for served in 0 .. 20 do
        for skipped in 0 .. 20 do
            let st: SoftThrottle.Throttled<int> =
                { Inner = 0
                  Tank = SoftThrottle.tank 1.0 1.0
                  Tick = served + skipped
                  Served = served
                  Skipped = skipped }
            match SchedulerShedHeat.throttlePressure st with
            | None -> Assert.Equal(0, skipped) // only a zero-skip state may stay cold
            | Some heat ->
                Assert.False(SchedulerShedHeat.isLoss heat, "SoftThrottle must never emit a loss signal")
                Assert.True(heat.MassPpm <= 1_000_000L) // the bounded-fraction invariant

// ═══════════════════════════════════════════════════════════════════════════
//  4. ANNOTATION INVENTORY — the drift guard
// ═══════════════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir = DirectoryInfo(AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

/// The covered surfaces. A shedding decision in one of these files must carry a
/// `SHED:` marker AND appear in the inventory below.
let private coveredFiles =
    [ Path.Combine("src", "Core", "CellScheduler.fs")
      Path.Combine("src", "Core", "SoftThrottle.fs") ]

/// (id, class, metered) — the classification of every shedding decision on the
/// covered surfaces. `class=loss` means the payload is annihilated and pays;
/// `class=pressure` means it is deferred and does not; `class=derived` means it
/// is recomputable in place (the `SchedulerZeta` case) and does not.
let private inventory =
    [ "cell-deliver-unknown-target", "loss", "yes"
      "cell-step-spurious-ready", "derived", "no"
      "outbox-malformed-entry", "loss", "yes"
      "outbox-malformed-container", "loss", "yes"
      "soft-step-refuse-collapse", "pressure", "no"
      "soft-step-evolve-error", "loss", "no"
      "soft-throttle-boat-close", "pressure", "no"
      "soft-throttle-step-sip", "pressure", "no"
      "soft-throttle-skip-dry-tank", "pressure", "yes"
      "soft-throttle-skip-gradient", "pressure", "yes" ]
    |> Set.ofList

let private parseMarkers () =
    let root = repoRoot ()
    [ for relative in coveredFiles do
        let path = Path.Combine(root, relative)
        Assert.True(File.Exists path, sprintf "covered surface is missing: %s" relative)
        for line in File.ReadAllLines path do
            let idx = line.IndexOf("SHED:", StringComparison.Ordinal)
            if idx >= 0 then
                let fields =
                    line.Substring(idx + 5).Split([| ' '; '\t' |], StringSplitOptions.RemoveEmptyEntries)
                Assert.True(
                    fields.Length >= 3,
                    sprintf "malformed SHED marker in %s: %s" relative (line.Trim()))
                let value (prefix: string) =
                    fields
                    |> Array.tryPick (fun f ->
                        if f.StartsWith(prefix, StringComparison.Ordinal) then
                            Some(f.Substring prefix.Length)
                        else
                            None)
                    |> Option.defaultWith (fun () ->
                        failwithf "SHED marker in %s is missing '%s': %s" relative prefix (line.Trim()))
                yield fields.[0], value "class=", value "metered=" ]
    |> Set.ofList

[<Fact>]
let ``the SHED annotations in the source match the classification inventory exactly`` () =
    let found = parseMarkers ()
    let unclassified = Set.difference found inventory
    let missing = Set.difference inventory found
    Assert.True(
        Set.isEmpty unclassified,
        sprintf
            "UNCLASSIFIED shedding path(s) — a new SHED marker appeared with no entry in the inventory. Decide loss vs pressure and add it: %A"
            (Set.toList unclassified))
    Assert.True(
        Set.isEmpty missing,
        sprintf
            "a classified shedding path lost its SHED annotation (removed, renamed, or reclassified in source): %A"
            (Set.toList missing))

[<Fact>]
let ``every 'metered=yes' site has a live classifier, and its class matches the inventory`` () =
    // Ties the annotation to executable behaviour: the inventory's `class` must be
    // what the classifier actually returns, so relabelling a loss as pressure in the
    // comment (or in the classifier) goes red.
    let classOf (heat: HeatSignature) = if SchedulerShedHeat.isLoss heat then "loss" else "pressure"
    let live =
        [ "cell-deliver-unknown-target",
          classOf (SchedulerShedHeat.cellShedSignature (CellScheduler.CellShed.UndeliverableMessage("g", 0)))
          "outbox-malformed-entry",
          classOf (SchedulerShedHeat.outboxShedSignature (CellScheduler.OutboxShed.MalformedOutboxEntry DynamicValue.Null))
          "outbox-malformed-container",
          classOf (SchedulerShedHeat.outboxShedSignature (CellScheduler.OutboxShed.MalformedOutbox DynamicValue.Null))
          "soft-throttle-skip-dry-tank",
          classOf
              (SchedulerShedHeat.throttlePressure
                  { Inner = 0; Tank = SoftThrottle.tank 1.0 1.0; Tick = 1; Served = 0; Skipped = 1 })
                  .Value
          "soft-throttle-skip-gradient",
          classOf
              (SchedulerShedHeat.throttlePressure
                  { Inner = 0; Tank = SoftThrottle.tank 1.0 1.0; Tick = 1; Served = 0; Skipped = 1 })
                  .Value ]
    let metered =
        inventory |> Set.filter (fun (_, _, metered) -> metered = "yes") |> Set.map (fun (id, cls, _) -> id, cls)
    Assert.Equal<Set<string * string>>(metered, Set.ofList live)

// ── The behaviour-preservation guard: the shed channel is ADDITIVE ──

[<Fact>]
let ``adding the shed channel changed no result: step, init and runToQuiescence are byte-identical`` () =
    for seed in 1UL .. 60UL do
        let cells, seedMsgs = societyFor seed
        let consumed = ref 0
        let offered = ref 0
        let stepFn = countingStep consumed offered
        Assert.Equal<CellScheduler.State<int, TMsg>>(
            CellScheduler.init cells seedMsgs,
            fst (CellScheduler.initWithShed cells seedMsgs))
        let s0 = CellScheduler.init cells seedMsgs
        Assert.Equal<CellScheduler.State<int, TMsg> option>(
            CellScheduler.step stepFn s0,
            CellScheduler.stepWithShed stepFn s0 |> Option.map fst)
        let plain = CellScheduler.runToQuiescence 1_000_000 stepFn s0
        let withShed = CellScheduler.runToQuiescenceWithShed 1_000_000 stepFn s0 |> Result.map fst
        Assert.Equal<Result<Map<CellId, int>, string>>(plain, withShed)
