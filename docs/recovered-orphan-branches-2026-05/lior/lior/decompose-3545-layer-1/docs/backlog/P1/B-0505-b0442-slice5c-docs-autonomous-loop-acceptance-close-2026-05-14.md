---
id: B-0505
priority: P1
status: open
title: "B-0442 slice 5c — docs update (AUTONOMOUS-LOOP.md + bg/README.md) + B-0442 acceptance close"
tier: factory-infrastructure
effort: XS
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0442
depends_on: [B-0504]
composes_with: [B-0442, B-0503, B-0504]
tags: [documentation, background-service, drift-detection, recovery-pr]
type: chore
---

# B-0442 slice 5c — docs update + acceptance criteria close

## Origin

B-0442 acceptance criterion (still open after B-0503 + B-0504 land):

> Optionally auto-opens recovery PR with the missing commits (gated by
> configuration) (slice 5 — pending; subscriber-agent layer)

Once B-0503 (core function) and B-0504 (wiring) land, the only remaining
work is documentation and marking the acceptance criterion complete. This row
is intentionally docs-only — no code changes.

## Acceptance criteria

- [ ] `docs/AUTONOMOUS-LOOP.md` updated with a new subsection under the
  `missed-substrate-detector` service entry:
  - Documents `--auto-recover` flag: purpose, default (`off`), when to enable.
  - Documents `--recovery-dry-run` flag: purpose (log intent without mutations).
  - Explains the recovery branch naming convention (`recovery/<prN>-<timestamp>`).
  - Notes the idempotency guarantee (existing open recovery PR → skip).
  - Notes the conflict-on-cherry-pick behavior (surface result; do not push
    partial state; human must resolve).

- [ ] `tools/bg/README.md` updated:
  - Add `missed-substrate-recovery.ts` row to the services table.
  - Update `missed-substrate-detector.ts` row: add `--auto-recover` and
    `--recovery-dry-run` to the flags column.

- [ ] B-0442 acceptance criterion updated: mark the slice 5 row as `[x]`:
  ```
  - [x] Optionally auto-opens recovery PR with the missing commits (gated by
        configuration) (slice 5 — landed 2026-05-14 via B-0503 + B-0504)
  ```

- [ ] B-0442 frontmatter updated: add `children: [B-0503, B-0504, B-0505]` field.

- [ ] All tests still pass (no code touched; verification only):
  `bun tools/bg/missed-substrate-detector.test.ts`
  `bun tools/bg/missed-substrate-recovery.test.ts`

## Why docs-only is a separate row

Per DV2.0 data-split discipline (`.claude/rules/dv2-data-split-discipline-activated.md`):
documentation changes (fast-changing English) and code changes (stable hub) have
different change rates. Separating them into atomic rows makes each diff reviewable
in isolation and avoids documentation becoming a tail on a code PR.

Separating also ensures that if B-0504 needs a revision cycle, the docs PR does not
block the CI loop — it simply needs to land after B-0504 is stable.

## Dependency chain

```
B-0442 (slices 1–4 + 6 shipped)
  └─ B-0503 (openRecoveryPR core)
       └─ B-0504 (wire into pollOnce — MUST LAND BEFORE THIS ROW)
            └─ B-0505 (THIS ROW — docs + acceptance close)
```

## Pre-start checklist (per backlog-item-start-gate)

- [ ] B-0504 must be merged before this row starts (depends_on B-0504)
- [ ] Verify `docs/AUTONOMOUS-LOOP.md` section exists for `missed-substrate-detector`
      (it does — landed 2026-05-13 per B-0442 slice 6 acceptance criterion)
- [ ] Verify `tools/bg/README.md` exists and has a services table
- [ ] Grep for existing `--auto-recover` mentions to avoid redundant text
