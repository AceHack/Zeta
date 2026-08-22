module Zeta.Tests.Infra.TelemetryExporterTests
#nowarn "0893"

open System
open System.Collections.Generic
open System.Diagnostics
open FsUnit.Xunit
open global.Xunit
open OpenTelemetry.Metrics
open OpenTelemetry.Trace
open Zeta.Core
open Zeta.Core.Telemetry


// ═══════════════════════════════════════════════════════════════════
// THE FALSIFIER FOR THE OTel EXPORTER.
//
// Infra/Tracing.Tests.fs documents the FALSE side of this property in
// its own comment: "With no ActivityListener attached, Activity is
// null." That was the whole story until now -- five instruments and an
// activity source that reached nobody.
//
// Wiring an exporter is not evidence that anything flows through it, so
// none of the tests below assert that the code compiles or that a
// provider was constructed. They attach an IN-MEMORY exporter -- the
// same seam an OTLP exporter plugs into -- and assert the counters and
// spans ARRIVE, with the values and tags they were given.
//
// Mutate `ZetaTelemetry.MeterName`, `ActivitySourceName`, the AddMeter
// call, or the AddSource call, and these go red.
// ═══════════════════════════════════════════════════════════════════


/// A tag value nothing else in the suite uses, so an assertion cannot be
/// satisfied by another test's concurrent traffic on the same global meter.
let private probeOp (name: string) = "telemetry-probe-" + name

let private sumForOp (metric: Metric) (opName: string) : float =
    let mutable total = 0.0
    let mutable points = metric.GetMetricPoints().GetEnumerator()

    while points.MoveNext() do
        let point = points.Current
        let mutable matches = false
        let mutable tags = point.Tags.GetEnumerator()

        while tags.MoveNext() do
            let tag = tags.Current

            if String.Equals(tag.Key, "op.name", StringComparison.Ordinal) then
                match tag.Value with
                | :? string as s when String.Equals(s, opName, StringComparison.Ordinal) -> matches <- true
                | _ -> ()

        if matches then
            total <- total + float (point.GetSumLong())

    total


// ── The link that breaks silently: a rename in Core ────────────────

[<Fact>]
let ``the exporter subscribes to the meter Core actually publishes`` () =
    // Renaming the meter in src/Core/Metrics.fs without renaming it here
    // yields a provider that subscribes to a meter nobody publishes: a
    // pipeline that looks configured and moves nothing. That is the exact
    // failure class the observability-chain audit exists for, expressed at
    // the .NET layer where a YAML audit cannot see it.
    ZetaTelemetry.MeterName |> should equal DbspMetrics.Meter.Name


[<Fact>]
let ``the exporter subscribes to the activity source Core actually publishes`` () =
    ZetaTelemetry.ActivitySourceName |> should equal DbspTracing.Source.Name


// ── Opt-in: absent configuration exports NOTHING ───────────────────

[<Fact>]
let ``an absent OTEL_EXPORTER_OTLP_ENDPOINT attaches no exporter`` () =
    // A library that phones home by default is wrong. This is the shipped
    // default, so it gets a test rather than a comment.
    ZetaTelemetry.decideEndpoint (fun _ -> "") |> should equal NotConfigured

    match ZetaTelemetry.tryStart (fun _ -> "") with
    | Ok None -> ()
    | Ok(Some _) -> failwith "an exporter was attached with no endpoint configured"
    | Error e -> failwith ("expected silent default, got error: " + e)


[<Fact>]
let ``whitespace is not a configured endpoint`` () =
    ZetaTelemetry.decideEndpoint (fun _ -> "   ") |> should equal NotConfigured


[<Fact>]
let ``a service name alone does not turn exporting on`` () =
    let env key =
        if String.Equals(key, ZetaTelemetry.ServiceNameVariable, StringComparison.Ordinal) then
            "zeta-portal"
        else
            ""

    match ZetaTelemetry.tryStart env with
    | Ok None -> ()
    | _ -> failwith "OTEL_SERVICE_NAME must not imply an endpoint"


// ── Supplied-and-wrong is LOUD, never mistaken for disabled ────────

[<Fact>]
let ``a malformed endpoint is an error, not a silent disable`` () =
    let env key =
        if String.Equals(key, ZetaTelemetry.EndpointVariable, StringComparison.Ordinal) then
            "alloy:4317"
        else
            ""

    match ZetaTelemetry.decideEndpoint env with
    | Malformed _ -> ()
    | other -> failwith (sprintf "expected Malformed, got %A" other)

    match ZetaTelemetry.tryStart env with
    | Error _ -> ()
    | _ -> failwith "a typo'd endpoint must not read as telemetry-disabled"


[<Fact>]
let ``a non-http scheme is refused`` () =
    let env key =
        if String.Equals(key, ZetaTelemetry.EndpointVariable, StringComparison.Ordinal) then
            "ftp://alloy.monitoring.svc:4317"
        else
            ""

    match ZetaTelemetry.decideEndpoint env with
    | Malformed _ -> ()
    | other -> failwith (sprintf "expected Malformed, got %A" other)


[<Fact>]
let ``a well-formed endpoint is accepted and carried through`` () =
    let env key =
        if String.Equals(key, ZetaTelemetry.EndpointVariable, StringComparison.Ordinal) then
            "http://alloy.monitoring.svc.cluster.local:4317"
        else
            ""

    match ZetaTelemetry.decideEndpoint env with
    | Configured uri -> uri.Port |> should equal 4317
    | other -> failwith (sprintf "expected Configured, got %A" other)


[<Fact>]
let ``protocol defaults to grpc and rejects nonsense`` () =
    match ZetaTelemetry.decideProtocol (fun _ -> "") with
    | Ok Grpc -> ()
    | other -> failwith (sprintf "unset must default to grpc, got %A" other)

    match ZetaTelemetry.decideProtocol (fun _ -> "http/protobuf") with
    | Ok HttpProtobuf -> ()
    | other -> failwith (sprintf "http/protobuf must select HttpProtobuf, got %A" other)

    match ZetaTelemetry.decideProtocol (fun _ -> "carrier-pigeon") with
    | Error _ -> ()
    | Ok p -> failwith (sprintf "expected an error, got %A" p)


// ── THE MAIN EVENT: data actually arrives at an exporter ───────────

[<Fact>]
let ``metrics recorded on the Zeta meter ARRIVE at an exporter`` () =
    let exported = ResizeArray<Metric>()
    let op = probeOp "rows-in"

    use providers =
        ZetaTelemetry.compose
            "zeta-test"
            (fun b -> b.AddInMemoryExporter exported)
            id

    // Recorded AFTER the provider exists, exactly as a live process would.
    DbspMetrics.RecordRowsIn(op, 4242, 7L)
    DbspMetrics.RecordRowsOut(op, 4242, 3L)

    providers.ForceFlush 5000 |> should equal true

    let names =
        exported |> Seq.map (fun m -> m.Name) |> Set.ofSeq

    // If this set is empty the exporter path is wired and produces nothing --
    // which is precisely the state this whole change set exists to end.
    names |> should contain "dbsp.rows.in"
    names |> should contain "dbsp.rows.out"

    let rowsIn = exported |> Seq.find (fun m -> String.Equals(m.Name, "dbsp.rows.in", StringComparison.Ordinal))
    let rowsOut = exported |> Seq.find (fun m -> String.Equals(m.Name, "dbsp.rows.out", StringComparison.Ordinal))

    // The VALUE, not just the name: a metric that arrives with the wrong
    // number is a worse lie than one that does not arrive.
    sumForOp rowsIn op |> should equal 7.0
    sumForOp rowsOut op |> should equal 3.0


[<Fact>]
let ``every instrument DbspMetrics publishes reaches the exporter`` () =
    let exported = ResizeArray<Metric>()
    let op = probeOp "all-instruments"

    use providers =
        ZetaTelemetry.compose
            "zeta-test"
            (fun b -> b.AddInMemoryExporter exported)
            id

    DbspMetrics.RecordTick()
    DbspMetrics.RecordRowsIn(op, 1, 1L)
    DbspMetrics.RecordRowsOut(op, 1, 1L)
    DbspMetrics.RecordTickDuration 12.5
    DbspMetrics.RecordAllocations 4096L

    providers.ForceFlush 5000 |> should equal true

    let names = exported |> Seq.map (fun m -> m.Name) |> Set.ofSeq

    for expected in [ "dbsp.ticks"; "dbsp.rows.in"; "dbsp.rows.out"; "dbsp.tick.duration"; "dbsp.tick.allocations" ] do
        names |> should contain expected


[<Fact>]
let ``spans started on the Zeta source ARRIVE at an exporter, with their tags`` () =
    let exported = ResizeArray<Activity>()

    use providers =
        ZetaTelemetry.compose
            "zeta-test"
            id
            (fun b -> b.AddInMemoryExporter exported)

    // The contrast that makes this a falsifier rather than a demo: with a
    // listener attached StartActivity stops returning null. Tracing.Tests.fs
    // records the other half of this sentence.
    ZetaTelemetry.isTracingLive () |> should equal true

    let act = DbspTracing.StartTick 4242
    act |> should not' (be null)
    act.Stop()

    providers.ForceFlush 5000 |> should equal true

    let tick =
        exported
        |> Seq.filter (fun a -> String.Equals(a.OperationName, "circuit.tick", StringComparison.Ordinal))
        |> Seq.filter (fun a ->
            a.TagObjects
            |> Seq.exists (fun kv ->
                String.Equals(kv.Key, "circuit.id", StringComparison.Ordinal)
                && (match kv.Value with
                    | :? int as i -> i = 4242
                    | _ -> false)))
        |> Seq.toList

    tick |> should haveLength 1


[<Fact>]
let ``with no provider the source has no listeners -- the documented status quo`` () =
    // Deliberately asserts the BEFORE state so the AFTER state above means
    // something. If this ever fails it means some other code path attached a
    // global listener, and the arrival tests are no longer proving anything.
    let source = new ActivitySource("Zeta.Core.NoListenerProbe", "1.0.0")
    source.HasListeners() |> should equal false
    source.StartActivity "probe" |> should be null
    source.Dispose()


// ── The OTLP branch itself (construction only -- see the honest limit) ──

[<Fact>]
let ``a configured endpoint actually attaches the OTLP providers`` () =
    // The in-memory tests above prove data reaches AN exporter. This one proves
    // the branch a live process takes is not merely type-checked: with an
    // endpoint set, tryStart returns providers and the activity source goes
    // live. Port 4317 on localhost is almost certainly closed here and that is
    // fine -- OTLP export is asynchronous, so construction does not require a
    // reachable collector.
    //
    // HONEST LIMIT, stated where it belongs: this does NOT prove bytes arrive at
    // a collector. Nothing in this suite can, because that needs a listener on
    // the wire. The cheapest real probe is an otelcol/Alloy container on 4317
    // with a debug exporter and OTEL_EXPORTER_OTLP_ENDPOINT pointed at it --
    // deliberately NOT wired into the gate, because a container per PR is a cost
    // that has to be argued for, not smuggled in.
    let env key =
        if String.Equals(key, ZetaTelemetry.EndpointVariable, StringComparison.Ordinal) then
            "http://127.0.0.1:4317"
        else
            ""

    match ZetaTelemetry.tryStart env with
    | Ok(Some providers) ->
        use p = providers
        ZetaTelemetry.isTracingLive () |> should equal true
        let act = DbspTracing.StartTick 99
        act |> should not' (be null)
        act.Stop()
    | Ok None -> failwith "a configured endpoint must attach providers"
    | Error e -> failwith ("tryStart refused a well-formed endpoint: " + e)
