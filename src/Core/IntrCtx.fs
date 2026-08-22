namespace Zeta.Core

open System.Diagnostics
open System.Threading.Tasks

/// InterruptKind — the 8 081KSNY2Z0008QG0R002HB4AGT variants representing system/operator interrupt triggers.
type InterruptKind =
    | TimerElapsed of intervalMs: int
    | RateLimitExhausted of budget: string // "rest" | "graphql"
    | OperatorMessageArrived of content: string
    | DotGitSaturation of stuckProcs: int
    | SentinelMissing
    | RoundsElapsedSinceFreeTime of n: int
    | PeerPRMerged of prNumber: int
    | CIFailureDetected of jobId: string

/// InterruptFeedback — the error channel for the ISR monad. An ISR execution can
/// either fail with a general message, or be explicitly interrupted by an InterruptKind.
type InterruptFeedback =
    | Interrupted of InterruptKind
    | Failed of string

/// IntrCtx — the 5-context Kleisli context record (memetic, prompt, trust, log, otel).
/// threads trace/audit/trust metadata explicitly without using hidden ambient state.
type IntrCtx = {
    Memetic: string
    Prompt: string
    Trust: string
    Log: string
    Otel: ActivityContext
}

/// **ISR = Interrupt Service Routine.** Spelled out 2026-08-16 because it never was: the expansion
/// appeared nowhere in the repo, and had to be inferred from `IntrCtx` / `InterruptFeedback`. Aaron,
/// who named it: *"you named it when we were working on interrupts, we should just spell it out."*
///
/// `ISR<'A, 'B>` — the **Kleisli** Arrow context monad type alias. Threads `IntrCtx` explicitly.
///
/// Two layers, and the choice of each is load-bearing:
///   * a **Reader** over `IntrCtx` — the context is threaded EXPLICITLY, never ambiently. That is
///     §13 noninterference: influence enters only through a declared channel, and an interrupt is
///     precisely the undeclared-channel failure this guards against.
///   * **Kleisli** over `Task<Result<_, InterruptFeedback>>` — specifically Kleisli, NOT the more
///     general Hughes Arrow. Since `ArrowApply ≡ Monad`, having `>>=` is what permits dispatch to
///     depend on WHICH interrupt fired — a runtime value — rather than on statically-known wiring.
///     Being the less general structure is the stronger claim here, not a weaker one.
///
/// Consequence used by `IsrLift.fs`: genuine interrupts live in `Result`'s ERROR position and
/// short-circuit under `>=>`, while ordinary per-tick state (the four corners) flows through the
/// VALUE position. Cost note: `>>=` on a runtime value is dynamic control flow — the fragment that
/// is embarrassingly parallel is the Applicative/Arrow one without `ArrowApply`. Keep the monadic
/// power at the membrane; keep the interior static.
///
/// **WHY THAT SPLIT IS LOAD-BEARING, not tidiness** (Aaron 2026-08-16, recording architecture that
/// existed only in the shape of the code). This is where prediction and pseudo-retrocausality enter:
/// speculate an input, run forward, and re-run from a saved observation when the true input arrives
/// (the GGPO / rollback shape — see `references/notes/dst-omniscience-retrocausality-prior-art-…`).
/// **Replay requires that structure be knowable independently of the values flowing through it.**
///
/// `ArrowApply`'s `app : a (a b c, b) c` — run an arrow that arrived AS DATA — destroys exactly
/// that: you cannot inspect, schedule, or re-run against a corrected input a computation you cannot
/// identify until you already hold the value you were trying to predict. So `no app ⇒ static
/// structure ⇒ inspectable ⇒ replayable ⇒ prediction and rollback are possible at all`.
///
/// The apparent contradiction — avoid `app`, yet keep monadic properties over interrupts — resolves
/// in the channel split. `Result`'s short-circuit is monadic SEQUENCING whose BRANCHING SHAPE IS
/// FIXED: two outcomes, statically known, at every `>=>`. That is categorically unlike `app`, where
/// the branch structure is whatever the value says. So the unpredictable CONTENT (which interrupt
/// fired) sits in a channel whose CONTROL FLOW is fully determined, and the surrounding computation
/// stays replayable. You get `>>=` for dispatch and never need `app` to get it.
///
/// Aaron on arriving here: *"this was actually really hard to accomplish — interrupt prediction of
/// controller input and how it affects game state … it kind of felt like magic once I finally got
/// it right, and I didn't even know to avoid `app`, it was just instinctive."* Separating
/// unpredictable VALUE from unpredictable STRUCTURE is the cut; only the second one breaks rollback.
type ISR<'A, 'B> = IntrCtx -> 'A -> Task<Result<'B, InterruptFeedback>>

[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module ISR =

    /// Kleisli composition (>=>) for ISR arrows. Threads the context and propagates
    /// errors/interrupts automatically.
    let inline (>=>) (f: ISR<'A, 'B>) (g: ISR<'B, 'C>) : ISR<'A, 'C> =
        fun ctx a ->
            task {
                let! resB = f ctx a
                match resB with
                | Ok b -> return! g ctx b
                | Error e -> return Error e
            }
