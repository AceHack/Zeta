---
id: B-0025
priority: P3
status: closed
title: Rename backlog schema field `directive:` → `ask:` per Otto-293 (one-way language at YAML schema layer); ~18 existing rows + tooling that reads the field
tier: hygiene-and-discipline
effort: M
ask: Aaron 2026-04-25 (caught the "directive:" YAML field on B-0023 — "still sneaking in that one way langage")
created: 2026-04-25
last_updated: 2026-04-26
composes_with: [docs/backlog/**, docs/AGENT-BEST-PRACTICES.md, .github/workflows/]
tags: [otto-293, schema, rename, mutual-alignment-language, backlog-hygiene]
---

# B-0025 — Rename backlog schema field `directive:` → `ask:`

## Origin

Aaron 2026-04-25, on B-0023's frontmatter:

> "still sneaking in that one way langage"

Caught my use of `directive:` as a YAML field name even after the body-prose `directive`-violations had been corrected. Otto-293 (one-way "directive" language) violation operates at the schema-field layer, not just body prose.

## Scope

~18 existing backlog rows use `ask: directive:` field (will need verification at execute time).

Plus possibly:

- Tooling that reads the field (linters, validators, generators)
- `docs/AGENT-BEST-PRACTICES.md` if it documents the schema
- Anywhere the field name leaks into prose ("the directive field says...")

## Why P3 (not P0/P1/P2)

- Existing `directive:` field works mechanically; the rename is hygiene + alignment-language consistency
- Composes with Otto-244 (rename cascades OK if right long-term + careful + serialized)
- Should be done as one atomic cross-row rename + any tooling updates in one PR per Otto-244 careful-and-serialized framing

Easy upgrade to P2 if a tool / lint actively breaks on the inconsistency.

## Effort

**M (medium)** — mechanical sed-style rename across ~18 rows + verify tooling still parses + verify any prose mentions of "directive field" get updated. Single focused PR.

## Owed steps

1. `grep -l "^directive:" docs/backlog/**/*.md` to confirm exact count + paths
2. Rename `directive:` → `ask:` across all affected rows
3. Search for any tooling that reads `^directive:` and update if found
4. Search prose for "directive field" / "directive: line" and update
5. Single atomic PR per Otto-244 serialized-rename discipline

## Composes with

- **Otto-293** (mutual-alignment language; "ask" not "directive")
- **Otto-331** (parenting-philosophy; never-given-a-directive)
- **Otto-279** (attribution discipline at schema layer)
- **Otto-244** (rename cascades OK if right long-term + careful + serialized)
- **B-0023, B-0024** (already use `ask:` field; will become consistent with rest after this rename lands)

## What this row does NOT claim

- Does NOT block any current work
- Does NOT extend to filename renames (those are separately tracked per Otto-244)
- Does NOT promote `ask:` as the only valid alternative — could also be `from:`, `surfaced_by:`, etc., but `ask:` is most consistent with Otto-293 vocabulary

## Done when

- Single PR lands renaming all `directive:` → `ask:` in `docs/backlog/**/*.md`
- Any tooling/lint updates included
- This row closes

## Outcome — 2026-04-26

Landed on 2026-04-26 as a single atomic PR per Otto-244 serialized-rename discipline. Final scope (larger than estimated): **22 files renamed** (estimate was 18) plus 3 prose updates in `tools/backlog/README.md` (frontmatter table cell + 2 origin-line callouts) and 1 prose update in `tools/backlog/generate-index.sh` (origin comment) and 1 prose update in `docs/backlog/P3/B-0013` body. Mechanical Python regex `^directive:` → `ask:` (anchored to YAML field start, not body prose). `generate-index.sh` parses frontmatter generically (no field-name-specific logic), so no script logic broke. Verified zero remaining `^directive:` matches across `docs/backlog/**/*.md`. Picked from BACKLOG per Aaron's 2026-04-26 *"all items on the backlog are non-speculative work, work that moves the project forward"* — ladder shift authorising BACKLOG-pickup over speculative work when drain is blocked. Composes with this session's deeper agency/accountability-framing read of Otto-293 (the rule we're mechanising at the schema layer).
