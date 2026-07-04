namespace Zeta.Core

open System.Diagnostics
open System.Threading.Tasks

/// SoftChip8Scheduler — CHIP-8 as the soft `IScheduler`'s FIRST client (Aaron 2026-06-10, shadow*).
///
/// Aaron: "can we have our CHIP-8 use our new soft IScheduler when it's built." This is that wiring.
/// CHIP-8 is the minimal honest test of the scheduler (#7529): if it can't *deterministically* schedule
/// CHIP-8 it can't schedule anything. Two CHIP-8 clock domains map onto the scheduler cleanly:
///   • the **60 Hz timer** = the scheduler's `TimerElapsed` tick (decrement Delay/Sound);
///   • the **CPU** runs faster — `CyclesPerTick` instructions per 60 Hz tick.
/// So one `TimerElapsed` ISR does both: `Chip8Cow.tick` (timers) then `SoftChip8.lookAhead cycles`
/// (a deterministic batch of CPU steps that stops at an input branch — where prediction would fork).
///
/// State = `Chip8Cow.Frame` (immutable, COW). Pure transition wrapped in the ISR arrow (Task-returning,
/// no I/O, no `Task.Run`). DST: the deterministic seed source drives it, so a ROM replays identically.
/// Pure module, no classes.
[<RequireQualifiedAccess>]
module SoftChip8Scheduler =

    /// CPU instructions per 60 Hz tick. ~540 Hz CPU (a common CHIP-8 default) ÷ 60 = 9 cycles/tick.
    [<Literal>]
    let DefaultCyclesPerTick = 9

    /// The CHIP-8 timer ISR: on each 60 Hz `TimerElapsed`, decrement the Delay/Sound timers, then advance
    /// the CPU a batch of `cyclesPerTick` instructions (stopping early at an input branch). The scheduler
    /// only invokes this when the trigger matches, so it always advances exactly one frame's worth.
    let timerIsr (cyclesPerTick: int) : ISR<Chip8Cow.Frame, Chip8Cow.Frame> =
        fun _ctx frame ->
            let ticked = Chip8Cow.tick frame
            let advanced, _hitBranch = SoftChip8.lookAhead cyclesPerTick ticked
            Task.FromResult(Ok advanced)

    /// The CHIP-8 60 Hz handler — fires on `TimerElapsed` only (ignores other interrupts so it composes
    /// with input/CI/etc. handlers in the same scheduler).
    let timerHandler (cyclesPerTick: int) : SoftScheduler.Handler<Chip8Cow.Frame> =
        SoftScheduler.handler
            "chip8-60hz"
            (function
            | TimerElapsed _ -> true
            | _ -> false)
            (timerIsr cyclesPerTick)

    /// A bare IntrCtx for the deterministic (no-trace-export) path.
    let private dstCtx: IntrCtx =
        { Memetic = "chip8"; Prompt = ""; Trust = ""; Log = ""; Otel = ActivityContext() }

    /// Run a ROM on the soft scheduler for `frames` 60 Hz ticks against the deterministic seed source
    /// (DST — null I/O). Returns the final frame (or the interrupt that stopped it). CHIP-8 = the
    /// scheduler's first client; identical (seed, rom, frames) replays identically.
    let run (seed: uint64) (rom: byte[]) (frames: int) : Task<Result<Chip8Cow.Frame, InterruptFeedback>> =
        let initial = Chip8Cow.create seed |> Chip8Cow.loadRom rom
        SoftScheduler.runDeterministic [ timerHandler DefaultCyclesPerTick ] dstCtx (int64 seed) initial frames

    /// Run with a custom cycles-per-tick (e.g. for a slower/faster CPU clock).
    let runWith (cyclesPerTick: int) (seed: uint64) (rom: byte[]) (frames: int) : Task<Result<Chip8Cow.Frame, InterruptFeedback>> =
        let initial = Chip8Cow.create seed |> Chip8Cow.loadRom rom
        SoftScheduler.runDeterministic [ timerHandler cyclesPerTick ] dstCtx (int64 seed) initial frames

    // ── Thermodynamic telemetry (ComputeReceipt wiring) ───────────────────────────────────────────
    //
    // The CHIP-8 scheduler is the FIRST client to emit ComputeReceipts.
    //
    // The prior is the SoftValue over the fork candidates *before* running the frames:
    //   • At an input branch: uniform 0.5/0.5 over key-down / key-up successors (PC addresses).
    //   • Deterministic: point-mass 1.0 over the single successor.
    // The posterior is the committed branch after the run completes (point-mass 1.0 at the final PC).
    //
    // IV = KL(posterior || prior) = ln(2) nats when resolving one input branch, 0 when deterministic.
    //
    // This measures exactly one thing: how much uncertainty about the next branch was resolved per run.
    // The CHIP-8 AI is the Maxwell's demon at the instruction level — it sorts branch uncertainty
    // using compute, and the receipt tells us how efficiently it did so vs. the Landauer limit.

    /// Build the prior SoftValue for a frame: uniform over fork candidates (or point-mass if deterministic).
    /// Uses the PC of each fork successor as the SoftValue key — the branch address is the uncertain quantity.
    let private framePrior (f: Chip8Cow.Frame) : SoftValue.SoftValue option =
        let forks = SoftChip8.forkOnInput f
        let weighted = forks |> List.map (fun (succ, w) -> DynamicValue.Int (int64 succ.PC), w)
        SoftValue.ofWeighted weighted

    /// Build the posterior SoftValue for a committed frame: point-mass at the committed PC.
    let private framePosterior (committed: Chip8Cow.Frame) : SoftValue.SoftValue option =
        SoftValue.ofWeighted [ DynamicValue.Int (int64 committed.PC), 1.0 ]

    /// Run a ROM for `frames` 60 Hz ticks and emit a ComputeReceipt measuring the information
    /// purchased (uncertainty resolved about the next branch) vs. the compute spent.
    ///
    /// Returns the final frame result AND a ComputeReceipt option.
    /// The receipt is None only if the prior/posterior SoftValue construction fails (degenerate ROM).
    ///
    /// This is the first live client of the thermodynamic accounting system:
    ///   DeltaU = IV - DeltaJ  (net useful work)
    ///   Heat   = DeltaJ when IV ≈ 0  (wasted compute on deterministic frames)
    ///   LandauerRatio = DeltaJ / IV  (efficiency vs. the Landauer limit)
    let runWithReceipt
        (seed: uint64)
        (rom: byte[])
        (frames: int)
        : Task<Result<Chip8Cow.Frame, InterruptFeedback> * ComputeReceipt.Receipt option> =
        task {
            let initial = Chip8Cow.create seed |> Chip8Cow.loadRom rom
            // Capture prior before the run (uncertainty about the first branch in the ROM).
            let priorOpt = framePrior initial
            let! result = SoftScheduler.runDeterministic [ timerHandler DefaultCyclesPerTick ] dstCtx (int64 seed) initial frames
            // Capture posterior from the committed final frame.
            let finalFrame =
                match result with
                | Ok f -> f
                | Error _ -> initial // on interrupt, use initial as fallback for the receipt
            let posteriorOpt = framePosterior finalFrame
            // Compute the receipt: ticks = frames, bytesPerTick = CHIP-8 memory footprint (4 KiB).
            let receipt =
                match priorOpt, posteriorOpt with
                | Some prior, Some posterior -> ComputeReceipt.compute prior posterior frames 4096L
                | _ -> None
            return result, receipt
        }
