---
id: B-0105
priority: P2
status: open
title: Consolidation pass — map 2026-04-29 session-arc rules into 3 durable homes max
tier: factory-hygiene
effort: M
ask: Multi-AI synthesis packet round 4 (Amara 2026-04-29 — "no new conceptual substrate until a consolidation pass maps each new rule to a durable home")
created: 2026-04-29
last_updated: 2026-04-29
composes_with: [B-0098, B-0099, B-0100, B-0101, B-0102, B-0103, B-0104]
tags: [consolidation, factory-hygiene, durable-home-discipline, p2, blocks-new-substrate]
---

# Consolidation pass — three durable homes max

Amara's round-4 directive (2026-04-29):

> *"No new conceptual substrate until a consolidation pass
> maps each new rule to a durable home."*

The 2026-04-29 session arc produced 7+ promotable rules across
three families. Without consolidation, they remain fragmented
across many backlog rows + memory files + research notes. The
consolidation pass converts them into ≤3 durable homes.

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

Subsumes: B-0102.

### Home 2 — Computed-metadata-discipline (already P2 in B-0103)

Existing path: `docs/backlog/P2/B-0103-computed-metadata-discipline-unified-lint-2026-04-29.md`.
Already absorbs:

- Ordinal drift (B-0098, subsumed)
- PR-count drift (B-0099, subsumed)
- Filename-vs-row-timestamp drift
- Branch-base claims
- Boundary clause (does NOT apply to summaries/interpretations)

Future: implement the unified lint (`tools/lint/metadata-drift-check.sh`).

Subsumes: B-0098, B-0099.

### Home 3 — Reviewer-artifact / snapshot-mismatch taxonomy

Likely path: `memory/feedback_reviewer_artifact_snapshot_mismatch_taxonomy_2026_04_29.md`
(memory file, since it's a decision-tree future-Claude
applies on every review thread — frontmatter + body). Absorbs:

- 5+1 bucket table from B-0101 (REAL_DEFECT, BACKWARD_STALE_SNAPSHOT,
  FORWARD_CROSS_PR_REFERENCE, DISPLAY_ARTIFACT, INCOMPLETE_CONTEXT,
  NEEDS_HUMAN_REVIEW)
- SNAPSHOT_MISMATCH parent class with two children (split
  applied in round-4)
- Per-bucket remedies (verify-and-resolve vs encode-dependency
  vs evidence-resolve vs investigate-then-decide vs surface-to-
  human)
- "A forward reference is not wrong if the dependency is
  enforced" rule

Subsumes: B-0101.

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

- B-0098, B-0099 — subsumed into B-0103.
- B-0100 — pure-wait backpressure rule; preserved as separate
  operational concern (orthogonal to the metadata family).
- B-0101 — subsumed into Home 3 (memory file).
- B-0102 — subsumed into Home 1 (operational doc).
- B-0103 — already a Home (the metadata-discipline P2).
- B-0104 — subsumed if the threading bridge becomes one of
  the operational homes; otherwise stays separate.

## Migration path (when consolidation work begins)

1. Author Home 1 doc; copy + restructure B-0102 content;
   mark B-0102 as superseded-by-Home1.
2. Author Home 3 memory file; copy + restructure B-0101
   content; mark B-0101 as superseded-by-Home3.
3. B-0103 stays in place (already a P2 Home); update its
   frontmatter to mark B-0098 + B-0099 as fully subsumed.
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
