---
name: 081KRSKQ20008QG0R0014PPGZM slice 4 audit — docs/backlog surface; largest scope (17 refs, ~22 edges) but simplest resolution pattern (all Otto-authored rows, 4-option menu applies)
description: ~22 edges across 17 unique dangling refs in docs/backlog. All citing files are Otto-authored backlog rows (B-NNNN-*.md), no verbatim-preservation constraint. Uses slice-1 4-option menu (in-repo projection / footnote-fallback / deletion / hybrid). Largest scope but no Option E needed.
type: feedback
created: 2026-05-17T07:23Z
---

# 081KRSKQ20008QG0R0014PPGZM slice 4 audit — docs/backlog, 21 citing files, 17 unique refs

## Audit output (`--surfaces docs/backlog`, 2026-05-17T07:23Z)

17 unique dangling refs, ~22 edges across 21 backlog-row files:

| Citing file (truncated) | # citations |
|---|---:|
| `081KQ8P5D0008QG0R003JETMEV-budget-cadence-workflow-cron-misses-task-287-deadline-*.md` | 2 |
| `081KQGDBJ0008QG0R000A4EZS5-typescript-standardization-non-install-scripts-aaron-*.md` | 2 |
| `081KRA5AR0008QG0R002JS7GRB-home3-reviewer-artifact-snapshot-mismatch-taxonomy-*.md` | 2 |
| 18 other rows | 1 each |

Total citing rows: 21. All under `docs/backlog/P*/B-*.md`. All are
**Otto-authored backlog rows** — not verbatim conversation files,
not external-AI packet preservation, not research syntheses.

## File-type classification

| File category | Files | Resolution pattern |
|---|---:|---|
| Otto-authored backlog rows | 21 | **4-option menu** (slice 1) |
| Verbatim preservation | 0 | (none — Option E not needed) |
| External-AI packets | 0 | (none) |

Slice 4 is **homogeneous** — single file-type, single resolution
pattern, even though it's the largest scope by edge count.

## Per-ref resolution menu (slice 1's 4 options)

For each of the 17 unique dangling refs in slice 4, pick one of:

1. **Option A — In-repo projection**: backlog row authors a brief
   in-repo summary of the user-scope content + updates the citation
   to point at the in-repo summary location. Most appropriate when
   the memory file's content is load-bearing on the row's argument.

2. **Option B — Footnote-fallback**: keep the citation but add a
   footnote naming the in-repo fallback (`memory/CURRENT-*.md`
   section or a rule body). Most appropriate when the memory file
   is contextual (composes_with substrate) but not load-bearing.

3. **Option C — Delete**: remove the citation if the cited memory
   was an artifact of the row's original drafting that no longer
   carries the row's current logic. Most appropriate for "full
   reasoning" or "see also" pointers that have been superseded.

4. **Option D — Hybrid**: per-citation choice across the row's
   multiple cites (3 of the 21 rows cite 2 refs each; could mix
   options per cite).

## Compositional snapshot after 4 slices (081KRSKQ20008QG0R0014PPGZM complete audit)

| Slice | Surface | uniqueRefs | edges | Pattern |
|---|---|---:|---:|---|
| 1 | `.claude/skills` + `.claude/rules` | 6 | 6 | 4/6 already footnote-fallback (no work); 2 need Option A-D |
| 2 | `memory/persona` | 4 | 10 | Option E (editorial footnote on verbatim) |
| 3 | `docs/research` | 8 | 9 | Hybrid: ~5 Option E (verbatim) + ~4 Option A-D (Otto-authored) |
| 4 | `docs/backlog` | 17 | ~22 | All Option A-D (Otto-authored backlog rows) |
| **Total** | 6 surfaces (`.claude/agents` has 0) | **35** | **~47** | 4 patterns: no-work / Option A-D / Option E / hybrid |

## Work-decomposition summary

| Resolution class | Edges | Work shape |
|---|---:|---|
| Already footnote-fallback (slice 1) | 4 | No edit needed (intentional dangling) |
| Option A-D (Otto-authored rows + research) | ~26 | Per-citation choice; mechanical once mapping established |
| Option E (verbatim files) | ~15 | Editorial footnote at top of file; mechanical pattern |
| Audit-tool integration | — | Allowlist / suggest mode / annotation parser (one-time engineering) |

**Estimated work for full 081KRSKQ20008QG0R0014PPGZM cleanup**: ~3-4 small PRs
(one per slice + optional audit-tool-integration PR). Per-slice
PR can be authored independently. Slice 1 + 4 (most homogeneous)
could ship first; slice 2 + 3 (with Option E) need the projection-
target inspection step at safe window.

## Composes with

- 081KRSKQ20008QG0R0014PPGZM — parent backlog row
- Slice-1 recipe memo (4-option menu + footnote-fallback observation)
- Slice-2 recipe memo (Option E pattern for verbatim)
- Slice-3 recipe memo (mixed file types, hybrid resolution)
- This memo — completes the per-slice prep audit set

## Substrate-honest framing

The 4-slice per-recipe set is now complete. The cleanup work
itself is bounded and well-scoped: each slice has a known
resolution pattern, known per-citation count, and a substrate-
honest map from "ref I see in audit output" to "edit I make to
resolve it."

The substrate-design decisions are:

1. **Maintainer decision (slice 1)**: 4-option menu choice for the
   2 non-footnoted refs (#1 and #4 from slice-1 recipe)
2. **Mechanical (slice 2)**: Option E editorial footnote on 6
   conversation files
3. **Per-citation decisions (slice 3)**: Option E on 4 verbatim
   files + per-cite Option A-D on 3 Otto-authored files
4. **Per-citation decisions (slice 4)**: Option A-D on 21 rows
5. **Optional engineering (post-cleanup)**: audit-tool allowlist
   semi-automation per 081KRSKQ20008QG0R0014PPGZM acceptance bullet

After all slices land, `bun tools/hygiene/audit-dangling-memory-refs.ts`
exits 0 across all 6 surfaces. Until the audit-tool allowlist
ships, CI integration of the tool is gated on completing slice
cleanup.

This memo completes the 081KRSKQ20008QG0R0014PPGZM audit-prep substrate. Future
safe-window Otto starting cleanup can read the 4 per-slice memos
+ the parent backlog row to execute the work without re-running
discovery.
