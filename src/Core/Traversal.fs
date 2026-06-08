namespace Zeta.Core

/// **`Traversal` — an uncertainty-reduction unit: cost + control loop + its relevant lenses (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"the window = solid ground + pointers to the traversals that reduce uncertainty of stuff outside the
/// context window… those traversals will have a **cost** and a **control loop** attached, along with several
/// **top-k lenses** that are most relevant to that uncertainty-reduction loop."*
///
/// A `Traversal` is the first-class thing a context-window *pointer* (#7135) points at: a packaged way to resolve
/// some out-of-window uncertainty. It carries
///   - **`Cost`** — the resources to run it (the caching cost-tier, #7134: ambient ≈ 0, expensive = traversal +
///     oscillation);
///   - **`Lenses`** — the top-k lenses (`LensRouter`) most relevant to *this* uncertainty-reduction loop (each
///     traversal has its own bounded relevant set, not the global one);
///   - **`ExpectedReduction`** — how much uncertainty it's expected to remove (entropy drop / solid-ground gain);
///   - **`Run`** — the control loop itself (e.g. a `ControlMerge`/`SoftDrive`/`Fixpoint` oscillation that settles
///     to the resolved clarity).
///
/// You don't run them all — you **schedule by value-of-information** (`voi = reduction / cost`) under a budget:
/// run the traversal whose uncertainty-reduction most exceeds its cost (active sensing). That is how a bounded
/// agent decides which out-of-window clarity is worth fetching now.
///
/// **Honest scope (peel):** `ExpectedReduction`/`Cost` are *estimates* the scheduler trusts (mis-estimates ⇒
/// wrong priority — calibrate against realized reduction). `schedule` is greedy-by-VOI under an additive cost
/// budget (a knapsack heuristic, not optimal). `Run` is generic `'r` (the resolved value). Deterministic (DST).
/// Anchors: value-of-information / active sensing; the cost-tier caching (#7134); `LensRouter` (the relevant set).
[<RequireQualifiedAccess>]
module Traversal =

    /// A packaged uncertainty-reduction traversal (what a context-window pointer points at).
    type Traversal<'r> =
        { Name: string
          /// What out-of-window uncertainty this resolves (a cell / region label).
          Target: string
          /// Resource cost to run the loop.
          Cost: float
          /// The top-k lenses most relevant to this uncertainty-reduction loop.
          Lenses: LensRouter.Lens list
          /// Expected uncertainty removed (entropy drop / solid-ground gain).
          ExpectedReduction: float
          /// The control loop that resolves the clarity (oscillation/settle) — invoked on demand.
          Run: Chip8Cow.Frame -> 'r }

    /// **Value of information:** expected uncertainty reduced per unit cost. Free (`Cost ≤ 0`) ⇒ `infinity`
    /// (ambient solid ground — always worth "running"). The priority signal for scheduling.
    let voi (t: Traversal<'r>) : float =
        if t.Cost <= 0.0 then infinity else t.ExpectedReduction / t.Cost

    /// Is this traversal worth running (its VOI clears `threshold`)?
    let worth (threshold: float) (t: Traversal<'r>) : bool = voi t >= threshold

    /// **Schedule under a cost `budget`:** greedily take traversals by descending VOI while the cumulative cost
    /// fits — the active-sensing decision of which out-of-window clarities to fetch now.
    let schedule (budget: float) (ts: Traversal<'r> list) : Traversal<'r> list =
        ts
        |> List.sortByDescending voi
        |> List.fold
            (fun (spent, chosen) t ->
                if spent + t.Cost <= budget then (spent + t.Cost, chosen @ [ t ]) else (spent, chosen))
            (0.0, [])
        |> snd

    /// Run the scheduled traversals from a state, returning each resolved clarity (with its target label).
    let runScheduled (budget: float) (f: Chip8Cow.Frame) (ts: Traversal<'r> list) : (string * 'r) list =
        schedule budget ts |> List.map (fun t -> t.Target, t.Run f)
