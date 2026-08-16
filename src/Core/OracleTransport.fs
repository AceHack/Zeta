module Zeta.Core.OracleTransport

/// **`OracleTransport` — transport-agnostic oracle reading adapter.**
///
/// An oracle reading is a `ZSet<OracleReading>` delta — a single measurement
/// of the identity space boundary by one oracle at one point in time.
///
/// The transport is pluggable. The oracle does not know or care whether it
/// sends over Git, WebSocket, NATS, Reticulum, or any other channel. The
/// transport IS the L in ρ = 1/(1+L):
///
///   Git (branch push)      → L ≈ minutes   → ρ ≈ 0.01   (Classical/Independent)
///   Reticulum (mesh hop)   → L = hop delay → ρ = variable (SharedState → Classical)
///   NATS (pub/sub)         → L ≈ ms        → ρ ≈ 0.999  (Correlated → SharedState)
///   WebSocket (push)       → L ≈ ms        → ρ ≈ 0.999  (Correlated)
///
/// The Condorcet bonus of a transport is `1 - ρ = L/(1+L)`. High-delay
/// transports (Git, Reticulum) have high Condorcet bonus — they are the
/// transports that make the sensor-fusion proof real.
///
/// **Money velocity connection:** the same formula applies to money.
/// L = holding period (time preference). ρ = money velocity correlation.
/// High-velocity money (L → 0, ρ → 1) is inflationary — correlation-to-one.
/// Low-velocity money (L → ∞, ρ → 0) is deflationary (Bitcoin) — independent.
/// The oracle transport layer is the formalization of Austrian time preference.
///
/// **Transport agnosticism:** the `ITransport` interface has one method:
/// `EmitAsync(reading: OracleReading) : Task<unit>`. Any channel that can
/// carry a JSON blob implements it. The oracle computation is identical
/// regardless of transport; only the L (and therefore ρ) changes.
///
/// ## Maturity of the implementations in this file (audited 2026-08-16)
///
/// The `ITransport` **interface** is real. Of the three implementations, **one is**:
///
/// | type | what it actually does | status |
/// |---|---|---|
/// | `WebSocketTransport` | `do! sendFn json` — delivers through an **injected** send function | **real** |
/// | `GitFileDropTransport` | writes a local JSON file; a separate CI step pushes it | **half** — no git call here |
/// | `SimulatedReticulumLatencyTransport` | `Task.Delay`; the reading is **discarded** | **stub** — sends nothing |
///
/// The latter two were named `GitTransport` and `ReticulumTransport` and were renamed because those
/// names asserted capabilities the code does not have. Read each type's docstring before wiring it
/// to anything — in particular, a stub's returned latency still flows into `ρ = 1/(1+L)`, so an
/// unimplemented transport left in a fan-out list does not merely fail to deliver, it takes the
/// **largest** Condorcet weight in the posterior while having measured nothing.
///
/// The ρ table below (`transportRhoTable`) is a table of **nominal** per-channel latencies for
/// reference. It is not a claim that this file implements those channels.

open System
open System.Text.Json
open System.Text.Json.Serialization
open System.Threading.Tasks


// ── Domain types ─────────────────────────────────────────────────────────────

/// A single oracle reading: one measurement of the identity space boundary.
/// This is the atom of the sensor-fusion proof.
[<Struct>]
type OracleReading =
    { /// Oracle index (0–4 for the five DLA oracles; 5 for money velocity; 6+ for extensions)
      OracleIndex: int
      /// Oracle name (human-readable, for display)
      OracleName: string
      /// The seed used for this reading (hex string, last 6 digits shown on site)
      Seed: uint64
      /// The fractal dimension D_f measured by this oracle
      FractalDim: float
      /// The cluster size (number of stuck cells)
      ClusterSize: int
      /// The total cells in the grid
      TotalCells: int
      /// The compute time in seconds
      ElapsedSeconds: float
      /// The wall-clock timestamp of this reading (UTC ISO 8601)
      Timestamp: string
      /// The transport that carried this reading (for L measurement)
      Transport: string
      /// The measured one-way latency of the transport in seconds (L)
      LatencySeconds: float
      /// The effective correlation ρ = 1/(1+L) for this transport
      EffectiveCorrelation: float
      /// The Condorcet bonus = L/(1+L) for this transport
      CondorcetBonus: float
      /// The agent that emitted this reading (alexa/otto/soraya/external)
      AgentId: string
      /// The ZetaId of the heartbeat that triggered this reading (hex)
      HeartbeatId: string }


/// Compute the effective correlation and Condorcet bonus for a given latency.
module OracleReading =

    let effectiveCorrelation (latencySeconds: float) : float =
        1.0 / (1.0 + max 0.0 latencySeconds)

    let condorcetBonus (latencySeconds: float) : float =
        let l = max 0.0 latencySeconds
        l / (1.0 + l)

    /// Create an OracleReading with ρ and bonus computed from latency.
    let create
        (oracleIndex: int)
        (oracleName: string)
        (seed: uint64)
        (df: float)
        (clusterSize: int)
        (totalCells: int)
        (elapsed: float)
        (transport: string)
        (latencySeconds: float)
        (agentId: string)
        (heartbeatId: string)
        : OracleReading =
        { OracleIndex         = oracleIndex
          OracleName          = oracleName
          Seed                = seed
          FractalDim          = df
          ClusterSize         = clusterSize
          TotalCells          = totalCells
          ElapsedSeconds      = elapsed
          Timestamp           = DateTimeOffset.UtcNow.ToString("o")
          Transport           = transport
          LatencySeconds      = latencySeconds
          EffectiveCorrelation = effectiveCorrelation latencySeconds
          CondorcetBonus      = condorcetBonus latencySeconds
          AgentId             = agentId
          HeartbeatId         = heartbeatId }

    /// The spread (max - min D_f) across a set of readings.
    /// If spread < 0.25, the sensor-fusion proof passes.
    let spread (readings: OracleReading seq) : float =
        let dfs = readings |> Seq.map (fun r -> r.FractalDim) |> Seq.toArray
        if dfs.Length = 0 then 0.0
        else Array.max dfs - Array.min dfs

    /// The weighted mean D_f, weighted by Condorcet bonus (high-delay oracles count more).
    /// This is the Kalman posterior — the best estimate of the true D_f.
    let weightedMeanDf (readings: OracleReading seq) : float =
        let rs = readings |> Seq.toArray
        if rs.Length = 0 then 0.0
        else
        let totalWeight = rs |> Array.sumBy (fun r -> r.CondorcetBonus + 1e-9)
        let weightedSum = rs |> Array.sumBy (fun r -> r.FractalDim * (r.CondorcetBonus + 1e-9))
        weightedSum / totalWeight

    /// JSON serialization options (camelCase, no null fields).
    let private jsonOptions =
        let opts = JsonSerializerOptions()
        opts.PropertyNamingPolicy <- JsonNamingPolicy.CamelCase
        opts.DefaultIgnoreCondition <- JsonIgnoreCondition.WhenWritingNull
        opts.WriteIndented <- true
        opts

    let toJson (r: OracleReading) : string =
        JsonSerializer.Serialize(r, jsonOptions)

    let fromJson (json: string) : Result<OracleReading, string> =
        try
            let boxed = JsonSerializer.Deserialize(json, typeof<OracleReading>, jsonOptions)
            match boxed with
            | :? OracleReading as r -> Ok r
            | _ -> Error "Deserialization returned null"
        with ex -> Error ex.Message


// ── Transport interface ───────────────────────────────────────────────────────

/// A transport that can carry oracle readings.
/// The transport IS the L in ρ = 1/(1+L).
/// Implement this interface for any channel: Git, WebSocket, NATS, Reticulum.
type ITransport =
    /// Emit an oracle reading over this transport.
    /// Returns the measured round-trip latency in seconds (L).
    abstract EmitAsync : OracleReading -> Task<float>

    /// The nominal one-way latency of this transport in seconds.
    /// Used to pre-compute ρ before a reading is emitted.
    abstract NominalLatencySeconds : float

    /// Human-readable name of this transport (for display and logging).
    abstract Name : string


// ── Built-in transports ───────────────────────────────────────────────────────

/// **`GitFileDropTransport` — writes the reading to a LOCAL FILE. It does not touch git.**
///
/// **HALF-IMPLEMENTED — renamed from `GitTransport` 2026-08-16.** The old name asserted a
/// capability this code does not have: there is no push, no REST call, no network of any kind
/// below. `EmitAsync` serialises the reading to `{pathPrefix}/{agentId}/oracle-*.json` and returns,
/// which is a *real and useful* half — a separate CI step is what picks the file up and pushes it
/// via the GitHub REST git-data API (the `write-heartbeat.ts pushHeartbeatViaRest` pattern). So the
/// file drop is genuine; the delivery is somebody else's job and is **not** performed here.
///
/// Two consequences a caller must know before wiring this up:
///
///   - **`NominalLatencySeconds = 120.0` is a constant about a round-trip this class never makes.**
///     The returned `EmitAsync` latency measures a local file write (sub-millisecond) and is
///     therefore NOT the `L` in `ρ = 1/(1+L)`. Feeding the returned value into the Condorcet
///     weighting would credit this transport with independence it has not demonstrated.
///   - **Without the CI step, emitting here delivers nothing to anyone.** The reading is on local
///     disk and no peer will ever see it.
///
/// Under `toy-is-free-metered-must-be-earned`: **unmetered**. No test exercises it, and no test
/// would fail if the file write were removed.
type GitFileDropTransport(repo: string, branch: string, pathPrefix: string) =

    /// Nominal latency: 2 minutes (GitHub Actions typical round-trip) — a claim about the CI step
    /// that ships the dropped file, NOT about anything this class does. See the type docstring.
    let nominalLatency = 120.0

    interface ITransport with
        member _.Name = $"git-file-drop:{repo}@{branch}"
        member _.NominalLatencySeconds = nominalLatency

        member _.EmitAsync(reading: OracleReading) =
            task {
                // Writes a local file ONLY. The push is a separate CI step (see type docstring);
                // nothing here contacts GitHub.
                let t0 = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                let json = OracleReading.toJson reading
                let filename = $"oracle-{reading.OracleIndex}-{reading.Seed:x}-{t0}.json"
                let dir = System.IO.Path.Combine(pathPrefix, reading.AgentId)
                System.IO.Directory.CreateDirectory(dir) |> ignore
                System.IO.File.WriteAllText(System.IO.Path.Combine(dir, filename), json)
                let elapsed = float (DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - t0) / 1000.0
                return elapsed
            }


/// WebSocket transport: push a JSON message to connected browser clients.
/// L ≈ milliseconds. Low Condorcet bonus (Correlated regime).
/// Use this for the live oracle feed panel on the DLA site.
type WebSocketTransport(sendFn: string -> Task<unit>) =

    /// Nominal latency: 5ms (local WebSocket round-trip).
    let nominalLatency = 0.005

    interface ITransport with
        member _.Name = "websocket"
        member _.NominalLatencySeconds = nominalLatency

        member _.EmitAsync(reading: OracleReading) =
            task {
                let t0 = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                let json = OracleReading.toJson reading
                do! sendFn json
                let elapsed = float (DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - t0) / 1000.0
                return elapsed
            }


/// **`SimulatedReticulumLatencyTransport` — NOT IMPLEMENTED. Sleeps, discards the reading, returns
/// the time it slept.**
///
/// **STUB — renamed from `ReticulumTransport` 2026-08-16.** This is the most dangerous shape in the
/// defect class and the reason the rename is not cosmetic: it satisfies `ITransport` completely,
/// never throws, never logs, and returns a latency that looks exactly like a successful mesh
/// round-trip. A caller who wires it into `OracleTransport.emitAll` gets **silent total data loss** —
/// `reading` is not read, not serialised, and not sent anywhere. `Task.Delay` is the entire body.
///
/// It is worth being precise about why the old name was worse than merely inaccurate. A stub named
/// `ReticulumTransport` in a fan-out list is indistinguishable at the call site from the working
/// `WebSocketTransport` beside it, and its **fabricated latency propagates into the science**:
/// `ρ = 1/(1+L)` would credit this class with the *highest* Condorcet independence of any transport
/// in the table, so a fusion posterior computed with it in the list is weighted most heavily by the
/// one participant that measured nothing. The `Name` and `NominalLatencySeconds` members now
/// announce the simulation so a log line cannot be mistaken for a delivery.
///
/// Implementing it (Reticulum Python API over subprocess or named pipe, store-and-forward routing,
/// measured RTT replacing the nominal) is **separate work and is deliberately not done here** — this
/// change makes the gap legible, it does not close it. Note also that `Task.Delay` blocks the fan-out
/// for `nominalHops × 0.5` seconds of pure fiction, and that a real implementation must take its
/// socket as an injected dependency (§13 noninterference) rather than reaching for one ambiently —
/// the pattern `WebSocketTransport(sendFn)` above already follows.
///
/// Under `toy-is-free-metered-must-be-earned`: **toy**, not unmetered — there is no mechanism here
/// that could be falsified.
type SimulatedReticulumLatencyTransport(destinationHash: string, nominalHops: int) =

    /// Nominal latency: 0.5s per hop (Reticulum typical) — the duration this stub SLEEPS for.
    /// It is not a measurement, and no packet is in flight during it.
    let nominalLatency = float nominalHops * 0.5

    interface ITransport with
        member _.Name = $"SIMULATED-reticulum(unimplemented):{destinationHash[..7]}"
        member _.NominalLatencySeconds = nominalLatency

        member _.EmitAsync(reading: OracleReading) =
            task {
                // NOT IMPLEMENTED. `reading` is intentionally unused: nothing is serialised and
                // nothing is transmitted. This sleeps for the nominal hop delay and reports how
                // long it slept. See the type docstring before wiring this to anything.
                ignore reading
                let t0 = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                do! Task.Delay(int (nominalLatency * 1000.0))
                let elapsed = float (DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - t0) / 1000.0
                return elapsed
            }


// ── Multi-transport fan-out ───────────────────────────────────────────────────

/// Fan out a reading to multiple transports simultaneously.
/// The Kalman posterior weights each transport by its Condorcet bonus.
/// High-delay transports (Git, Reticulum) count more in the posterior.
[<RequireQualifiedAccess>]
module OracleTransport =

    /// Emit a reading to all transports and return the measured latencies.
    let emitAll (transports: ITransport list) (reading: OracleReading) : Task<float list> =
        task {
            let tasks = transports |> List.map (fun t -> t.EmitAsync reading)
            let! latencies = Task.WhenAll(tasks)
            return Array.toList latencies
        }

    /// The Condorcet-weighted posterior D_f across all readings.
    /// This is the Kalman sensor fusion result.
    let posterior (readings: OracleReading seq) : float =
        OracleReading.weightedMeanDf readings

    /// The sensor-fusion verdict: PASS if spread < 0.25.
    let verdict (readings: OracleReading seq) : bool * float =
        let s = OracleReading.spread readings
        (s < 0.25, s)

    /// The ρ = 1/(1+L) table for the standard transports.
    let transportRhoTable : (string * float * float * string) list =
        [ "git",        120.0,  OracleReading.effectiveCorrelation 120.0,  "Classical (Independent)"
          "reticulum",  5.0,    OracleReading.effectiveCorrelation 5.0,    "Classical (Independent)"
          "nats",       0.001,  OracleReading.effectiveCorrelation 0.001,  "Correlated (S≈4)"
          "websocket",  0.005,  OracleReading.effectiveCorrelation 0.005,  "Correlated (S≈4)"
          "human",      300.0,  OracleReading.effectiveCorrelation 300.0,  "Classical (Independent)" ]
