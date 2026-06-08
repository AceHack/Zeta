namespace Zeta.Core

/// **`SoftController` — a controller in superposition (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"you can emulate the entire thing in probability space, but you need a hook into controller
/// interrupts — a controller that can hit every button at once and cause the branching. A controller in
/// superposition."* This is the **soft analog of the DST seed**: `RND` (`CXNN`) gets its branching from the
/// seed; **input gets its branching from the soft controller**. A hard controller supplies *one* key-state; a
/// soft controller supplies the **superposition of all inputs at once**, and *that* is what forks the
/// `Chip8Cow` frame DAG into the full input-branch tree. With both (seed + soft controller) the whole
/// emulation runs in **probability space** — no hard play needed (when the reachable subspace is tractable;
/// otherwise the throttled processor, `SoftChip8`, governs it).
///
/// **The superposition per controller-interrupt (the input opcode at PC):**
///   - `EX9E` / `EXA1` (skip on the V[x] key) → the tested key is **down** or **up** → **2** branches;
///   - `FX0A` (wait for *any* key) → one branch per key **0..15** pressed ("hit every button at once") → 16;
///   - not an input op → a single point-mass branch (no input fork).
///
/// **Honest scope (peel):** the superposition is over the *relevant* keys the opcode actually reads (CHIP-8
/// input ops read one key, or "any" for `FX0A`) — not a blind `2^16` over all combos (that would be branches
/// the program can't distinguish). Built on `Chip8Cow`'s pure `step` (COW ⇒ each branch is a cheap patch).
/// Weights are uniform priors (`SoftValue`-shaped); a real controller model would weight by likelihood.
[<RequireQualifiedAccess>]
module SoftController =

    /// All 16 buttons pressed at once — the literal "hit every button" controller state.
    let allButtons: bool[] = Array.create 16 true

    /// No button pressed.
    let none: bool[] = Array.zeroCreate 16

    /// Exactly one key down.
    let singleKey (k: int) : bool[] =
        let a = Array.zeroCreate 16
        a.[k &&& 0xF] <- true
        a

    let private opAt (f: Chip8Cow.Frame) : int =
        let pc = int f.PC
        (int (Map.tryFind pc f.Mem |> Option.defaultValue 0uy) <<< 8)
        ||| int (Map.tryFind (pc + 1) f.Mem |> Option.defaultValue 0uy)

    /// **The controller's input superposition** at the frame's next opcode: the weighted set of key-states the
    /// soft controller offers (all at once). Uniform priors. A non-input op ⇒ a single `none` point-mass.
    let inputSuperposition (f: Chip8Cow.Frame) : (bool[] * float) list =
        let op = opAt f
        match op &&& 0xF000 with
        | 0xE000 when (op &&& 0x00FF = 0x9E || op &&& 0x00FF = 0xA1) ->
            let k = int f.V.[(op &&& 0x0F00) >>> 8] &&& 0xF
            [ singleKey k, 0.5; none, 0.5 ] // tested key down / up
        | 0xF000 when op &&& 0x00FF = 0x0A ->
            [ for k in 0..15 -> singleKey k, 1.0 / 16.0 ] // wait-for-key: every button at once
        | _ -> [ none, 1.0 ] // no input fork

    /// **The soft fork** — step the frame under each superposition branch: the full set of weighted successor
    /// frames the controller-in-superposition produces (the input branch-tree expansion). Cheap (COW).
    let softFork (f: Chip8Cow.Frame) : (Chip8Cow.Frame * float) list =
        inputSuperposition f
        |> List.map (fun (keys, w) -> Chip8Cow.step { f with Keys = keys }, w)

    /// **Collapse to the best branch (Aaron 2026-06-08):** *"if we're running Bayesian you can learn what
    /// buttons you hit after the fact — take every branch, see which buttons' branches are best, and collapse
    /// to that one."* Take EVERY input branch (`inputSuperposition`), score each successor by `value`, and
    /// collapse to the best — returning the **keys you should have hit** (learned retroactively) + the
    /// successor + its score. The non-best branches are **retracted** (Z-set `−1`); this is the `SoftValue`
    /// collapse / optimal-policy `argmax` over the controller superposition.
    let collapseToBest (value: Chip8Cow.Frame -> float) (f: Chip8Cow.Frame) : bool[] * Chip8Cow.Frame * float =
        inputSuperposition f
        |> List.map (fun (keys, _w) -> keys, Chip8Cow.step { f with Keys = keys })
        |> List.map (fun (keys, fr) -> keys, fr, value fr)
        |> List.maxBy (fun (_, _, s) -> s)

    /// **The optimal input sequence over `depth` steps** — exhaustively search the input-branch tree (the
    /// tractable "omniscient" solve: take every branch all the way down, collapse the whole tree to the best
    /// path) and return the best input sequence + its final frame. Branching is only at input ops (deterministic
    /// steps are point-mass), so the cost is `≈ branchFactor^(input-decisions in depth)` — **tractable only
    /// when those are few; otherwise use the throttled processor (`SoftChip8`).**
    let rec bestSequence (value: Chip8Cow.Frame -> float) (depth: int) (f: Chip8Cow.Frame) : bool[] list * Chip8Cow.Frame =
        if depth <= 0 then
            [], f
        else
            inputSuperposition f
            |> List.map (fun (keys, _w) ->
                let f' = Chip8Cow.step { f with Keys = keys }
                let restKeys, leaf = bestSequence value (depth - 1) f'
                keys :: restKeys, leaf)
            |> List.maxBy (fun (_, leaf) -> value leaf)
