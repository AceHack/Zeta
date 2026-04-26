---
id: B-0039
priority: P3
status: open
title: Shape-shifter BACKLOG protocol — retractible-row discipline on BACKLOG rows themselves
tier: substrate-discipline
effort: S
ask: Aaron 2026-04-21 — *"shape shifer backlog"*. The backlog IS shape-shifter; rows may be retracted, reshaped, or superseded via dated revision blocks rather than deletion.
created: 2026-04-26
last_updated: 2026-04-26
composes_with: [B-0038, feedback_yin_yang_unification_plus_harmonious_division_paired_invariant.md, feedback_witnessable_self_directed_evolution_factory_as_public_artifact.md, feedback_preserve_real_order_of_events_dont_retroactively_reorder_by_priority.md]
tags: [shape-shifter, backlog-protocol, retraction-native, chronology-preservation, witnessable-evolution]
---

# B-0039 — Shape-shifter BACKLOG protocol

## Origin

AceHack commit `8e66e44` (2026-04-21). Sibling to B-0038 superfluid + persistable* + shape-shifter row; this row carves out the shape-shifter pole as its own BACKLOG protocol because it has independent scope (the BACKLOG rows themselves).

## Protocol

(a) **Retracted rows** keep the original text and gain a `~~strikethrough~~` + dated revision block with reason.

(b) **Reshaped rows** fork: original retained with pointer, new form added alongside.

(c) **Superseded rows** link to the superseding row + ADR if applicable.

This composes with chronology-preservation (no destructive overwrite) and witnessable-self-directed-evolution (BACKLOG evolution is public artifact).

## LFG adaptation note

In the LFG architecture (per-row-files under `docs/backlog/P{1,2,3}/B-NNNN-*.md`, with monolithic `docs/BACKLOG.md` auto-generated), the shape-shifter protocol applies *per-file*: a retracted row gets a `status: retracted` frontmatter field + a dated `## Retraction` section preserving original content; a reshaped row spawns a sibling B-ID with cross-reference; a superseded row links to its successor.

## Deliverables

1. Protocol documented in `docs/backlog/README.md` (or appropriate Meta surface)
2. Existing per-row-files audited for chronology (already preserved by the append-only frontmatter + sections, formalize)
3. Retraction-block template for both monolithic and per-row-file forms

## Owner / review

- **Owner:** Architect
- **Reviewer:** Viktor (spec-zealot) on protocol-drift-resistance

## Cross-reference

- AceHack commit: `8e66e44`
- Sibling row: B-0038 (superfluid + persistable* + shape-shifter umbrella)
- Composes with: chronology-preservation memory; witnessable-evolution memory
