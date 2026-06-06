---
id: B-0341
zetaid: 081KR2E4K0008QG0R002PHZR58
priority: P1
status: closed
title: Minimal bootstrap seed manifest — exact file set for the recreation test repo
tier: foundation
effort: S
ask: B-0193 decomposition — AC 1 (test repo seeded with minimal substrate hypothesis)
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0193
depends_on: [B-0339, B-0340]
composes_with: [B-0193, B-0343]
tags: [bootstrap-razor, seed-manifest, minimal-substrate, trajectory-child]
type: friction-reducer
---

# B-0341 — Minimal bootstrap seed manifest

## Parent

B-0193 (bootstrap razor + 23-hour recreation test).

## What

Define the exact file set that seeds the test repo.
B-0193's experimental design names the hypothesis:

> Seed with ONLY `openspec/specs/**` + `docs/*.tla` +
> `proofs/lean/**` + the absolute-minimum bootstrap docs
> (CLAUDE.md / AGENTS.md / GOVERNANCE.md if needed — TBD;
> that itself is part of the experiment).

This row resolves the TBD. Informed by:

- **B-0339** (keep-vs-cut criteria) — what categories are
  exempt vs testable.
- **B-0340** (spec audit) — what specs actually exist and
  what gaps are known going in.

## Decisions to make

1. **Bootstrap docs inclusion**: does the test repo get
   CLAUDE.md / AGENTS.md / GOVERNANCE.md? If yes, that's
   bootstrap the experiment can't measure. If no, the
   fresh-context Otto must derive factory conventions from
   specs alone — a stronger test.
2. **Formal proof inclusion**: `proofs/lean/**` and
   `docs/*.tla` — include or derive?
3. **Directory structure**: does the test repo mirror
   Zeta's directory layout or start flat?

## Acceptance criteria

1. A `docs/bootstrap-razor/SEED-MANIFEST.md` file lists
   every included path glob with rationale (include/exclude
   + why).
2. The manifest is machine-readable enough for B-0343
   (seeding script) to consume.
3. The bootstrap-docs decision is documented with reasoning.

## Effort

S — design document, no code.
