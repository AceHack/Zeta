namespace Zeta.Core

/// **`SoftChip8` — throttled, batched prediction over the COW frame DAG (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"this is exactly where you use the throttled processor — it decides when to throttle multiple
/// timesteps together instead of predicting on each step; continuous play and predict simultaneously,
/// prediction throttled by the throttled processor."* This is the prediction layer over `Chip8Cow` (the COW
/// frame DAG, #7087).
///
/// **Two activities, run simultaneously:**
///   - **Play** — the committed deterministic timeline advances continuously (`Chip8Cow.step`).
///   - **Predict** — speculative look-ahead, **throttled** by the `FerryThrottler` ("the throttled
///     processor"): it decides *when* to predict and *how many timesteps to batch* (`lookAhead depth`), and
///     *how many input-branches to explore* (breadth) — **not** per-step prediction. Branch prediction +
///     speculative execution; mispredicts are retracted (Z-set `−1`) when the actual input resolves.
///
/// **The key DST insight:** the only genuine *future*-uncertainty is **INPUT** — `RND` (`CXNN`) is
/// seed-determined (deterministic ⇒ a point-mass, no branch). So the soft branch-tree forks **only on unknown
/// future key-input** (`EX9E`/`EXA1`/`FX0A`); everything else is a deterministic line the throttle can batch
/// far ahead cheaply (COW makes each speculated frame a small patch).
///
/// **Honest scope (peel):** built on `Chip8Cow`'s pure `step` (COW ⇒ branches are cheap, no aliasing). This
/// module provides the *prediction primitives* (`branchesOnInput`, `lookAhead` = batched deterministic
/// look-ahead, `forkOnInput` = the soft fork at an input branch) + the throttle-governance contract; the
/// *concurrent* play∥predict scheduling over a real `FerryThrottler` (DoP=N async, DoP=1 deterministic) is the
/// adapter slice. Deterministic (DST §7): `lookAhead n` ≡ `Chip8Cow.run n` on a no-input line.
[<RequireQualifiedAccess>]
module SoftChip8 =

    let private opAt (f: Chip8Cow.Frame) : int =
        let pc = int f.PC
        (int (Map.tryFind pc f.Mem |> Option.defaultValue 0uy) <<< 8)
        ||| int (Map.tryFind (pc + 1) f.Mem |> Option.defaultValue 0uy)

    /// Does the frame's next opcode branch on (unknown future) INPUT? — the only soft fork in DST.
    let branchesOnInput (f: Chip8Cow.Frame) : bool =
        let op = opAt f
        match op &&& 0xF000 with
        | 0xE000 -> // EX9E / EXA1 (skip on key)
            let lo = op &&& 0x00FF
            lo = 0x9E || lo = 0xA1
        | 0xF000 -> (op &&& 0x00FF) = 0x0A // FX0A (wait for key)
        | _ -> false

    /// **Throttled batch look-ahead** — speculate `depth` deterministic steps ahead in ONE batch (the throttle
    /// decides `depth`, not per-step), stopping early at an input branch (where prediction must fork). Returns
    /// the predicted frame and whether it halted on a branch (so the throttle/play knows a fork is pending.)
    /// Cheap: COW ⇒ each speculated frame is a small patch over the parent.
    let lookAhead (depth: int) (f: Chip8Cow.Frame) : Chip8Cow.Frame * bool =
        let mutable s = f
        let mutable i = 0
        let mutable hitBranch = false
        while i < max 0 depth && not hitBranch do
            if branchesOnInput s then
                hitBranch <- true
            else
                s <- Chip8Cow.step s
                i <- i + 1
        s, hitBranch

    /// The soft fork at an input branch: the successor frames for **key down** vs **key up** on the key the
    /// next opcode tests — the two speculative branches (weighted equally absent a prior; SoftValue-shaped).
    /// For `FX0A` (wait-for-key) the "down" branch picks key 0, the "up" branch stalls (re-executes).
    let forkOnInput (f: Chip8Cow.Frame) : (Chip8Cow.Frame * float) list =
        if not (branchesOnInput f) then
            [ Chip8Cow.step f, 1.0 ] // point-mass: not a branch
        else
            let op = opAt f
            let keyIdx =
                let x = (op &&& 0x0F00) >>> 8
                if op &&& 0xF000 = 0xE000 then
                    int f.V.[x] &&& 0xF // EX9E/EXA1: V[x] IS the tested key — correct as it was
                else
                    0 // FX0A: key 0 EXPLICITLY (Kira r3: V[x] is FX0A's DESTINATION — the old code pressed whatever garbage it was about to overwrite)
            let down = Array.zeroCreate 16
            down.[keyIdx] <- true
            let up = Array.zeroCreate 16
            [ Chip8Cow.step { f with Keys = down }, 0.5 // speculative: key pressed
              Chip8Cow.step { f with Keys = up }, 0.5 ] // speculative: key not pressed

    /// **Resolve a misprediction (Z-set retraction back to now):** given the frame *before* the branch and the
    /// **actual** input that occurred, the committed successor — the branch that survives; the others are
    /// retracted (`−1`). This is the speculative-execution commit (keep the taken branch, drop the rest).
    let resolve (actualKeys: bool[]) (f: Chip8Cow.Frame) : Chip8Cow.Frame =
        Chip8Cow.step { f with Keys = actualKeys }

    /// The number of pending soft branches the throttle would need to cover one fork (1 if deterministic, else
    /// the input branch factor) — the throttle's breadth budget for this frame.
    let branchFactor (f: Chip8Cow.Frame) : int = if branchesOnInput f then 2 else 1
