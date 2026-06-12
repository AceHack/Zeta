---
id: B-0088.3
zetaid: 081KRA5AR0008QG0R002WVSEGW
priority: P2
status: open
title: Audit memory-reference-existence-lint.yml for advisory-vs-required parity (same class as B-0088)
tier: factory-tooling
effort: XS
ask: re-decomposition of B-0088 (2026-05-11)
created: 2026-05-11
last_updated: 2026-05-11
parent: B-0088
depends_on: [B-0088]
composes_with: [B-0088]
tags: [riven-2026-05-11, sibling-audit, memory-index-integrity]
type: audit
---

# B-0088.3 — Sibling audit: memory-reference-existence-lint advisory status

## Why

B-0088 lists this as likely same shape. Isolate as atomic child so parallel loops can verify without blocking on the main decision.

## Acceptance

- [ ] Confirm job name in .github/workflows/memory-reference-existence-lint.yml
- [ ] Check presence in required_status_checks.contexts (or ruleset)
- [ ] If advisory, record the overstated claim (if any) and open follow-up for fix

## Dependency

Independent of B-0088.1/2 (child relationships described in prose); composes with root B-0088 for full closure.

## Focused check

```bash
ls .github/workflows/memory-reference-existence-lint.yml && grep -E '^\s*(jobs:|name:)' .github/workflows/memory-reference-existence-lint.yml | head -10
```
Outcome in PR body. (explicit target file, not broad grep)
