---
id: 081KR2E4K0008QG0R001CCWHZ2
priority: P2
status: open
title: Memory trust-calculus calibration — measure cross-instance transmission fidelity
tier: research
effort: M
ask: 081KQR4HQ0008QG0R001909FPT Step 8 decomposition
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQR4HQ0008QG0R001909FPT
depends_on: [081KR2E4K0008QG0R002FRQZN4]
composes_with: [081KQR4HQ0008QG0R001909FPT, 081KR2E4K0008QG0R002FRQZN4]
tags: [memory, trust-calculus, measurement, research, trajectory-child]
type: research
---

# 081KR2E4K0008QG0R001CCWHZ2 — Memory trust-calculus calibration

## Parent

081KQR4HQ0008QG0R001909FPT Step 8 (memory trust-calculus calibration).

## What

The substrate-encoding-bypasses-trust-calculus claim (PR #1552)
needs operational measurement. Build a measurable signal for
cross-instance memory transmission fidelity:

1. **Test protocol** — a fresh agent instance loads CLAUDE.md +
   N random memory files; measure whether it can answer:
   - What is the carved sentence for file X?
   - What does file Y compose with?
   - What correction does feedback file Z encode?
2. **Baseline measurement** — run the protocol 5 times, record
   accuracy.
3. **Compare load-bearing vs decorative** — do load-bearing
   files (per 081KR2E4K0008QG0R002FRQZN4) transmit better than decorative ones?

## Why P2

Research-grade measurement. The factory operates without this;
the measurement informs future memory architecture decisions.

## Why depends on 081KR2E4K0008QG0R002FRQZN4

The load-bearing classification provides the comparison groups
for the measurement.

## Acceptance criteria

1. Test protocol documented in a `docs/research/` file.
2. At least one baseline measurement run completed.
3. Results reported with accuracy numbers.

## Prior art

- `memory/feedback_substrate_encoding_bypasses_trust_calculus_sleeping_bear_cross_instance_transmission_aaron_2026_05_04.md`
- PR #1552 — the originating claim.
