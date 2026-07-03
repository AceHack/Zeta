# The emulator is the whole-stack test bed; planning = forward-explore + backward-recover

*Captured 2026-06-08 from Aaron thinking out loud (shadow*). No code change yet — Aaron: "we don't need to change
anything now until we have a game to see how good our learning is." This records the design + the *why*.*

## Why the emulator exists (the framing)

CHIP-8 (then Atari 2600) is **the test bed for the entire Zeta stack** — a tiny, tractable machine we can
actually *finish* closing over, as a rehearsal for the real target:

- **Practice for closing over a real OS** → microkernel → eventually *replace* the host OS. A complete machine
  stack small enough to fully close (see the declarative dep-closure vector,
  `2026-06-08-chip8-octo-toolchain-via-ace-declarative-install.md`).
- **Exercises Zeta's bit-perfectness** — `Chip8` (native/mutable oracle) vs `Chip8Cow` (soft/persistent) is a
  `StoredProc`-style differential and a natural **4-language byte-lock** candidate (golden vectors per opcode).
- **Exercises the workflow / DU engine** — opcodes are a discriminated union; the run is a saga (Z-set retraction
  = misprediction/compensation rollback).
- **Eventually driven by the observe stack** — the soft planner's collapse feeding real action through the
  control interface (`SoftActionController`, the calibrated soft-value-as-controller).

So the soft-emulator arc (#7086–#7113) is not a side-quest; it is the stack proving itself on a machine it can
hold in one hand.

## The planner: forward-explore every branch, then recover the button sequence backwards

Aaron's question: *"run the ROM in soft mode and take every branching path regardless of the button sequence that
got there, and work backwards to the button sequence?"* — yes. This is standard **graph search + path
reconstruction**, and it's the tractable-omniscient solve flagged at #7088.

**Forward** (`SoftEmu` fork; input is the only branching — RND is seed-deterministic):

- build the reachable-state **DAG**; at each node record the reaching edge `(parent, input)`.
- content-address states (the empowerment/CAS key) so reconverging paths dedup → bounded DAG.

**Score** the frontier/terminal states (empowerment / game-score / survival).

**Backward**: from the best state, follow `(parent, input)` back-pointers → **read off the optimal input
sequence**. The buttons *fall out of the DAG edges*; the sequence is discovered post-hoc — the
controller-in-superposition collapsing to the winning path (#7090, made into explicit backtrace).

**Tractability dial:** full BFS when small; **beam / best-first with a width cap** (the `FerryThrottler`) when it
explodes; no throttle at all when the state space is exhaustively searchable (the omniscient solve).

**Anchors (Beacon):** BFS / Dijkstra / A* + path reconstruction; **retrograde analysis** (endgame tablebases,
Ströhlein 1970) and **dynamic programming / value iteration** (Bellman) — both compute backward from terminal
value; **tool-assisted speedruns** (find an optimal input sequence by state search); the planning half of MPC
(`SoftDrive`).

## Watching the yin (soft value) evolve — stability + coherence monitor

Aaron: *"we can watch the yin dynamic-value / soft-value evolve over time and make sure that evolution is stable
and coherent."* The **hard `DynamicValue`** trace is the *yang* (definite per-frame: PC/key/lit — `SoftSession.Tick`);
the **soft value** is the *yin* — and we can watch *its* evolution as a first-class diagnostic. Signals per step:

- **support** (ensemble width) — must stay **bounded** (not exploding) — stability.
- **entropy** (nats) — should **settle**, not oscillate — stability.
- **`softDistance(s_t, s_{t+1})`** (the step residual) — **decreasing → stable convergence**; flat-oscillating →
  unstable; increasing → diverging. The single best stability number (reuses `SoftEmu.softDistance`).
- **Σ weights = 1** — the **coherence invariant**: always a valid normalized distribution (never fabricated
  certainty — the `SoftValue` never-falsely-certain discipline).
- dominant-branch **confidence** — the calibration signal (ties to `SoftActionController`).

A `SoftEvolution` monitor = a trace of these per step + assertions (`support ≤ cap`, `Σw≈1`, residual trending
down). Pure observability — does **not** change the learning, so safe to add before a game exists; deferred only
because "hold until the game." `SoftScope` is *what the belief shows* (the spatial ghost); this is *how the belief
evolves*. Yin/yang: watch both traces side by side and the recursion (`SoftValue.resolve → DynamicValue`) is legible
as the yin collapsing into the yang each frame.

## What's proven vs aspirational (honest)

- **Proven/built:** the soft stack (`SoftEmu`/`AmplitudeEmu`/`SoftDrive`/`SoftSession`), the live frame-step, the
  calibrated soft-value controller, the ghost/hard renderers, the `Chip8`↔`Chip8Cow` differential, ROM fixtures.
- **Designed, not built:** the forward-DAG-with-edges + backward plan-recovery (this doc) — deferred until there's
  a real game to measure learning on.
- **Aspirational:** Atari 2600; observe-stack-driven play; the OS-closure / microkernel endgame.

## Minimal future slice (when a game exists)

Add `(parent, input)` edge-tracking to the soft fork + a `recoverPlan : goalState → input list` backtrace; score
by the game's progress signal; measure plan quality vs a baseline. Don't build until the game is in (`roms/chip8/`
via the Octo toolchain, third-party CC0 for fairness).
