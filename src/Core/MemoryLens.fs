namespace Zeta.Core

/// **`MemoryLens` — find the lens: the unknown reduction of all-memory to the controllable world state (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"the current world state is some unknown reduction of all memory… we have to find our lens, then using
/// prediction control the patterns in memory with our buttons so we can at least stay alive — that's the first
/// goal before even score."* The lens is discovered by asking, per memory cell: **does the button move it?**
///   - **Controllable** — the cell's delta *varies across button branches* (the button affects it) → it is part
///     of the steerable world state; this is where control lives.
///   - **Autonomous** — the cell changes but *identically regardless of button* (timer / counter / RNG-driven) →
///     not steerable; abstract it away (it's the nuisance that made the raw state space infinite, #7121).
///   - **Constant** — never changes here.
///
/// The **lens** = the projection onto the Controllable (and chosen-relevant) cells. `lensKey` is that reduced
/// world state — finite where the full `contentKey` was infinite, and exactly the input a predictor/controller
/// needs. Combine with `StateSpace.exploreGuarded` (an "alive" invariant) over `lensKey` to search for a control
/// sequence that **stays alive** (survival = remaining in the safe subspace) — the first goal, before score.
///
/// **Honest scope (peel):** controllability is *state-local* — a cell is only controllable on frames where an
/// input opcode actually polls (a position only moves when the game reads the pad), so single-state classification
/// is noisy; `classify` aggregates over sampled states (Controllable if controllable *anywhere*). This is a
/// causal-effect heuristic (does action change this cell?), not a proof of relevance to survival; and it tests the
/// given `actions` only (an unprobed button could reveal more). Registers + timers + PC only (Mem cells not yet
/// classified). Deterministic (DST). Anchors: causal feature discovery / controllability; predicate abstraction /
/// state aggregation (CEGAR, bisimulation); the lens (#7092); empowerment (controllable subspace = where
/// action→future has channel capacity).
[<RequireQualifiedAccess>]
module MemoryLens =

    /// How a memory cell responds to the button under the probed actions.
    type CellClass =
        | Constant // never changes
        | Autonomous // changes, but identically regardless of button (timer/counter/RNG) — nuisance
        | Controllable // delta varies by button — the steerable world state

    /// The named cells we classify (registers + I + timers + PC).
    let private cellsOf (f: Chip8Cow.Frame) : (string * int) list =
        [ "PC", int f.PC
          "I", int f.I
          "Delay", int f.Delay
          "Sound", int f.Sound ]
        @ [ for i in 0..15 -> sprintf "V%X" i, int f.V.[i] ]

    let private names = cellsOf (Chip8Cow.create 0UL) |> List.map fst

    /// **Classify each cell at a single state** by how its one-frame delta responds across `actions`.
    let classifyAt (cyclesPerFrame: int) (actions: bool[] list) (f: Chip8Cow.Frame) : Map<string, CellClass> =
        let baseVals = cellsOf f |> Map.ofList
        let childDeltas =
            actions
            |> List.map (fun a ->
                let child = Chip8Cow.frameStep cyclesPerFrame { f with Keys = a }
                cellsOf child |> List.map (fun (n, v) -> n, v - baseVals.[n]) |> Map.ofList)
        [ for n in names ->
              let deltas = childDeltas |> List.map (fun cd -> cd.[n])
              let cls =
                  if deltas |> List.forall ((=) 0) then Constant
                  elif deltas |> List.distinct |> List.length = 1 then Autonomous // same nonzero change for every button
                  else Controllable // the button changes the outcome
              n, cls ]
        |> Map.ofList

    /// Merge two classifications, taking the strongest evidence per cell (Controllable > Autonomous > Constant).
    let private merge (a: Map<string, CellClass>) (b: Map<string, CellClass>) : Map<string, CellClass> =
        let rank =
            function
            | Constant -> 0
            | Autonomous -> 1
            | Controllable -> 2
        names
        |> List.map (fun n ->
            let x = Map.tryFind n a |> Option.defaultValue Constant
            let y = Map.tryFind n b |> Option.defaultValue Constant
            n, (if rank x >= rank y then x else y))
        |> Map.ofList

    /// **Find the lens** by aggregating classification over sampled `states`: a cell is `Controllable` if it is
    /// controllable at *any* sampled state (control only shows up on poll frames), else `Autonomous` if it ever
    /// changed, else `Constant`.
    let classify (cyclesPerFrame: int) (actions: bool[] list) (states: Chip8Cow.Frame list) : Map<string, CellClass> =
        states
        |> List.map (classifyAt cyclesPerFrame actions)
        |> List.fold merge (names |> List.map (fun n -> n, Constant) |> Map.ofList)

    /// The controllable cells (the steerable world state) under a classification.
    let controllable (classes: Map<string, CellClass>) : string list =
        names |> List.filter (fun n -> Map.tryFind n classes = Some Controllable)

    /// **The lens key** — the reduced world state: the values of just the controllable cells (sorted, comparable).
    /// Finite where the full `StateSpace.contentKey` is infinite; the input a predictor/controller needs. If no
    /// cell is controllable (nothing probed moves), falls back to `PC` so distinct program phases still separate.
    let lensKey (classes: Map<string, CellClass>) (f: Chip8Cow.Frame) =
        let ctrl = controllable classes
        let vals = cellsOf f |> List.filter (fun (n, _) -> List.contains n ctrl)
        if List.isEmpty vals then [ "PC", int f.PC ] else vals
