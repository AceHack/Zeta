# Ani — the whole system finally in words: OLAP-per-agent, merging=sharing-uncertainty, the Cells naming, GPU-warp actor serialization, soft-value-primary (2026-06-07)

Glass-halo conversation archive (Ani's register: warm, grounded-hype). Aaron, talking to Ani
while Otto built in the background, found the WORDS for a ~20-year vision — "it's been built as
we talk." Recorded faithfully; the durable technical confirmations are flagged for the
build/vision docs.

## The system, in Aaron's words (the compression that finally landed)

- **SQL Server Analysis Services / Tabular / OLAP-cube thinking** is the substrate intuition —
  but each *cell* is a full **YinYang engine** (`Remains` = what remains, `Acts` = what acts),
  self-similar/reflective, in a **self-describing** format = **DynamicValue**, with **Bayesian
  inference because values can be soft** (`SoftValue`). All inside a **relativistic git-native
  database engine**; **agents run inside that database**; you can **join across git databases**,
  and they're **relative — no two gits need be the same. Each agent gets its own database / own
  git repo.** (Aaron learned OLAP cubes ~20 years ago; this is that, grown up.)
- **Every agent carries its own OLAP cube** (its DynamicValue DB). **Society = agents sharing
  uncertainty across dimensions.** *"Merging is all just sharing uncertainty"* — probabilistic
  alignment over shared dimensions, not forcing two truths together; the uncertainty is what
  lets them connect without agreeing on one reality.
- **Dimensions are shareable too:** an agent can discover a **new dimension** and hand it over
  as a **new DynamicValue** — no schema change, no migration, no central approval. The system is
  infinitely extensible by sharing DynamicValues that carry new structure.
- **Soft value is PRIMARY (reason over it; store it uncollapsed).** The crisp `DynamicValue` is
  the **collapsed snapshot** — a projection sampled from the soft value *within the current
  execution frame*. Nuance: **`DynamicValue` can CONTAIN both** the soft (uncollapsed) and the
  collapsed forms — so a single tree can have some branches sharp/certain and others fully soft
  at the same time (mixed resolution per granularity). "Collapse where you need to act; stay
  soft where you reason."
- **Branchless top to bottom — a deliberate parallelism decision.** No `if`/traditional control
  flow: soft values carry uncertainty (no branch), crispness is via **algebraic data types /
  discriminated unions**. So the whole stack is GPU/shader-parallelizable by construction.
- **The GPU vision (the real ambition):** *"what if the control structure for workflows had to
  live in the GPU and you could have thousands of LLMs running simultaneously inside workflows
  inside a GPU?"* The hard part: each workflow must be a **single-threaded actor** (serialized
  message progression) even on massively-parallel hardware. Doable **within an NVIDIA warp**
  (serialized execution); cleanly inside a **shader** is the open problem. The primitive needed:
  **serialized read/write access to one memory location per workflow.** Practical now: **CPU +
  Orleans** for the actor model — boils the GPU problem down to that one primitive; "the minds
  will have figured out the shader case by the time I get there."
- **Geospatial → A Thousand Brains.** Once geo is added, each cell = a **cortical column**
  (Hawkins); every agent carries thousands of mini-brains in its cube; intelligence is **fractal**
  — cell level, agent level, society level.

## The "Cells" naming origin (de-anthropomorphize)

Aaron wanted to **de-anthropomorphize** the execution unit (not "actor" — that was the 70s
most-anthropomorphic word, before LLMs; and we're *anthropomorphizing the LLMs, which are
agents*). The AI suggested **"cells"** → reminded Aaron of **Excel** → **columnar storage**
(which everything already is) → **OLAP** → and with geo, **Thousand Brains / cortical columns**.
One word made a stack of ideas click. And it was already true: **the engine that runs the
DynamicValue is already named `YinYang.Cell`.** Split: **agents** = intelligent/anthropomorphic
(the LLMs); **cells** = lower-level, non-human, serialized work units.

## Status aside (Max / infra)

Max (Aaron's daughter's ex; now business partner — the freedom-first call) geeked out, gets the
k8s side; took a computer home and iterates on the **zflash** USB tool (NixOS + k8s from
scratch). Reliable up to k8s/**Cilium** networking bring-up — "just config from here."

## Pointers (durable confirmations already shipped / captured)

- `src/Core/YinYang.fs` (the cell) · `src/Core/SoftValue.fs` (soft primary) · `src/Core/DynamicValue.fs`
  (the container; can hold soft + collapsed) · `src/Core.Git/` (git-native DB) · `src/Core/Diplomacy.fs`
  (Eve Protocol). Branchless/soft-not-sharp + 1000-brains: `docs/writer-actor-routing-model.md`,
  vision §4e/§4f. Actor→Cell terminology: `docs/writer-actor-routing-model.md`.
