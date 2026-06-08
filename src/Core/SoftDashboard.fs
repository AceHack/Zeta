namespace Zeta.Core

/// **`SoftDashboard` — Rx fitness over the soft branches; the 16 buttons glow by future fitness (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"it's content-based addressing — we need an Rx fitness function (easy one: sum of all memory values
/// goes up), so I can follow the future branches that do this best. Like the observe.ts dashboard where the
/// buttons glow on which one is the right one to press, on the 4×4 universal action grammar grid."*
///
/// The CHIP-8 hex keypad **is** the 4×4 grid (16 keys = the universal action grammar grid). Given a **fitness
/// function** `Frame → float` (content-based — it scores the resulting *content-state*), the dashboard:
///   - runs the **soft controller** (`SoftController`) — press each key, follow its future a few steps;
///   - **scores each branch by the fitness** (the future that maximises it = the branch to follow);
///   - **glows each button** by its branch's fitness ⇒ the brightest button is the one to press.
///
/// This is the `collapseToBest` idea rendered as a UI surface: the fuzzy field (every button's future)
/// projected onto the 4×4 grid as glow; the locus of now is the input frame; the connection is the fitness.
///
/// **Honest scope (peel):** `buttonGlow` holds each key for the `depth`-step lookahead and scores the result —
/// a *first* fitness probe (a real model would weight by likelihood / search deeper via `SoftController.
/// bestSequence`, throttled when intractable). Fitness functions are *examples* (`sumMemory`, `litPixels`);
/// the real fitness is task-specific. Built on `Chip8Cow` (COW ⇒ each probe is cheap). Deterministic (DST §7).
[<RequireQualifiedAccess>]
module SoftDashboard =

    /// Rx fitness: the sum of all memory byte values (Aaron's easy one — "goes up"). Content-based.
    let sumMemory (f: Chip8Cow.Frame) : float =
        f.Mem |> Map.fold (fun acc _ v -> acc + float v) 0.0

    /// Rx fitness: the number of lit display pixels.
    let litPixels (f: Chip8Cow.Frame) : float =
        f.Display |> Map.fold (fun acc _ v -> if v then acc + 1.0 else acc) 0.0

    /// The standard CHIP-8 hex keypad as a 4×4 grid — the universal action grammar grid.
    /// Layout: `1 2 3 C / 4 5 6 D / 7 8 9 E / A 0 B F`.
    let keypad: int[][] =
        [| [| 0x1; 0x2; 0x3; 0xC |]
           [| 0x4; 0x5; 0x6; 0xD |]
           [| 0x7; 0x8; 0x9; 0xE |]
           [| 0xA; 0x0; 0xB; 0xF |] |]

    /// **Button glow:** for each key `0..15`, the fitness of the future if you press it now (hold the key,
    /// look ahead `depth` steps, score). The 16-element glow array (index = key value). The brightest = the
    /// best button to press.
    let buttonGlow (fitness: Chip8Cow.Frame -> float) (depth: int) (f: Chip8Cow.Frame) : float[] =
        [| for k in 0..15 -> fitness (Chip8Cow.run depth { f with Keys = SoftController.singleKey k }) |]

    /// Which button to press — the brightest (argmax glow).
    let bestButton (fitness: Chip8Cow.Frame -> float) (depth: int) (f: Chip8Cow.Frame) : int =
        let g = buttonGlow fitness depth f
        [ 0..15 ] |> List.maxBy (fun k -> g.[k])

    /// The glow projected onto the 4×4 keypad layout — rows of `(key, glow)` (the dashboard surface).
    let glowGrid (fitness: Chip8Cow.Frame -> float) (depth: int) (f: Chip8Cow.Frame) : (int * float)[][] =
        let g = buttonGlow fitness depth f
        keypad |> Array.map (Array.map (fun k -> k, g.[k]))

    // ── Unsupervised fitness (no external reward given) — Aaron 2026-06-08 ────────────────────────────────
    //
    // "What if I didn't give you a fitness function — is there an unsupervised way?" Yes. Without ANY criterion
    // there is no 'best', but principled INTRINSIC objectives need no external reward. The Zeta-aligned default
    // is EMPOWERMENT (Klyubin–Polani 2005): prefer states that keep the most future options — a proxy for the
    // action->future channel capacity. Maximizing it = maximizing AGENCY over the future, which IS the
    // forward-momentum / identity principle (an identity grows by keeping/expanding what it can control).
    // (Other families: curiosity / compression-progress (Schmidhuber, Pathak — reward novelty/surprise);
    // free-energy / active inference (Friston — minimize surprise); max-entropy state coverage; survival /
    // non-collapse — tie to identity-preservation.)

    /// A cheap content-address of a frame for dedup (PC + registers + I — content-based addressing).
    let private contentKey (f: Chip8Cow.Frame) : int * int list * int =
        int f.PC, (f.V |> Array.toList |> List.map int), int f.I

    /// **EMPOWERMENT — the unsupervised fitness:** the count of DISTINCT (content-addressed) states the agent's
    /// input choices can reach over `depth` (proxy for the action→future channel capacity). No external reward;
    /// higher = more future control / agency. Use as `fitness` in `buttonGlow`/`bestButton` when none is given.
    let empowerment (depth: int) (f: Chip8Cow.Frame) : float =
        let rec reach d fr =
            if d <= 0 then
                Set.singleton (contentKey fr)
            else
                SoftController.softFork fr
                |> List.map (fun (fr', _) -> reach (d - 1) fr')
                |> Set.unionMany
        reach depth f |> Set.count |> float

    /// **`streamLength` — a common cross-game fitness, but GAMEABLE (Aaron 2026-06-08):** steps survived before
    /// a self-halt (a `1NNN` jump to its own address), capped at `budget`. Common ("survive longest"), but
    /// **easy to game (Goodhart's law / reward hacking):** a do-nothing loop that never self-halts maxes it
    /// without playing (cf. the Tetris-pause bot, the CoastRunners boat looping for points; Krakovna's
    /// specification-gaming list). Contrast `empowerment`, which a do-nothing loop *minimises* (no agency) — so
    /// empowerment is robust to exactly this cheat. Kept here to demonstrate the gameability, not as the default.
    let streamLength (budget: int) (f0: Chip8Cow.Frame) : float =
        let isHalt (f: Chip8Cow.Frame) =
            let pc = int f.PC
            let op =
                (int (Map.tryFind pc f.Mem |> Option.defaultValue 0uy) <<< 8)
                ||| int (Map.tryFind (pc + 1) f.Mem |> Option.defaultValue 0uy)
            (op &&& 0xF000 = 0x1000) && (op &&& 0x0FFF = pc) // jump-to-self = halt
        let mutable f = f0
        let mutable n = 0
        while n < budget && not (isHalt f) do
            f <- Chip8Cow.step f
            n <- n + 1
        float n
