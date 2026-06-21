---
id: 081KR2E4K0008QG0R0004B55ND
priority: P1
status: closed
title: "MEMORY.md marker-vs-index - Q1 AutoDream/AutoMemory compatibility validation"
created: 2026-05-08
last_updated: 2026-05-14
closed: 2026-05-14
parent: 081KQ8P5D0008QG0R003KFRGJ0
depends_on: [081KR2E4K0008QG0R001M8NJ56]
classification: blocked-on-cutover
decomposition: atomic
---

# 081KR2E4K0008QG0R0004B55ND - Q1 AutoDream/AutoMemory compatibility validation

Validate post-cutover behavior for AutoDream/AutoMemory and
codify rollback/repair actions if contract mismatches appear.

## Work scope

- Run post-cutover compatibility checks.
- Validate writes/reads still land on expected surfaces.
- Document rollback/repair procedure.

## Acceptance criteria

- Compatibility result is recorded with pass/fail evidence.
- Any mismatch has explicit rollback or interception plan.
- 081KQ8P5D0008QG0R003KFRGJ0 close recommendation is produced only after this row.

## Closure notes (2026-05-14)

**PR #3110** delivers:

- `docs/research/b-0261-autodream-automemory-compatibility-validation-2026-05-14.md`
  — full pass/fail evidence report (five verification steps re-run post-cutover).

**Compatibility results (PASS with one pre-existing gap):**

| Check | Result |
|-------|--------|
| Line cap satisfied post-cutover | ✅ PASS — 110 lines (was 370 pre-cutover) |
| Byte cap satisfied | ❌ PARTIAL — 62 KB (pre-existing; not a regression) |
| One-line-per-file format | ✅ PASS — 100/100 lines correct |
| Reindexer format contract | ✅ PASS — `--check` exits 0 |
| AutoDream marker preserved | ✅ PASS — marker at line 1; reindexer passes it through |
| AutoDream write-back compat | ✅ PASS — no conflict by design |
| AutoMemory write-back scope | ✅ PASS — targets user-scope path, not repo-scope |

**Key architectural finding:** AutoMemory writes to `~/.claude/projects/<slug>/memory/MEMORY.md`
(user-scope), not `memory/MEMORY.md` (repo-scope). The two surfaces are independent —
no interaction conflict is possible.

**Known gap (byte-cap overage):** Repo-scope MEMORY.md is 62 KB vs ~25 KB harness byte
cap. Pre-existing since before 081KR2E4K0008QG0R001M8NJ56 (was 108 KB). Mitigation in place: reindexer
100-entry stack cap. Rollback plan documented in the research note (three options:
trim descriptions, reduce stack cap, or wait for feature-flag graduation).

**081KQ8P5D0008QG0R003KFRGJ0 close recommendation:** All five child rows closed. All done-criteria met
except the 081KQ8P5D0008QG0R001D8RCZ9 hotspot-threshold check (ongoing monitoring, not a blocker).
081KQ8P5D0008QG0R003KFRGJ0 is recommended for closure.

All acceptance criteria met:

- ✅ Compatibility result recorded with pass/fail evidence
- ✅ Byte-cap mismatch documented with rollback/interception plan
- ✅ 081KQ8P5D0008QG0R003KFRGJ0 close recommendation produced
