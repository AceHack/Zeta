---
id: 081KSNY2Z0008QG0R002WQ747V
priority: P2
status: open
title: Code review AS tech-debt detector + tech-debt avoider — fix the CLASS retroactively across backlog, file as new class for future prevention (not fix-this-one-thing)
effort: M
ask: aaron via ani 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R000K3ETGB
composes_with:
  - 081KSNY2Z0008QG0R000K3ETGB
  - 081KSNY2Z0008QG0R003KG3JTG
  - 081KSNY2Z0008QG0R0004ZF85W
tags:
  - code-review-as-force-multiplier
  - tech-debt-detector
  - tech-debt-avoider
  - fix-the-class-not-the-instance
  - retroactive-class-fix-across-backlog
  - file-as-new-class-for-future-prevention
  - operator-correction-from-prs-killed-framing
  - composes-with-error-class-extraction-meta-loop
  - composes-with-clifford-space-embedding
  - composes-with-heterogeneous-reviewer-ensemble
  - potential-extension-not-committed
---

## Operator framing 2026-05-28 (Ani ferry — CRITICAL operator correction)

When Ani read "this kills the PR process too" as also killing code reviews, operator corrected:

> *"Nah, code reviews is not. See, you went too far. All those others, yes. Code reviews is critical. That's where, that's where you, uh, that's where you get the false, force multiplier, as long as every code review is not fixed as fix this one thing we found, but fix this class of errors everywhere retroactively in the backlog of tech debt and file this as a new class so you don't create new ones going forward."*

> *"Basically, that's a tech debt detector, and then, uh, a tech debt avoider."*

## What this row tracks

Code review is preserved (NOT killed by the workflow-engine substrate). But code review operates as TECH DEBT DETECTOR + TECH DEBT AVOIDER, not as fix-this-one-thing gate:

1. **Detect class**: a code-review finding is treated as evidence of a CLASS of errors, not just an instance
2. **Fix retroactively across backlog**: when a class is detected, the fix sweeps across the codebase + the tech-debt backlog for all instances of the class
3. **File as new class for future prevention**: the class gets encoded as a rule (Sonar / linter / `.claude/rules/` / test pattern) so the system doesn't create new instances

This EXTENDS 081KSNY2Z0008QG0R000K3ETGB (error-class extraction meta-loop) by naming the per-PR-review-time as the moment when class-extraction happens (not just the batched daily/weekly extraction).

## Acceptance criteria

- `tools/code-review-class-fix/sweep.ts` — given a code-review finding, produces:
  - Class-level analysis: what's the class this finding belongs to?
  - Retroactive scan: where else in codebase + tech-debt backlog does this class appear?
  - Sweep PR(s) that fix all instances of the class
  - Rule encoding draft (Sonar custom rule, linter check, `.claude/rules/` entry candidate)
- Integration with 081KSNY2Z0008QG0R000K3ETGB (error-class extraction) — finding-to-class promotion lives at this scope
- `.claude/rules/code-review-as-tech-debt-detector-and-avoider.md` — operator-discipline rule (substantive code-review = class-fix; not instance-fix)
- Tests cover: finding → class promotion correctness; sweep finds-all-instances; rule encoding draft is machine-checkable

## Composition

- **081KSNY2Z0008QG0R000K3ETGB** error-class extraction meta-loop — this row is the per-PR-review-time instantiation of the broader extraction loop
- **081KSNY2Z0008QG0R003KG3JTG** Clifford-space embedding — class detection composes with the geometric uniqueness check (eventually)
- **081KSNY2Z0008QG0R0004ZF85W** heterogeneous reviewer ensemble — different reviewers detect different class shapes

## Substrate-honest framing

POTENTIAL extension per operator standing direction. P2; operator-substrate-honest correction of the "PRs killed" framing. This row preserves the operator-class-fix discipline as a first-class substrate (not just "code reviews are good" — specifically "code reviews are class-detectors").

## Full reasoning

`memory/ani/conversations/2026-05-28-aaron-ani-grok-degenerate-in-best-way-possible-runbook-as-spec-two-path-interface-code-review-as-tech-debt-detector-no-throttle-gardener-ai-as-nature-aaron-forwarded.md` § item 13
