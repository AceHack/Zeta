namespace Zeta.Core

open System
open System.Threading
open System.Threading.Tasks


open System.Collections.Concurrent
open System.Runtime.CompilerServices

[<AllowNullLiteral>]
type BuggifyState(rngState: int64) =
    member val RngState = rngState with get, set

/// FoundationDB-style buggify probabilistic fault injection.
/// Provides a static hook so core code paths can inject faults (e.g. disk write errors,
/// network drops) probabilistically under simulation. Inactive in production.
[<AbstractClass; Sealed>]
type Buggify =
    static member val private context = System.Threading.AsyncLocal<BuggifyState>() with get

    /// Enables BUGGIFY fault-injection under a specific simulation run with a given seed.
    static member Enable(seed: int64) =
        Buggify.context.Value <- BuggifyState(seed)

    /// Disables BUGGIFY fault-injection (all BUGGIFY checks instantly return false).
    static member Disable() =
        Buggify.context.Value <- null

    /// Evaluates if a BUGGIFY fault is active at the calling site.
    /// Default probability of activation is 5% (0.05).
    static member IsActive(?probability: float, [<CallerLineNumber>] ?_line: int, [<CallerFilePath>] ?_file: string) =
        let state = Buggify.context.Value
        if box state = null then false
        else
            let p = defaultArg probability 0.05
            let mutable nextRng = 0L
            lock state (fun () ->
                state.RngState <- state.RngState + 0x9E3779B97F4A7C15L
                let mutable z = state.RngState
                z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9L
                z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBL
                nextRng <- z ^^^ (z >>> 31)
            )
            let roll = (nextRng &&& 0xFFFF_FFFFL |> float) / 4294967295.0
            roll < p

    /// Backward compatibility helper for tag-based bug checks.
    static member Check(probability: float, _tag: string) : bool =
        Buggify.IsActive(probability)


/// Simulated filesystem interface.
type ISimulatedFs =
    abstract FlushToStableStorage: path: string -> unit


/// Global registry to dispatch filesystem simulation intercepts.
[<AbstractClass; Sealed>]
type SimulatedFs =
    static member val private current : ISimulatedFs option = None with get, set
    static member Register(fs: ISimulatedFs) = SimulatedFs.current <- Some fs
    static member Clear() = SimulatedFs.current <- None
    static member Flush(path: string) =
        match SimulatedFs.current with
        | Some fs -> fs.FlushToStableStorage path
        | None -> ()


/// Fault-injection policy used by `ChaosEnvironment`. Policies are additive
/// — combine them to simulate messy production conditions.
[<Flags>]
type ChaosPolicy =
    | None              = 0
    | DelayJitter       = 1   // Delay() can return up to `delayMultiplier` × requested
    | ClockSkew         = 2   // UtcNow may jitter ± `clockSkewMs`
    | RngStall          = 4   // NextInt64() may repeat the previous value
    | TimeReversal      = 8   // Clock may briefly move backwards (rare)


/// `ChaosEnvironment` — the engine for FoundationDB-style simulation tests.
/// Every side-effect goes through `ISimulationEnvironment`, so in tests
/// we inject a chaos env and replay determinism by seed. Policies let us
/// surface race conditions and ordering assumptions without ever running
/// real concurrent code.
///
/// The chaos is deterministic: same (seed, policy, schedule) produces
/// identical traces. When a property-based test fails, FsCheck's shrinker
/// drives the seed down to the minimal triggering value.
[<Sealed>]
type ChaosEnvironment
    (initialTime: DateTimeOffset,
     seed: int64,
     policy: ChaosPolicy,
     delayMultiplier: double,
     clockSkewMs: int64) =

    let mutable now = initialTime
    let mutable ticks = 0L
    let mutable rngState = seed
    let mutable prevRng = 0L
    let mutable guidCounter = 0UL
    let lockObj = obj ()

    let splitMix () =
        rngState <- rngState + 0x9E3779B97F4A7C15L
        let mutable z = rngState
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9L
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBL
        z ^^^ (z >>> 31)

    let hasPolicy flag = (policy &&& flag) = flag

    member _.Policy = policy

    /// Enable Buggify for this simulation environment
    member this.EnableBuggify() =
        Buggify.Enable(seed)
        SimulatedFs.Register(this :> ISimulatedFs)

    /// Disable Buggify
    member this.DisableBuggify() =
        Buggify.Disable()
        SimulatedFs.Clear()

    interface ISimulatedFs with
        member _.FlushToStableStorage(path) =
            if Buggify.Check(0.05, "fs.flush_failure") then
                failwithf "BUGGIFY: Simulated disk flush failure for %s" path

    /// Internal: advance without taking the lock (caller must hold it).
    /// Lets composite operations — RNG draw + clock advance — happen
    /// atomically under a single acquire, preserving seeded determinism.
    member internal _.AdvanceTimeLocked(delta: TimeSpan) =
        now <- now + delta
        ticks <- ticks + int64 delta.TotalMilliseconds

    member this.AdvanceTime(delta: TimeSpan) =
        lock lockObj (fun () -> this.AdvanceTimeLocked delta)

    interface ISimulationEnvironment with
        member _.UtcNow() =
            lock lockObj (fun () ->
                if hasPolicy ChaosPolicy.ClockSkew then
                    let skew = splitMix() % (clockSkewMs * 2L + 1L) - clockSkewMs
                    if hasPolicy ChaosPolicy.TimeReversal && (splitMix() &&& 0x3FL) = 0L then
                        // Rare time reversal — simulate NTP corrections.
                        now.AddMilliseconds(float -(abs skew))
                    else
                        now.AddMilliseconds(float skew)
                else now)

        member _.Ticks() = lock lockObj (fun () -> ticks)

        member _.NextInt64() =
            lock lockObj (fun () ->
                if hasPolicy ChaosPolicy.RngStall && (splitMix() &&& 0x7L) = 0L then
                    prevRng   // simulate duplicate reads / retries
                else
                    prevRng <- splitMix()
                    prevRng)

        member _.NewGuid() =
            lock lockObj (fun () ->
                guidCounter <- guidCounter + 1UL
                let bytes = Array.zeroCreate<byte> 16
                BitConverter.TryWriteBytes(Span<byte>(bytes, 0, 8), guidCounter) |> ignore
                BitConverter.TryWriteBytes(Span<byte>(bytes, 8, 8), seed) |> ignore
                Guid bytes)

        member this.Delay(timeout, _ct) =
            // The RNG draw (`splitMix`) and the clock advance must be
            // atomic under `lockObj` — otherwise concurrent Delay calls
            // can interleave as `splitMixA → splitMixB → AdvanceTimeB →
            // AdvanceTimeA`, breaking the seeded-determinism guarantee the
            // docstring promises.
            lock lockObj (fun () ->
                let actual =
                    if hasPolicy ChaosPolicy.DelayJitter then
                        let noise = (splitMix() &&& 0x3FFL |> float) / 1024.0
                        TimeSpan.FromTicks(int64 (float timeout.Ticks * (1.0 + noise * delayMultiplier)))
                    else timeout
                this.AdvanceTimeLocked actual)
            Task.CompletedTask


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module ChaosEnvironment =

    /// Retrieves a simulation seed from the environment variable "ZETA_SIM_SEED" or uses the default.
    let getSeedFromEnv (defaultSeed: int64) : int64 =
        match Environment.GetEnvironmentVariable("ZETA_SIM_SEED") with
        | null | "" -> defaultSeed
        | valStr ->
            match Int64.TryParse(valStr) with
            | true, v -> v
            | _ -> defaultSeed

    /// Default chaos env — jitters everything with standard parameters.
    let defaults (seed: int64) : ChaosEnvironment =
        ChaosEnvironment(
            DateTimeOffset.UnixEpoch, seed,
            ChaosPolicy.DelayJitter ||| ChaosPolicy.ClockSkew ||| ChaosPolicy.RngStall,
            delayMultiplier = 0.5,
            clockSkewMs = 100L)

    /// Maximal chaos — every policy active, bigger skews. Use for aggressive
    /// stress tests.
    let maximal (seed: int64) : ChaosEnvironment =
        ChaosEnvironment(
            DateTimeOffset.UnixEpoch, seed,
            ChaosPolicy.DelayJitter ||| ChaosPolicy.ClockSkew
                ||| ChaosPolicy.RngStall ||| ChaosPolicy.TimeReversal,
            delayMultiplier = 2.0,
            clockSkewMs = 5_000L)
