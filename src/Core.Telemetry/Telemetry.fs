namespace Zeta.Core.Telemetry

open System
open System.Diagnostics
open OpenTelemetry
open OpenTelemetry.Exporter
open OpenTelemetry.Metrics
open OpenTelemetry.Resources
open OpenTelemetry.Trace
open Zeta.Core


/// What the environment said about where telemetry should go. Three cases,
/// and the middle one is the DEFAULT: absent means do not export.
///
/// A library that phones home unless told otherwise has made an egress
/// decision for its host. So `NotConfigured` is not an error and not a
/// fallback-to-localhost -- it is the shipped behaviour, and the only way
/// out of it is an operator setting `OTEL_EXPORTER_OTLP_ENDPOINT`.
type OtlpEndpointDecision =
    /// No `OTEL_EXPORTER_OTLP_ENDPOINT`. Export nothing. This is the default.
    | NotConfigured
    /// A well-formed absolute endpoint. Export there.
    | Configured of Uri
    /// Set but unparseable. LOUD, never silently downgraded to NotConfigured --
    /// a typo'd endpoint that reads as "telemetry disabled" is the same class
    /// of failure as a sink with no source.
    | Malformed of value: string * reason: string


/// Which OTLP framing to speak. Alloy's receiver listens on both
/// (grpc :4317, http/protobuf :4318), so this is a real choice with a
/// real default rather than a knob nobody can use.
type OtlpWireProtocol =
    | Grpc
    | HttpProtobuf


/// The composition root that connects Zeta's BCL-level instrumentation to an
/// OTLP collector.
///
/// ## The gap this closes
///
/// `Zeta.Core.DbspMetrics` has published a `Zeta.Core.Circuit` meter with five
/// instruments, and `Zeta.Core.DbspTracing` an activity source, since long
/// before anything listened. With no listener attached `StartActivity` returns
/// null and every `Counter.Add` is a no-op that costs ~5ns -- correct, cheap,
/// and reaching nobody. This module is the listener.
///
/// ## Opt-in, twice over
///
/// 1. Referencing `Zeta.Core` does NOT pull the OTel SDK in. This assembly is
///    separate precisely so a consumer of the DBSP library never inherits an
///    exporter it did not ask for.
/// 2. Referencing THIS assembly still exports nothing until
///    `OTEL_EXPORTER_OTLP_ENDPOINT` names a destination.
///
/// ## Anchors (Beacon)
///
/// - OpenTelemetry Specification, "OTLP Exporter Configuration": the
///   `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_EXPORTER_OTLP_PROTOCOL` /
///   `OTEL_SERVICE_NAME` variable names are the spec's, not ours, so an
///   operator who knows OTel already knows this surface.
/// - Sigelman et al., *Dapper* (Google, 2010) -- the span/trace model
///   `ActivitySource` implements.
[<RequireQualifiedAccess>]
module ZetaTelemetry =

    /// The meter `src/Core/Metrics.fs` publishes. Held here as a literal and
    /// pinned to `DbspMetrics.Meter.Name` by a test: renaming the meter in
    /// Core without renaming it here would silently unhook the exporter and
    /// leave a pipeline that looks configured and moves nothing.
    [<Literal>]
    let MeterName = "Zeta.Core.Circuit"

    /// The activity source `src/Core/Tracing.fs` publishes. Same pinning.
    [<Literal>]
    let ActivitySourceName = "Zeta.Core"

    [<Literal>]
    let EndpointVariable = "OTEL_EXPORTER_OTLP_ENDPOINT"

    [<Literal>]
    let ProtocolVariable = "OTEL_EXPORTER_OTLP_PROTOCOL"

    [<Literal>]
    let ServiceNameVariable = "OTEL_SERVICE_NAME"

    [<Literal>]
    let DefaultServiceName = "zeta-core"

    /// Read the real process environment. Injected rather than called
    /// directly so every decision below is a pure function of its input
    /// (discipline #7 noninterference: the ambient environment enters
    /// through one declared door, which is also what makes it testable).
    let environmentReader : string -> string =
        fun key ->
            match Environment.GetEnvironmentVariable key with
            | null -> ""
            | value -> value

    /// Parse `OTEL_EXPORTER_OTLP_PROTOCOL`. Unset defaults to grpc, which is
    /// the OTel spec's default and the port Alloy's receiver opens first.
    let decideProtocol (getEnv: string -> string) : Result<OtlpWireProtocol, string> =
        match (getEnv ProtocolVariable).Trim() with
        | "" -> Ok Grpc
        | "grpc" -> Ok Grpc
        | "http/protobuf" -> Ok HttpProtobuf
        | other ->
            Error(
                ProtocolVariable
                + " is "
                + other
                + " -- expected grpc or http/protobuf"
            )

    /// Decide where (or whether) to export. Pure in `getEnv`.
    let decideEndpoint (getEnv: string -> string) : OtlpEndpointDecision =
        let raw = (getEnv EndpointVariable).Trim()

        if String.IsNullOrEmpty raw then
            NotConfigured
        else
            match Uri.TryCreate(raw, UriKind.Absolute) with
            | true, uri when uri.Scheme = "http" || uri.Scheme = "https" -> Configured uri
            | true, uri -> Malformed(raw, "scheme " + uri.Scheme + " is not http or https")
            | false, _ -> Malformed(raw, "not an absolute URI")

    /// `OTEL_SERVICE_NAME` or the default. Never empty.
    let decideServiceName (getEnv: string -> string) : string =
        match (getEnv ServiceNameVariable).Trim() with
        | "" -> DefaultServiceName
        | name -> name

    /// Owns a meter provider and a tracer provider as one unit; disposing
    /// flushes and detaches both. Held as a class because it owns unmanaged-ish
    /// lifetime (the earned-class bar: this IS state with a lifecycle).
    [<Sealed>]
    type Providers(meters: MeterProvider, tracers: TracerProvider) =

        member _.MeterProvider = meters
        member _.TracerProvider = tracers

        /// Push everything queued. Exposed because a short-lived process
        /// (a CLI, a test) exits before any periodic reader fires.
        member _.ForceFlush(timeoutMilliseconds: int) : bool =
            let m = meters.ForceFlush timeoutMilliseconds
            let t = tracers.ForceFlush timeoutMilliseconds
            m && t

        interface IDisposable with
            member _.Dispose() =
                meters.Dispose()
                tracers.Dispose()

    /// Attach providers over Zeta's meter + activity source, with the EXPORTER
    /// chosen by the caller.
    ///
    /// The exporter is a parameter and not a hardcoded OTLP call on purpose:
    /// it is the seam an in-memory exporter plugs into, which is the only way
    /// to assert that instrumentation actually ARRIVES somewhere. "It compiles"
    /// is not evidence that telemetry flows.
    let compose
        (serviceName: string)
        (configureMetrics: MeterProviderBuilder -> MeterProviderBuilder)
        (configureTracing: TracerProviderBuilder -> TracerProviderBuilder)
        : Providers =
        let resource (b: ResourceBuilder) =
            b.AddService(serviceName = serviceName, serviceVersion = "1.0.0")

        let meters =
            Sdk
                .CreateMeterProviderBuilder()
                .ConfigureResource(fun b -> resource b |> ignore)
                .AddMeter MeterName
            |> configureMetrics
            |> fun b -> b.Build()

        let tracers =
            Sdk
                .CreateTracerProviderBuilder()
                .ConfigureResource(fun b -> resource b |> ignore)
                .AddSource ActivitySourceName
            |> configureTracing
            |> fun b -> b.Build()

        new Providers(meters, tracers)

    let private applyOtlp (endpoint: Uri) (protocol: OtlpWireProtocol) (options: OtlpExporterOptions) : unit =
        options.Endpoint <- endpoint

        options.Protocol <-
            match protocol with
            | Grpc -> OtlpExportProtocol.Grpc
            | HttpProtobuf -> OtlpExportProtocol.HttpProtobuf

    /// The opt-in entry point.
    ///
    /// `Ok None` is the DEFAULT and the honest one: no endpoint configured, so
    /// nothing was attached and nothing is exported. `Error` is reserved for a
    /// configuration that was SUPPLIED and is wrong -- which must never be
    /// mistaken for "telemetry disabled".
    let tryStart (getEnv: string -> string) : Result<Providers option, string> =
        match decideEndpoint getEnv with
        | NotConfigured -> Ok None
        | Malformed(value, reason) -> Error(EndpointVariable + "=" + value + " is unusable: " + reason)
        | Configured endpoint ->
            match decideProtocol getEnv with
            | Error e -> Error e
            | Ok protocol ->
                let serviceName = decideServiceName getEnv

                let providers =
                    compose
                        serviceName
                        (fun b -> b.AddOtlpExporter(fun o -> applyOtlp endpoint protocol o))
                        (fun b -> b.AddOtlpExporter(fun o -> applyOtlp endpoint protocol o))

                Ok(Some providers)

    /// `tryStart` over the real process environment.
    let tryStartFromEnvironment () : Result<Providers option, string> = tryStart environmentReader

    /// True when a listener is attached to the Zeta activity source right now.
    ///
    /// This is the property `Tracing.Tests.fs` documents the FALSE side of
    /// ("StartActivity returns null with no listener"). Exposed so the true
    /// side is assertable rather than assumed.
    let isTracingLive () : bool = DbspTracing.Source.HasListeners()
