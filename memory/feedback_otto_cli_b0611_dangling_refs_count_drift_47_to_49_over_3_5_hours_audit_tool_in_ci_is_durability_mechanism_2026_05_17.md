---
name: 081KRSKQ20008QG0R0014PPGZM dangling-refs count drift — 47 → 49 over 3.5h shows one-shot cleanup is insufficient; audit tool in CI is the durability mechanism
description: Real-time data point captured during autonomous-loop session 2026-05-17 0808Z-0820Z. Catalog memo from same morning (0430Z) recorded 47 file:line pairs across 6 surfaces. Re-running the newly-merged audit-dangling-memory-refs.ts (PR #4042) at 0817Z showed 49 edges / 35 unique dangling refs across 5 surfaces (`.claude/agents` now 0). The +2 edge drift over ~3.5h is operational evidence that one-shot 081KRSKQ20008QG0R0014PPGZM cleanup will be re-incremented by next session's natural rule/memo authoring unless the audit tool is wired into CI as a non-required check that surfaces drift on every PR.
type: project
created: 2026-05-17T08:20Z
---

# Dangling-refs count drift signal — 47 → 49 over 3.5h (2026-05-17)

## The data point

| Source | Timestamp | Edges | Unique dangling | Surfaces with edges |
|---|---|---|---|---|
| Catalog memo (PR #4046 substrate) | 2026-05-17T04:30Z | 47 | (n/a) | 6 (including `.claude/agents`) |
| Audit tool run (autonomous-loop, this session) | 2026-05-17T08:17Z | 49 | 35 | 5 (`.claude/agents` now 0) |

**Net change**: +2 edges, ~3.5h elapsed. One surface emptied; new edges
appeared in other surfaces. The 35-unique-dangling headline from the
081KRSKQ20008QG0R0014PPGZM row remains accurate at session-current state.

## By-surface breakdown (audit tool, 08:17Z)

| Surface | Edges | Unique dangling | Files scanned |
|---|---|---|---|
| `.claude/skills` | 1 | 1 | 262 |
| `.claude/rules` | 5 | 5 | 56 |
| `docs/research` | 9 | 8 | 355 |
| `docs/backlog` | 24 | 17 | 675 |
| `memory/persona` | 10 | 4 | 288 |
| **Total** | **49** | **35** | **1636** |

`docs/backlog` carries the largest share (17 / 35 = 49% of unique
dangling refs) — consistent with slice 4 of the recipe memos
([slice 4 memo](feedback_otto_cli_b0611_slice4_audit_docs_backlog_largest_scope_simplest_pattern_2026_05_17.md))
naming docs/backlog as "largest scope, simplest pattern."

## Why the drift matters

The 0430Z catalog → 0817Z audit drift confirms a structural property
of the dangling-refs problem: **new in-repo references to user-scope
memory files accumulate naturally with each rule update, each new
memo, each PR description**. The pattern is generative, not
incidental.

A one-shot 081KRSKQ20008QG0R0014PPGZM cleanup that resolves 35 refs at point-in-time T
will, by the same generative process, accumulate new dangling refs
between T and T+N. Without a durability mechanism, the count drifts
right back up.

## Implication for 081KRSKQ20008QG0R0014PPGZM cleanup strategy

The 081KRSKQ20008QG0R0014PPGZM row's "Proposed mechanization" already includes an
audit-tool CI-integration acceptance bullet. This data point
strengthens the case: the audit tool from PR #4042 should ship as a
**non-required CI check** that:

1. Runs on every PR via `bun tools/hygiene/audit-dangling-memory-refs.ts --json`
2. Compares new-PR-state count vs `origin/main`-state count
3. Surfaces as a non-required check failure when the count increases
4. Does NOT block merge (similar to "lint (backlog parent-child status)" on PR #3962) — non-blocking signal, not gate

The non-blocking shape preserves authoring velocity (PRs that legitimately
add new user-scope-memory-file references aren't blocked) while making
the drift visible at PR-review time. The reviewer (Otto / Copilot / Codex)
sees the check + decides whether to address the new ref or let it ride.

## Composes with

- [PR #4042](https://github.com/Lucent-Financial-Group/Zeta/pull/4042)
  — audit tool mechanization
- [PR #4046](https://github.com/Lucent-Financial-Group/Zeta/pull/4046)
  — 081KRSKQ20008QG0R0014PPGZM row + 4 slice recipes + session memos + 3 tick shards
- 081KRSKQ20008QG0R0014PPGZM row (now on `origin/main` via #4046):
  `docs/backlog/P2/081KRSKQ20008QG0R0014PPGZM-dangling-memory-refs-cleanup-35-refs-6-surfaces-2026-05-17.md`
- Slice 4 memo (largest scope finding) — references the same pattern
- The dangling-refs file:line catalog memo (still filesystem-only in
  primary worktree at session 0820Z; candidate for follow-up PR)

## Session context

Captured during autonomous-loop tick at 0820Z, counter=5 pre-empt
point with named-dep `Lior-active` (3 procs) blocking fresh-worktree
follow-up PR work. This memo is the substrate-honest concrete
artifact for the pre-empt cycle, recorded in primary worktree as
filesystem-only (Aaron-WIP staging absorbs it on next interactive
commit cycle, or a fresh-worktree Otto sweeps it into a follow-up PR
when Lior clears).

## Full reasoning

The audit tool's `--json` output at 08:17Z UTC, this session
(0808Z-0820Z autonomous-loop arc). Catalog memo's headline count
recorded in
`memory/feedback_otto_cli_dangling_refs_file_line_catalog_47_pairs_6_surfaces_2026_05_17.md`
frontmatter and body.
