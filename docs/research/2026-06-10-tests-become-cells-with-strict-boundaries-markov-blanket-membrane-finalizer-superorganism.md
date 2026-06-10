# Tests become cells with strict boundaries

**Register:** [grounded] substrate-synthesis (Aaron) + [Beacon] + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). What the test substrate *is*, biologically framed.

## Aaron's words

> "so test become cells with strict boundaries."

## The synthesis

A **test is a cell.** Its **strict boundary is the membrane** — the **Markov blanket** (Pearl) that
separates inside from outside. This unifies several threads that were circling the same shape:

- **test = cell = tick = room.** A bounded test is a finalizer **tick** (`src/Core/Finalizer*.fs`); it
  is a **room** (prod = test; the Henderson bob-and-weave cells — `Skadium.fs` / `DarkHall.fs`); it is
  a **cell**. One name, four framings.
- **the boundary is STRICT.** Nothing crosses the cell membrane except through the defined **seam**:
  effects **in** (the DI-injected `IEffects` — real I/O in prod, null in DST), and the committed
  **delta out** (the `cut`/`mea` residue the finalizer merges to `main`). Inside the cell: the
  `sim |> mea |> cut` loop. Outside: everything else. The membrane is the `same/` **ctxboundary** /
  [`bounds/`](../../bounds/) Markov boundary made cellular.
- **mea reads at the membrane.** To `measure` is to read the cell **at its boundary** (the ΔU); the
  strict boundary is *what makes the cell measurable* — a leaky boundary has no well-defined reading.

## Reticulum crosses the membrane — and crossing is where uncertainty comes from (Aaron 2026-06-10)

> Aaron: "these membranes are markov boundaries of the room, reticulum lets you cross that boundary —
> that's where the uncertainty comes from, unless we inject other IO interfaces."

The membrane is the room's **Markov boundary**, and **Reticulum is the I/O interface that crosses it**
(`src/Core/ReticulumLink.fs` — the mesh, ZetaId destinations). **Crossing the boundary is the source of
(new, external) uncertainty:** observation entering the cell from the mesh *is* the ΔU the demon
measures. No crossing ⇒ no new external uncertainty.

This is the **DI seam made precise** — the injected `IEffects` is *which boundary-crossing interface the
cell uses*:

- **prod = inject Reticulum** — the real mesh crosses the membrane; real external uncertainty flows in;
  `mea` measures it, the demon posts ΔU. Reticulum is the default real crossing.
- **DST = inject null** — no real crossing; the cell is sealed, so it is fully deterministic/replayable
  (only **intrinsic** entropy remains — the git-history persona entropy, the "full void"; never empty,
  but no *new* external uncertainty).
- **inject other I/O** — any other interface across the membrane (file, sensor, another mesh) — "unless
  we inject other IO interfaces." The crossing interface is a choice.

So uncertainty has **two sources**, cleanly separated by the membrane: **intrinsic** (git history /
reified types — always present inside the cell) and **extrinsic** (what crosses the boundary via
Reticulum or another injected I/O). This reconciles the earlier correction: `mea` is never
informationless (intrinsic is always there), and *new* uncertainty is exactly what crosses the
membrane. The strict boundary is what lets us say precisely where each bit came from.

## Why strict boundaries (what they buy)

The strictness is not aesthetic — it is what makes the substrate work:

- **DST / determinism** — no hidden shared state crossing the membrane ⇒ the cell replays identically
  (manifesto §7). A strict boundary *is* the precondition for deterministic simulation.
- **Lock-free / wait-free** (§2) — cells make progress without reaching across each other's membranes;
  no shared mutable state to lock.
- **Isolation / no races** — parallel cells don't collide (the worktree-isolation discipline: parallel
  agents need isolated worktrees = cells with strict boundaries; the DoP ferries each own their cell).
- **Composability → superorganism** — strict-boundaried cells **compose**: many cells (tests) combine
  into the organism (the substrate). **C. elegans** cells combine into a *super-deterministic
  superorganism* (filmed); the **collective-we** ([`bounds/`](../../bounds/)) is the organism's
  boundary; **S=4** is the cells phase-locked across the shared cause. Strict cell + strict cell →
  coherent organism; leaky cells → no organism.

## The room is the physics-accounting demon (Aaron 2026-06-10)

> Aaron: "our rooms are our physics accounting demon and it writes the uncertainty changes after it
> measures to our uncertainty ledger."

The cell/room is **Maxwell's demon doing physics accounting.** The demon's move: it **measures**
(`mea`) and then **writes the uncertainty change (ΔU) to the ledger** — measurement is not free
(Szilard: a measurement has an information/entropy cost; Landauer: erasure has a thermodynamic cost),
so the demon must **account** for it. The room *is* that accountant: every measurement's
uncertainty-reduction is **posted to the ledger** ([`ledgers/`](../../ledgers/) — the uncertainty
ledger specifically). The ledger is the demon's book of accounts; the membrane is where it reads.

- **mea → post ΔU.** `mea(sim)` measures at the membrane and commits the ΔU to the (uncertainty-scoped)
  ledger. The finalizer's merge-to-`main` is the posting.
- **Accounting integrity (idempotency, §6).** A ΔU is keyed to its measurement, so re-measuring the
  same thing is an upsert, not a double-post — double-entry discipline: the books must balance, the
  demon can't conjure uncertainty-reduction it didn't measure.
- **Physics, not metaphor at the floor.** The Maxwell's-demon framing is the literal DST controller
  (deterministic sort from the entropy reservoir); the "accounting" is the real ledger write. The cost
  side (Szilard/Landauer) is the anchor for *why* every measurement is recorded, not discarded.

## Rooms are definitions of useful work; they require hats; agents pick hats per iteration (Aaron 2026-06-10)

> Aaron: "so our tests/rooms become definitions of useful work and certain rooms require certain hats."
> · "the agents can decide which hats to wear for the room on each iteration."

A room (cell/test) is not just a boundary — it is a **definition of useful work**: a named, bounded
unit whose ΔU posted to the ledger *is* its value (ties every-bug-has-economic-value — useful work =
measured uncertainty reduction, banked). The substrate's work is the set of rooms.

- **Rooms require hats.** A room **declares the capabilities it needs** — its required
  [`hats/`](../../hats/) (the persona/capability hats; cf. the `hat-system` CRD in
  `full-ai-cluster/k8s/applications/hat-system` — `hat`/`hatpolicy`/`hatswap`). A crypto room requires
  the security/PKI hat; a math room requires the formal-verification hat; etc. The room's hat
  requirement is part of its definition (what skill the work needs).
- **Agents choose hats per iteration.** An agent entering a room **decides which hat(s) to wear for
  that room on each iteration** of the loop (`sim |> mea |> cut`, then re-iterate via `res`). Hats are
  not fixed to an agent — they are worn per-room, per-iteration, dynamically (the architect-hat-may-be-
  worn-by-any-persona principle; `hatswap` is the mechanism). So the SAME agent wears different hats in
  different rooms, and may swap hats between iterations of the same room as the work demands.
- **Why per-iteration.** Useful work shifts as a room converges (`res` loops until ΔU→0): early
  iterations may want an explore hat, later ones a verify/harden hat. Letting the agent re-choose each
  iteration matches the hat to the current phase of the work — weight-free (no hat permanently
  captures an agent) and self-similar (same choose-a-hat move at every iteration).

## Anchors (Beacon)

- **Cell theory** (Schleiden/Schwann 1839) + the **cell membrane** — the bounded unit of life.
- **Markov blanket** (Pearl) + **Friston's free-energy principle / active inference** — which models a
  cell/organism *as* a Markov-blanketed unit that infers across its boundary. This is the precise
  formal anchor: "cell with a strict boundary" = "system with a Markov blanket."
- **C. elegans** (Brenner) — fixed-lineage cells composing a deterministic organism (the superorganism
  films).
- **FoundationDB DST** (Zhou et al.) — strict isolation as the precondition for deterministic replay.
- Process/worktree isolation — the engineering instance of the membrane.

*(Peel: "cell / membrane / superorganism" is the biological framing; the load-bearing literals are the
finalizer tick + the DI-injected boundary + DST isolation. The Markov-blanket↔cell correspondence is a
real formal anchor (Friston) to develop with the math team, not yet a built theorem.)*

## Ties / routing

[`bounds/`](../../bounds/) (the Markov boundary / collective-we membrane) · `src/Core/Finalizer*.fs`
(test = tick = cell) · `src/Core/Sim.fs` + [`clis/`](../../clis/) (the `sim |> mea |> cut` loop inside
the cell) · `same/` (the ctxboundary = membrane) · `Skadium.fs`/`DarkHall.fs` (the Henderson cells) ·
the worktree-isolation rule (cells don't race) · C. elegans superorganism · S=4 (cells phase-locked).
**Routes to:** Soraya/Sova (formalize cell = Markov-blanket via Friston), Aaron (the synthesis).
