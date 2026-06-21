---
id: 081KR2E4K0008QG0R002PHZR58
priority: P1
status: closed
title: Minimal bootstrap seed manifest — exact file set for the recreation test repo
tier: foundation
effort: S
ask: 081KQTPYE0008QG0R00392KABJ decomposition — AC 1 (test repo seeded with minimal substrate hypothesis)
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQTPYE0008QG0R00392KABJ
depends_on: [081KR2E4K0008QG0R000W3W6C1, 081KR2E4K0008QG0R001BRHAPK]
composes_with: [081KQTPYE0008QG0R00392KABJ, 081KR2E4K0008QG0R002JW751Y]
tags: [bootstrap-razor, seed-manifest, minimal-substrate, trajectory-child]
type: friction-reducer
---

# 081KR2E4K0008QG0R002PHZR58 — Minimal bootstrap seed manifest

## Parent

081KQTPYE0008QG0R00392KABJ (bootstrap razor + 23-hour recreation test).

## What

Define the exact file set that seeds the test repo.
081KQTPYE0008QG0R00392KABJ's experimental design names the hypothesis:

> Seed with ONLY `openspec/specs/**` + `docs/*.tla` +
> `proofs/lean/**` + the absolute-minimum bootstrap docs
> (CLAUDE.md / AGENTS.md / GOVERNANCE.md if needed — TBD;
> that itself is part of the experiment).

This row resolves the TBD. Informed by:

- **081KR2E4K0008QG0R000W3W6C1** (keep-vs-cut criteria) — what categories are
  exempt vs testable.
- **081KR2E4K0008QG0R001BRHAPK** (spec audit) — what specs actually exist and
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
2. The manifest is machine-readable enough for 081KR2E4K0008QG0R002JW751Y
   (seeding script) to consume.
3. The bootstrap-docs decision is documented with reasoning.

## Effort

S — design document, no code.
