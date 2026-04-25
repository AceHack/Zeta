---
id: B-0012
priority: P3
status: open
title: Land `docs/DECISIONS/2026-04-22-aurora-ksk-design.md` ADR if still needed (currently dangling reference in some legacy citations)
tier: docs
effort: M
directive: Codex review on PR #506 (Otto-313 teaching-decline disposition)
created: 2026-04-25
last_updated: 2026-04-25
composes_with: []
tags: [docs, decisions-adr, aurora, aurora-ksk, dangling-reference]
---

# Land Aurora-KSK design ADR if still needed

Codex flagged on PR #506 a tick-history row mentioning `docs/DECISIONS/2026-04-22-aurora-ksk-design.md` (the row was DESCRIBING a fix replacing that dead path with three actually-existing memory-file references). The mention is recording-the-fix, not citing-as-live; thread resolved as not-actually-broken.

## What

If the Aurora-KSK design substrate WARRANTS formalization as an ADR (rather than living in the memory cluster), land the file at `docs/DECISIONS/2026-04-22-aurora-ksk-design.md`. If the memory cluster is sufficient (Amara 7th ferry + Aurora-network-DAO + Aurora-pitch covers it), no ADR is needed and this row resolves as not-needed.

## Decision questions

1. Is the Aurora-KSK design substrate complete in the memory cluster?
   - `feedback_aurora_*` files at `memory/`
   - Amara 7th ferry import
   - Aurora-network-DAO substrate
   - Aurora-pitch substrate
2. If complete: no ADR needed; resolve as not-needed; close.
3. If incomplete: identify the gap; draft ADR; land at the cited path.

## Composes with

- B-0005 (split aurora from courier-ferry archive) — the ADR if landed should align with the directory-ontology decision in B-0005.
- Otto-273 (history-of-named-entity-conversations directory pattern).
- Otto-313 — this row IS the teaching for the Codex catch.

## Why deferred

- Memory cluster currently holds substantive Aurora-KSK material; ADR may not be needed.
- Aurora-KSK is referenced from multiple substrate surfaces but the substrate is what reviewers actually consume; a separate ADR may be redundant.
- Decision-on-need warrants Aaron sign-off; landing without need would be churn.

## Done when

- Decision made: ADR-needed OR not-needed.
- If ADR-needed: file landed; legacy citations updated to point to it.
- If not-needed: this row resolves as not-needed; tick-history row about the fix stays as-is (it's recording-the-fix, not citing-as-live).
