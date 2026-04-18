module Zeta.Tests.Infra.MetricsTests
#nowarn "0893"

open System.Diagnostics.Metrics
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// DbspMetrics — cover every record API + the Meter publication path
// (moved from CoverageBoostTests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``DbspMetrics record APIs don't throw`` () =
    DbspMetrics.RecordTick()
    DbspMetrics.RecordRowsIn("map", 42, 10L)
    DbspMetrics.RecordRowsOut("map", 42, 10L)
    DbspMetrics.RecordTickDuration(123.456)
    DbspMetrics.RecordAllocations(4096L)


[<Fact>]
let ``DbspMetrics registers with a MeterListener`` () =
    use listener = new MeterListener()
    listener.InstrumentPublished <-
        fun instrument ml ->
            if instrument.Meter.Name = "Zeta.Core.Circuit" then
                ml.EnableMeasurementEvents instrument
    listener.SetMeasurementEventCallback<int64>(
        MeasurementCallback<int64>(fun _inst _m _tags _state -> ()))
    listener.Start()
    DbspMetrics.RecordTick()
    // Ensure listener attach path runs without throwing.
    ()


// ═══════════════════════════════════════════════════════════════════
// Injection — swappable DI seams (moved from CoverageBoostTests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``RecordingMetricsSink accumulates counters`` () =
    let rec' = RecordingMetricsSink()
    let sink = rec' :> IMetricsSink
    sink.RecordTick()
    sink.RecordTick()
    sink.RecordRowsIn("map", 1, 10L)
    sink.RecordRowsIn("map", 1, 5L)
    sink.RecordRowsOut("map", 1, 15L)
    rec'.Ticks |> should equal 2L
    rec'.RowsIn.["map"] |> should equal 15L
    rec'.RowsOut.["map"] |> should equal 15L


[<Fact>]
let ``NullMetricsSink never throws`` () =
    let sink = NullMetricsSink() :> IMetricsSink
    sink.RecordTick()
    sink.RecordRowsIn("map", 1, 10L)
    sink.RecordRowsOut("map", 1, 10L)
    sink.RecordTickDuration 123.4
    sink.RecordAllocations 4096L
