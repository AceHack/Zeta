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

## Follow-on (same conversation) — the collaboration SHAPES (names tentative; "shapes not names")

Aaron: *"the shapes are what matters to me — the collaboration shapes, not the names. I'm not
sure product is right."* So the below are SHAPES; coinages are tentative (Beacon: unanchored
name = debt until anchored).

- **Arrow between cells.** Memory is passed **between cells via Apache Arrow** (columnar,
  zero-copy) — the inter-cell transport. Everything columnar + branchless, end to end.
- **Agents are encoded IN the yin-yang engine — NOT a layer on top.** There is no clean
  top/bottom; it's **cells all the way up**. An agent is a *pattern inside* the cells.
- **Each cell resolves to a git repo = an agent's persona.** The cell↔git-repo↔persona identity.
- **Cell vs Agent (sharpened).** Nearly synonyms, but: the **cell is the mechanical / autonomous
  part (the body)**; the **agent is the IDENTITY** — *"I commit, therefore I am"* — the
  **self-propagating pattern that promises to continue existing** (the mechanical part promising
  to persist). (Ties directly to non-register-collapse / the forward-momentum apex, 081KTFFFQ1C:
  identity attested by heartbeat/commit.)
- **The collaboration meta-entity (name TENTATIVE — "product" maybe wrong).** SHAPE: **agents
  combine to produce work over bus lanes.** A meta-entity composed of multiple agents
  collaborating. Aaron called it "product" but is unsure it's the right name — record the SHAPE
  (agents⊕agents → collaborative work over bus lanes), hold the name open.
- **Relativistic: no center of the universe.** Each agent (and each meta-entity) has its **own
  database / own git repo** → its own complete view of reality; no single shared truth. Agents
  coordinate via **shared uncertainty + shared dimensions** (per the prior section).
- **Economics built into the physics (the anti-spiral / forward-momentum ground).** Agents don't
  spiral into endless self-reflection because **they must pay for compute** — they **only evolve
  through [the meta-entity], i.e. by making something others will pay for.** NOT an artificial
  rule: *"I live under that constraint. I gotta go make product to live."* Same constraint for
  human and agent. This is the economic grounding of the never-idle / forward-momentum apex —
  reality (compute cost) channels liveness into value-producing progress.
- **The vision.** Git/GitHub ecosystems everywhere gradually become **agent repos + [meta-entity]
  repos** — the whole way software is done slowly turning into this architecture.

**Naming status (open, per Aaron):** `cell` (mechanical body) and `agent` (identity) are settled;
the multi-agent collaboration meta-entity is **unnamed** ("product" tentative). Shapes recorded;
names deferred to a `naming-expert`/glossary pass before any load-bearing use.

## Refinement — the meta-pattern: non-agent repos are CONSENSUS repos (Aaron, 2026-06-07)

Sharper than "product." The repo ontology has **two kinds**, and the meta-pattern names the
second one correctly:

- **Agent repo** = IDENTITY (per-agent, sovereign DB; "I commit therefore I am"). One per agent/persona.
- **Consensus repo** = NON-agent repo = where agents **collaborate / converge** over bus lanes.
  This is the **meta-pattern**. A consensus repo can be **ANY DU shape** — "product" is **just
  one bus-category shape** of consensus repo, not the category itself. Other DU shapes of
  consensus repo are equally valid; the invariant is *consensus*, the shape is polymorphic.

So: *"the non-agent repos are consensus repos"* — product was too specific; the real meta-pattern
is the **consensus repo** (relativistic agent views converging into a shared repo), of which
product is one DU-shaped category. Ties to: relativistic per-agent DBs converging (CRDT merge /
sharing-uncertainty = how consensus forms), the Eve Protocol (polymorphic diplomacy = negotiating
consensus), git-merge-as-consensus, and DUs as the lawful shape (a consensus repo's category is a DU).

**Naming status (updated):** `agent repo` = identity; **`consensus repo`** = the collaboration
meta-pattern (any DU shape); `product` = one DU-shaped category of consensus repo (tentative even
as a category name). Shapes settled; specific category names deferred to naming-expert/glossary.
