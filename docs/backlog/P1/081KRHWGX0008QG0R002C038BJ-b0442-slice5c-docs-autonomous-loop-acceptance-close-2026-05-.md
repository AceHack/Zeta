---
id: 081KRHWGX0008QG0R002C038BJ
priority: P1
status: closed
title: "081KRFA460008QG0R00061SXRW slice 5c — docs update (AUTONOMOUS-LOOP.md + bg/README.md) + 081KRFA460008QG0R00061SXRW acceptance close"
tier: factory-infrastructure
effort: XS
created: 2026-05-14
last_updated: 2026-05-15
closed: 2026-05-15
closed_by_pr: 3458
parent: 081KRFA460008QG0R00061SXRW
depends_on: [081KRHWGX0008QG0R000PVB6FF]
composes_with: [081KRFA460008QG0R00061SXRW, 081KRHWGX0008QG0R0027YXBTB, 081KRHWGX0008QG0R000PVB6FF]
tags: [documentation, background-service, drift-detection, recovery-pr]
type: chore
---

# 081KRFA460008QG0R00061SXRW slice 5c — docs update + acceptance criteria close

## Origin

081KRFA460008QG0R00061SXRW acceptance criterion (still open after 081KRHWGX0008QG0R0027YXBTB + 081KRHWGX0008QG0R000PVB6FF land):

> Optionally auto-opens recovery PR with the missing commits (gated by
> configuration) (slice 5 — pending; subscriber-agent layer)

Once 081KRHWGX0008QG0R0027YXBTB (core function) and 081KRHWGX0008QG0R000PVB6FF (wiring) land, the only remaining
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

- [ ] 081KRFA460008QG0R00061SXRW acceptance criterion updated: mark the slice 5 row as `[x]`:
  ```
  - [x] Optionally auto-opens recovery PR with the missing commits (gated by
        configuration) (slice 5 — landed 2026-05-14 via 081KRHWGX0008QG0R0027YXBTB + 081KRHWGX0008QG0R000PVB6FF)
  ```

- [ ] 081KRFA460008QG0R00061SXRW frontmatter updated: add `children: [081KRHWGX0008QG0R0027YXBTB, 081KRHWGX0008QG0R000PVB6FF, 081KRHWGX0008QG0R002C038BJ]` field.

- [ ] All tests still pass (no code touched; verification only):
  `bun tools/bg/missed-substrate-detector.test.ts`
  `bun tools/bg/missed-substrate-recovery.test.ts`

## Why docs-only is a separate row

Per DV2.0 data-split discipline (`.claude/rules/dv2-data-split-discipline-activated.md`):
documentation changes (fast-changing English) and code changes (stable hub) have
different change rates. Separating them into atomic rows makes each diff reviewable
in isolation and avoids documentation becoming a tail on a code PR.

Separating also ensures that if 081KRHWGX0008QG0R000PVB6FF needs a revision cycle, the docs PR does not
block the CI loop — it simply needs to land after 081KRHWGX0008QG0R000PVB6FF is stable.

## Dependency chain

```
081KRFA460008QG0R00061SXRW (slices 1–4 + 6 shipped)
  └─ 081KRHWGX0008QG0R0027YXBTB (openRecoveryPR core)
       └─ 081KRHWGX0008QG0R000PVB6FF (wire into pollOnce — MUST LAND BEFORE THIS ROW)
            └─ 081KRHWGX0008QG0R002C038BJ (THIS ROW — docs + acceptance close)
```

## Pre-start checklist (per backlog-item-start-gate)

- [ ] 081KRHWGX0008QG0R000PVB6FF must be merged before this row starts (depends_on 081KRHWGX0008QG0R000PVB6FF)
- [ ] Verify `docs/AUTONOMOUS-LOOP.md` section exists for `missed-substrate-detector`
      (it does — landed 2026-05-13 per 081KRFA460008QG0R00061SXRW slice 6 acceptance criterion)
- [ ] Verify `tools/bg/README.md` exists and has a services table
- [ ] Grep for existing `--auto-recover` mentions to avoid redundant text
