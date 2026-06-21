---
id: 081KQB8J40008QG0R0021GX1HK
priority: P2
status: decomposed
title: Consolidation pass — map 2026-04-29 session-arc rules into 3 durable homes max
tier: factory-hygiene
effort: M
ask: Multi-AI synthesis packet round 4 (Amara 2026-04-29 — "no new conceptual substrate until a consolidation pass maps each new rule to a durable home")
created: 2026-04-29
last_updated: 2026-05-02
depends_on: []
composes_with: [081KQB8J40008QG0R003VMCFWB, 081KQB8J40008QG0R002PEP2A2, 081KQB8J40008QG0R0023DKTFJ, 081KQB8J40008QG0R002DNCSKR, 081KQB8J40008QG0R002DQ0FDR, 081KQB8J40008QG0R003XNATZJ, 081KQB8J40008QG0R0016EHY06]
tags: [consolidation, factory-hygiene, durable-home-discipline, p2, blocks-new-substrate]
type: friction-reducer
---

# Consolidation pass — three durable homes max

Amara's round-4 directive (2026-04-29):

> *"No new conceptual substrate until a consolidation pass
> maps each new rule to a durable home."*

The 2026-04-29 session arc produced 7+ promotable rules across
three families. Without consolidation, they remain fragmented
across many backlog rows + memory files + research notes. The
consolidation pass converts them into ≤3 durable homes.

## Decomposition (re-decomp 2026-05-11, Riven background)

081KQB8J40008QG0R0021GX1HK was broad (5 migration steps + 3 homes + backpressure). Re-decomposed into 3 smallest dependency-ordered atomic children (always re-decompose assumption applied):

**Buildable now (parallel):**

- 081KRA5AR0008QG0R0031VF018 (S) — Home 1 operational doc authoring (merge-cascade PR liveness)
- 081KRA5AR0008QG0R002JS7GRB (S) — Home 3 memory file authoring (reviewer-artifact taxonomy)

**Blocked on 081KRA5AR0008QG0R0031VF018 + 081KRA5AR0008QG0R002JS7GRB:**

- 081KRA5AR0008QG0R001QT2ZXQ (M) — 081KQB8J40008QG0R003XNATZJ update + MEMORY.md index + cross-links + 081KQB8J40008QG0R0021GX1HK supersede

No further children; the 3 homes are now the durable substrate. 081KQB8J40008QG0R0023DKTFJ/081KQB8J40008QG0R0016EHY06 remain orthogonal.

## Three target durable homes

### Home 1 — PR-liveness / merge-cascade operational doc

Likely path: `docs/operations/merge-cascade-pr-liveness-rule.md`
(kebab-case to match existing `docs/operations/` filename
convention; Copilot caught the ALL-CAPS mismatch). Absorbs:

- Probabilistic race framing (PR-liveness race during merge
  cascade is observed/probabilistic, not deterministic)
- Cascade detection pre-flight (`gh pr list --author --jq`
  query for adjacent auto-merge PRs)
- Before/after capture protocol (RUN_ID-namespaced artifact
  paths)
- API/head sync wait (poll until GitHub `headRefOid`
  converges to local HEAD)
- Successor-PR dedup (re-check original after settle)
- Recovery-note schema (10 fields including
  `seconds_between_force_push_and_pr_close`)
- "Up-to-date is a merge gate; PR-aliveness is a
  reachability/diff invariant; do not confuse them"
- ORDERED_MERGE_DEPENDENCY guard (encode `Depends-On: #N` +
  pre-merge check script)

Subsumes: 081KQB8J40008QG0R002DQ0FDR.

### Home 2 — Computed-metadata-discipline (already P2 in 081KQB8J40008QG0R003XNATZJ)

Existing path: `docs/backlog/P2/081KQB8J40008QG0R003XNATZJ-computed-metadata-discipline-unified-lint-2026-04-29.md`.
Already absorbs:

- Ordinal drift (081KQB8J40008QG0R003VMCFWB, subsumed)
- PR-count drift (081KQB8J40008QG0R002PEP2A2, subsumed)
- Filename-vs-row-timestamp drift
- Branch-base claims
- Boundary clause (does NOT apply to summaries/interpretations)

Future: implement the unified lint (`tools/lint/metadata-drift-check.sh`).

Subsumes: 081KQB8J40008QG0R003VMCFWB, 081KQB8J40008QG0R002PEP2A2.

### Home 3 — Reviewer-artifact / snapshot-mismatch taxonomy

Likely path: `memory/feedback_reviewer_artifact_snapshot_mismatch_taxonomy_2026_04_29.md`
(memory file, since it's a decision-tree future-Claude
applies on every review thread — frontmatter + body). Absorbs:

- 5+1 bucket table from 081KQB8J40008QG0R002DNCSKR (REAL_DEFECT, BACKWARD_STALE_SNAPSHOT,
  FORWARD_CROSS_PR_REFERENCE, DISPLAY_ARTIFACT, INCOMPLETE_CONTEXT,
  NEEDS_HUMAN_REVIEW)
- SNAPSHOT_MISMATCH parent class with two children (split
  applied in round-4)
- Per-bucket remedies (verify-and-resolve vs encode-dependency
  vs evidence-resolve vs investigate-then-decide vs surface-to-
  human)
- "A forward reference is not wrong if the dependency is
  enforced" rule

Subsumes: 081KQB8J40008QG0R002DNCSKR.

## Backpressure rule for new substrate

Until this consolidation lands, the discipline is:

```text
No new conceptual substrate (new memory files, new backlog
rows for new concepts, new research notes for new ideas)
until each rule from the 2026-04-29 session arc maps to one
of the three homes above.

Permitted during the freeze:
- corrections to existing rules (per reviewer feedback)
- tick-history shards (operational record)
- merges of in-flight PRs
- defect fixes on existing substrate
- THIS consolidation work itself
```

## Why P2 (factory-hygiene, blocking new substrate)

P2 because the consolidation IS the next-priority work; until
it lands, the substrate fragmentation grows. Not P0/P1
because nothing is currently broken; the cost is future-
discoverability and rule-coherence.

## Composes with

- 081KQB8J40008QG0R003VMCFWB, 081KQB8J40008QG0R002PEP2A2 — subsumed into 081KQB8J40008QG0R003XNATZJ.
- 081KQB8J40008QG0R0023DKTFJ — pure-wait backpressure rule; preserved as separate
  operational concern (orthogonal to the metadata family).
- 081KQB8J40008QG0R002DNCSKR — subsumed into Home 3 (memory file).
- 081KQB8J40008QG0R002DQ0FDR — subsumed into Home 1 (operational doc).
- 081KQB8J40008QG0R003XNATZJ — already a Home (the metadata-discipline P2).
- 081KQB8J40008QG0R0016EHY06 — subsumed if the threading bridge becomes one of
  the operational homes; otherwise stays separate.

## Migration path (when consolidation work begins)

1. Author Home 1 doc; copy + restructure 081KQB8J40008QG0R002DQ0FDR content;
   mark 081KQB8J40008QG0R002DQ0FDR as superseded-by-Home1.
2. Author Home 3 memory file; copy + restructure 081KQB8J40008QG0R002DNCSKR
   content; mark 081KQB8J40008QG0R002DNCSKR as superseded-by-Home3.
3. 081KQB8J40008QG0R003XNATZJ stays in place (already a P2 Home); update its
   frontmatter to mark 081KQB8J40008QG0R003VMCFWB + 081KQB8J40008QG0R002PEP2A2 as fully subsumed.
4. Update MEMORY.md index with a pointer to Home 3 (the new
   memory file).
5. Cross-link the three Homes in their respective docs +
   in `docs/AGENT-BEST-PRACTICES.md` if rule-elevation is
   warranted.

## Distilled rule

```text
Consensus is a spotlight.
Evidence is the lock.
Consolidation is the next gate.
```
