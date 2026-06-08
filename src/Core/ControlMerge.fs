namespace Zeta.Core

/// **`ControlMerge` — subsumption: survival vetoes, optimization loops CRDT-join within the safe set (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"the control loops we find become control-structure DUs, CRDT joins and consensus of the different
/// optimizations — there will be more than the one stay-alive one, but that one has final say… stay-alive is our
/// heartbeat."* This is that combinator. Each optimization is a **`Loop`** (it scores candidate actions from a
/// state). **Stay-alive subsumes** them all (Brooks 1986): the survival invariant is a **hard veto** — only
/// actions that keep the next frame alive are eligible; among those, the optimization loops' scores are
/// **CRDT-joined** (summed — commutative/associative/order-independent) and the best is chosen. Survival has final
/// say; everything else optimizes *within* the safe set (`exploreGuarded`/`planTo` are the search-time form; this
/// is the per-step form). No safe action ⇒ `None` = the heartbeat fails (the agent's "I commit therefore I am"
/// can no longer commit — death).
///
/// **Honest scope (peel):** one-step (greedy) survival veto — it prunes actions whose *immediate* next frame dies,
/// not actions that doom you k steps later (use `Survival`/`exploreGuarded` for horizon-safe). CRDT-join here is a
/// plain score *sum*; a real consensus (weighted vote / lexicographic priority across loops) is a richer merge —
/// `decideLexicographic` gives the strict-priority variant. Action equality is structural over the 16-bool vector.
/// Deterministic (DST).
[<RequireQualifiedAccess>]
module ControlMerge =

    /// An optimization loop: from a state, its scored preferences over candidate actions.
    type Loop = Chip8Cow.Frame -> (bool[] * float) list

    /// **The survival veto:** the actions whose next frame still satisfies `alive` (one frame ahead). The hard
    /// constraint stay-alive imposes on every other loop.
    let safeActions (alive: Chip8Cow.Frame -> bool) (cyclesPerFrame: int) (actions: bool[] list) (f: Chip8Cow.Frame) : bool[] list =
        actions |> List.filter (fun a -> alive (Chip8Cow.frameStep cyclesPerFrame { f with Keys = a }))

    let private scoreFor (loops: Loop list) (f: Chip8Cow.Frame) (a: bool[]) : float =
        // CRDT join of the loops' scores for action `a` (sum = commutative/associative/order-independent).
        loops
        |> List.sumBy (fun loop ->
            loop f |> List.tryPick (fun (a', s) -> if a' = a then Some s else None) |> Option.defaultValue 0.0)

    /// **Decide (subsumption):** among the survival-safe actions, pick the one maximizing the CRDT-joined score
    /// across `loops`. `None` if no action is safe (the heartbeat fails). Survival has final say.
    let decide
        (alive: Chip8Cow.Frame -> bool)
        (cyclesPerFrame: int)
        (actions: bool[] list)
        (loops: Loop list)
        (f: Chip8Cow.Frame)
        : bool[] option =
        match safeActions alive cyclesPerFrame actions f with
        | [] -> None
        | safe -> safe |> List.maxBy (scoreFor loops f) |> Some

    /// **Lexicographic decide:** among survival-safe actions, prefer the first `loops` entry's best, breaking ties
    /// by the next loop, and so on (strict priority instead of a summed join — for when loops must not trade off).
    let decideLexicographic
        (alive: Chip8Cow.Frame -> bool)
        (cyclesPerFrame: int)
        (actions: bool[] list)
        (loops: Loop list)
        (f: Chip8Cow.Frame)
        : bool[] option =
        match safeActions alive cyclesPerFrame actions f with
        | [] -> None
        | safe ->
            let key (a: bool[]) =
                loops |> List.map (fun loop -> loop f |> List.tryPick (fun (a', s) -> if a' = a then Some s else None) |> Option.defaultValue 0.0)
            safe |> List.maxBy key |> Some // F# compares the score list lexicographically
