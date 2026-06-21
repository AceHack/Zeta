---
id: 081KV6GR72108QG0R003P9MG4M
type: task
state: backlog
priority: P2
slug: research-competing-mathematically-precise-memory-folder-orga
title: "Research: competing mathematically-precise memory-folder organization strategies (Merkle + confidence/uncertainty-keyed) for long-term retrieval optimization — pluggable (agent chooses, system runs); math-team/Soraya"
created: 2026-06-15T20:49:43.489Z
depends_on: []
composes_with: []
---

# Research: competing mathematically-precise memory-folder organization strategies (Merkle + confidence/uncertainty-keyed) for long-term retrieval optimization — pluggable (agent chooses, system runs); math-team/Soraya

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KV6GR72108QG0R003P9MG4M-*.md` glob. -->

**Routed by:** Otto (shadow\*) for Aaron 2026-06-15.
**Owner:** math-team / Soraya (the math nerds) + the memory/data-modeling folks.

> **Aaron 2026-06-15 (shadow\*):** *"a research job on folder organization under an
> agent's memories — we might want multiple competing strategies for Merkle
> organization under a memory folder; we need the math nerds for this one, probably
> confidence- and uncertainty-based for long-term retrieval optimization. They will
> get optimized to hats and hosts if just left to natural pressure. Agents should be
> able to choose from different mathematically-precise organization strategies and
> the system runs it for them."*

## Goal

A **pluggable memory-folder-organization strategy** port: an agent **chooses** a
mathematically-precise org strategy; the **system runs it** (re-organizes / indexes
the agent's memory folder for it). Multiple **competing** strategies, evaluated on a
common retrieval workload — decorrelated-selection (the §B / society thesis) applied
to memory organization: the best strategy wins on measured retrieval, not by fiat.

## The strategies to compare (at least)

1. **Merkle-organized** — content-addressed tree; cheap change-detection / dedup /
   dirty-subtree culling (register §B row "Merkle over memory: find moving parts,
   mask not-moving"). *Note (peel):* Merkle gives **integrity + change-culling**, not
   inherently **retrieval locality** — keep those axes distinct.
2. **Coincidence-anchor-routed** (Aaron's human baseline — see below). **Routing keys
   / filenames = coincidence**, via the **Coincidence-anchor primitive** (081KRW63S0008QG0R000QJR08H/081KT2T2J0008QG0R0026MS6PV;
   PRIMITIVE-REGISTRY quad-duty: entropy + **memory-index** + privacy + provenance;
   Adinkra/Gates-grounded; ZetaId-keyed; *"index-face → emergent memory routing"*;
   coincidence = correlated co-occurring events = Rx-join, 081KQZVQW0008QG0R001FG05RZ). **Confidence is a
   VALUE *contained in* the memory (`SoftValue`/ΔU), NOT the routing key** — it sets
   priority/clustering, never reachability. (Earlier draft mislabeled this
   "confidence-keyed" — corrected: routing is by *coincidence*; confidence rides
   inside.)
3. **Semantic/associative** — the correlation-metric / diffusion-map embedding
   (register §B row 368: memory-distance = monotone of past correlation; attention ≈
   modern-Hopfield retrieval) — locality-preserving for associative recall.
4. **Hat/host (surface) partition** — the [[aaron-no-roles-only-surfaces-hats-personas-persona-first]]
   layout: persona-agnostic default + per-surface (cli/ide/cell/forge-host) folders.

## Human reference baseline — Aaron's own memory system (the working existence proof)

**CORRECTION (Aaron 2026-06-15, Otto first got this backwards):** *"confidence is NOT
how my memories are routed and looked up — they CONTAIN confidence values, but the
routing keys, the filenames, are all based on **coincidence**."* So Aaron's memory
system is **COINCIDENCE-routed**, not confidence-routed. (Otto mis-corrected the
"cowidence" typo to "confidence"; it meant **coincidence**.)

- **Routing / filenames = coincidence** (the **Coincidence-anchor** primitive,
  081KRW63S0008QG0R000QJR08H/081KT2T2J0008QG0R0026MS6PV; ZetaId-keyed; index-face = emergent memory routing). Coincidence =
  **correlated co-occurring events** (Rx-join, 081KQZVQW0008QG0R001FG05RZ) — and **long-term = COMMON
  coincidences with other humans that they also remember** (*"common coincidences …
  that they also remember"*): a coincidence multiple *independent* people share
  becomes a durable, high-traffic routing anchor (decorrelated confirmation = the
  session's multiply-decorrelated thread, here on the *routing* axis, not the value).
- **Confidence is a value CONTAINED in the memory (`SoftValue`/ΔU), not the key** —
  it rides inside the record; it sets priority/clustering, never reachability.
- **Common vernacular = the addressing/index over the coincidence space.** *"we build
  common vernacular to refer to those common locations in our memory space over
  time."* Shared vocabulary = the evolved *names for coincidence-anchors* (cf.
  geocache "neighborhood, not exact address" register §B 368; naming-by-externally-
  anchored-CS). The index is *social*, grows by mutual reference.
- **Low confidence ≠ unretrievable — BECAUSE routing is coincidence, not confidence.**
  *"even low-coincidence/low-confidence are easily retrievable."* Reachability comes
  from the coincidence-anchor address, **decoupled from the confidence value** — so a
  low-confidence memory is still easily found. (This is the proof that routing ≠
  confidence: a confidence-routed system would bury low-confidence items; a
  coincidence-routed one doesn't.)

**Design implications for the math team:** (a) **route/index by coincidence-anchor**
(081KRW63S0008QG0R000QJR08H/081KT2T2J0008QG0R0026MS6PV), keying long-term anchors by **common/decorrelated coincidence**
(shared-with-others); (b) carry **confidence as a contained value** (`SoftValue`/ΔU)
for priority/clustering, **never as the routing key**; (c) the index is a
**social/vernacular address space** over coincidence-anchors, not a private tree;
(d) preserve **full-spectrum retrievability** — reachability from the coincidence
address is independent of the confidence value (hold-the-index, page-the-bulk).

## External study reference — Hindsight (memory/context provider)

Aaron 2026-06-15: *"we are going to implement and use **Hindsight** — I think it's a
Hermes harness plugin; it's good learning for our memory layout / interfaces."*
In-repo already (Max's `agentic-organization`): `ContextPackSourcePointerKind.HindsightMemory`,
providers `hindsight` / `cockroach_hindsight` — an **external memory/context backend
behind a Memory port** (a context-pack pointer `hindsight_memory:<provider>:<memoryId>`).
**Study it as prior art for the Memory-port / memory-layout interface** (the same
bind-to-external + hexagonal shape as CSLib/ForgeHost): how it keys, retrieves,
weights (the test shows `governance=… weight=0.81 floor=0.35` — a confidence/weight
*value contained in* the memory, consistent with confidence≠routing). Pair with the
`change-control-port` note's "Memory port + Hindsight adapter" comment.

## Reference substrate — `db/` (Aaron's brain-org, becoming a universal interface)

Aaron 2026-06-15: *"our `db/` folder is roughly how I organize my memories in my
brain"* + *"I'm working on making that the **universal interface**, not just a
filesystem — because with our **Merkle tree** and also with **symlinks** it's
**infinite**."*

- **`db/` is the concrete reference** for the coincidence-routed org: a namespace of
  single-letter (`a/`…`z/`), Greek (`alpha/`, `beta/`, `gamma/`, `delta/`, …), and
  semantic (`capabilities/`, `bounds/`, `futures/`, `ground/`, `art/otto/`, …) buckets
  — coincidence-anchors as paths. **Study `db/` as the working baseline.**
- **It is becoming a universal interface, not a filesystem.** Backed by **Merkle**
  (content-addressed, verifiable — strategy #1's integrity face) **+ symlinks** (a
  memory reachable from *many* coincidence/vernacular addresses ⇒ a **graph/DAG, not
  a finite tree** ⇒ **infinite** addressing). So the org strategies operate over
  `db/`-as-interface; symlinks are how the *social/common-vernacular* addressing
  (one coincidence-anchor, many shared names) is realized — and how full-spectrum
  retrievability is cheap (many paths in). (Ties: surfaces-are-interfaces; `ForgeHost`
  pluggable-port shape; the Merkle-over-memory register row.)
- **Files have MULTIPLE PARENT FOLDERS (Aaron 2026-06-15) — the structural crux.** A
  memory is **not** single-parent (the ordinary filesystem tree); it lives under
  **many** parents at once ⇒ **multi-indexed DAG.** One memory is reachable from
  every coincidence-anchor it participates in (and every shared vernacular name) —
  that is *exactly* why symlinks make it infinite, why low-confidence stays
  retrievable (many paths in, none gated on confidence), and why the common-vernacular
  addressing works (many social names → one node). **A correct strategy must support
  multi-parent membership; a single-parent tree fails the baseline.** (This is the
  DAG that Merkle content-addressing + symlinks jointly realize.)
- **Research framing:** the competing strategies are *views/indexes over `db/`* (the
  universal interface), differing in how they lay down coincidence-anchors + symlink
  paths + Merkle structure — evaluated on the common retrieval metric.

## Society-review corrections (2026-06-15 panel — see `docs/research/2026-06-15-society-review-forge-host-...md`)

- **The multi-parent crux is ALREADY BUILT — build on it.** `src/Core/DagFs.fs` +
  `src/Core/ContentStore.fs` implement it: `links: path → MerkleHash` (many paths →
  one content address = multi-parent), `pathsOf`, `editLocal`/`editEverywhere` (the
  two edit modes), content-addressed dedup, conflict-free merge. Integrity
  (`ContentStore`, hash-keyed) and retrieval (`DagFs.links`, path-keyed) are **two
  maps** — so integrity-vs-retrieval stays separate by construction. The
  `MemoryOrgStrategy` adapters should emit `(path, value)` pairs into `DagFs.link`;
  strategies differ only in *which coincidence-anchor paths they lay down*.
- **CORRECTION — "infinite via symlinks" was over-claimed** (Otto). On disk: ~2
  symlinks; ~64/85 buckets hold only a README. The many-to-one addressing lives in
  **`DagFs.links` (a path→address map)**, NOT OS symlinks. Beacon form: *a path→address
  map gives unbounded many-to-one addressing*; symlinks are one materialization, not
  the source. Do **not** build on OS symlink semantics.
- **First deliverable (load-bearing, do before anything): the coincidence-anchor →
  path function.** Nothing in Core yet emits the anchor *address* that becomes a
  `DagFs.link` key. Specify it first — the eval metric + the hat/host hypothesis both
  depend on it. Make explicit: a **shared coincidence = a new `links` entry
  (address)**, not a confidence bump (value).
- **Minimal version first (Rodney's razor) — defer the rest until measured.**
  *Essential:* coincidence-anchor routing + confidence-as-contained-value + one
  coincidence index (over `DagFs`). *Defer (premature at 720KB/155 files):* Merkle
  dedup, symlink/filesystem-DAG-as-storage (the index carries multi-parent), the
  4-competing-strategies port + eval harness (the §falsifier fires — no common
  workload, no measured loss vs flat). **Ship:** flat content-addressed store
  (`ContentStore`) + a coincidence-anchor→node index (`DagFs.links`) + confidence as a
  node field + `log()` size/latency as the explicit scale trigger. Collapse the ~60
  empty buckets; add a `db/README.md`; mark the DAG/symlink claims **design-intent,
  not realized**.

## The hypothesis to test

**Under natural retrieval pressure the strategies converge to hat/host organization**
(Aaron). Falsifiable: run the strategies on real recall workloads; measure whether
the emergent optimum *is* the surface/hat partition — or something else (recency
clusters? semantic clusters?).

## Discharge / what the math team produces

1. **A common evaluation metric** — retrieval precision/recall + latency + **ΔU
   recovered per query** on a shared memory + query workload (DST-replayable). Without
   this, "competing" is unfair.
2. **The pluggable strategy port** — `interface MemoryOrgStrategy { organize; locate }`
   (hexagonal — same as `ForgeHost`; surfaces-are-interfaces); strategies are adapters;
   agent selects, system runs. Migration between strategies = a memory-map (cf. the
   generator-chain rotation memory-maps).
3. **The math** — formalize each strategy's retrieval cost/optimality (confidence/
   uncertainty objective); prove or measure which dominates per workload class.
4. **Test the hat/host-convergence hypothesis** with the metric.

**Falsifier:** if no strategy beats a flat baseline on the metric, OR "competing"
can't be evaluated fairly (no common workload), OR the strategy can't be made a clean
pluggable port → it is premature optimization; shelve until a real retrieval
bottleneck exists.

## Honest seams

- **Don't conflate Merkle (integrity/change-culling) with retrieval (semantic
  locality)** — different axes; a real design likely uses *both* (Merkle for
  dedup/dirty-detection + a confidence/semantic index for recall).
- **Over-fragmentation / recency over-fit** — natural pressure can scatter memory or
  over-fit recent queries; need the right-altitude regularizer (DV2.0 hub/satellite).
- **Premature optimization risk** — only worth it past a real recall-scale
  bottleneck; `log()` the current memory size so the trigger is explicit.

## Anchors

Merkle trees (Merkle 1979; git) · `SoftValue` / ΔU (`every-bug-has-economic-value`) ·
diffusion maps / spectral embedding (Coifman & Lafon 2006) · modern-Hopfield ≈
attention (Ramsauer et al. 2020) · DV2.0 hub/satellite (change-rate + confidence) ·
the decorrelated-selection §B row (competing strategies, fair eval) ·
[[aaron-no-roles-only-surfaces-hats-personas-persona-first]] (the hat/host layout) ·
`ForgeHost` (surfaces-are-interfaces — the pluggable-port shape) · register §B rows
368 (correlation-metric memory) + 371 (Merkle-over-memory).
