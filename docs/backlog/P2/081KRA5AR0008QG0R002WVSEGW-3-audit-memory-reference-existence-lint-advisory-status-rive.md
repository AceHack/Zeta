---
id: 081KRA5AR0008QG0R002WVSEGW
priority: P2
status: open
title: Audit memory-reference-existence-lint.yml for advisory-vs-required parity (same class as 081KQ8P5D0008QG0R002FSTGXP)
tier: factory-tooling
effort: XS
ask: re-decomposition of 081KQ8P5D0008QG0R002FSTGXP (2026-05-11)
created: 2026-05-11
last_updated: 2026-05-11
parent: 081KQ8P5D0008QG0R002FSTGXP
depends_on: [081KQ8P5D0008QG0R002FSTGXP]
composes_with: [081KQ8P5D0008QG0R002FSTGXP]
tags: [riven-2026-05-11, sibling-audit, memory-index-integrity]
type: audit
---

# 081KRA5AR0008QG0R002WVSEGW — Sibling audit: memory-reference-existence-lint advisory status

## Why

081KQ8P5D0008QG0R002FSTGXP lists this as likely same shape. Isolate as atomic child so parallel loops can verify without blocking on the main decision.

## Acceptance

- [ ] Confirm job name in .github/workflows/memory-reference-existence-lint.yml
- [ ] Check presence in required_status_checks.contexts (or ruleset)
- [ ] If advisory, record the overstated claim (if any) and open follow-up for fix

## Dependency

Independent of 081KRA5AR0008QG0R000GZ8ECC/2 (child relationships described in prose); composes with root 081KQ8P5D0008QG0R002FSTGXP for full closure.

## Focused check

```bash
ls .github/workflows/memory-reference-existence-lint.yml && grep -E '^\s*(jobs:|name:)' .github/workflows/memory-reference-existence-lint.yml | head -10
```
Outcome in PR body. (explicit target file, not broad grep)
