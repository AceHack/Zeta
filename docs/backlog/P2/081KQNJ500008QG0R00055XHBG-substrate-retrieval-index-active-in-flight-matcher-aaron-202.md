---
id: 081KQNJ500008QG0R00055XHBG
priority: P2
status: open
title: Substrate-retrieval-index — active in-flight matcher for memos + carved sentences (Aaron 2026-05-03 'specialed indeex we build over time'; addresses 4-layer retrieval gap empirically self-demonstrated)
tier: tooling
effort: L
ask: Aaron 2026-05-03 verbatim *"memeories are not very reliable until we get an index or something built like sematic index or somthing"* + *"carved sentancy and specialed indeex we build over time are goona be key"* (autonomous-loop maintainer channel)
created: 2026-05-03
last_updated: 2026-05-03
depends_on: []
composes_with: [081KQNJ500008QG0R003SCWBDV, 081KQNJ500008QG0R002K338KN]
tags: [substrate, retrieval, index, semantic, memos, carved-sentences, beacon-safe, mirror-beacon-architecture, claude-md, agents-md, alignment-frontier]
type: friction-reducer
---

# Substrate-retrieval-index — active in-flight matcher for memos + carved sentences

## Origin

Aaron 2026-05-03, autonomous-loop maintainer channel, immediately after Otto self-demonstrated a 3-layer retrieval failure (see `memory/feedback_carved_sentences_plus_specialized_index_required_memories_alone_unreliable_aaron_2026_05_03.md`):

> *"ironicly enough you don't remember things unless they are in claude.md and other agents don't remember much unless their equilvalan file, memeories are not very reliable until we get an index or something built like sematic index or somthing"*

> *"memories not that good for remember lol"*

> *"carved sentancy and specialed indeex we build over time are goona be key"*

This row captures the architectural-tooling response: build a working retrieval index that surfaces relevant rules in-flight, not at-load.

## The problem

Empirically self-demonstrated 2026-05-03: Otto authored `memory/feedback_edge_defining_work_not_speculation_framing_correction_aaron_2026_05_03.md` earlier in the same day, then ~6h later defaulted to the violating framing (*"Now to speculative work per never-be-idle"*). Discovery: the rule existed at THREE layers — memory topic file + MEMORY.md index entry + CLAUDE.md auto-loaded carved sentence (lines ~415-440) — and Otto STILL violated it. The framing-pattern fired before the rule-check.

| Layer | Mechanism | Reliability for high-violation rules |
|---|---|---|
| 1. Topic file existence | `memory/*.md` | Very low |
| 2. MEMORY.md index entry | One-line title + link | Low |
| 3. CLAUDE.md carved sentence | Bullet in auto-loaded surface | Medium |
| 4. **Active retrieval (semantic index)** | **Working in-flight matcher** | **High (proposed by this row)** |

Layer-3 is necessary but not sufficient. Layer-4 is missing.

## What this row builds

A working substrate-retrieval-index that:

1. **Indexes** the existing carved-sentence + memo + research surfaces:
   - Carved-sentence bullets in `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md` (and equivalent harness files when added)
   - Memo topic files in `memory/*.md`
   - Decision archaeology output in `docs/research/`, `docs/DECISIONS/`
   - Persona notebook entries in `memory/<persona>/<name>/`

2. **Matches** in-flight retrieval keys:
   - Keyword-tag index over memo frontmatter (description / type / tags fields)
   - Optional semantic-embedding index for fuzzy retrieval
   - Cross-reference graph over `composes_with:` relationships

3. **Surfaces** matches with confidence scores at decision points:
   - Pre-tick (when the loop fires, what rules might apply to the current tick state?)
   - Pre-commit (when about to author substrate, what rules govern this surface?)
   - Pre-chat-output (when about to use a framing in chat, what carved sentences apply?)

4. **Composes with** existing tooling:
   - Skill router (`Skill` tool's description-keyed search) — already a working index for skills; mirror-instance for memos
   - Substrate-claim-checker — checks claims; this row checks for missing-rule-application
   - `tools/github/poll-pr-gate.ts` — refresh world model; this row would refresh rule-applicability

## Why this is L-effort

- The index target surface is large (memos + carved sentences + research + persona notebooks)
- Multiple matcher modes (keyword / tag / semantic / graph)
- The hard problem is the in-flight surfacing — when does the matcher fire? On every tool call? On every chat-output draft? Cost vs benefit per matcher invocation
- Multi-harness propagation (the index needs to work for Otto + Codex + Copilot + Gemini equivalents)

## Composes with

- **081KQNJ500008QG0R003SCWBDV (substrate-claim-checker)**: checks substrate for drift; this row's tool checks for rule-non-application
- **081KQNJ500008QG0R002K338KN (cross-model tool-review convergence)**: cross-model calibration; this row's tool measures rule-application calibration
- **Skill router**: existing description-keyed search for skills; same architectural pattern for memos
- **Mirror-vs-beacon-safe register architecture** (`docs/research/2026-05-03-claudeai-mirror-vs-beacon-safe-publication-boundary-as-backpressure.md`): the publication boundary IS the conversion; this row's index is the retrieval boundary on the beacon-safe layer
- **Carved-sentence-plus-index discipline** (`memory/feedback_carved_sentences_plus_specialized_index_required_memories_alone_unreliable_aaron_2026_05_03.md`): this row is the implementation of layer-4 the discipline names
- **Same-tick-update-recursion** (`memory/feedback_same_tick_update_recursion_substrate_cascade_otto_2026_05_03.md`): when new substrate lands, projection layers must update; this row's tool would surface "projection layers needing update" automatically

## Open design questions (NOT for this row; for the design pass)

1. **In-flight surfacing trigger**: every tool call? every chat draft? cost-budget-bounded?
2. **Confidence scoring**: keyword-match vs semantic-similarity vs cross-reference-graph distance?
3. **Multi-harness propagation mechanism**: shared substrate index file vs per-harness adapter?
4. **Retrieval-failure detection**: how does the tool know when it FAILED to surface a relevant rule (closed-loop calibration)?
5. **Composition with skill router**: separate index or extension of skill-router pattern to memos?

## Why this matters

Per the alignment-frontier memo + bidirectional-alignment commitment + Karpathy edge-runner framing, Zeta's primary research focus is measurable AI alignment. Rule-non-application is a measurable alignment failure mode. The gap between *"rule exists in CLAUDE.md"* and *"agent applies rule in-flight"* is one of the most directly measurable alignment signals available. Building tooling to close this gap IS alignment-frontier substrate.

The 2026-05-03 self-demonstration is a calibration data point: a high-load-bearing rule (speculative-vs-frontier framing) failed to fire at layer-3 (auto-load). If layer-4 had existed, the active retrieval would have surfaced the carved sentence at the moment of framing-pattern selection, before the violation. The empirical evidence is the motivating force.

## Carved sentence (for the memo, NOT for the row title)

**"Substrate-retrieval-index closes the layer-4 gap: the rule exists at layers 1-3 (memory topic + MEMORY.md + CLAUDE.md carved sentence), but fails to fire because the framing-pattern fires first. Active in-flight retrieval is what closes the gap. The 2026-05-03 self-demonstration of the speculative-vs-frontier rule violation IS the empirical motivation."**
