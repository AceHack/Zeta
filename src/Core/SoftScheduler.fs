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

    // ── The CO-OWNED corner — `T Feedback In`, additive 2026-08-17 ────────────────────────────────
    // Design + research: `docs/research/2026-08-17-t-feedback-in-the-co-owned-fourth-corner-at-the-
    // tick-boundary.md`. Work item 081M08WE9R3087G0R003PAK63F; measurement it closes against is
    // register row R-1a (PR #11660) and workitem 081M08S4DQC087G0R002SH0C88.
    //
    // A tick boundary runs THREE of the four corners: `T In` (the matched `InterruptKind`), `T Out`
    // (the new `'S` in `Result`'s Ok position), and `T Out Feedback` (`InterruptFeedback` in the
    // error position — which short-circuits rather than carries). The absent one is `T In Feedback`,
    // and `FourCorner.fs` says what it is: the **co-owned** corner, "BOTH sides contribute … each
    // side's contribution is the other side's backpressure".
    //
    // Everything below is ADDITIVE. `Handler`, `HandlerK`, `drive`, and `driveK` are untouched, the
    // same way `HandlerK` was added beside `Handler` in 2026-06-11.

    /// The co-owned corner's algebra — the ONE thing a driver needs in order to thread a channel that
    /// BOTH sides write to. **If both sides write, neither may overwrite**: without an associative
    /// merge the last writer of the tick silently wins and the corner is a race wearing a channel's
    /// clothes. Hence a monoid, and hence it is INJECTED — the driver must not pick which one.
    ///
    /// **Weight-free record, and NOT a class** (`interfaces-free-classes-earned-under-rules`): pure
    /// shape, no instance state, nothing to capture — the same shape `Handler` and `HandlerK` above
    /// already are. An `interface` was the first choice and F# refuses it here: a generic abstract
    /// member cannot be instantiated at `unit` (`FS0017`), which would have cost the trivial corner —
    /// the one that makes migration opt-in. Recorded so the choice does not read as carelessness.
    ///
    /// **Required: associativity.** `Merge (Merge a b) c = Merge a (Merge b c)`.
    /// **Optional, and the caller's to declare (DV2 #6):** commutativity and idempotence. A corner
    /// with both is a join-semilattice (CRDT, Shapiro et al. 2011) and is reorder- and
    /// redelivery-safe; `appendCorner` has neither and is therefore order-sensitive by construction.
    /// This type does not pretend otherwise.
    type CoOwnedCorner<'F> =
        { /// the identity — what the corner holds before either side has contributed
          Empty: 'F
          /// how the two sides' contributions combine; MUST be associative
          Merge: 'F -> 'F -> 'F }

    /// Build a corner from an identity and an associative merge. Associativity is the caller's
    /// obligation — it is a law, not something a constructor can check.
    let cornerOf (empty: 'F) (merge: 'F -> 'F -> 'F) : CoOwnedCorner<'F> = { Empty = empty; Merge = merge }

    /// The TRIVIAL corner — a handler with this corner is a handler with no corner. This is what
    /// makes migration opt-in rather than a sweep: `HandlerK<'S>` is `HandlerF<'S, unit>`.
    let unitCorner: CoOwnedCorner<unit> =
        { Empty = ()
          Merge = fun _ _ -> () }

    /// The append corner over lists — the telemetry-log instance (a receipt log, a signal queue).
    /// Associative; NOT commutative and NOT idempotent, so a room using it is order-sensitive at the
    /// tick boundary. Said out loud rather than discovered later.
    let appendCorner<'a> () : CoOwnedCorner<'a list> =
        cornerOf [] (fun (left: 'a list) right -> left @ right)

    /// A FOUR-CORNER handler: the arrival, the co-owned corner **as it stands on entry** (the other
    /// side's contributions so far), then the ordinary ISR arrow — whose Ok position now carries the
    /// new state AND this tick's own contribution to the corner. The Error position is unchanged.
    ///
    /// Reading the corners off the signature is the point of writing it this way:
    ///   • `T In`           — the `InterruptKind` argument
    ///   • `T In Feedback`  — the `'F` argument (inbound) and the `'F` in the returned pair (outbound)
    ///   • `T Out`          — the `'S` in the returned pair
    ///   • `T Out Feedback` — `InterruptFeedback`, still short-circuiting
    ///
    /// Anchor (Beacon), checked and with its difference named: Hughes 2000 / Paterson's `ArrowLoop`,
    /// `loop : a (b,d) (c,d) -> a b c` — an arrow whose input and output both carry an extra `d`,
    /// tied back. Same shape; NOT the same semantics — `loop` ties `d` within one invocation (a
    /// value-recursive knot needing laziness), while `driveF` ties it across successive ticks. The
    /// sequential tie's own name is Mealy (1955), and that is what this implements.
    type HandlerF<'S, 'F> =
        { Name: string
          Matches: InterruptKind -> bool
          RunF: InterruptKind -> 'F -> ISR<'S, 'S * 'F> }

    /// Build a four-corner handler.
    let handlerF (name: string) (matches: InterruptKind -> bool) (runF: InterruptKind -> 'F -> ISR<'S, 'S * 'F>) : HandlerF<'S, 'F> =
        { Name = name; Matches = matches; RunF = runF }

    /// Embed an arrival-aware handler as a four-corner handler over the trivial corner. This is the
    /// migration path: no existing `HandlerK` site has to move, and each one opts in by choosing a
    /// non-trivial `'F`. The law that makes it a path rather than a hope — `driveF unitCorner
    /// (List.map ofHandlerK hs) source` ≡ `driveK hs source` modulo the `* unit` — is measured in
    /// `tests/Tests.FSharp/FourCornerTickBoundary.Tests.fs` (FIN-2).
    let ofHandlerK (h: HandlerK<'S>) : HandlerF<'S, unit> =
        { Name = h.Name
          Matches = h.Matches
          RunF =
            fun intr _corner ctx st ->
                task {
                    let! res = h.RunK intr ctx st
                    return res |> Result.map (fun s -> s, ())
                } }

    /// Drive four-corner handlers — the SAME single cooperative loop as `driveK` (DoP=1,
    /// deterministic, stops on the first `Error`), with the co-owned corner threaded alongside `'S`
    /// and each handler's contribution merged in.
    ///
    /// The return type is the EXISTING port at `'S * 'F`, not a new one. That is load-bearing rather
    /// than tidy: the corner lands inside the value `TickBoundaryProbe` compares, so information
    /// travelling on it is *observable to the instrument* — which is exactly what an unread `-> unit`
    /// sink is not (TICK-4's blind spot #1). The corner's opening value arrives as the `'F` half of
    /// `initial`, so the consumer's first contribution is a declared parameter and is reset per run
    /// by construction (§13 noninterference; DST replays it).
    let driveF (corner: CoOwnedCorner<'F>) (handlers: HandlerF<'S, 'F> list) (source: Source) : ISoftScheduler<'S * 'F> =
        let hs = List.toArray handlers
        { new ISoftScheduler<'S * 'F> with
            member _.Run ctx seed initial budget =
                task {
                    let mutable state = fst initial
                    let mutable coOwned = snd initial
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
                                    let! res = h.RunF intr coOwned ctx state
                                    match res with
                                    | Ok(s, contribution) ->
                                        state <- s
                                        coOwned <- corner.Merge coOwned contribution
                                    | Error e -> err <- Some e
                                hI <- hI + 1
                            a <- a + 1
                        n <- n + 1
                    match err with
                    | Some e -> return Error e
                    | None -> return Ok(state, coOwned)
                } }

    /// Package a tick's outcome as the LITERAL four-corner object — the very same
    /// `FourCorner.FourCornerOwnership` that `WSet.FourCornerTrace.toFourCorner` returns, instantiated
    /// at the tick boundary instead of over a `WSet`. **One object, two instantiations**: nothing new
    /// is defined here, so if anyone later forks the shape the compiler says so.
    ///
    /// Honest limit, because the stronger claim is tempting and is not made: sharing the corner OBJECT
    /// is not instantiating the TRACE. `FourCornerTrace`'s invariant is
    /// `Emitted = consolidate (gen after history)` — feedback moves an interpretation `'I` and the
    /// generator re-reads a retained `'H`. A room's `'S` is not an `('I, 'H)` pair; it is advanced
    /// forward. Making a tick a literal trace is a state split, not a rename. See §4 of the design doc.
    let toFourCorner
        (intr: InterruptKind)
        (outcome: Result<'S * 'F, InterruptFeedback>)
        : FourCorner.FourCornerOwnership<InterruptKind, 'S, InterruptFeedback, 'F> =
        match outcome with
        | Ok(state, coOwned) ->
            FourCorner.ofIn intr
            |> FourCorner.withOut state
            |> FourCorner.withInFeedback coOwned
        | Error e -> FourCorner.ofIn intr |> FourCorner.withOutFeedback e
