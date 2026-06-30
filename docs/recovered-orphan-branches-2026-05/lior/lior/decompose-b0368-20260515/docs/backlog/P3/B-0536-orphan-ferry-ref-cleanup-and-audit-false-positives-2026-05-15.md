---
id: B-0536
priority: P3
status: open
title: "Orphan-ferry-ref cleanup + audit false-positive on filename paths"
tier: factory-infrastructure
effort: M
created: 2026-05-15
last_updated: 2026-05-15
depends_on: []
composes_with: [B-0070]
tags: [audit, otto-279, role-refs, code-hygiene]
type: feature
---

# Orphan-ferry-ref cleanup + audit false-positive on filename paths

## Origin

Today's 4-batch Otto-279 cleanup arc ([PR #3570](https://github.com/Lucent-Financial-Group/Zeta/pull/3570), [#3572](https://github.com/Lucent-Financial-Group/Zeta/pull/3572), [#3574](https://github.com/Lucent-Financial-Group/Zeta/pull/3574), [#3576](https://github.com/Lucent-Financial-Group/Zeta/pull/3576)) addressed all 17 audit-flagged `per-name-attribution` violations. The remaining `orphan-ferry-ref` class needs separate treatment because:

1. **Different fix pattern** — `Per Aaron 2026-` → `Per the human maintainer 2026-` is mechanical. `ferry-7 enforcement-instrument set` → ??? requires per-occurrence judgment.
2. **Audit false-positive** — `src/Core/Maji.fs:5` is flagged as `orphan-courier-ferry-ref:courier-ferry-2026` but the match is inside a FILENAME (`docs/research/maji-formal-operational-model-deep-research-peer-courier-ferry-2026-04-26.md`). The path itself is legitimate (Otto-279 carve-out covers `docs/research/`); the audit shouldn't flag filename substrings.

## Problem statement

### Part A — orphan-ferry-ref cleanup

5+ live `orphan-ferry-ref` hits requiring per-occurrence judgment:

| File | Line | Context |
|---|---|---|
| `tools/hygiene/audit-agencysignature-main-tip.ts` | 9 | `ferry-7 enforcement-instrument set` |
| `tools/hygiene/audit-agencysignature-main-tip.ts` | 389 | `ferry-6` reference |
| `tools/hygiene/validate-agencysignature-pr-body.ts` | 9 | `ferry-7 enforcement-instrument set ("stop designing, instrument enforcement")` |
| `tests/Tests.FSharp/Algebra/Veridicality.Tests.fs` | 12 | `ferry-10` reference |
| `docs/trajectories/typescript-bun-migration/slice-audits.md` | 759 | `Amara's ferry-7 enforcement-instrument set` (Amara already named — half-fixed) |

Per `memory/feedback_orphan_role_ref_after_name_stripping_aaron_2026_04_28.md`, the fix pattern is:

> Mechanical name-stripping has a known failure mode: stripping "Amara ferry-N" leaves an orphan "ferry-N" reference that doesn't carry semantic weight. The orphan should EITHER be removed entirely OR replaced with a self-contained principle name.

Example fix from that memory:

```
Per Amara ferry-7 evidence-pointer rule  →  Per courier-ferry-7 absorb evidence-pointer rule
```

OR drop ferry-N entirely if the rule is otherwise specified in spec.

### Part B — audit false-positive

`src/Core/Maji.fs:5` references `docs/research/maji-formal-operational-model-deep-research-peer-courier-ferry-2026-04-26.md` (a legitimate filename in `docs/research/`). The audit script's regex matches `courier-ferry-2026` and `ferry-2026` inside the path. False positive.

Audit script needs to either:

1. Skip backtick-quoted paths (markdown file references)
2. Skip text inside parentheses that ends in `.md` (likely a markdown link target)
3. Whitelist `docs/research/` path prefix (Otto-279 carve-out already exempts that surface)

## Proposed solution

**Two slices:**

### Slice A — per-occurrence ferry-N cleanup

Read each ferry-N reference in context; either:

- Remove the `ferry-N` part if the surrounding prose is self-contained ("ferry-7 enforcement-instrument set" → "enforcement-instrument set")
- Replace with the AgencySignature spec reference if the reference is to that spec ("ferry-7" → "the AgencySignature spec v1 governance gate")
- Restore named source if removing would lose semantic info

Per-occurrence judgment; not mechanical.

### Slice B — audit script false-positive fix

In `tools/hygiene/audit-orphan-role-refs.ts`:

- Filter out filename-path matches (heuristic: if the `ferry-N` is inside a `.md` or `.ts`/`.fs` path token, skip)
- Or: whitelist `docs/research/` path prefix

Test with `src/Core/Maji.fs` as the regression fixture — should not flag the Maji.fs file reference after fix.

## Out of scope

- Audit-orphan-role-refs gate.yml wiring (separate row if/when baseline = 0)
- Multi-name attribution (`Per Codex + Copilot 2026-05-06`) — audit regex limitation observed 2026-05-15 in tick 2020Z shard; not in this row's scope but related class

## Composes with

- [B-0070](B-0070-author-time-orphan-role-ref-lint.md) — the original row that surfaced this audit (if it exists; verify in research)
- `memory/feedback_orphan_role_ref_after_name_stripping_aaron_2026_04_28.md` — the fix-pattern reference
- `tools/hygiene/audit-orphan-role-refs.ts` — the detection tool
- 4-batch Otto-279 per-name-attribution arc this session (PRs #3570, #3572, #3574, #3576)
