---
id: 081KRA5AR0008QG0R0029YWXYW
priority: P2
status: open
title: Author core CONTRIBUTOR-COMPLIANCE.md (public-company MNPI rule + framing examples + SEC lineage)
tier: factory-hygiene
effort: S
ask: Reusable substrate doc per 081KQ8P5D0008QG0R003ZF64GG
created: 2026-05-11
last_updated: 2026-05-14
parent: 081KQ8P5D0008QG0R003ZF64GG
depends_on: []
composes_with: [081KQ8P5D0008QG0R0002TN22C, 081KQ8P5D0008QG0R00353940P]
renumbered_from: 081KR2E4K0008QG0R000ARCH0X
renumbered_reason: "ID collision with 081KR2E4K0008QG0R000ARCH0X P1 (durable-computation checkpoint extension) which was filed 2 days earlier via PR #2269 (itself a prior collision-resolution sweep) and has external references in PR history (#2369 review doc) + memory file (feedback_shadow_lesson_log_otto_catches_2026_05_07.md). Per first-merged-wins + external-references rules, the P1 set keeps 081KR2E4K0008QG0R000ARCH0X-0373; this P2 contributor-compliance set renumbered to next-free 081KRA5AR0008QG0R0029YWXYW-0455 as a unit (preserves the internal depends_on chain). Substrate-cleanup tracked in 081KRFA460008QG0R00308W7FJ."
tags: [contributor-compliance, public-company, MNPI, 10b-5, renumbered]
decomposition: atomic
classification: buildable-now
---

# 081KRA5AR0008QG0R0029YWXYW — Core CONTRIBUTOR-COMPLIANCE.md authoring (renumbered from 081KR2E4K0008QG0R000ARCH0X)

## Scope (atomic slice)

- Create `docs/CONTRIBUTOR-COMPLIANCE.md` with:
  - Plain-language MNPI rule for public-company contributors.
  - Industry-general vs company-specific framing examples.
  - Public-source citation requirement.
  - Otto enforcement + contributor responsibilities.
  - External lineage (SEC Rule 10b-5, Reg FD, Sarbanes-Oxley).
- Cite the ServiceTitan origin memory file.
- No cross-refs or trajectories yet (those are sibling rows).

## Acceptance

- [ ] File exists at canonical path with all 5 content bullets from 081KQ8P5D0008QG0R003ZF64GG §1.
- [ ] Worked example cited.
- [ ] No legal-advice disclaimer missing.

## Why S-effort atomic

Single deliverable doc; no integration or cadence work. TS/audit later if needed.

## Pre-check

Build gate passed (0w 0e) in claim worktree. Refresh + prior-art confirmed no collision.
