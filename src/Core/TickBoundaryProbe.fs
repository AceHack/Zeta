namespace Zeta.Core

open System.Threading.Tasks

/// **TickBoundaryProbe — the instrument for `R-1a`'s load-bearing premise: is the tick-boundary
/// trace COMPLETE?**
///
/// Aaron 2026-08-17: *"retrocausality hides in the forces trace but i think the four corner ownership
/// trace makes it 'impossible to hide' retrocausality which is why it's also psudo there."* That
/// argument does not forbid a backward influence; it forbids a **hidden** one — anything real would
/// have to surface as a declared corner. Which makes the whole argument conditional on one property:
/// **every influence crossing a tick boundary appears in a declared channel.** This module measures
/// that property instead of assuming it.
///
/// **The declared channels at the tick boundary** (`SoftScheduler.drive` / `driveK`) are exactly four:
/// the seed, the injected `Source` (`int -> InterruptKind list`), the threaded state `'S`, and the
/// `IntrCtx` handed to every arrow. `Result`'s error position (`InterruptFeedback`) is the fifth, and
/// it short-circuits rather than carries. **Nothing constrains what a handler CLOSES OVER** — the type
/// `ISR<'S,'S> = IntrCtx -> 'S -> Task<Result<'S,_>>` says nothing about the closure environment, so a
/// handler may read and write state that is in none of those channels. That is the gap this probes.
///
/// **The measurement.** `SoftScheduler.driveK`'s contract is *"same room, same seed ⇒ same report"*,
/// and that contract is a claim about the DECLARED channels alone. So: run the same room, with the
/// same seed, twice **in the same process**, and compare. Every declared channel is identical by
/// construction across the two runs — therefore any difference in the outcome was carried by something
/// that is not one of them. A divergence is not a heuristic here; it is a *witness*.
///
/// **This probe CONVICTS, NEVER ACQUITS — read the `DeclaredOnly` verdict as "not detected", not as
/// "clean".** Three ways a real undeclared crossing stays invisible to it, named so nobody rounds a
/// negative up into a proof:
///   1. **Idempotent leaks.** A handler that writes the same value into a captured cell every run
///      leaks information and diverges never. (`ReceiptScheduler`'s `onReceipt` egress is exactly this
///      shape when the sink is append-only-and-unread.)
///   2. **Read-only ambient reads.** A handler reading an ambient constant (a file, an env var) that
///      does not change between the two runs is undeclared and undetected.
///   3. **Structural equality.** `'S` is compared with F# structural equality; a `'S` holding a
///      mutable array compares by *contents*, so an aliased buffer that ends at the same contents
///      reads as equal.
/// Symmetrically, `UndeclaredDetected` is sound: the declared channels were held fixed, so there is
/// no innocent reading of a difference. One-way inference, the same shape as `AntiSybil` — see
/// [`dual-use-detection-is-neutral-oracle-decides`]. The probe reports the FACT and attaches no
/// verdict: a divergence may be a bug, a deliberate cache, or a legitimate cross-run memo. That call
/// belongs to the caller's oracle.
///
/// Anchor (Beacon): Goguen & Meseguer, *Security Policies and Security Models* (IEEE S&P 1982) —
/// **noninterference**: high-level input must not affect low-level observation. Running twice with the
/// declared inputs pinned and comparing the observation is the operational form of that definition,
/// and it is manifesto §13 stated as a test rather than as a principle.
[<RequireQualifiedAccess>]
module TickBoundaryProbe =

    /// What the probe saw. Neutral facts — no verdict attached (the mechanism does not decide whether
    /// a crossing is a defect; the caller's oracle does).
    type Crossing<'S> =
        /// Every repeat produced an identical outcome. **"Not detected", not "no undeclared channel"**
        /// — see the three blind spots in the module docstring.
        | DeclaredOnly of outcome: Result<'S, InterruptFeedback>
        /// Two runs with byte-identical declared channels produced different outcomes. Something not
        /// in {seed, Source, 'S, IntrCtx} carried information from the first run into the second.
        | UndeclaredDetected of runIndex: int * first: Result<'S, InterruptFeedback> * differing: Result<'S, InterruptFeedback>

    /// Is this a detected crossing? (convenience for assertions)
    let detected (c: Crossing<'S>) : bool =
        match c with
        | DeclaredOnly _ -> false
        | UndeclaredDetected _ -> true

    /// The canonical `IntrCtx` the probe hands to every run — identical across repeats, so the context
    /// channel is pinned along with the other three.
    let probeCtx (label: string) : IntrCtx =
        { Memetic = "tick-boundary-probe:" + label
          Prompt = ""
          Trust = ""
          Log = ""
          Otel = System.Diagnostics.ActivityContext() }

    /// Probe ANY scheduler on the port: run `repeats` times over the SAME seed, SAME initial value,
    /// SAME budget, and compare every outcome to the first. `probeHandlers` and the four-corner
    /// `driveF` shape both go through this, so there is ONE instrument rather than a family of them.
    ///
    /// Both `sched` and `initial` are *thunks* on purpose: a shared scheduler object or a shared
    /// mutable initial value would itself be an undeclared channel between the repeats, and the probe
    /// would then be measuring its own instrument.
    let probeScheduler
        (label: string)
        (sched: unit -> SoftScheduler.ISoftScheduler<'T>)
        (seed: int64)
        (initial: unit -> 'T)
        (budget: int)
        (repeats: int)
        : Task<Crossing<'T>> =
        task {
            let ctx = probeCtx label
            let! first = (sched ()).Run ctx seed (initial ()) budget
            let mutable verdict = DeclaredOnly first
            let mutable i = 1
            while i < repeats && not (detected verdict) do
                let! again = (sched ()).Run ctx seed (initial ()) budget
                if again <> first then
                    verdict <- UndeclaredDetected(i, first, again)
                i <- i + 1
            return verdict
        }

    /// Probe a handler set directly: run `repeats` times over the SAME seed, SAME source, SAME initial
    /// state, SAME budget, and compare every outcome to the first.
    ///
    /// `initial` is a *thunk* on purpose: a shared mutable initial value would itself be an undeclared
    /// channel between the repeats, and the probe would then be measuring its own instrument.
    let probeHandlers
        (label: string)
        (handlers: SoftScheduler.HandlerK<'S> list)
        (source: SoftScheduler.Source)
        (seed: int64)
        (initial: unit -> 'S)
        (budget: int)
        (repeats: int)
        : Task<Crossing<'S>> =
        probeScheduler label (fun () -> SoftScheduler.driveK handlers source) seed initial budget repeats

    /// Probe a `SimFramework.Room` — the shipped room shape. `Room.Initial : int64 -> 'S` is already a
    /// function of the seed, so the room type gives the fresh-initial-state property for free.
    let probeRoom (room: SimFramework.Room<'S>) (seed: int64) (repeats: int) : Task<Crossing<'S>> =
        task {
            let ctx = probeCtx room.Name
            let run () =
                (SoftScheduler.drive room.Handlers (room.Source seed)).Run ctx seed (room.Initial seed) room.Budget

            let! first = run ()
            let mutable verdict = DeclaredOnly first
            let mutable i = 1
            while i < repeats && not (detected verdict) do
                let! again = run ()
                if again <> first then
                    verdict <- UndeclaredDetected(i, first, again)
                i <- i + 1
            return verdict
        }

    /// Probe an arbitrary *estimator-shaped* function — anything of the form `'In -> 'Out` that a room
    /// installs into a handler list (`Chip8PredictionRoom.BeliefEstimator`, `Vision.BranchEstimator`,
    /// a `ControlScheme` reader). These are the population where the defect shape found by the
    /// continuation-boundary audit lives: a member of a class with a `let mutable` field, handed to a
    /// handler as a plain function value, is state crossing the boundary **outside `'S`** while the
    /// type claims to be a pure function of its argument.
    ///
    /// Same one-way inference: unequal ⇒ not a function of its declared argument. Equal ⇒ nothing seen.
    let probeEstimator (f: 'In -> 'Out) (input: 'In) (repeats: int) : Crossing<'Out> =
        let first = Ok(f input)
        let mutable verdict = DeclaredOnly first
        let mutable i = 1
        while i < repeats && not (detected verdict) do
            let again = Ok(f input)
            if again <> first then
                verdict <- UndeclaredDetected(i, first, again)
            i <- i + 1
        verdict
