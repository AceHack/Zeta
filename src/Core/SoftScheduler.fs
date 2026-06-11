namespace Zeta.Core

open System.Threading.Tasks

/// SoftScheduler — the soft `IScheduler` on the ISR arrow (Aaron 2026-06-10, shadow*).
///
/// "I'm working on a soft thread scheduler ... a soft `IScheduler` we can use inside of rooms ... we
/// have the start of one in our CHIP-8 interrupt handler — it's soft using the arrow category from
/// category theory."
///
/// The kernel is `IntrCtx.ISR<'A,'B>` (the Kleisli arrow = the soft promise; its `Task` = the future).
/// The scheduler drives a set of registered ISR handlers over a tick budget. Faithful to the six
/// disciplines:
///   • Scale-free / DST — beautiful on ONE thread: a single cooperative loop (DoP=1), no locks, no
///     `Task.Run`; the same (seed, budget, source) replays identically (FoundationDB run-loop). DoP=N
///     ferry is the named extension, NOT faked here (one small move at a time).
///   • Lock/wait-free — genuinely async (awaits each ISR; yields while I/O is in flight), no blocking.
///   • The interrupt SOURCE is INJECTED (the room's Markov-blanket crossing): inject the null/seed
///     source for DST (test the Zeta entropy alone, from the seed) — inject real IEffects
///     (Reticulum/disk) for prod. Same code path; the source is a parameter of the room.
///
/// Pure module + one free interface (interfaces free, classes earned under rules/); no classes.
[<RequireQualifiedAccess>]
module SoftScheduler =

    /// A registered handler — one of the unrolled, single-threaded repeating-pattern loops. When an
    /// arriving `InterruptKind` matches, its ISR arrow advances the scheduler state. (`'S -> 'S` shape:
    /// each handler is an endo-arrow on the shared state, composable via `>=>`.)
    type Handler<'S> =
        { Name: string
          Matches: InterruptKind -> bool
          Run: ISR<'S, 'S> }

    /// Build a handler.
    let handler (name: string) (matches: InterruptKind -> bool) (run: ISR<'S, 'S>) : Handler<'S> =
        { Name = name; Matches = matches; Run = run }

    /// The injected interrupt source: tick index -> the interrupts arriving on that tick. This IS the
    /// room boundary — inject `seedSource` (null/deterministic) for DST, a real-IEffects source for prod.
    type Source = int -> InterruptKind list

    /// The DST default — a deterministic null source derived from the seed alone (no I/O), the same way
    /// `Sim.tick` derives its entropy, so the schedule replays identically. Fires the 60Hz `TimerElapsed`
    /// every tick (the CHIP-8 timer) and deterministically raises an occasional `OperatorMessageArrived`
    /// from the avalanched (seed, tick) hash — exercising more than one handler without any real input.
    let seedSource (seed: int64) : Source =
        fun n ->
            // Fold the tick index into the seed via the golden-ratio increment, then run it through the
            // canonical `SplitMix64.mix` (the ONE place the avalanche constants + their provenance live —
            // arxiv 1410.0530) so the WHOLE seed (incl. low bits) reaches the decision bits. (A naive
            // `seed ^^^ n*k` leaves low-bit seed differences invisible after a right shift — the bug this
            // replaced.) Reusing SplitMix64.mix instead of re-inlining the constants per the DRY rule.
            let h = SplitMix64.mix (uint64 seed + uint64 n * SplitMix64.GoldenRatio)
            let timer = [ TimerElapsed 17 ] // ~1/60s
            if h &&& 0xFUL = 0UL then
                timer @ [ OperatorMessageArrived(sprintf "tick-%d" n) ]
            else
                timer

    /// The soft scheduler — runs registered ISR handlers over a tick budget, threading state. The
    /// future is the returned `Task`; an `Error` (a real interrupt or failure) stops the run and
    /// surfaces — the room does not silently swallow it.
    type ISoftScheduler<'S> =
        abstract member Run: ctx: IntrCtx -> seed: int64 -> initial: 'S -> budget: int -> Task<Result<'S, InterruptFeedback>>

    /// Drive — the single cooperative loop (DoP=1, deterministic). Per tick: ask the source what
    /// arrived, then fold the state through every matching handler's ISR arrow, in (arrival × handler)
    /// registration order. Genuinely async: `let!` awaits each ISR (the loop yields while the arrow's
    /// I/O is in flight) — no `Task.Run`, no `.Result`, no locks. Stops on the first `Error`.
    let drive (handlers: Handler<'S> list) (source: Source) : ISoftScheduler<'S> =
        let hs = List.toArray handlers
        { new ISoftScheduler<'S> with
            member _.Run ctx seed initial budget =
                task {
                    let mutable state = initial
                    let mutable err: InterruptFeedback option = None
                    let mutable n = 0
                    while n < budget && Option.isNone err do
                        let arrivals = source n |> List.toArray
                        let mutable a = 0
                        while a < arrivals.Length && Option.isNone err do
                            let intr = arrivals.[a]
                            let mutable hI = 0
                            while hI < hs.Length && Option.isNone err do
                                let h = hs.[hI]
                                if h.Matches intr then
                                    let! res = h.Run ctx state
                                    match res with
                                    | Ok s -> state <- s
                                    | Error e -> err <- Some e
                                hI <- hI + 1
                            a <- a + 1
                        n <- n + 1
                    match err with
                    | Some e -> return Error e
                    | None -> return Ok state
                } }

    /// Convenience: drive `handlers` against the deterministic seed source for `budget` ticks (the DST
    /// path — null I/O). Returns the final state or the interrupt that stopped it.
    let runDeterministic (handlers: Handler<'S> list) (ctx: IntrCtx) (seed: int64) (initial: 'S) (budget: int) : Task<Result<'S, InterruptFeedback>> =
        (drive handlers (seedSource seed)).Run ctx seed initial budget

    // ── Arrival-AWARE handlers (additive, 2026-06-11; discovered by the MeshPong lockstep demo) ──
    // `Handler.Run` never sees the arrival itself, so a room cannot read a crossing's PAYLOAD (e.g. an
    // input message). `HandlerK` passes the matched `InterruptKind` to the arrow — needed by any room
    // that folds message contents (lockstep inputs, operator messages). `Handler`/`drive` untouched.

    /// An arrival-aware handler: `RunK` receives the matched crossing (its content), then the state.
    type HandlerK<'S> =
        { Name: string
          Matches: InterruptKind -> bool
          RunK: InterruptKind -> ISR<'S, 'S> }

    /// Build an arrival-aware handler.
    let handlerK (name: string) (matches: InterruptKind -> bool) (runK: InterruptKind -> ISR<'S, 'S>) : HandlerK<'S> =
        { Name = name; Matches = matches; RunK = runK }

    /// Drive arrival-aware handlers — same single cooperative loop as `drive` (DoP=1, deterministic,
    /// stops on first Error), but the matched arrival is handed to the arrow.
    let driveK (handlers: HandlerK<'S> list) (source: Source) : ISoftScheduler<'S> =
        let hs = List.toArray handlers
        { new ISoftScheduler<'S> with
            member _.Run ctx seed initial budget =
                task {
                    let mutable state = initial
                    let mutable err: InterruptFeedback option = None
                    let mutable n = 0
                    while n < budget && Option.isNone err do
                        let arrivals = source n |> List.toArray
                        let mutable a = 0
                        while a < arrivals.Length && Option.isNone err do
                            let intr = arrivals.[a]
                            let mutable hI = 0
                            while hI < hs.Length && Option.isNone err do
                                let h = hs.[hI]
                                if h.Matches intr then
                                    let! res = h.RunK intr ctx state
                                    match res with
                                    | Ok s -> state <- s
                                    | Error e -> err <- Some e
                                hI <- hI + 1
                            a <- a + 1
                        n <- n + 1
                    match err with
                    | Some e -> return Error e
                    | None -> return Ok state
                } }
