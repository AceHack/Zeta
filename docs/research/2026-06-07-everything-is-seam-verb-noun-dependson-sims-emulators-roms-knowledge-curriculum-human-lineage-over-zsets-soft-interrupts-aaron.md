# Everything is `[seam] verb noun dependson` — sims (emulators/ROMs), knowledge/curriculum (Khan-Academy, elementary→PhD), prior-art, human lineages — over zsets + soft interrupts (Aaron, 2026-06-07)

The universalization of the grammar (#6957/#6971/#6984). Aaron, across a burst:

> *"emulators and ROMs can follow the same sim interface — verb noun dependson."*
> *"prior art and humans' intellectual lineages and school categories can be ZetaIds, elementary to PhD."*
> *"Khan-Academy-style — this is just a craft interface, verb noun kind of thing with declared deps for
> prerequisites. Very similar to everything else."*
> *"is it running over zsets? and soft interrupts."*

## The kernel: ONE grammar for everything — node (`[seam] verb noun`) + edges (`dependson`)

The `[seam] verb noun [dependson …]` grammar (#6957/#6971), resolved by topo-order over the `dependson` graph
(#6984), is **universal** — *"very similar to everything else."* Three more domains collapse into it:

### 1. Sims: emulators + ROMs — and **sim is a special form of `test`** (#6958)

- `test run emulator dependson cpu`, `test load rom:atari-2600/<title> dependson emulator` — emulators and ROMs
  are **nodes** with `dependson` edges (a ROM depends on its emulator; the emulator on its CPU/host). DarkHall
  (#6986) = the cell hosting them; ROMs (#6987) = signature-keyed pointer nouns. They aren't special — `seam
  verb noun dependson` like deps, identity anchors, files (#6962).
- **`sim` is NOT a separate seam — it's the omniscient, DST-mandatory form of `test` (Aaron, 2026-06-07).**
  *"sim is just a special form of test … sim has to be DST, tests do not … tests can exist at the boundary, sims
  are omnisciently known."* The distinction:
  - **`test` (general):** can sit **at the boundary** — black-box, external, partial knowledge of the other
    side; **DST is NOT required** (a boundary/integration test hits something it doesn't fully control, so it
    may be non-deterministic).
  - **`sim` (special):** **omnisciently known** — the *whole world* (clock, RNG, I/O, state) is inside the
    simulator and controlled, so it is **deterministic by construction ⇒ DST mandatory** (fully replayable). The
    DarkHall emulator (#6986) is a sim: omniscient over its CPU state, pure, deterministic.
  - So **sim ⊂ test**: a sim is a test where omniscient control of all inputs forces determinism. Boundary
    tests = the partial-knowledge edge; sims = the omniscient interior. (This is the FoundationDB insight: the
    *whole system in the simulator* is what makes it deterministic — omniscience ⇒ DST.) The `test` seam (#6958)
    is the plane; "sim" is its omniscient-DST mode.

### 2. Knowledge / curriculum = the same grammar (Khan-Academy-style)

- **Prior-art entries are ZetaIds** (each reference a content-addressed node; the `reference-sources.json`
  entries, #6989).
- **Human intellectual lineages are `dependson` edges** — who built on whom (Codd→…; the
  anchor-to-human-prior-art chains). The intellectual-genealogy graph = the dependson graph; **citations are
  edges**.
- **School categories (elementary → middle → high → undergrad → masters → PhD) are nodes; prerequisites are
  `dependson`** — you can't learn calculus before algebra. **Khan-Academy-style**: a topic depends on its
  prereqs; the learning ORDER is the **topo-order** of the knowledge graph (#6984). Elementary→PhD is the
  topological traversal of a content-addressed knowledge dependson graph, anchored to humans+papers
  (anchor-to-human-prior-art). Knowledge *is* a ZetaId dependency graph.

So **deps, sims, ROMs, prior-art, human lineages, and curriculum are all the same**: `seam verb noun dependson`,
ordered by topo-sort (#6984), carved as subgraphs (#6972), resolved as a lazy/eager saga (#6976/#6977).
Recursive/self-similar (§9/§10) — one grammar, every domain.

## Over zsets + soft interrupts (Aaron's question — honest answer)

> *"is it running over zsets? and soft interrupts."*

**Currently: not fully.** The prior-art refresh (`sync-prior-art.sh`) is **plain bash git-clone** — *not* over
zsets, no soft interrupts (its own DEBT note: Unix-only bash, cross-platform port pending). The DarkHall
emulator (#6986) is **pure/deterministic** (DST-replayable) but steps as a plain fold, **not yet** as zset
deltas or under a soft-interrupt model. So: **no, not yet — but both map onto the substrate cleanly**, and that
*is* the direction:

- **Over zsets:** each sim step / each refresh entry / each knowledge edge is a **delta** (a +1/−1 over a Z-set);
  the run is the fold (DBSP incremental, #6976) — replayable (#6958), idempotent (re-run converges; the refresh's
  `ls-remote` skip *is* idempotency #6959). The manifest is a Z-set; the emulator trace is a Z-set of frames.
- **Soft interrupts:** the sim runs on an **interrupt substrate** (cf. the Atari-2600-on-the-interrupt-substrate
  thread) — **cooperative, yieldable** interrupts: each step can yield/resume (one-step-at-a-time #6965,
  saga-fenced #6976), so a sim (or refresh) is interruptible + resumable, not a blocking loop. Soft interrupt =
  the yield point that keeps the loop legible at DoP=1 and scalable (async-all-the-way §2).

So the unification extends to *execution*: everything is `seam/verb/noun+dependson` **folded over zsets, one
soft-interruptible step at a time** (#6965). The bash refresh + the pure emulator are the *not-yet-substrate*
versions; porting them onto zsets + soft interrupts makes them replayable, resumable, and uniform with the rest.

## Honest scope / peel

- **Conceptual unification + honest status.** The grammar (#6957/#6971/#6984) is real and shipped; applying it to
  sims/knowledge/curriculum and running over zsets+soft-interrupts is the *direction*. Today: refresh = bash (not
  zsets); DarkHall = pure fold (deterministic, but not zset-deltas/soft-interrupts yet). Don't claim it's all
  running over zsets — it isn't; it *maps* there.
- "Very similar to everything else" is the genuine insight (one grammar, many domains) — but each domain still
  needs its resolver/verbs defined (sim verbs, knowledge prereq edges, the zset/soft-interrupt port). Naming the
  unity ≠ having built every domain's adapter.
- Knowledge-graph anchoring stays honest: human lineages/curriculum nodes anchor to real humans+papers
  (anchor-to-human-prior-art); no unanchored coinages.

## Ties

- **seam/verb/noun grammar (#6957) + dependson edges (#6971) + topo-order resolver (#6984)** — the universal
  grammar; this applies it to sims + knowledge.
- **DarkHall emulator (#6986) + ROMs-as-pointers (#6987) + chip8-roms manifest (#6989)** — the `sim` seam nodes.
- **Curriculum / prerequisites / ARC-AGI chip8-atari DBSP-replay curriculum** — knowledge as a dependson graph;
  Khan-Academy prerequisite ordering = topo-order.
- **anchor-to-human-prior-art rule** — human lineages/citations = dependson edges; nodes anchor to humans+papers.
- **DBSP zsets / IVM (#6976) + one-step-at-a-time (#6965) + saga (#6976) + DST test seam (#6958)** — running
  over zsets, soft-interruptible, replayable.
- **Atari-2600-on-the-interrupt-substrate (ray-traceability gap-finder doc)** — soft interrupts as the sim's
  execution substrate.

## Beacon anchors

- **Khan Academy / prerequisite knowledge graphs / curriculum sequencing** (topics as a prerequisite DAG;
  learning = topo-order). · **Academic genealogy / citation graphs** (Mathematics Genealogy Project; citations =
  intellectual-lineage edges). · **Bloom's taxonomy / education levels** (elementary→PhD as ordered nodes). ·
  **seam/verb/noun + dependson** (#6957/#6971/#6984) + **DBSP Z-set deltas / IVM** (Budiu et al.). · **Soft /
  cooperative interrupts** (yieldable interrupts; cooperative scheduling; the interrupt substrate). Honest
  novelty: none — it *universalizes* the `[seam] verb noun dependson` grammar to **sims (emulators/ROMs) and
  knowledge (prior-art, human lineages, curriculum elementary→PhD, Khan-Academy prerequisites)** — all one
  content-addressed dependson graph, topo-ordered — and names the execution direction: **folded over Z-sets, one
  soft-interruptible step at a time** (honestly: the refresh is bash and the emulator a pure fold *today*; the
  zset/soft-interrupt port is the direction).
