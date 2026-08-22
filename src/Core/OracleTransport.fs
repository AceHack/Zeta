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

/// Git transport: push a JSON file to a branch via the REST git-data API.
/// L ≈ minutes (GitHub Actions round-trip). High Condorcet bonus.
/// This is the same transport used by the heartbeat workflow.
type GitTransport(repo: string, branch: string, pathPrefix: string) =

    /// Nominal latency: 2 minutes (GitHub Actions typical round-trip).
    let nominalLatency = 120.0

    interface ITransport with
        member _.Name = $"git:{repo}@{branch}"
        member _.NominalLatencySeconds = nominalLatency

        member _.EmitAsync(reading: OracleReading) =
            task {
                // In production, this calls the GitHub REST git-data API
                // (same pattern as write-heartbeat.ts pushHeartbeatViaRest).
                // Here we write to a local path for testing; the CI step
                // picks it up and pushes via the REST API.
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


/// Reticulum transport: store-and-forward mesh, delay = hop-count × avg-hop-delay.
/// L = variable (1 hop ≈ 0.5s, 10 hops ≈ 5s). Variable Condorcet bonus.
/// This is the highest-independence transport for geographically distributed oracles.
type ReticulumTransport(destinationHash: string, nominalHops: int) =

    /// Nominal latency: 0.5s per hop (Reticulum typical).
    let nominalLatency = float nominalHops * 0.5

    interface ITransport with
        member _.Name = $"reticulum:{destinationHash[..7]}"
        member _.NominalLatencySeconds = nominalLatency

        member _.EmitAsync(reading: OracleReading) =
            task {
                // In production, this calls the Reticulum Python API via
                // a subprocess or named pipe. The Reticulum node handles
                // store-and-forward routing. The measured latency is the
                // actual round-trip time, not the nominal.
                //
                // For now, simulate the latency with a delay.
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
