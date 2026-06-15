---
name: dangling-memory-refs-systemic-29-across-4-surfaces-audit-extension
description: Extending audit #4031 from .claude/rules/ alone to 4 substrate surfaces revealed 29 dangling memory-file refs (1 skill, 8 research, 17 backlog, 3 persona) versus the original 5 — the user-scope-only-memory-file citation pattern is systemic, not rule-local. Audit-method extension + count by surface from Otto-CLI 2026-05-17T04:15Z.
type: project
created: 2026-05-17
---

# Audit extension — dangling memory refs are systemic across 4 surfaces (29 total)

**Fact**: Audit [#4031](https://github.com/Lucent-Financial-Group/Zeta/pull/4031) found 5 dangling rule→memory refs in `.claude/rules/`. Extending the audit to other substrate surfaces revealed **29 dangling refs** total across **4 surfaces**:

| Surface | Dangling / Unique refs | Pattern |
|---------|------------------------|---------|
| `.claude/agents/` | 0 / 0 | clean |
| `.claude/skills/` | 1 / 14 | tiny |
| `.claude/rules/` | 5 / N (was the #4031 audit; addressed by #4031+#4033+#4038 chain) | landed |
| `docs/research/` | 8 / 186 | small |
| `docs/backlog/` | 17 / 200 | largest |
| `memory/<persona>/` | 3 / 58 | small |
| **TOTAL** | **29 dangling refs** across 4 still-open surfaces | systemic |

**Why**: User-scope-only memory files (`~/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/`) get cited by in-repo substrate via `memory/feedback_*.md` path form. Aaron's Otto-CLI auto-loads user-scope memory so citations resolve; cold-boot agents on fresh checkouts don't have user-scope memory and the citations dangle.

**How to apply**: when auditing this pattern, scan ALL substrate surfaces in one pass — not just `.claude/rules/`. The systemic count (29) versus rule-local count (5) shows the pattern scales 6×. Apply Option B disclosure (citation-form discipline) at each citation site, OR Option A (promote user-scope memo to in-repo) for constitutional memos.

## Audit-method extension

The original #4031 audit used `sort -u` on filenames which (a) hid multi-rule citation edges (the bug that caused #4036 to miss the m-acc rule's citation of `feedback_aaron_shadow_star_shorthand_*`) and (b) only scanned `.claude/rules/`.

Extended audit command (one-pass, multi-surface):

```bash
for dir in .claude/agents .claude/skills .claude/rules docs/research docs/backlog memory/persona; do
  count=$(grep -rhoE 'memory/feedback_[a-zA-Z0-9_-]+\.md' "$dir" 2>/dev/null \
    | sort -u | while read f; do [ ! -f "$f" ] && echo "1"; done \
    | wc -l | tr -d ' ')
  total=$(grep -rhoE 'memory/feedback_[a-zA-Z0-9_-]+\.md' "$dir" 2>/dev/null \
    | sort -u | wc -l | tr -d ' ')
  echo "$dir: $count dangling / $total unique refs"
done
```

Better still: track ALL rule→file edges (file:line pairs), not deduplicated filenames. The audit-method gap from #4036's r2 cycle reveals that the `sort -u` dedup itself is the bug — multi-citation sites get hidden.

## Not a P0

Per the #4031 audit's own framing: Aaron's Otto-CLI continues to operate correctly via user-scope auto-load. The drift is in the cold-boot-fallback path for agents not on Aaron's machine.

But the **scaling** changes priority: 29 dangling refs across 4 surfaces is meaningful drift. A `tools/hygiene/audit-dangling-memory-refs.ts` script + CI integration would mechanize the discipline. Filed as substrate-engineer candidate.

## Composes with

- [`memory/feedback_otto_cli_audit_in_repo_rules_cite_user_scope_only_memory_files_5_dangling_refs_cold_boot_invisible_2026_05_17.md`](feedback_otto_cli_audit_in_repo_rules_cite_user_scope_only_memory_files_5_dangling_refs_cold_boot_invisible_2026_05_17.md) — the predecessor audit; this extension uses the same methodology at broader scope
- [PR #4031](https://github.com/Lucent-Financial-Group/Zeta/pull/4031) — the 5-ref rules-scope audit memo
- [PR #4033](https://github.com/Lucent-Financial-Group/Zeta/pull/4033) — peer-Otto-Desktop's Option B for 3 of the 5 rule-scope refs
- [PR #4038](https://github.com/Lucent-Financial-Group/Zeta/pull/4038) — my r2 cherry-pick adding Option B for the 5th rule-scope ref (which my original `sort -u` audit had hidden as a multi-citation site)
- [`.claude/rules/wake-time-substrate.md`](../.claude/rules/wake-time-substrate.md) — load-bearing learnings need durable substrate; user-scope IS durable for Aaron's machine, NOT for cold-boot agents on fresh checkouts
- CLAUDE.md memory fast-path section — names the two-tier (user-scope vs in-repo) architecture
