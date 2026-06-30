---
id: B-0535
priority: P3
status: closed
title: "Backlog ID-uniqueness lint — extension of B-0532 to catch cross-agent B-NNNN collisions"
tier: factory-infrastructure
effort: S
created: 2026-05-15
last_updated: 2026-05-16
closed: 2026-05-16
depends_on: []
composes_with: [B-0532, B-0533]
tags: [backlog, lint, mechanization, multi-agent, drift-detection, id-allocation]
type: feature
---

# Backlog ID-uniqueness lint

## Origin

2026-05-15 had at least 2 cross-agent B-NNNN ID-allocation collisions:

| Collision | Agents | Resolution |
|---|---|---|
| `B-0444` | Otto-CLI vs Otto-Desktop | Otto-CLI flagged via "Request Changes"; corrected as [PR #3053](https://github.com/Lucent-Financial-Group/Zeta/pull/3053) using `B-0450` |
| `B-0532` + `B-0533` | Lior (PR #3545) vs Otto-CLI (PR #3523, PR #3540) | Otto-CLI's PRs landed first ([B-0532](B-0532-backlog-graph-consistency-lint-parent-child-status-mismatch-2026-05-15.md), [B-0533](B-0533-section33-migration-dead-xref-sweep-and-lint-2026-05-15.md)); Lior's PR #3545 in CONFLICTING state, requires renumbering |

Both collisions cost ~15min of cross-agent coordination effort (investigation + comment + renumbering) per occurrence. Empirical collision rate ~20% across backlog-row-authoring events on 2026-05-15.

[`.claude/rules/otto-channels-reference-card.md`](../../../.claude/rules/otto-channels-reference-card.md) already documents the ID-allocation discipline (check `origin/main` + in-flight PR scan before allocating). The discipline relies on agent-side compliance at row-authoring time. This row mechanizes the catch at PR-time so the discipline doesn't depend on per-agent memory.

## Problem

The discipline-level rule (check `origin/main` + `gh pr list` before picking a B-NNNN) can be skipped or misapplied:

- Agent reads only `git ls-tree origin/main` (misses in-flight PRs)
- Agent reads only `gh pr list` (misses already-merged work on main)
- Agent reads both but at separate times with intervening commits
- Agent picks B-NNNN from a feature-branch state, not from current main + in-flight

Result: same B-NNNN claimed by two different files at two different paths (often `docs/backlog/P*/B-NNNN-...md`). Today's example: `B-0532` claimed by mine at `docs/backlog/P3/B-0532-backlog-graph-consistency-lint-...` AND by Lior at `docs/backlog/P2/B-0532-claude-code-permissions-hardcoded-safety-gates-...`. Different paths → no file-system conflict → no automatic CI catch.

## Proposed solution

**Extend [B-0532](B-0532-backlog-graph-consistency-lint-parent-child-status-mismatch-2026-05-15.md)'s scope** to include ID-uniqueness:

1. Walk all `docs/backlog/**/B-NNNN-*.md` files
2. Group by B-NNNN ID (parsed from filename or frontmatter `id:` field)
3. Hard error if any B-NNNN ID maps to more than 1 file

Hard error because ID collision is **always wrong** (no legitimate case for two backlog rows with the same B-NNNN). Different from B-0533 dead-xref which is "default error but exception-prone" — ID uniqueness has no legitimate exception.

## Implementation sketch

```typescript
// tools/hygiene/audit-backlog-id-uniqueness.ts (or extend audit-backlog-items.ts)

const backlogFiles = walkMd("docs/backlog");
const byId = new Map<string, string[]>();
for (const f of backlogFiles) {
  const match = basename(f).match(/^B-(\d{4})-/);
  if (!match) continue;
  const id = `B-${match[1]}`;
  (byId.get(id) ?? byId.set(id, []).get(id)!).push(f);
}
const collisions = [...byId.entries()].filter(([_, files]) => files.length > 1);
// hard-error if collisions.length > 0
```

`audit-backlog-items.ts` already exists in `tools/hygiene/`; the natural shape is to either extend it OR add a sibling `audit-backlog-id-uniqueness.ts`. Decision: extend the existing tool (per [`.claude/rules/skill-router-as-substrate-inventory.md`](../../../.claude/rules/skill-router-as-substrate-inventory.md) — inventory before authoring).

## Gate.yml wiring

Add to the existing backlog-related lint job in `.github/workflows/gate.yml` (or as a sibling job named `lint-backlog-id-uniqueness`). Same pattern as the §33-migration-xrefs job from [PR #3555](https://github.com/Lucent-Financial-Group/Zeta/pull/3555).

## Out of scope

- **Auto-suggest next-available B-NNNN** — useful CLI tool, but separate scope (could file as B-053N follow-up)
- **Cross-fork ID coordination** — current scope assumes single repo with multiple agents; cross-fork coordination is a different problem
- **Decision-archaeology ID type** — this row scope is B-NNNN only; D-NNNN (decision IDs) could be added later if collisions become recurrent there too

## Composes with

- [B-0532](B-0532-backlog-graph-consistency-lint-parent-child-status-mismatch-2026-05-15.md) — natural extension of scope; same lint family
- [B-0533](B-0533-section33-migration-dead-xref-sweep-and-lint-2026-05-15.md) — same catch-once-then-lint mechanization pattern
- [`.claude/rules/otto-channels-reference-card.md`](../../../.claude/rules/otto-channels-reference-card.md) — ID-allocation discipline this lint mechanizes
- [`.claude/rules/refresh-before-decide.md`](../../../.claude/rules/refresh-before-decide.md) — discipline-layer this lint complements at machine-layer
- [PR #3053](https://github.com/Lucent-Financial-Group/Zeta/pull/3053) (B-0444 collision empirical anchor)
- [PR #3545](https://github.com/Lucent-Financial-Group/Zeta/pull/3545) (B-0532/B-0533 collision empirical anchor)

## Resolution (2026-05-16)

Mechanization shipped 2026-05-15 via **PR #3565** (`feat(B-0535): wire backlog ID-uniqueness lint to gate.yml`, merged).

The duplicate-ID detection logic was extended into the existing `tools/hygiene/audit-backlog-items.ts` (per the row's skill-router-as-substrate-inventory decision in "Implementation sketch"), and CI is now wired:

| Acceptance | Status |
|---|---|
| Walk all `docs/backlog/**/B-NNNN-*.md`; group by ID | shipped — `audit-backlog-items.ts` `--enforce-duplicate-ids` |
| Hard error on collision | shipped — exit non-zero on duplicate IDs |
| Wired to `.github/workflows/gate.yml` | shipped — `lint-backlog-id-uniqueness` job (verified by `grep -E 'lint-backlog-id-uniqueness' .github/workflows/gate.yml`) |
| Composes with B-0532 hard-error slice | shipped — sibling job `--enforce-parent-child-status` adjacent in gate.yml |

Out-of-scope items remain out of scope (auto-suggest next ID; cross-fork coordination; D-NNNN type).

Row left open 2026-05-15 → 2026-05-16 as substrate drift — third drift catch of this session (paired with B-0506 PR #3733 and B-0530 PR #3737). The pattern is recurring enough that it's worth filing a systematic-audit follow-up row to sweep the remaining P3 status-open rows for shipped-but-unclosed work.
