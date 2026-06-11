namespace Zeta.Core

/// Ben — **the ben verb, slice 1: exact meters + the prediction grader** (B-1039; Aaron: "make
/// ben(chmark) as easy as measure… see how good our PREDICTION is"). This slice carries only
/// what is EXACT and DST-clean — no wall clock, no GC counters (those are the dotnet-room slice,
/// behind the boundary with the red light). The chip8 emu is the easy case on purpose: tick
/// counts and Frame-map sizes are deterministic, replayable, byte-stable.
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
        let final = [ 1 .. max 0 steps ] |> List.fold (fun f _ -> Chip8Cow.step f) f0
        { Steps = max 0 steps
          MemEntries = Map.count final.Mem
          DisplayLit = final.Display |> Map.filter (fun _ v -> v) |> Map.count
          ExtraEntries = Map.count final.Extra
          StackDepth = List.length final.Stack
          Faulted = final.Fault.IsSome }

    /// The growth classes the grader can name (slice 1: the doubling-ratio set).
    type Growth =
        | Constant
        | Linear
        | Quadratic
        | Superquadratic

    /// Infer the growth class from cost samples at DOUBLING sizes [(n,c); (2n,c'); (4n,c'')…]:
    /// classify the mean doubling ratio against 1 / 2 / 4 (nearest wins; >6 ⇒ Superquadratic).
    /// Needs ≥ 2 samples; degenerate inputs return None (refusal, not a guess).
    let infer (samples: (int * int64) list) : Growth option =
        match samples with
        | (_, c0) :: _ when c0 > 0L && List.length samples >= 2 ->
            let ratios =
                samples
                |> List.pairwise
                |> List.map (fun ((_, a), (_, b)) -> float b / float a)
            let mean = List.average ratios
            if mean > 6.0 then Some Superquadratic
            elif abs (mean - 4.0) < 1.0 then Some Quadratic
            elif abs (mean - 2.0) < 0.7 then Some Linear
            elif abs (mean - 1.0) < 0.35 then Some Constant
            else Some Superquadratic
        | _ -> None

    /// The verdict on one prediction.
    type Grade =
        | Confirmed
        | Tighter // measured grows SLOWER than declared — the WHY undersold; update it
        | Violated // measured grows FASTER than declared — the WHY lied; a priced bug

    let private rank =
        function
        | Constant -> 0
        | Linear -> 1
        | Quadratic -> 2
        | Superquadratic -> 3

    /// Compare the declared class (the ComplexityRegistry's prediction) to the measured one.
    let grade (declared: Growth) (measured: Growth) : Grade =
        if rank measured = rank declared then Confirmed
        elif rank measured < rank declared then Tighter
        else Violated
