namespace Zeta.Core

open System
open System.Threading
open System.Threading.Tasks

/// Minimal side-effect surface for deterministic simulation.
///
/// Every operator or circuit that needs "current time", "random number", or
/// any other observable side effect must obtain it through this interface.
/// Tests inject a virtual `ISimulationEnvironment`; production uses
/// `SystemEnvironment.Default`. No F# code in this library calls
/// `DateTime.UtcNow`, `Random.Shared`, `Guid.NewGuid`, or
/// `Task.Delay`/`Thread.Sleep` directly.
type ISimulationEnvironment =
    /// Current logical time. `SystemEnvironment` returns wall-clock UTC;
    /// `VirtualEnvironment` returns the scheduler-controlled clock.
    abstract UtcNow: unit -> DateTimeOffset

    /// A monotonically-increasing ticks counter (for durations).
    abstract Ticks: unit -> int64

    /// Next 64-bit integer from the environment's RNG.
    abstract NextInt64: unit -> int64

    /// Fresh GUID. Virtual envs emit deterministic values; system env uses v4.
    abstract NewGuid: unit -> Guid

    /// Wait `timeout`. Async; environment may fast-forward.
    abstract Delay: timeout: TimeSpan * cancellationToken: CancellationToken -> Task


/// Production environment backed by the actual OS clock and a seeded
/// `System.Random.Shared`. Stateless; a single static instance is reused.
[<Sealed>]
type SystemEnvironment private () =
    static let instance = SystemEnvironment()
    static member Default : ISimulationEnvironment = instance :> _
    interface ISimulationEnvironment with
        member _.UtcNow() = DateTimeOffset.UtcNow
        member _.Ticks() = Environment.TickCount64
        member _.NextInt64() = Random.Shared.NextInt64()
        member _.NewGuid() = Guid.NewGuid()
        member _.Delay(timeout, ct) = Task.Delay(timeout, TimeProvider.System, ct)


/// Deterministic environment for simulation and tests. The clock only
/// advances under the test's explicit control via `AdvanceTime`; random
/// numbers and GUIDs are produced by a seeded generator so replays are
/// bit-identical. `DelayAsync` is honoured by advancing the virtual clock
/// and completing synchronously — no wall-clock waiting happens.
[<Sealed>]
type VirtualEnvironment(initialTime: DateTimeOffset, seed: int64) =
    let mutable now = initialTime
    let mutable ticks = 0L
    let mutable rngState = seed
    let mutable guidCounter = 0UL
    let lockObj = obj ()

    /// Advance the virtual clock by the given amount.
    member _.AdvanceTime(delta: TimeSpan) =
        lock lockObj (fun () ->
            now <- now + delta
            ticks <- ticks + int64 delta.TotalMilliseconds)

    /// Set the virtual clock to an absolute instant.
    member _.SetTime(instant: DateTimeOffset) =
        lock lockObj (fun () -> now <- instant)

    interface ISimulationEnvironment with
        member _.UtcNow() = lock lockObj (fun () -> now)
        member _.Ticks() = lock lockObj (fun () -> ticks)
        member _.NextInt64() =
            // splitmix64 — compact, fast, high-quality deterministic RNG.
            lock lockObj (fun () ->
                rngState <- rngState + 0x9E3779B97F4A7C15L
                let mutable z = rngState
                z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9L
                z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBL
                z ^^^ (z >>> 31))
        member _.NewGuid() =
            // Construct a deterministic Guid from the counter + seed. Not a
            // v4 random Guid, but stable across runs for the same seed.
            lock lockObj (fun () ->
                guidCounter <- guidCounter + 1UL
                let bytes = Array.zeroCreate<byte> 16
                BitConverter.TryWriteBytes(Span<byte>(bytes, 0, 8), guidCounter) |> ignore
                BitConverter.TryWriteBytes(Span<byte>(bytes, 8, 8), seed) |> ignore
                Guid bytes)
        member this.Delay(timeout, _ct) =
            // Immediate return; virtual time advances.
            this.AdvanceTime timeout
            Task.CompletedTask


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Environment =
    /// Create a fresh virtual environment starting at Unix epoch with the
    /// given RNG seed. Used by tests that need a predictable side-effect
    /// surface.
    let createVirtual (seed: int64) : VirtualEnvironment =
        VirtualEnvironment(DateTimeOffset.UnixEpoch, seed)

    /// Create a virtual environment at a specific start time.
    let createVirtualAt (start: DateTimeOffset) (seed: int64) : VirtualEnvironment =
        VirtualEnvironment(start, seed)
