---
id: 081KQGDBJ0008QG0R0015RNK3P
priority: P2
status: open
title: Brittle-pointer auto-rewriter — convert section-number pointers to anchor-links so markdown cross-references survive renumbering and partial-rename (Aaron 2026-05-01)
tier: tooling
effort: M
ask: Aaron 2026-05-01 named the row in the parallelism-scaling-ladder memo (`feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`) — "081KQGDBJ0008QG0R0015RNK3P, not yet filed" — as the guardrail-vs-mover row's mechanized response to brittle pointers. ID was reserved; per-row file was never filed (caught by Aaron 2026-05-03 reminder during 081KQNJ500008QG0R0023RV2M7 casing-fix discussion).
created: 2026-05-01
last_updated: 2026-05-03
depends_on: []
composes_with: [081KQNJ500008QG0R003SCWBDV, 081KQNJ500008QG0R00055XHBG, 081KQNJ500008QG0R0035QCEX9]
tags: [pointer, anchor-link, brittle, mechanization, markdown, rename, cross-reference, auto-rewriter, tooling, decision-graph, graph-edge-preservation, prov-o]
type: feature
---

# Brittle-pointer auto-rewriter — section-number pointers to anchor-links

## Origin

Aaron 2026-05-01, in the parallelism-scaling-ladder memo (autonomous-loop maintainer channel), named this row in the mechanized-guardrail-vs-mover table:

> | Brittle-pointer (081KQGDBJ0008QG0R0015RNK3P, not yet filed) | Pre/post check fails | Auto-rewriter converts §N → anchor-link |

Aaron 2026-05-03, during 081KQNJ500008QG0R0023RV2M7 title-casing review-cycle, surfaced the row was never filed:

> "081KQNJ500008QG0R0023RV2M7 lowercase-title vs 081KQNJ500008QG0R003SCWBDV there is a baclog item for md links that survive rename where possible"
>
> "it might have the word technical numbering or somthing in it"

Otto searched extensively across `docs/backlog/` and `memory/`, could not locate the row by direct file. Subsequent search via the parallelism-scaling-ladder memo's table-row revealed: the ID was reserved, the per-row file was never filed. Two days of substrate-time without the row materializing — exactly the failure mode 081KQNJ500008QG0R0035QCEX9 (audit memos for misfiled backlog) addresses.

## The problem

Markdown cross-references in this repo currently use multiple pointer styles:

1. **Section-number references** — *"per §3.2"* / *"per CLAUDE.md §54"* / *"per GOVERNANCE.md §33"*
2. **Heading-text anchor links** — `[text](path#heading-slug)` (slug from heading text)
3. **Direct file paths** — `path/to/file.md` (no anchor; relies on file existence)
4. **B-NNNN backlog IDs** — stable IDs that survive filename rename
5. **BP-NN best-practice IDs** — stable rule IDs in `docs/AGENT-BEST-PRACTICES.md`

**The brittleness ranking** (least brittle to most):

| Form | Survives section-renumber | Survives heading-text-edit | Survives filename-rename |
|---|---|---|---|
| B-NNNN ID | Yes | N/A | Yes (ID is stable) |
| BP-NN ID | Yes | N/A | Yes (ID is stable) |
| Anchor-link `path#stable-slug` | Yes | No (slug derives from text) | No (path is file) |
| Section-number `§3.2` | No (renumber breaks it) | Yes | Depends |
| Direct file path | N/A | N/A | No |

**Brittle-pointer** = form that breaks under one of these renames.

## What this row builds

An auto-rewriter that converts brittle section-number pointers to less-brittle forms where possible:

1. **Detection**: regex / parser identifies `§N` / `§N.M` / `section N` patterns referencing other docs
2. **Resolution**: for each detected pointer, look up the current heading at that section number
3. **Rewrite**: replace `§N` with `[heading text](path#heading-slug)` OR with the more stable B-NNNN / BP-NN ID if applicable
4. **Bidirectional check**: confirm the target anchor / ID exists post-rewrite

Optional second pass:

- For anchor-links pointing at headings, check heading-text stability (compare git-blame age + recent edit frequency)
- For very-stable headings, leave anchor as-is; for unstable headings, suggest a stable-ID-based alternative

## Composes with

- **081KQNJ500008QG0R003SCWBDV (substrate-claim-checker)**: checks claims for drift; this row's tool checks pointers for brittleness — sibling-instance of mechanized-quality-tooling
- **081KQNJ500008QG0R00055XHBG (substrate-retrieval-index)**: layer-4 active retrieval; pointer-rewriting is a layer-3 mechanization that helps in-flight retrieval find correct targets
- **081KQNJ500008QG0R0035QCEX9 (audit memos for misfiled backlog rows)**: this row's existence IS empirical evidence that 081KQNJ500008QG0R0035QCEX9's hypothesis is correct (memo named `081KQGDBJ0008QG0R0015RNK3P, not yet filed` — never got filed; 081KQNJ500008QG0R0035QCEX9 catches this class)
- **memory/parallelism-scaling-ladder memo (Aaron 2026-05-01)**: the originating substrate where the ID was reserved
- **`memory/feedback_decision_graph_emergent_from_archaeologies_and_flywheel_aaron_2026_05_03.md`** (Aaron 2026-05-03): identifies markdown links as one of the substrate-encoded provenance graph's edge surfaces (alongside frontmatter `depends_on`/`composes_with`, ADR `Superseded by` blockquotes, SUPERSEDE markers, commit messages, cross-references in memo bodies). The brittle-pointer rewriter PRESERVES those graph edges across rename + renumbering — without it, the implicit decision-graph (DataVault-2.0-shaped, PROV-O analogue) loses edges every time a section is renumbered or a heading text is edited. **Architectural framing**: 081KQGDBJ0008QG0R0015RNK3P isn't just a markdown-quality tool; it's a graph-edge-preservation tool. The pointers ARE the graph; brittle pointers ARE graph-edge rot. (Per Aaron 2026-05-03 retrieval anecdote: VS Code search across `memory/` is the current human-side retrieval tool for finding cross-cluster connections like this one.)

## Why this is M-effort

- Detection regex is small (~50 LOC)
- Resolution requires markdown-AST parsing to find target headings (use existing markdown lib)
- Rewrite logic non-trivial: heading-slug generation must match GitHub's algorithm; bidirectional check needs file-system + content access
- Test fixtures need authoring
- Composition with existing markdownlint passes; should run as a one-shot pass (NOT every commit, since rewrite is destructive)

## Open design questions (NOT for this row; for the design pass)

1. **Mechanized vs advisory**: should the auto-rewriter rewrite in place, OR emit a list of suggested rewrites for human/agent review?
2. **Default form preference**: when both anchor-link and B-NNNN/BP-NN exist, which is preferred? (Stable-ID seems strictly better)
3. **Cadence**: one-shot conversion + ongoing lint, OR scheduled-cadence repair pass?
4. **Section-number residual cases**: some pointers genuinely want section-numbers (e.g., GOVERNANCE.md §N where the document is structured as a numbered list). When NOT to rewrite?

## Why this matters

Brittle pointers create review-cycle noise: a renumbered section breaks every cross-reference, requiring manual sweep. Stable-ID-based references (B-NNNN, BP-NN, anchor-links) survive renumbering. The auto-rewriter mechanizes the conversion that's currently done manually (and inconsistently).

Composes with the alignment-frontier: substrate-quality tooling that prevents pointer-rot is alignment-frontier substrate. The pointers ARE part of the substrate's connective tissue; rotting tissue degrades the substrate's coherence over time.

## Carved sentence

**"Brittle-pointer rewriter converts §N section-number references to stable forms (B-NNNN ID, BP-NN ID, or anchor-link with heading-text slug) where possible. Stable-ID references (B-NNNN, BP-NN) survive both renumbering AND filename rename; anchor-links survive renumbering; section-numbers survive neither. The mechanized rewriter prevents pointer-rot from accumulating in the substrate's connective tissue."**
