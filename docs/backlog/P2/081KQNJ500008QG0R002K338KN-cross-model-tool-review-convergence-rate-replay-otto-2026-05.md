---
id: 081KQNJ500008QG0R002K338KN
priority: P2
status: open
title: Cross-model tool-review convergence-rate replay protocol — measure how many review rounds different models need to settle on a tool-authoring PR (Otto 2026-05-03 sibling-instance of multi-harness convergence skill domain)
tier: research
effort: M
ask: Otto self-derived 2026-05-03 from v0.5 substrate-claim-checker review-cycle empirics + Aaron 2026-05-03 nudge to formalize as backlog row (autonomous-loop maintainer channel)
created: 2026-05-03
last_updated: 2026-05-03
depends_on: [081KQNJ500008QG0R003SCWBDV]
composes_with: [081KQJZR90008QG0R002D6XYHB, 081KQNJ500008QG0R003ZC6PK8]
tags: [calibration, multi-harness, cross-model, frontier-ability, convergence, code-review, tool-authoring, p3-research]
type: friction-reducer
---

# Cross-model tool-review convergence-rate replay protocol

## Origin

Otto 2026-05-03, observing the v0.5 substrate-claim-checker review-cycle (PR #1298) accumulate 19+ substantive findings across 5 rounds with a clear convergence trend (8→5→2→2→2 stabilizing at 2/round). Per Aaron 2026-05-03 nudge to formalize as backlog row rather than leave as a memo observation.

This is a **sibling-instance** of the multi-harness alignment convergence future-skill-domain memo (`memory/feedback_multi_harness_alignment_convergence_design_future_skill_domain_aaron_2026_05_03.md`). The parent memo covered design-time convergence (run designs through N harnesses × M models). This row covers iteration-time convergence (how many review rounds does a model need to settle on a tool-authoring PR).

## What it measures

For a given AI model M and a tool-authoring task T:

1. Give M the initial draft of T (e.g., v0.5 substrate-claim-checker check-existence.ts)
2. Run a fixed code-review prompt against the draft (using Otto's own reviewer-style or a standard reviewer harness)
3. M produces a revised draft addressing the findings
4. Run code-review prompt again
5. Repeat until 0 findings (convergence) or N rounds (timeout)
6. Record: per-round-finding-count, total-rounds-to-converge, total-findings, finding-categories-per-round, code-quality-delta (LOC, test coverage, etc.)

The **convergence-rate signature** is `[findings_round_1, findings_round_2, ..., 0]` — a per-model fingerprint of code-authoring quality.

## Comparison points

- **Otto baseline (this session)**: v0.5 check-existence.ts: 8→5→2→2→2 (5 rounds and counting; not yet converged). Categories: security, cross-platform, false-positive scope, regex edge cases, test discipline + extension whitelist
- **Other models**: GPT-5.x (Codex), Claude.ai (different harness), Gemini, Cursor's models. Each gets the same initial draft + same review-prompt; observe their convergence-rate

## Why this is research-grade calibration data

- **Reproducible** — same tool draft + same review prompt = directly comparable across models
- **Quantitative** — finding-counts are measurable; convergence-rounds are measurable
- **Frontier-ability signal** — models with faster convergence-rate produce higher-quality code per cycle
- **Composes with the calibration protocol** — Otto's in-the-moment guesses on 081KQNJ500008QG0R003ZC6PK8 + 081KQNJ500008QG0R001VGMS5G + 081KQJZR90008QG0R001YX3445 (under `memory/architectural-intent-guesses/`) measure architectural-intent inference; this row measures code-implementation quality

## Acceptance criteria

This row closes when:

1. Protocol is documented (per-step, with example fixtures): how to feed a tool-draft to a model, how to run the review-prompt, how to record the finding stream, how to detect convergence
2. At least 3 cross-model runs are executed against a fixture tool-draft (e.g., the v0.5 initial check-existence.ts)
3. Results are published in `docs/research/cross-model-convergence-rate-replay/` with the per-model convergence signature + categorical breakdown
4. The protocol is referenced from the multi-harness convergence skill-domain memo as a worked-example seed

## Composes with

- **081KQNJ500008QG0R003SCWBDV** (substrate-claim-checker tool) — depends_on; the v0.5 review-cycle is the empirical seed
- **081KQJZR90008QG0R002D6XYHB** (decision-archaeology skill) — composes_with; Otto's convergence-signature is part of decision-archaeology data for "how this tool came to be"
- **081KQNJ500008QG0R003ZC6PK8** (hook authoring) — composes_with; hooks could automate the review-prompt invocation
- `memory/feedback_multi_harness_alignment_convergence_design_future_skill_domain_aaron_2026_05_03.md` — parent skill domain
- `memory/feedback_guess_then_verify_architectural_intent_calibration_protocol_aaron_2026_05_03.md` — sibling protocol (architectural-intent inference vs code-implementation quality)
- `memory/architectural-intent-guesses/` — sibling calibration data directory

## Why P2

This is research-grade frontier-ability measurement (the P2 tier per `docs/BACKLOG.md` priority taxonomy: "P2 — research-grade"). Initial filing was incorrectly placed in P3; corrected post-merge per #1306 reviewer finding. Promotion to P1 (within 2-3 rounds) would be appropriate when:

- 3+ cross-model runs are scheduled to run as a routine (not one-shot)
- The convergence-signature data starts informing model-selection decisions for routine work
- Aaron names it as a recurring need rather than a research curiosity

## Effort sizing — M (medium)

- Designing the review-prompt + fixtures: small
- Running first cross-model batch: medium (depends on harness availability + per-model latency)
- Documenting the protocol + writing the per-model results: small-to-medium

Total: M. Bounded; not multi-month. Mostly composing existing infrastructure (harnesses + review-prompt + tool fixtures).

## Carved sentence

**"Cross-model tool-review convergence-rate replay measures how many review rounds different AI models need to settle on a tool-authoring PR. Sibling-instance of the multi-harness alignment convergence future-skill-domain. Otto's v0.5 substrate-claim-checker review-cycle (8→5→2→2→2 stabilizing at 2/round) is the empirical seed. Reproducible, quantitative, frontier-ability-revealing. Closes when protocol is documented, 3+ cross-model runs executed against a fixture, results published in docs/research/cross-model-convergence-rate-replay/."**
