namespace Zeta.Core

open System.Threading.Tasks

/// SimFramework — **the simulation framework port: rooms do not run ON a test framework; test frameworks
/// adapt to ROOMS** (Aaron 2026-06-11: "we are going to wrap all this in a simulation framework — the
/// rooms framework does not make sense on top of a test framework alone like xUnit; we will hexagonal it
/// with our own interfaces").
///
/// Hexagonal: this file is the **port** (our own interfaces — free, per the meta-rule); concrete
/// frameworks are **adapters**:
///   • the default harness below runs a room on the soft `IScheduler` (DoP=1, seed-deterministic, DST);
///   • **xUnit is just an adapter** — a `[<Fact>]` that runs the harness and asserts `SignedOff`
///     (see `SimFramework.Tests.fs` for the worked adapter);
///   • future adapters: the DevRoom console, the recorded-membrane replayer, CI gates, the Q# oracle.
///
/// The doctrine made type-shaped: **a test IS a room** — `seed + extensions(handlers) + parameters
/// (budget/source)` — and **passing IS resolving** (rooms-as-sign-off): the room ticks toward its
/// plateau; `Resolved` is the sign-off predicate; the report carries the run (DST: same room, same seed
/// ⇒ same report). Everything here will be treaty-ratified little by little — the report is text-shaped
/// on purpose.
[<RequireQualifiedAccess>]
module SimFramework =

    /// A ROOM — the unit the simulation framework runs (the test-as-room shape):
    /// seed → initial state; handlers = the room's μops (its extensions); Source = its membrane
    /// (parameters — `SoftScheduler.seedSource` for null/DST, a `RecordedSource.replay` for recorded
    /// real IO); Budget = the tick budget; Resolved = the SIGN-OFF predicate (the plateau check).
    type Room<'S> =
        { Name: string
          Initial: int64 -> 'S
          Handlers: SoftScheduler.Handler<'S> list
          Source: int64 -> SoftScheduler.Source
          Budget: int
          Resolved: 'S -> bool }

    /// The report a harness returns — the room's run, sign-off, and how it ended. Text-friendly (the
    /// treaty surface): no opaque state required to read the verdict.
    type RoomReport<'S> =
        { Room: string
          Ticks: int
          Final: Result<'S, InterruptFeedback>
          SignedOff: bool }

    /// THE PORT: a simulation harness runs rooms to (attempted) resolution. Implementations are
    /// adapters — deterministic local (below), distributed, recorded-replay, CI, …
    type ISimHarness =
        abstract member Run: room: Room<'S> * seed: int64 -> Task<RoomReport<'S>>

    /// The DEFAULT harness — the soft scheduler at DoP=1: deterministic, replay-equal, the FDB shape.
    /// (An object expression implementing the port — the interface is free; no class earned.)
    let harness: ISimHarness =
        { new ISimHarness with
            member _.Run(room, seed) =
                task {
                    let ctx: IntrCtx =
                        { Memetic = "sim:" + room.Name
                          Prompt = ""
                          Trust = ""
                          Log = ""
                          Otel = System.Diagnostics.ActivityContext() }

                    let! final =
                        (SoftScheduler.drive room.Handlers (room.Source seed)).Run ctx seed (room.Initial seed) room.Budget

                    let signedOff =
                        match final with
                        | Ok s -> room.Resolved s
                        | Error _ -> false

                    return
                        { Room = room.Name
                          Ticks = room.Budget
                          Final = final
                          SignedOff = signedOff }
                } }

    /// Convenience: build a room over the null/DST membrane (`SoftScheduler.seedSource`).
    let room
        (name: string)
        (initial: int64 -> 'S)
        (handlers: SoftScheduler.Handler<'S> list)
        (budget: int)
        (resolved: 'S -> bool)
        : Room<'S> =
        { Name = name
          Initial = initial
          Handlers = handlers
          Source = SoftScheduler.seedSource
          Budget = budget
          Resolved = resolved }

    /// Swap the room's membrane (its parameters) — e.g. a recorded real-IO replay
    /// (`RecordedSource.replay r |> withSource room` makes the SAME room run against real crossings).
    let withSource (source: int64 -> SoftScheduler.Source) (r: Room<'S>) : Room<'S> = { r with Source = source }

    /// Run a room on the default harness (the common path).
    let run (r: Room<'S>) (seed: int64) : Task<RoomReport<'S>> = harness.Run(r, seed)
