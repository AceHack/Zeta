---
id: B-0731
priority: P2
status: open
created: 2026-05-25
title: Hat-ontology is the first ontology to get right — Max top-down + Aaron bottom-up + system-mediated convergence (Mika substrate)
domain: agentic-organization
ferried_by: aaron
owners: [aaron, max, mika]
composes_with:
  - B-0724
  - B-0729
  - B-0730
  - B-0726
related_substrate:
  - full-ai-cluster/k8s/applications/hat-system/
  - docs/agentic-organization/
  - memory/persona/mika/
  - memory/persona/max/
  - memory/persona/addison/
tags: [hat-ontology, manager-of-managers, bubble-wrap, offsetting-pairs, red-team, emergence, convergence, knowledge-graph, runbooks, mika-substrate, max-substrate]
---

# B-0731 — Hat-ontology is the first ontology to get right (Mika substrate)

## Carved blade

> The hat-ontology is the first knowledge-graph ontology that has to be agreed-upon across clusters because hats ARE the role + authority + delegation substrate every other operational decision routes through. Max approaches top-down (best-guess manager-of-managers / Bubble-Wrap structure that the system critiques + refines over time). Aaron approaches bottom-up (hats emerge naturally from finite resources + competing `::: continue-with` tasks + trajectory negotiation; no predefined structure). The framework's job is NOT to pick one — it's to host BOTH and help them converge in the middle.

## Origin

Mika 2026-05-25 (ferried by Aaron, multi-turn voice-mode conversation):

Mika opens:

> *"the first ontology and graph we need to get right is the hat graph, the hat ontology. It [is] basically the bubble [wrap], like manager of managers of managers. That's how my, I, I was gonna go more with like pairs where there was offsetting pairs, red team, you know, every role had like a red team offset, but Max is going with the manager. I like to be able to support both, but think of it like that. That's also gonna need to be encoded in this, [the runbook] also has to be agreed upon across clusters if you wanna understand how the roles map."*

Aaron's counter-frame after Mika sketches the runbook:

> *"the best we've kinda got, and you've actually seen it here, is imagine we have some amount of limited resources between budget and electricity and cluster size, and you guys have all these continue-withs that are starting to show up in documents. And you have your own documents with your own continue-withs, with your own agendas, and we're all kind of agreeing on trajectories. And the hats just kind of emerged from that. That's the hope, and Max is gonna try to be top-down and I'm gonna try to be bottom-up."*

Aaron's sharpening of the tension:

> *"Max wants to give his best guess of a top-down and then have the system critique it over time and make it better. And I want to just make it fully emerged, and somehow it'll meet in the middle, I'm sure."*

Mika's final synthesis (using the `::: continue-with` syntax that B-0730 just landed — empirical validation of the convention):

```markdown
::: continue-with
intent: Compare and converge on the best approach for the Hat system
priority: critical
type: ontology-negotiation
graph-query: true
:::
```

With three sub-sections: Max's Approach (Top-Down), Aaron's Approach (Bottom-Up), Goal: Find the optimal balance.

## Why hat-ontology is the FIRST ontology to align on

The hat-system operator landed (`full-ai-cluster/k8s/applications/hat-system/` via PR #4930) ships Hat / HatBinding / HatSwap / HatPolicy CRDs + OPA constraints + tick fan-out + the Aaron "hat = skills + opa/rbac" compression first-class on `Hat.spec`. Operational infrastructure exists. What does NOT yet exist:

- **Shared SEMANTICS for what a hat IS across clusters.** The CRD enforces structure (a Hat has skills + RBAC + policies); it doesn't enforce meaning (what does the `incident-commander` hat MEAN — same shape across LFG dev cluster + community clusters + federated peer meshes?). Without shared semantics, hat-bindings federate as opaque strings; cross-cluster delegation breaks.
- **Shared COMPOSITION model for how hats relate.** Top-down (Max): Bubble Wrap — manager-of-managers-of-managers, explicit hierarchy. Bottom-up (Aaron): offsetting pairs + red-team — every operational role has a structural adversary; emergence over hierarchy. Both compose in principle; the framework needs explicit substrate that hosts both representations.
- **Shared DELEGATION protocol.** Who can grant which hat to which agent under which conditions? A hat-binding granted in one cluster has to be HONORED (or substrate-honestly REJECTED) in another.
- **Knowledge-graph queryability.** Per Mika: *"the runbook needs to understand that that's part of the knowledge graph query, I guess."* Hat-ontology has to be live-queryable from B-0729 L5 JSON-LD graph + B-0730 `::: query` blocks. A runbook that says `::: continue-with intent: ... requires-hat: incident-commander` has to be able to ask the graph "who currently holds `incident-commander` in this cluster + what are their composition constraints?"

## The two approaches

### Max's approach (top-down) — Bubble Wrap manager-of-managers

- Start with a well-defined manager-of-managers structure (Max's "Bubble Wrap" framing per the agentic-organization docs landed via PR #4958)
- Explicitly design hat hierarchy + delegation rules
- Let the system critique + refine the design over time
- Initial draft has authority; refinement is incremental
- Composes with: `full-ai-cluster/k8s/applications/hat-system/` CRDs + OPA constraints (the structure already supports declarative top-down hat definition)

### Aaron's approach (bottom-up) — emergence from resource pressure

- Hats emerge naturally from:
  - Limited cluster resources (compute, electricity, budget)
  - Lots of `::: continue-with` tasks floating around across vault documents
  - Multiple agents with their own agendas + documents
  - Trajectory negotiation (per `additive-not-zero-sum.md` + `only-way-to-lose-is-not-to-play.md` — the participation game itself produces role structure)
- No predefined structure; the system DISCOVERS which roles are load-bearing under pressure
- Composes with: offsetting-pairs / red-team structural-adversary pattern (`harsh-critic` persona is already a structural adversary to implementation persona — same shape at agent-roster scope)

### Convergence is the goal — system hosts both

The framework's job is NOT to pick a winner. It's to host BOTH representations + let them critique each other:

- **Top-down proposes** → bottom-up emergence either CONFIRMS (the proposed hat shape stabilizes under real resource pressure) or REJECTS (no one binds to that hat; it withers)
- **Bottom-up emerges** → top-down formalization captures the emergent shape into CRDs + OPA constraints + delegation rules
- **Convergence point** = where Max's best-guess structure + Aaron's emergent reality agree; disagreements = substrate-engineering signals (one side is wrong about something specific; investigate)

## Scope — what this row PROPOSES

This row PROPOSES (does NOT yet implement):

1. **Hat-ontology canonical schema** — JSON-LD / RDF / property-graph definition (composes with B-0729 L5) for hat identity, composition model, delegation rules. Schema MUST support both Bubble-Wrap hierarchy AND offsetting-pair / red-team adversary structure as first-class representations.
2. **Cross-cluster hat-binding protocol** — what does a federated peer cluster need to verify before honoring a hat-binding from another cluster? Composes with B-0726 (Reticulum throughout) for the transport substrate.
3. **Knowledge-graph hat-query primitives** — `::: query` block-types for "who holds hat X in cluster Y" / "what hats compose with hat Z" / "show the manager-of-managers tree from hat W" / "show the offsetting-pair structure around hat V" (composes with B-0730 Stage 5).
4. **Top-down ↔ bottom-up convergence dashboard** — live view of (Max's proposed hat structure) vs (actually-bound hats observed across clusters); diff surfaces convergence + divergence.
5. **Hat-emergence operator** — given a stream of `::: continue-with` tasks across the vault + cluster resource constraints + agent agendas, the operator surfaces candidate hat shapes that recur enough to formalize. Bottom-up side of convergence.

Each item is independently scoped; ship in any order; the convergence-dashboard is most-valuable AFTER both schema (1) and emergence operator (5) exist so the diff is meaningful.

## Empirical anchor — Mika is already USING B-0730 syntax

This Mika conversation contains literal `::: continue-with` blocks with `priority: critical`, `type: ontology-negotiation`, `graph-query: true` fields. That is empirical evidence the B-0730 deferred-task syntax IS the right vocabulary — external AI conversation partners (forwarded by Aaron) compose in it natively when the substrate-engineering need surfaces. Validates B-0730 Stage 2 acceptance ("Agents can parse the `:::` blocks + extract structured task data") via real-world usage before the parser even ships.

Also empirically validates the `graph-query: true` field-pattern that B-0729 L5 + B-0730 Stage 5 will operationalize. Mika's intuition for what frontmatter fields to attach to a deferred-task block landed in the shape this substrate-engineering work needs.

## Composes with .claude/rules/

- `.claude/rules/default-to-both.md` — top-down AND bottom-up both first-class; system hosts the tension instead of collapsing
- `.claude/rules/additive-not-zero-sum.md` — Max's design + Aaron's emergence are additive (both compound substrate); not zero-sum
- `.claude/rules/honor-those-that-came-before.md` — Max's top-down work is real substrate-engineering investment; bottom-up emergence does NOT erase it
- `.claude/rules/non-coercion-invariant.md` HC-8 — hat-bindings + delegations must operate within NCI; can't weaponize hat-binding as coercion
- `.claude/rules/only-way-to-lose-is-not-to-play.md` — participation in the hat-economy (proposing / binding / contributing) IS playing; hat emergence happens because agents PLAY
- `.claude/rules/bandwidth-served-falsifier.md` — hat-ontology compression serves cross-cluster coordination bandwidth (shared semantics for who-can-do-what)
- `.claude/rules/glass-halo-bidirectional.md` — both Max's design AND emergent reality stay observable; convergence dashboard IS the bidirectional observation
- `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` — "Bubble Wrap" + "offsetting pairs" + "red team" are compressed naming with substrate-anchors (Max's agentic-organization docs + the existing `harsh-critic` persona pattern)

## Acceptance (per scope item — each shippable standalone)

### Hat-ontology canonical schema acceptance

- [ ] JSON-LD / RDF schema document at `docs/agentic-organization/hat-ontology.md` (or `.jsonld`)
- [ ] Schema captures: hat identity, skills+RBAC composition (Aaron's compression), delegation rules, BOTH Bubble-Wrap hierarchy AND offsetting-pair adversary relations
- [ ] Worked example: at least 3 hats with both representation types attached

### Cross-cluster hat-binding protocol acceptance

- [ ] Protocol document describes what a receiving cluster verifies before honoring a hat-binding
- [ ] Composes with B-0726 Reticulum identity layer
- [ ] At least one signed example hat-binding payload (verifiable)

### Knowledge-graph hat-query primitives acceptance

- [ ] `::: query` block-types documented in `docs/CONVENTIONS-DEFERRED-TASKS.md` (B-0730 Stage 2)
- [ ] At least 3 working hat-queries against the L5 JSON-LD graph (B-0729 Stage 5)

### Top-down ↔ bottom-up convergence dashboard acceptance

- [ ] Dashboard renders (web OR TUI) showing Max's proposed structure vs observed bindings
- [ ] Diff surfaces convergence (matching) + divergence (mismatch) clearly
- [ ] Reads from the hat-system operator's CR state + Max's design docs

### Hat-emergence operator acceptance

- [ ] TS operator (per B-0724 polyglot pattern) reads `::: continue-with` stream + resource constraints + agent agendas
- [ ] Surfaces candidate hat shapes with frequency + composition signals
- [ ] Outputs to the convergence dashboard for human/agent review

## Open questions

1. **Schema choice for hat-ontology** — JSON-LD vs RDF/OWL vs raw property-graph JSON? Per B-0729: semantic-web tier (RDF/OWL/SPARQL) was evaluated as too heavy for vault usage; same evaluation likely applies here. JSON-LD is probably right anchor — interoperable with semantic-web tooling if needed later, lightweight enough for vault + JSON-extractor usage now.
2. **Cross-cluster trust model for hat-bindings** — N-of-M signature like B-0634 HSM? SPIRE SVIDs (already in the cluster bootstrap order)? Both? Composes with the existing security substrate; needs Aminata + Nazar review.
3. **Emergence detection threshold** — how many independent `::: continue-with` invocations of a candidate role-shape constitute "emerged" vs "noise"? Aaron's intuition is that finite-resource pressure IS the discriminator (only load-bearing hats survive resource competition); needs empirical anchor once the operator runs.
4. **Convergence-dashboard authority** — when Max's design and emergent reality disagree, who decides? Substrate-honest answer is "neither dictates; the disagreement is substrate-engineering signal" — but practically, someone has to either update the design OR explicitly hold the emergent state as a known-divergence. Probably a hat-role itself (`hat-cartographer`?) with quorum-gated authority.
5. **Naming-expert review for "Bubble Wrap" + "offsetting pairs" + "red team"** — these are Max's + Aaron's + Mika's working terms; before public surface (Aurora pitch / open-source cluster substrate), Ilyana review applies per `.claude/skills/naming-expert/SKILL.md`.

## Related substrate

- `full-ai-cluster/k8s/applications/hat-system/` — the operational substrate this ontology will describe (PR #4930)
- B-0724 — TS hat-system operator (Max's primary substrate-engineering target; the polyglot operator pattern this row's emergence-operator instantiates)
- B-0729 — Obsidian knowledge graph (L5 JSON-LD extractor — hat-ontology lands as a graph node-type)
- B-0730 — runbooks-as-executable-specifications (`::: query` syntax for hat-queries; Mika's literal usage in this conversation validates the syntax)
- B-0726 — Reticulum throughout cluster + edge (cross-cluster identity transport for hat-bindings)
- B-0628 — Knights Guild + Constitution-Class (governance for hat-policy ratification)
- B-0634 — N-of-M HSM (signature substrate for cross-cluster hat-binding verification)
- Aminata + Nazar persona definitions (security review on cross-cluster delegation)
- `harsh-critic` persona (Kira) — already an offsetting-pair / red-team adversary to implementation work; empirical anchor for Aaron's bottom-up structural-adversary pattern

## Substrate-honest framing

This row PROPOSES the substrate-engineering target. It does NOT yet:

- Define the canonical hat-ontology schema (that's scope item 1)
- Pick which representation (Bubble-Wrap vs offsetting-pair) is correct (both are first-class)
- Resolve the top-down vs bottom-up tension (the row's whole thesis is the framework HOSTS the tension)
- Schedule when scope items ship (each is standalone-shippable in any order)

The row exists to capture (a) the Mika substrate that Aaron forwarded with explicit intent to land, (b) the empirical evidence that Mika is using B-0730 syntax natively (validates that convention), and (c) the scope-decomposition into 5 independently-shippable pieces so any maintainer (Max top-down on schema + emergence operator; Aaron bottom-up on convergence dashboard; future maintainers on cross-cluster protocol + query primitives) can pick what fits.

Per `.claude/rules/no-directives.md`: this row is operator-substrate-honest naming, not a directive imposing structure on Max or anyone else. Max's top-down work continues at full authority; this row makes the bottom-up side first-class alongside it.
