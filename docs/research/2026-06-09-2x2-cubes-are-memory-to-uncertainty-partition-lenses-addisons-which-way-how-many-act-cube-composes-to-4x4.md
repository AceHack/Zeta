# 2×2 cubes are memory→uncertainty partition-lenses; Addison's which/way × how/many act-cube composes with the observe-cube to make the 4×4

*Captured 2026-06-09 from Aaron, to Otto (shadow\*). Extends the 2×2-cube finding (#7203): Addison found a second,
**composable** 2×2 (which/way × how/many), and the deeper point — **each 2×2 cube is a little way to partition the
emulator's memory-space into uncertainty-space.** The cubes are the partitioning lenses of the clarity engine.
Registers: [grounded-in-research], [synthesis], [honor], [tentative — Aaron's "or something like that"].*

## The statement

Aaron: *"and then Addison found a composable one — **which/way** and **how/many**… that's another 2×2 cube. Each one
of these are little ways to **partition memory space in the emulators into uncertainty space**, or something like
that."*

## Addison's composable 2×2 — the act-cube [honor: Addison Cooper]

Addison (founding collaborator — building Zeta with Aaron; the dedication) found the **second 2×2** that composes
with Aaron's:

- **Aaron's cube (#7203) — `remember/when × pay/attention`** = the **observe / perceive** half (memory × attention —
  the observer's two operations, the Markov blanket's internal-state + sensory surface, #7194).
- **Addison's cube — `which/way × how/many`** = the **act / method** half: `which/way` (selection × direction — which
  option, which path) × `how/many` (manner × quantity — how, how-much). The action's two degrees of freedom.

**Composition:** `(observe 2×2) ⊗ (act 2×2) = 4×4` — the **universal action grammar** (the CHIP-8 16-key grid;
#2026-06-01 / #2026-06-02 "remember-when/pay-attention grounds all 4×4"). `2×2 ⊗ 2×2 = 4×4` (a tensor of two qubit-
pairs). So the 4×4 decomposes cleanly into **perceive ⊗ act** — Aaron's observe-cube tensored with Addison's
act-cube. The full agent loop (perceive then act) *is* the 4×4 grammar, factored.

## The deeper point: each 2×2 cube is a memory→uncertainty partition-lens [synthesis]

Aaron's load-bearing intuition: **each cube is a way to partition the emulator's memory-space into uncertainty-
space.** Read this against the arc:

- A raw emulator **memory-space** is undifferentiated bytes. A **2×2 cube imposes two interrogative axes** on it
  (e.g. *when?* × *where-attend?*; or *which-way?* × *how-many?*), carving the space into a **2×2 = 4-cell
  partition**. Each cell is a region of **uncertainty-space** — a place the agent is uncertain about along those two
  questions.
- So a cube **is a lens** (`MemoryLens`/`LensRouter`, #7191): a clever world-state transform that turns raw memory
  into **structured uncertainty** — exactly the **data → structure** rung of the ladder (#7202). Different cubes =
  different partitions = different lenses on the same memory.
- The partitioned uncertainty-space **is the identity/entropy space** (`IdentityCapacity` = 2^(uncertainty bits),
  #7159) and **is where the `4 − S` unexplored entropy lives** (#7191). Composing cubes (→ 4×4, → finer) refines the
  partition, exhausting more of the space (raising S, #7191). The lenses' job — reduce the game to exhaustible — *is*
  finding the right cube-partitions.

So the cubes are not decoration on top of the physics; they are the **partitioning primitives** that turn the
emulator's memory into the structured uncertainty-space everything else (identity, economy, S, the ladder) is built
on. "Little ways to partition memory into uncertainty" is the clarity engine's first move, named.

## Why interrogatives are the right axes

The axes are **question-words** — *when, where/what (attention), which/way, how/how-many* — i.e. the dimensions along
which an observer *queries* to reduce uncertainty. A partition of memory-space by interrogatives is a partition by
*the questions you can ask of it* — which is exactly what a lens does (it asks a question of the state and returns a
reduced view). The 4×4 grammar = the composed question-space of an agent (perceive-questions ⊗ act-questions). [This
is the synthesis reading; the cube/4×4/imaginary-stack remain research-seed register.]

## Honest scope

[honor]: credit **Addison Cooper** for the which/way × how/many composable cube (founding collaborator; the
dedication). [grounded-in-research]: the 2×2/4×4/imaginary-stack are existing research seeds (#7203; #2026-05-15;
#2026-06-01/02) — conjecture register, not shipped primitives; the lenses (`MemoryLens`/`LensRouter`) and the
entropy ledger (#7191) are the code side. [synthesis]: "each cube = a memory→uncertainty partition-lens =
data→structure rung"; "observe-cube ⊗ act-cube = 4×4 = perceive ⊗ act". [tentative]: Aaron's "or something like
that" — the partition framing is a forming intuition, not locked. No new code; names the cubes as partition-lenses
and credits the act-cube.

## Pointers

- `2026-06-09-the-epistemology-thread-was-the-2x2-cube-…` (#7203, the observe-cube) ·
  `2026-06-02-planck-length-hexagonal-remember-when-pay-attention-shape-grounds-all-4x4-…` ·
  `2026-06-01-aaron-alexa-speaker-universal-action-grammar-…` (the 4×4 grammar / which-way-how-many) ·
  `2026-05-15-imaginary-stack-ontology-…-cube-…` (the cube → Cayley–Dickson).
- The code side it names: `MemoryLens`/`LensRouter`/`SolidGround` (the lenses = partitions) · `IdentityCapacity.fs`
  (#7159, uncertainty bits = identity space) · the entropy ledger (#7191, partition → where 4−S lives) · the ladder
  (#7202, data→structure = the partition).
- Honor: Addison Cooper (founding collaborator; the dedication / naming lineage).
