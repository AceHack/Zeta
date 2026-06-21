---
id: 081KRQ1AB0008QG0R002J484S1
priority: P1
status: open
title: Class-level lesson encoded as a verify-before-state-claim audit (decomposed from 081KQGDBJ0008QG0R002S9SWH6)
created: 2026-05-16
last_updated: 2026-05-16
depends_on: [081KQGDBJ0008QG0R002S9SWH6]
type: friction-reducer
---

# 081KRQ1AB0008QG0R002J484S1 — Class-level lesson encoded as a verify-before-state-claim audit

**Decomposed from:** 081KQGDBJ0008QG0R002S9SWH6 (Step 6)

## What

Encode a class-level lesson as a verify-before-state-claim audit (composes with 081KQGDBJ0008QG0R002Y31XJ3's audit-suite).

When filing a backlog row for new formalization / engineering work, the system must grep the codebase for existing implementations BEFORE asserting "TRACTABLE START" or similar clean-start framing. This prevents lineage-discontinuity failure modes where prior work is forgotten and redone.

## Acceptance criteria

1. **Verify-before-state-claim audit script** added to the hygiene suite.
2. The script checks new backlog rows for clean-start framing ("TRACTABLE START", etc.) and enforces a mandatory repo-grep to verify no prior artifacts exist before allowing the row to pass hygiene.
