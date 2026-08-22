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

/// ISR<'A, 'B> — the Kleisli Arrow context monad type alias. Threads IntrCtx explicitly.
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
