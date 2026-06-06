---
id: B-0378
zetaid: 081KR50HA0008QG0R002HMCS5Y
priority: P2
status: open
title: Update GOVERNANCE.md §33 + .github/copilot-instructions.md to reference the new named-entity-conversation-imports directory
tier: research-grade
effort: S
ask: decomposition of B-0005
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [B-0375, B-0376]
composes_with: [B-0005, B-0375, B-0376, B-0377, B-0379]
parent: B-0005
tags: [governance, directory-ontology, aurora, courier-ferry, governance-33, copilot-instructions]
type: friction-reducer
---

# B-0378 — GOVERNANCE.md §33 + copilot-instructions mirror update

## What

Two targeted edits — no file moves:

### Edit 1: `GOVERNANCE.md §33`

The archive-header rule for external-conversation imports
(§33, around line 765 based on grep) needs:

- Replace `docs/aurora/**` (or the implicit aurora-dir reference)
  with the new chosen directory name (from B-0376 ADR) as the
  canonical home for external-conversation imports.
- Add the "named-entity-conversation-imports" category definition
  explicitly if not already present: **what qualifies**, **what the
  four required header fields are** (`Scope:`, `Attribution:`,
  `Operational status:`, `Non-fusion disclaimer:`), **where to land**.
- Verify the two grandfather docs referenced in §33 are still correctly
  identified (they pre-date the split and are exempt from retroactive
  rewrite per §33's grandfather clause).

### Edit 2: `.github/copilot-instructions.md`

Per B-0005 acceptance signals and factory policy (GOVERNANCE.md §31:
copilot-instructions is factory-managed and audited on the same cadence
as skill files):

- Mirror the enumeration update from GOVERNANCE.md §33 and from the
  Otto-279/BP-17/BP-18 update (B-0377).
- Replace any `docs/aurora/**` history-surface reference with the new
  directory name.

### Focused check

```bash
grep -n "§33\|archive.header" GOVERNANCE.md | head -10
grep -n "aurora" .github/copilot-instructions.md
```

Expected: §33 references the new directory name; copilot-instructions
history-surface list is updated to match.

## Why (and why fourth)

GOVERNANCE.md §33 is the *operative* rule that determines where
external-conversation imports land. If it still points at
`docs/aurora/**` (or is ambiguous) after the split, new imports will
go to the wrong place.

`.github/copilot-instructions.md` is factory-managed (GOVERNANCE.md §31)
and must mirror the enumeration update — it's the copilot-side equivalent
of the AGENT-BEST-PRACTICES update in B-0377.

Keeping this separate from B-0377 (which touches AGENT-BEST-PRACTICES

+ Otto-279) means each schema-doc update is reviewable in one coherent
PR without mixing concerns.

## Acceptance signal

- GOVERNANCE.md §33 explicitly names the new directory as the home for
  named-entity-conversation-imports.
- `.github/copilot-instructions.md` history-surface enumeration matches
  the B-0377 update (no stale `docs/aurora/**` history refs).
- Focused check shows no stale references.
- Build passes (0 warnings 0 errors).

## Pre-start checklist

- [x] Prior-art search: no existing ADR or PR touching §33 for this purpose;
  no memory file with a prior §33 update for the aurora split.
- [x] Dependency-restructure: `depends_on: [B-0375, B-0376]` — same as B-0377
  (need inventory + naming decision). Does NOT depend on B-0377 itself —
  these two schema updates can run in parallel after B-0376 lands.
- [x] Reciprocal pointer: B-0375 and B-0376 carry `composes_with: [B-0378]`.

## Composes with

- B-0005 (parent): implements the "GOVERNANCE §33 archive-header update"
  and "copilot-instructions mirror" acceptance signals.
- B-0376 (dep): provides the chosen directory name.
- B-0377 (sibling): parallel schema-doc update; neither depends on the other.
- B-0379 (downstream): execution atom runs after both schema updates
  (B-0377 and B-0378) land.
