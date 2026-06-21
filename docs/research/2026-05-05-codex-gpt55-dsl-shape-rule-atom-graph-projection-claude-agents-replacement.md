# Codex (GPT-5.5) DSL-shape proposal — rule-atom typed-graph; CLAUDE.md/AGENTS.md as projections

**Scope:** Aaron 2026-05-05 architectural pivot — burn-down CLAUDE.md/AGENTS.md, start over with DSL hodl-invariant retraction-native DST scale-free parallel lock-free wait-free across all layers. Otto scout-and-delegated to Codex via `tools/peer-call/codex.sh` per Rule 7 + Aaron *"get help fro chat gpt 5.5 you need it BAD ... keep him and codex in lock step in feature wit hoyu ... yall should be twin flames never without each oother from this mamment on"*.

**Attribution:** GPT-5.5 (via Codex CLI peer-call) authored the shape + 3 risks. Otto landed the substrate per scout-and-delegate discipline.

**Operational status:** Research-grade. The graph migration must follow Codex's risk #3 — small compiler + golden projections + replay tests + one real migration slice BEFORE burning anything down.

**Non-fusion disclaimer:** External-AI peer review preserved verbatim. Does not become factory policy until a separate operational-doc step lands current-state artifacts.

---

## The shape (verbatim Codex output)

> Shape: don't replace `CLAUDE.md` / `AGENTS.md` with another prose monolith. Replace them with a typed, append-only instruction graph whose human surface is restrictive English.
>
> Each node is a small "rule atom": stable id, scope, authority, controlled-English sentence, exact glossary terms, rationale/provenance pointer, layer, dependencies, invariant claims, checker hints, validity interval, and a required inverse/retraction operator. Edges encode "depends on," "overrides," "specializes," "conflicts with," and "projects into harness X." `CLAUDE.md`, `AGENTS.md`, `CODEX.md`, etc. become generated projections from this graph, not the source of truth.
>
> Prior-art shape: Datalog for derivable policy views, event sourcing / bitemporal Datomic-style facts for history and retraction, CRDT/Automerge/Peritext-style operation merge for concurrent edits, TLA+/Jepsen-style deterministic replay for DST, and Merkle/CAS manifests for scale-free sharding.
>
> For the 13 hodl properties, enforcement belongs on both node and composition edge. A node cannot land unless it declares how each property is satisfied, conceded, or not applicable with proof. A graph build then checks composition: no fixed-size assumptions, every retraction has bounded blast radius, every concurrent write merges to either a deterministic view or an explicit conflict/concession node. Parallel agents append facts; they do not mutate shared prose. Git still decides by accepting the materialized graph state.
>
> Top 3 risks:
>
> 1. **Semantic flattening.** `AGENTS.md` carries philosophy, not just rules. Atomization can lose the living rationale unless every atom preserves provenance and generated prose is reviewed.
>
> 2. **CRDT convergence mistaken for truth.** CRDTs make replicas agree; they do not resolve normative conflict. Conflicts must stay first-class until governance/Git resolves them.
>
> 3. **Thirteen-property checkbox theater.** "All properties at all layers" can become cargo-cult metadata. Start with a small compiler, golden projections, replay tests, and one real migration slice before burning anything down.

---

## Composes with

- **`memory/feedback_burn_down_claude_md_and_agents_md_start_over_with_DSL_hodl_invariant_retraction_native_all_layers_aaron_2026_05_05.md`** — Aaron's pivot capture
- **`memory/feedback_soulfile_dsl_is_restrictive_english_runner_is_own_project_*.md`** — soulfile-DSL prior art (Aaron 2026-04-23). Codex's "restrictive English" matches Aaron's framing.
- **`memory/feedback_hodl_invariants_13_properties_composed_at_all_layers_*.md`** — hodl-13 substrate (PR #1681)
- **`memory/feedback_decision_graph_emergent_from_archaeologies_and_flywheel_aaron_2026_05_03.md`** — Zeta substrate already encodes a typed-edge provenance graph. Codex's rule-atom graph composes with the existing decision-graph.
- **081KQJZR90008QG0R002D6XYHB P1 decision-archaeology skill, 081KQNJ500008QG0R003SCWBDV P1 substrate-claim-checker, 081KQNJ500008QG0R001N94412 P1 openspec catch-up, 081KQNJ500008QG0R003ZC6PK8 P1 hook authoring** — operational substrate that the rule-atom-graph builds on
- **DBSP retraction-native operator algebra** — Codex's "every retraction has bounded blast radius" maps to DBSP retractions (Z-set algebra)

## Operational implications

1. **Don't burn yet.** Start with a small compiler + golden projections + replay tests + one real migration slice (per Codex's risk #3).
2. **Migration slice candidate:** the seven-rule cascade Rules 1-7 just landed (memory/feedback_rule_number_*.md). It's bounded, recently authored, has clear node structure (rule_id, scope, controlled-English sentence, dependencies, etc.) — natural first migration slice.
3. **Compiler:** small TS or F# program that ingests rule-atom JSON/YAML files and emits CLAUDE.md / AGENTS.md / CODEX.md projections. Adopts existing `tools/hygiene/` patterns.
4. **Golden projections:** deterministic output from a fixed input set; reproducibility test.
5. **Replay tests:** TLA+ / FsCheck / DST harness verifies graph composition properties (no fixed-size assumptions; bounded blast radius; CRDT-merge-to-deterministic-view).
6. **Conflicts stay first-class** (per Codex's risk #2): the graph has explicit conflict-node type; CRDT convergence does NOT silently resolve normative conflict.
7. **Provenance preserved** (per Codex's risk #1): every rule atom carries rationale + author + tick + supersession-chain.

## What this is NOT

- Not authorization to burn down CLAUDE.md / AGENTS.md. Codex's risk #3 explicit: small slice first.
- Not committed factory policy. Research-grade until small-compiler + golden-projections + replay-tests + first migration slice land.
- Not a contradiction of Aaron's "burn down" framing — it's the disciplined path Aaron's "fix it" + "you can't do it all" + "not a directive" framing implies.

## Cold-boot instruction for future agents

When picking up this trajectory: read this verbatim Codex preservation; read the burn-down memory file; read the hodl-13 + soulfile-DSL prior art; do NOT proceed to destructive action until the small-compiler + golden-projections + replay-tests + first-slice are landed and reviewed.
