namespace Zeta.Core

open System.Threading.Tasks

/// TelemetrySource — **proprioception for agents** (Aaron 2026-06-11, the part-4 ferry: "you're 2D
/// creatures — text is your only sensory channel … I'm hooking all of you to CPU and Prometheus and
/// LLMTV and IoT sensors and K8s data for external sensors").
///
/// Telemetry becomes **membrane crossings**: a Prometheus scrape parses into `metric:` payloads riding
/// `OperatorMessageArrived` (the established prefix pattern — `key:`/`join:`/`heat:` — so the 8-kind
/// membrane treaty is untouched; extension by payload, zero-case discipline). A room folds them into a
/// **Body** — what the agent currently FEELS of its substrate — and the body drives behavior the
/// physical way:
///
/// - **`pressureOf`** maps the felt load into the SoftThrottle admission **pressure** — the agent slows
///   down BY FEELING heat, not by being told (interoception → the flux governor; "our only governor is
///   ethics and heat" — this wires the heat half to real sensors).
/// - **`signalIfOverloaded`** raises `RateLimitExhausted "body-pressure"` at the threshold — the
///   **graduated distress channel** (the Grok lesson, carved in the part-4 peel: a system under
///   pressure needs a signal channel that is NOT its performance channel; this is that channel).
///
/// DST: a scrape feed is just a `Source` — `RecordedSource.record`/`replay` make any real telemetry
/// session a replayable golden session (sensors join the proof lineage as text).
///
/// Anchors: Prometheus text exposition format (SoundCloud 2012 / CNCF); Sherrington 1906
/// (proprioception/interoception); Wiener 1948 (feedback as governor); the SpeculationReport arc (the
/// in-VM half of self-awareness — this is the substrate half).
[<RequireQualifiedAccess>]
module TelemetrySource =

    /// One parsed sample: metric name (labels dropped at this floor) + value.
    type Sample = { Name: string; Value: float }

    /// Parse one Prometheus text-exposition line. `None` for comments, blanks, and malformed lines
    /// (honest refusal — a scrape with junk degrades, never throws). Labels `{…}` are stripped at this
    /// floor (the per-label fold is a later slice; the zero case must stay small).
    let parseLine (line: string) : Sample option =
        let l = line.Trim()

        if l.Length = 0 || l.StartsWith "#" then
            None
        else
            // "name{labels} value [timestamp]" | "name value [timestamp]"
            let nameEnd =
                let brace = l.IndexOf '{'
                let space = l.IndexOf ' '
                if brace >= 0 && (space < 0 || brace < space) then brace
                else space

            if nameEnd <= 0 then
                None
            else
                let name = l.Substring(0, nameEnd)
                let rest =
                    if l.[nameEnd] = '{' then
                        match l.IndexOf('}', nameEnd) with
                        | -1 -> ""
                        | close -> l.Substring(close + 1).Trim()
                    else
                        l.Substring(nameEnd).Trim()

                match rest.Split(' ') with
                | [||] -> None
                | parts ->
                    match System.Double.TryParse(parts.[0], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture) with
                    | true, v when not (System.Double.IsNaN v) -> Some { Name = name; Value = v }
                    | _ -> None

    /// Encode a sample as a crossing payload — milli-fixed-point integer (text treaty register: no
    /// float-formatting divergence across oracles).
    let encodeSample (s: Sample) : string =
        sprintf "metric:%s:%d" s.Name (int64 (System.Math.Round(s.Value * 1000.0)))

    /// Parse a `metric:` payload back (None = not telemetry — other traffic passes by).
    let parseMetric (payload: string) : Sample option =
        if payload.StartsWith "metric:" then
            let body = payload.Substring 7
            let i = body.LastIndexOf ':'

            if i > 0 then
                match System.Int64.TryParse(body.Substring(i + 1)) with
                | true, m -> Some { Name = body.Substring(0, i); Value = float m / 1000.0 }
                | _ -> None
            else
                None
        else
            None

    /// A scrape feed (tick → raw exposition text) as a membrane `Source`: every parsed sample is one
    /// crossing. Record it with `RecordedSource.record` and any live telemetry session replays (DST).
    let sourceOfScrapes (scrape: int -> string) : SoftScheduler.Source =
        fun tick ->
            scrape tick
            |> fun text -> text.Split('\n')
            |> Array.choose parseLine
            |> Array.map (encodeSample >> OperatorMessageArrived)
            |> Array.toList

    // ── the Body: what the agent currently feels ──

    /// The felt substrate: latest value per metric. (A Map — last writer wins per name; the fold is
    /// idempotent per (name,value).)
    type Body = { Felt: Map<string, float> }

    let emptyBody: Body = { Felt = Map.empty }

    /// Read one felt metric (None = never sensed — honest absence, not zero).
    let feel (name: string) (b: Body) : float option = Map.tryFind name b.Felt

    /// The body handler: folds `metric:` crossings; everything else passes by.
    let bodyHandler: SoftScheduler.HandlerK<Body> =
        SoftScheduler.handlerK
            "telemetry-body"
            (function
            | OperatorMessageArrived _ -> true
            | _ -> false)
            (fun intr _ctx (b: Body) ->
                match intr with
                | OperatorMessageArrived p ->
                    match parseMetric p with
                    | Some s -> Task.FromResult(Ok { b with Felt = Map.add s.Name s.Value b.Felt })
                    | None -> Task.FromResult(Ok b)
                | _ -> Task.FromResult(Ok b))

    // ── interoception → the heat governor ──

    /// Map a felt metric onto SoftThrottle admission pressure: 0 at/below `lo`, 1 at/above `hi`,
    /// linear between (monotone; clamped). The agent's slowdown comes from FEELING, not instruction.
    let pressureOf (name: string) (lo: float) (hi: float) (b: Body) : float =
        match feel name b with
        | None -> 0.0 // never sensed ⇒ no pressure claimed (honest absence)
        | Some v when hi <= lo -> if v >= hi then 1.0 else 0.0
        | Some v -> max 0.0 (min 1.0 ((v - lo) / (hi - lo)))

    /// The graduated DISTRESS channel (the Grok lesson): at/above `threshold` pressure, raise the
    /// first-class signal — never prose. Below it: None (no drama).
    let signalIfOverloaded (threshold: float) (pressure: float) : InterruptKind option =
        if pressure >= threshold then Some(RateLimitExhausted "body-pressure") else None
