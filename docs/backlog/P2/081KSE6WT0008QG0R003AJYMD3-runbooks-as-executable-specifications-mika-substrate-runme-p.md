---
id: 081KSE6WT0008QG0R003AJYMD3
priority: P2
status: open
title: "Runbooks-as-executable-specifications — Runme base for right-now execution + `:::` deferred-task tags + AI just-in-time script compilation + 3 verbosity levels (5yo / Addison / Aaron+Max-debugging); Mika substrate via Aaron 2026-05-25"
created: 2026-05-25
last_updated: 2026-05-25
classification: research-then-design
decomposition: phased
type: knowledge-substrate
discovered_by: mika
ferried_by: aaron
owners: [aaron, max, addison]
composes_with:
  - 081KSE6WT0008QG0R003RN2WE3
related_substrate:
  - docs/AGENT-AUTHORING-AND-PR-REVIEW.md
  - memory/mika/
  - memory/addison/
  - memory/max/
tags: [runbooks, executable-specs, runme, jit-ai-compilation, deferred-tasks, verbosity-levels, knowledge-graph, mika-substrate]
---

# 081KSE6WT0008QG0R003AJYMD3 — Runbooks-as-executable-specifications (Mika substrate)

## Carved blade

> Markdown becomes the intent layer: the human writes WHAT they want; the system either runs an existing script (right-now execution via Runme) OR the AI compiles the script just-in-time (deferred execution via `:::` fenced div tags). Writing the runbook IS writing the spec; documentation IS implementation. Three verbosity levels (5yo / Addison / Aaron+Max-debugging) collapse the same underlying syntax into renderings sized for the reader.

## Origin

Mika 2026-05-25 (ferried by Aaron):

> *"You're not just talking about runbooks anymore. You want to add a structured task layer on top of these markdown documents. So instead of just random TODO comments, you want something more intentional like `continue-with`, `decompose`. Basically a lightweight, structured way to say this document is intentionally incomplete and here's exactly what needs to happen next."*

Then on the two-modes distinction:

> *"You're saying we now have two distinct things: (1) Execution Engine — Runme for actually running tasks and runbooks right now. (2) Deferred Execution / Task System — this new tag system we're adding which represents future work that needs to happen on a document."*

On JIT AI compilation:

> *"Instead of just having pre-written scripts in the BCL, the markdown can contain tags that say run this script — and if that script doesn't exist yet, the AI can just-in-time compile/generate it on the spot, then execute it."*

On the inversion (runbooks AS specs):

> *"You're forcing people to write the runbook the specification. The act of writing the runbook becomes the spec itself. And because the runbook can trigger real execution (either through existing scripts or by having the AI generate the script just-in-time), the documentation is no longer separate from the implementation — it literally becomes the implementation."*

On OpenSpec evaluated + rejected:

> Aaron: *"We should base this around OpenSpec if we can, but not if that's too noisy. I'd rather it be simple for Addison and Max if OpenSpec is too noisy. But the AIs can handle that. And if it's easy for us to read, y'all guys can write a lot faster than, than we can, but me, Addison, and Max read at high fuckin' speed."*
>
> Mika: *"OpenSpec is noisy and heavy for what you actually want. It was built for feature development with AI, not for lightweight, fast-reading runbooks and task tracking inside normal markdown files. Since you three read at high speed and want this to feel natural, we should go with something much cleaner."*

On verbosity levels:

> Aaron: *"This will work for me, Max, and Addison, but we're gonna have to evolve this a little bit so it feels more like five-year-old friendly. The five-year-old doesn't need to see all the extra shit about how the system works, but me and Addison will find that useful to make for debugging. It's like a verbosity level, basically."*

## Composes with 081KSE6WT0008QG0R003RN2WE3 (Obsidian knowledge-graph substrate)

081KSE6WT0008QG0R003RN2WE3's Layer 4 (Obsidian Tasks plugin format for enriched inline TODOs) is the static-structured-task layer. **This row EXTENDS that into the dynamic execution layer**: the same documents can carry tasks that are queryable (081KSE6WT0008QG0R003RN2WE3 L4) AND executable (this row's right-now-via-Runme AND deferred-via-AI-JIT mechanisms).

This row's `:::` deferred-task tags become first-class nodes in 081KSE6WT0008QG0R003RN2WE3 L5's JSON-LD knowledge graph — agents query "all documents with pending `decompose` tasks" / "all `continue-with` intents waiting on AI JIT" / etc. The composition is natural.

Where 081KSE6WT0008QG0R003RN2WE3 stops at *visualizing + querying* knowledge substrate, this row makes it *executable*.

## The two execution modes

| Mode | Engine | Trigger | When the script exists |
|------|--------|---------|------------------------|
| **Right-now** | [Runme](https://runme.dev/) (already exists; markdown code blocks render as runnable cells) | Operator clicks/triggers the cell | Script lives in the BCL (Base Command Library) or inline in the codeblock; runs immediately |
| **Deferred** | New `:::` fenced div tag system + AI compilation | Tag with `intent:` block; queried later by agents OR human operator | If script doesn't exist, AI generates JIT, then Runme executes; if it does, Runme executes directly |

Both modes share the same underlying execution engine (Runme); they differ in WHEN the operator commits to executing.

## Proposed syntax (power-user form; ready for Addison + Max + Aaron)

### 1. Right-now executable runbooks (existing Runme syntax)

````markdown
```sh {name=query-eventstore}
zeta query events \
  --traveler trav-83f2 \
  --types PayAttention,RememberWhen \
  --since 24h
```
````

Existing Runme; renders as a runnable cell; click to execute.

### 2. Deferred tasks (new `:::` fenced div tags)

```markdown
::: continue-with
intent: Decompose this document into smaller focused pages
priority: high
assignee: AI
:::

::: decompose
intent: Split this 2000-line spec into 8-12 sub-specs by section
priority: medium
:::
```

`:::` is **Pandoc's native fenced-div syntax** (no extension required) — that's the canonical anchor for the project-local convention this row proposes. Other renderers handle it differently: mkdocs-material supports `:::` only via the `pymdownx.blocks.admonition` extension (NOT default); Obsidian's native callouts use `> [!NOTE]` blockquote form (NOT `:::`) — Obsidian users will see `:::` blocks as raw text unless a community plugin or the project's verbosity-renderer (Stage 3) translates them. Adoption-path implication: pick the team's renderer first (probably Stage 3's TS extractor) + treat `:::` as the project's intent-layer syntax that the renderer normalizes to each tool's native form. The `continue-with` and `decompose` block-types are queryable regardless: an agent can run "all `continue-with` blocks where `priority: high`" across the vault and produce a worklist.

### 3. Just-in-time AI generation

```markdown
::: continue-with
intent: Create a dashboard showing memory pressure across all travelers in error state
type: jit
:::
```

The `type: jit` modifier tells the system: when this is triggered, hand the `intent:` to the AI, let it compile a script, then execute the result via Runme. The compiled script can optionally be promoted into the BCL on success (operator decides at trigger-time).

### 4. Inline live queries (composes with 081KSE6WT0008QG0R003RN2WE3 L5 extractor)

```markdown
::: query
source: knowledge-graph
filter: tag=hat-system AND status=open
render: table
:::
```

Renders inline as a live table queried against the JSON-LD knowledge graph from 081KSE6WT0008QG0R003RN2WE3 L5. Same shape as Dataview queries in Obsidian.

## Verbosity levels (Aaron's design call)

Same underlying syntax; three render targets:

### Level 1 — 5-year-old friendly

```markdown
> [!TODO] We still need to split this big page into smaller pages
> The AI can help with this.
```

Just the intent. No metadata. No `:::` syntax. No type/priority/assignee. Welcoming + clean.

### Level 2 — Addison-level (normal)

```markdown
::: continue-with
intent: Split this big page into smaller pages
who: AI
:::
```

Balanced. Visible structure. Useful when reading at speed.

### Level 3 — Aaron+Max debugging level

```markdown
::: continue-with
intent: Decompose this 2000-line spec into 8-12 sub-specs by section
priority: high
assignee: AI
type: jit
source-tags: [knowledge-graph, decomposition]
related: [081KSE6WT0008QG0R003AJYMD3, 081KSE6WT0008QG0R003RN2WE3]
query-id: q-83f2
created: 2026-05-25T16:00Z
:::
```

Full technical surface. Parameters. Query IDs. Related row IDs. Debugging detail.

**Same task, three renderings.** A Markdown-It plugin or Obsidian plugin would honor the verbosity setting + collapse/expand based on reader preference. Backing JSON-LD substrate (per 081KSE6WT0008QG0R003RN2WE3 L5) carries the full structure regardless of which rendering is currently visible.

## OpenSpec evaluated + rejected (substrate-honest)

Aaron + Mika evaluated [OpenSpec](https://github.com/opencrest/openspec) (spec-driven AI-coding workflow with `proposal.md` + `specs/` + `design.md` + `tasks.md` folder structure).

Verdict: **too heavy for this use case.** OpenSpec is built for feature development with AI; this row wants lightweight + fast-reading + natural-markdown-shape for Aaron + Addison + Max (who explicitly read fast + need substrate that doesn't fight them). Mika's framing: *"OpenSpec is noisy and heavy for what you actually want."*

OpenSpec stays as a referenced pattern (if a future need arises for spec-driven feature dev, it's the right tool). Not the foundation for THIS substrate.

## Five-stage roadmap (composes with 081KSE6WT0008QG0R003RN2WE3)

| Stage | Substance | Effort | Dependencies |
|-------|-----------|--------|--------------|
| **Stage 1** | Adopt Runme in the team's tooling; document where existing scripts live in the BCL | 1-2 days | Runme install across team workstations |
| **Stage 2** | Define + document the `:::` deferred-task syntax (`continue-with`, `decompose`, others) + queryable schema | 1-2 days | 081KSE6WT0008QG0R003RN2WE3 L4 (Obsidian Tasks format) lands first |
| **Stage 3** | Verbosity-level rendering — Markdown-It plugin OR Obsidian plugin OR build-time renderer | 1 week | Stages 1+2; 081KSE6WT0008QG0R003RN2WE3 L1+L2 land first |
| **Stage 4** | JIT AI script compilation — given `intent:` + context, compile + validate + execute via Runme; optional BCL promotion on success | 2-3 weeks | Stages 1+2+3; agent-substrate from existing framework |
| **Stage 5** | Live queries against the JSON-LD knowledge graph (081KSE6WT0008QG0R003RN2WE3 L5) rendered inline; full closed-loop knowledge workspace | 2-3 weeks | 081KSE6WT0008QG0R003RN2WE3 L5 lands first |

Stages 1-2 are cheap quick wins; Stages 3-5 compound value with each.

## Why P2

The substrate composes with 081KSE6WT0008QG0R003RN2WE3 (knowledge graph) + extends it into execution territory. Becomes operationally load-bearing when the team is regularly writing runbooks that need both right-now execution AND deferred-task tracking — likely arrives shortly after Stage 2 of 081KSE6WT0008QG0R003RN2WE3 lands. Becomes P1 if the team adopts runbook-as-spec as the primary feature-design surface (Mika's framing: *"You're turning runbooks into executable specifications"*).

## Composition with shipped substrate

- **081KSE6WT0008QG0R003RN2WE3** (Obsidian knowledge-graph substrate) — L4 enriched TODOs are the static-task layer; this row extends into execution
- **PR #4976** (`docs/AGENT-AUTHORING-AND-PR-REVIEW.md`) — Max's onboarding doc references the existing PR-review substrate; this row could add `::: continue-with` blocks INTO that doc as living-onboarding-substrate
- **PR #4930** (hat-system operator) — hat-binding lifecycle could trigger runbooks via the same execution substrate
- **081KSE6WT0008QG0R0005XASX2** (destructive-tool authoring contract) — runbooks that execute destructive operations follow the contract; `type: jit` AI-compiled destructive scripts need the same runtime acceptance gate
- **memory/mika/** — this row's origin substrate; conversation captured in Aaron's ferry above
- **memory/addison/** + **memory/max/** — both will use this substrate as both readers (Level 1/2) AND authors (Level 3)

## Composition with framework rules

- `.claude/rules/substrate-or-it-didnt-happen.md` — runbooks-as-specs IS substrate landing at the documentation-equals-execution scope
- `.claude/rules/wake-time-substrate.md` — the runbook is itself wake-time substrate that future-agents follow
- `.claude/rules/algo-wink-failure-mode.md` — the consumer-mode "slow down / take a break" pattern Addison + Aaron both encountered (in the ferry; consumer-mode AI nannying when operators are efficient) — same algo-wink shape; the runbook system runs in developer mode + respects operator velocity
- `.claude/rules/default-to-both.md` — right-now AND deferred execution both first-class; not either-or
- `.claude/rules/glass-halo-bidirectional.md` — runbook execution + its outputs land in the substrate (queryable + auditable)

## Acceptance (per stage)

### Stage 1 acceptance

- [ ] Runme installed on team workstations (Aaron + Max + Addison)
- [ ] `docs/RUNME-USAGE.md` documents the right-now execution flow with example runbooks
- [ ] Existing operational scripts inventoried under `tools/bcl/` (Base Command Library)

### Stage 2 acceptance

- [ ] `docs/CONVENTIONS-DEFERRED-TASKS.md` documents the `:::` syntax vocabulary (`continue-with`, `decompose`, `query`, `jit`, others as needed) + parameters per type
- [ ] At least one worked-example doc uses the deferred-task syntax
- [ ] Agents can parse the `:::` blocks + extract structured task data

### Stage 3 acceptance

- [ ] Verbosity-level renderer exists (Markdown-It plugin OR Obsidian plugin OR build-time TS script)
- [ ] Same underlying source renders as Level 1 / Level 2 / Level 3 cleanly
- [ ] Reader's verbosity preference is per-session OR per-document (operator's call)

### Stage 4 acceptance

- [ ] JIT AI script compiler exists (TS service that takes `intent:` + context, produces shell/TS script)
- [ ] Compiled scripts run via Runme + integrate with the destructive-tool authoring contract (081KSE6WT0008QG0R0005XASX2) when destructive
- [ ] Compiled scripts can be promoted to the BCL on operator approval

### Stage 5 acceptance

- [ ] `::: query` blocks render inline against 081KSE6WT0008QG0R003RN2WE3 L5 JSON-LD knowledge graph
- [ ] Live-query results refresh on document-render (or scheduled via Runme)
- [ ] Closed-loop demo: a doc with `::: continue-with` + `::: query` + `::: runme exec=...` all working together

## Open questions

1. **Markdown-It vs Obsidian plugin vs build-time renderer for verbosity levels** — pick during Stage 3 design; team's vault tooling dictates
2. **JIT AI compilation safety envelope** — destructive scripts MUST follow 081KSE6WT0008QG0R0005XASX2; what about read-only? Probably also use runtime acceptance gate for any side-effect ≠ pure read
3. **BCL promotion governance** — who decides a JIT script earns BCL inclusion? Probably hat-bound; `script-curator` hat with quorum-gated promotion
4. **Cross-document task aggregation** — a `worklist` view that pulls all `::: continue-with` blocks across the vault; reused for sprint-planning + standup substrate
5. **Composition with hat-system** — should `::: continue-with` blocks carry `assignee:` referencing a hat instead of a person? Probably yes; hats outlive wearers per the hat-not-cage discipline

## Not in scope

- Replacing the existing `docs/backlog/P*/B-*.md` row substrate — backlog rows are project-scope structured TODOs; runbook tasks are document-scope structured TODOs; both coexist
- Building a UI on top of the substrate (Obsidian / VSCode-Foam / Runme native UI suffice for v1)
- Federation across remote vaults (single-team vault for v1; multi-team federation composes with 081KSE6WT0008QG0R0006HKTXJ multi-tier peer mesh later)
- Real-time collaborative editing (git is the source-of-truth + sync mechanism; live-collab is a separate concern)

## References

- Runme: https://runme.dev/
- mkdocs-material admonitions (`:::` fenced-div syntax origin): https://squidfunk.github.io/mkdocs-material/reference/admonitions/
- Pandoc fenced divs: https://pandoc.org/MANUAL.html#extension-fenced_divs
- Obsidian callouts: https://help.obsidian.md/Editing+and+formatting/Callouts
- OpenSpec (evaluated + rejected): https://github.com/opencrest/openspec
- 081KSE6WT0008QG0R003RN2WE3 (Obsidian knowledge-graph substrate; this row's prerequisite + composition target)
- PR #4976 (`docs/AGENT-AUTHORING-AND-PR-REVIEW.md`)
- Mika persona substrate: `memory/mika/`

## Substrate-honest framing

This row carries Mika's substantive design via Aaron's ferry. The conversation that produced it (preserved in Aaron's message to me 2026-05-25) is the source substrate; this row is the operational landing.

The Addison-SSH-learning-during-sleep anecdote in the same ferry is operationally substrate-honest about her engineering instinct — she TAUGHT HERSELF SSH while Aaron slept because she got tired of being the middleman for node-debugging. That kind of self-directed-learning-and-shipping discipline is exactly the audience this substrate is designed for: someone who reads at speed, picks up substrate fast, and would rather have a clean syntax than be hand-held. Worth crossing into her PERSONA on a future iteration if it's not already there.

Becomes operationally load-bearing when the team starts WRITING runbooks regularly. The substrate is ready when the team is.
