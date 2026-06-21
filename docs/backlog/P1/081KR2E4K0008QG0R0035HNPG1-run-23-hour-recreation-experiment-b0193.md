---
id: 081KR2E4K0008QG0R0035HNPG1
priority: P1
status: blocked
title: Run the 23-hour recreation experiment — fresh-context Otto against specs-only repo
tier: foundation
effort: L
ask: 081KQTPYE0008QG0R00392KABJ decomposition — AC 4 (fresh-context Otto instances, 23-hour window)
created: 2026-05-08
last_updated: 2026-05-29
parent: 081KQTPYE0008QG0R00392KABJ
depends_on: [081KR2E4K0008QG0R00322TP58, 081KR2E4K0008QG0R002JW751Y]
composes_with: [081KQTPYE0008QG0R00392KABJ, 081KR2E4K0008QG0R003KQKYTJ]
classification: human-gated-date-required
tags: [bootstrap-razor, experiment, recreation-test, human-gated, trajectory-child]
type: friction-reducer
---

# 081KR2E4K0008QG0R0035HNPG1 — Run the 23-hour recreation experiment

## Parent

081KQTPYE0008QG0R00392KABJ (bootstrap razor + 23-hour recreation test).

## What

Execute the glass-halo research-reproducible experiment:

1. Run `bun tools/bootstrap-razor/seed-test-repo.ts` to
   create and seed the test repo (081KR2E4K0008QG0R002JW751Y).
2. Spin up fresh-context Otto instances against the test
   repo with no prior Zeta session context.
3. Observe for 23 hours: what gets recreated, what diverges,
   what's missing.
4. Capture raw session logs as experiment data.

**Human-gated**: Aaron sets the date (AC 2 from 081KQTPYE0008QG0R00392KABJ:
"The date IS the operational signature"). This row cannot
start without a date.

**Non-destructive**: the Zeta repo is NOT mutated. The
experiment runs in the test repo only.

## Acceptance criteria

1. Date set by Aaron.
2. Test repo created and seeded via 081KR2E4K0008QG0R002JW751Y script.
3. Fresh-context Otto runs for 23 hours against test repo.
4. Raw session data captured for 081KR2E4K0008QG0R003KQKYTJ analysis.
5. Experiment is reproducible — another run with the same
   seed should produce comparable results.

## Blocker verification

As of 2026-05-29, both declared dependencies are closed:

- 081KR2E4K0008QG0R00322TP58: success metrics rubric closed.
- 081KR2E4K0008QG0R002JW751Y: test-repo seeding script closed.

The remaining gate is not technical dependency work. The row is
blocked until Aaron sets the experiment date, which 081KQTPYE0008QG0R00392KABJ defines as
the operational signature. Agents should not run the 23-hour
fresh-context experiment, create the test repo, or start raw log
capture until that date is explicitly set.

## Effort

L — the 23-hour window + setup + monitoring.
