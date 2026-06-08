namespace Zeta.Core

/// **`Survival` — can you stay alive forever? a safe cycle = a stable limit cycle (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"creating stable/coherent memory-transformation patterns that are loopable into stay-alive DUs is the
/// baseline — can you stay alive forever or until the time runs out… it's almost like we're looking for steerable
/// PID loops; this is all control theory."* It is. The whole arc is control theory:
///   - **observer** = `MemoryLens` (the lens reducing all-memory to the world state we can sense);
///   - **controllability** = `MemoryLens` Controllable cells (what the actuator can move);
///   - **actuator** = the buttons (`ActionGrammar`);
///   - **setpoint / safe region** = the `alive` invariant;
///   - **stability** = a **safe cycle**: a loop of invariant-satisfying states the controller can repeat forever
///     = a **stable limit cycle / homeostasis** (Lyapunov-stable invariant set). That is "stay alive forever."
///
/// `analyze` runs `StateSpace.exploreKeyed` over the safe subspace and asks `hasCycle`: a cycle ⇒ a repeatable
/// alive loop ⇒ **forever**; no cycle in a fully-explored (non-truncated) safe set ⇒ you survive only the finite
/// **horizon** (until the time runs out). Survival is gameable as a *metric* (it's longest-stream-length — Goodhart,
/// cf. `SoftDashboard.streamLength`); its value here is the *stability foundation* planning-toward-score builds on,
/// not a robust score.
///
/// **Soundness (load-bearing):** the default `analyze` keys on the **exact** `StateSpace.contentKey` — so
/// `AliveForever` means a *true* zero-drift limit cycle (sound, conservative: a non-lethal drifting counter
/// prevents an exact cycle, so it can answer `false` even when a lens-compressed loop exists). `analyzeKeyed`
/// takes a reduced key (e.g. `MemoryLens.lensKey`) to detect those compressed loops — but **only sound if the key
/// retains every cell the `alive` invariant depends on**; dropping an autonomous-yet-lethal cell yields a spurious
/// "forever" (see `StateSpace.exploreKeyed`). Deterministic (DST).
[<RequireQualifiedAccess>]
module Survival =

    /// The survival verdict over the explored safe subspace.
    type Verdict =
        { /// A safe cycle exists ⇒ a repeatable alive loop ⇒ can stay alive forever (sound w.r.t. the chosen key).
          AliveForever: bool
          /// Number of distinct safe (invariant-satisfying) states reached — the survivable horizon if not forever.
          SafeStates: int
          /// The search hit `maxStates` before exhausting the safe subspace (verdict is then a lower bound).
          Truncated: bool }

    /// **Survival analysis with an explicit state key.** Pass `StateSpace.contentKey` for the sound/exact verdict,
    /// or `MemoryLens.lensKey classes` for the lens-compressed one (caller ensures the key keeps lethal cells).
    let analyzeKeyed
        (keyOf: Chip8Cow.Frame -> 'k)
        (alive: Chip8Cow.Frame -> bool)
        (cyclesPerFrame: int)
        (maxStates: int)
        (actions: bool[] list)
        (f0: Chip8Cow.Frame)
        : Verdict =
        let g = StateSpace.exploreKeyed keyOf alive cyclesPerFrame maxStates actions f0
        { AliveForever = StateSpace.hasCycle g
          SafeStates = g.StateCount
          Truncated = g.Truncated }

    /// **Sound survival analysis** — keys on the exact `contentKey`. `AliveForever` ⇒ a true zero-drift limit
    /// cycle of alive states (homeostasis). Conservative (may miss lens-compressible loops; use `analyzeKeyed`).
    let analyze
        (alive: Chip8Cow.Frame -> bool)
        (cyclesPerFrame: int)
        (maxStates: int)
        (actions: bool[] list)
        (f0: Chip8Cow.Frame)
        : Verdict =
        analyzeKeyed StateSpace.contentKey alive cyclesPerFrame maxStates actions f0
