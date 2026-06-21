namespace Zeta.Core

/// Ben — **the ben verb, slice 1: exact meters + the prediction grader** (081KTSZN10008QG0R001F0B5A6; Aaron: "make
/// ben(chmark) as easy as measure… see how good our PREDICTION is"). This slice carries only
/// what is EXACT and DST-clean — no wall clock, no GC counters. THE GLASS-SIDE RULING (Aaron
/// 2026-06-11, verbatim: "glass-side only no wall clock in the room"): wall-clock time NEVER
/// enters the sealed room — statistical timing lives entirely in the out-of-process lanes
/// (BenchmarkDotNet senior adapter; EventPipe/dotnet-trace attach through the glass), and the
/// double-run boundary mechanically refuses any smuggled clock (see the falsifier in
/// TestLoop.Host.fs). In-room meters are the exact pair only: ticks + allocBytes. The chip8 emu
/// is the easy case on purpose: tick counts and Frame-map sizes are deterministic, replayable,
/// byte-stable.
///
/// THE GRADER closes the loop the ComplexityRegistry opened: every declared O(…) row is a
/// PREDICTION; feed `infer` cost samples at doubling sizes (n, 2n, 4n, …) and it names the
/// empirical growth class; `grade` compares prediction to measurement:
///   CONFIRMED (measured = declared) · TIGHTER (measured grows slower — the WHY undersold) ·
///   VIOLATED (measured grows faster — the WHY lied: a priced bug, the spiral-escape class).
[<RequireQualifiedAccess>]
module Ben =

    /// The exact chip8 meter — every field deterministic from (seed, rom, steps).
    type Chip8Meter =
        { Steps: int
          MemEntries: int
          DisplayLit: int
          ExtraEntries: int
          StackDepth: int
          Faulted: bool }

    /// Run `steps` ticks and meter the result — the emu's native benchmark (ticks, not seconds).
    let chip8Ticks (steps: int) (f0: Chip8Cow.Frame) : Chip8Meter =
        let mutable final = f0
        for _ in 1 .. max 0 steps do
            final <- Chip8Cow.step final
        { Steps = max 0 steps
          MemEntries = Map.count final.Mem
          DisplayLit = final.Display |> Map.filter (fun _ v -> v) |> Map.count
          ExtraEntries = Map.count final.Extra
          StackDepth = List.length final.Stack
          Faulted = final.Fault.IsSome }

    /// The growth classes the grader can name. Loglinear added per the math-team review (the
    /// registry declares O(n·log n) rows; a grader that cannot say it misgrades them).
    type Growth =
        | Constant
        | Linear
        | Loglinear
        | Quadratic
        | Superquadratic

    /// Infer the growth class — REWRITTEN per the math-team P0s (2026-06-11): the old
    /// mean-of-doubling-ratios fabricated verdicts (n^1.5 → "Superquadratic" → a fake priced
    /// bug; zero interior costs → confident garbage; never read the sizes). Now: log₂-log₂
    /// ordinary-least-squares SLOPE over the actual (size, cost) pairs, gated by
    ///   · all sizes strictly increasing, all costs > 0 (else refuse)
    ///   · ≥ 3 samples and span (max/min size) ≥ 8 (preasymptotic refusal)
    ///   · R² ≥ 0.99 (noise refusal — two ratios are not a measurement)
    ///   · slope must land IN a band; the gaps between bands REFUSE (no dead-band guessing):
    ///     Constant |s|<0.25 · Linear 0.75–1.05 · Loglinear 1.05–1.40 · Quadratic 1.75–2.25 ·
    ///     Superquadratic >2.60. n^1.5 (s≈1.5) now returns None — unclassified, honestly.
    let infer (samples: (int * int64) list) : Growth option =
        let sizesOk =
            samples |> List.pairwise |> List.forall (fun ((n1, _), (n2, _)) -> n2 > n1)
        let costsOk = samples |> List.forall (fun (n, c) -> n > 0 && c > 0L)
        if List.length samples < 3 || not sizesOk || not costsOk then None
        else
            let n0 = fst (List.head samples)
            let nK = fst (List.last samples)
            if nK / n0 < 8 then None // minimum span: refuse the preasymptotic
            else
                let pts = samples |> List.map (fun (n, c) -> log (float n) / log 2.0, log (float c) / log 2.0)
                let k = float (List.length pts)
                let sx = pts |> List.sumBy fst
                let sy = pts |> List.sumBy snd
                let sxx = pts |> List.sumBy (fun (x, _) -> x * x)
                let sxy = pts |> List.sumBy (fun (x, y) -> x * y)
                let denom = k * sxx - sx * sx
                if abs denom < 1e-12 then None
                else
                    let slope = (k * sxy - sx * sy) / denom
                    let intercept = (sy - slope * sx) / k
                    let ssTot = pts |> List.sumBy (fun (_, y) -> (y - sy / k) ** 2.0)
                    let ssRes = pts |> List.sumBy (fun (x, y) -> (y - (slope * x + intercept)) ** 2.0)
                    let r2 = if ssTot < 1e-12 then 1.0 else 1.0 - ssRes / ssTot
                    if r2 < 0.99 then None // noisy fit: refuse, never a guess
                    elif abs slope < 0.25 then Some Constant
                    elif slope >= 0.75 && slope <= 1.05 then Some Linear
                    elif slope > 1.05 && slope <= 1.40 then Some Loglinear
                    elif slope >= 1.75 && slope <= 2.25 then Some Quadratic
                    elif slope > 2.60 then Some Superquadratic
                    else None // the gaps refuse — no dead-band ever fabricates a class

    /// The verdict on one prediction.
    type Grade =
        | Confirmed
        | Tighter // measured grows SLOWER than declared — the WHY undersold; update it
        | Violated // measured grows FASTER than declared — the WHY lied; a priced bug

    let private rank =
        function
        | Constant -> 0
        | Linear -> 1
        | Loglinear -> 2
        | Quadratic -> 3
        | Superquadratic -> 4

    /// Compare the declared class (the ComplexityRegistry's prediction) to the measured one.
    /// REGISTER NOTE (math team): TIGHTER is ADVISORY below a 32× size span — preasymptotic data
    /// undersells honestly-declared costs; VIOLATED is bug-filing grade only with R² ≥ 0.99,
    /// span ≥ 32×, and a slope exceeding the declared band by ≥ 0.5 (the criteria live with the
    /// caller; this function is the pure comparison).
    let grade (declared: Growth) (measured: Growth) : Grade =
        if rank measured = rank declared then Confirmed
        elif rank measured < rank declared then Tighter
        else Violated

    /// THE DETERMINISTIC ALLOCATION METER (Aaron: "any free APM we can include deterministically?
    /// hook into runtime stuff?"). .NET's one truly replay-stable profiling hook:
    /// `GC.GetAllocatedBytesForCurrentThread()` — EXACT bytes allocated by THIS thread, excluding
    /// other threads and native JIT work. For deterministic code, allocation is deterministic —
    /// so the meter double-runs like everything else. `warmups` runs first (tiered-JIT first-call
    /// allocations are the one impurity; burn them before measuring). Wall TIME is never
    /// deterministic — that stays statistical (BenchmarkDotNet, the senior adapter; EventPipe/
    /// dotnet-trace/PerfView = the offline lane; OpenTelemetry = observability, not measurement).
    let allocBytes (warmups: int) (f: unit -> 'a) : int64 =
        for _ in 1 .. max 0 warmups do
            f () |> ignore
        let before = System.GC.GetAllocatedBytesForCurrentThread()
        f () |> ignore
        System.GC.GetAllocatedBytesForCurrentThread() - before
