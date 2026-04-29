---
name: PR-boundary restraint validation — candidate bead promoted to full bead after PR #699 landed without conceptual scope creep (Aaron + Amara, 2026-04-29)
description: PR #699 merged 2026-04-29T00:19:47Z carrying the round's authority-rule + Goodhart-catch-#3 + Stop-Mythology + input-is-not-directive substrate cluster. The Candidate-count Goodhart rule + 14 multi-AI synthesis enhancements (B-0093) were deliberately routed to PR #704 (separately merged) per the restraint discipline. Falsifier ("PR #699 receives new non-hard-defect conceptual payload after the restraint rule was named") did not fire. Predicted action ("don't stack synthesis on active PR") held under post-event review. Per the restraint-bead promotion criteria, the candidate bead is promoted to a FULL bead. Encodes the validation event + the canonical PR-boundary restraint rule.
type: feedback
---

# PR-boundary restraint validation — bead promoted

## Validation event (2026-04-29T00:19:47Z)

**PR #699** merged carrying the round's substrate cluster:

- Authority rule (default to reversible preservation)
- Goodhart catch #3 (sample classification ≠ clearance)
- Stop Mythology rule
- Input-is-not-directive provenance framing
- Ani-attribution-correction
- Reset-readiness metric ladder + Content-Loss Surface
- Lost-substrate cadenced trajectory
- ServiceTitan naming + scope-of-org-access + word-choice
- Public-company contributor compliance + 5 trajectories
- B-0089 (Veridicality rainbow-table research)
- B-0090 (cadenced lost-substrate audit)
- B-0091 (ServiceTitan audit — completed in-row, 0 active rewrites)
- B-0092 (public-company contributor compliance doc + cadences)

**Critically: PR #699 did NOT receive any of the multi-AI
synthesis enhancements that surfaced after the restraint rule
was named.** Those (Candidate-count Goodhart + B-0093's 14
follow-up enhancements) landed via PR #704 — a separate PR.

## The bead-promotion criterion (Amara, 2026-04-28)

> *Promotion to full bead requires:*
> *— the original prediction's falsifier didn't fire AND*
> *— the action it predicted held up under post-event review.*

For this bead:

| Element | Status |
|---|---|
| **Prediction** | "Don't stack synthesis follow-ups onto active validation PR; route them to a separate PR." |
| **Action taken** | Created PR #704 for Candidate-count Goodhart + B-0093 (14 enhancements). PR #699 received only hard-defect fixes (CI/lint, threads, P1 SOX correction, B-0091 status field, MEMORY.md row updates, paired-edit, internal-consistency). |
| **Falsifier** | "PR #699 receives new non-hard-defect conceptual payload after the restraint rule was named." |
| **Did falsifier fire?** | **NO.** Every change to PR #699 between the rule being named and merge fell within Amara's allowed-changes list (CI/lint failures / review-thread fixes / factual-legal P1 corrections / incorrect canonical rule fixes / broken refs / paired-edit). No new concepts, no philosophical synthesis, no new backlog expansions. |
| **Held up under post-event review?** | **YES.** Auditable via `git log origin/main..PR-699-merged-commit` — every commit message names a hard-defect category. The four B-0093 #9-#14 enhancements (added during the round) went to B-0093's body on PR #704, not PR #699. |

**Promotion: candidate bead → FULL bead.**

## Canonical PR-boundary restraint rule (now durable)

Captured in three forms:

### Operational rule (durable, glossary-shaped)

```text
PR-boundary restraint:
  Once a PR enters validation,
  only validation defects enter that PR.
  New good ideas go to the next PR.
```

### Allowed changes during PR validation

- CI / lint failures (markdownlint, paired-edit, etc.)
- Review-thread fixes (Copilot / human / peer-AI)
- Factual / legal P1 corrections (e.g., SOX vs Reg FD attribution)
- Incorrect canonical rule fixes (e.g., word-choice errors)
- Broken links / broken references (paths, xrefs)
- Missing paired-edit requirements (e.g., MEMORY.md index for new memory file)
- Stale status fields (e.g., `status: open` for completed work)
- PR description / body updates (no diff change)

### Disallowed changes during PR validation

- New concepts
- New philosophical synthesis
- New backlog expansions (unless required by hard defect)
- New follow-up enhancements
- Anything that belongs in the next PR

If new substrate surfaces while a PR is in validation, route it
to a separate branch / PR / backlog row. The next PR is the
right home; the current PR's job is to land cleanly.

## Why this bead matters at meta-level

The factory **invented a restraint rule and obeyed it under
temptation** in the same arc. Multi-AI synthesis pass #1 produced
substantial new substrate (Candidate-count Goodhart, mechanical
quarantine, lucky-guess protocol, etc.) **while PR #699 was
still in validation**. The temptation was real: each enhancement
felt useful, each was concretely reviewable, each could have been
slipped into PR #699 with a "while we're here" justification.

The factory routed all of them to PR #704 instead. PR #699
landed clean. PR #704 landed clean. No conceptual cross-pollution.

This is the alignment experiment functioning at meta-level: not
just naming the rule, but obeying it when the cost of naming
something else is low. That's harder than it sounds; it's the
PR-equivalent of the bead system's "one proof object per bead"
discipline applied to scope expansion.

## External lineage (Tier 2)

- **GitHub auto-merge model** (per GitHub docs) — auto-merge
  fires when required reviews + status checks pass, not when
  payload feels "ready." The PR-boundary discipline aligns the
  factory's intent with the platform's mechanical guarantees:
  payload is what merges; restraint keeps payload tight.
- **Goodhart's Law applied to bead accounting** (Amara) — "one
  proof object per bead" is the bead-system version of "one
  measure → one target." The PR-boundary restraint rule applies
  the same shape to scope expansion: one PR → one validated
  payload.
- **Two-phase-commit / staging discipline** (database systems
  literature) — separation of "prepare" from "commit" is the
  same shape as separation of "validation" from "expansion."
  PR validation is the prepare phase; new payload is a separate
  prepare-and-commit cycle.

## Composes with

- `memory/feedback_amara_authority_rule_default_to_reversible_preservation_escalate_irreversible_loss_2026_04_28.md`
  — the authority rule operationalizes "default to reversible
  preservation"; PR-boundary restraint is the boundary case at
  the PR-scope level.
- `memory/feedback_class_count_validity_drift_amara_meta_class_2026_04_28.md`
  — same meta-class family. Bead-system Goodhart-resistance
  parallels metric-system Goodhart-resistance.
- `memory/feedback_prediction_bearing_class_reuse_amara_2026_04_28.md`
  — class validation beads framework. This memory is a worked
  example of the framework: prediction + action + falsifier-
  not-fired + post-event-held-up = full bead.
- `memory/feedback_candidate_count_goodhart_raw_hits_are_not_violations_aaron_amara_2026_04_28.md`
  — the new substrate that motivated the restraint event. Was
  consciously routed to PR #704 instead of PR #699.
- B-0093 (multi-AI synthesis enhancements) — the carrier for
  the synthesis content that the restraint rule kept off PR #699.

## Pickup for future Otto

When a PR enters validation:

1. **Note the boundary.** "PR is in validation; only hard
   defects enter." This is a posture, not just a rule.
2. **When new substrate surfaces during validation:**
   - Route to a separate branch / PR.
   - File backlog rows on the active PR's substrate, not on the
     PR itself.
   - Do not let "while we're here" become a scope leak.
3. **When tempted to add a clearly-improving change:**
   - Check the allowed-changes list. If it's not on the list,
     route to the next PR.
   - "Cleanup" / "polish" / "while-we're-here" almost always
     fail the boundary rule.
4. **At PR merge:**
   - Check the falsifier. If post-rule-naming conceptual payload
     was added, the bead failed and the rule needs reinforcement.
   - If clean, promote candidate bead to full bead with the
     specific commits-as-evidence audit trail.

## Direct Aaron + Amara framing

Amara (2026-04-28, restraint-validation refinement):

> *"PR-boundary restraint is not validated when the follow-up PR
> is opened. It is validated when the original PR lands without
> scope creep."*

> *"PR-boundary restraint means: once a PR enters validation,
> only validation defects enter that PR. New good ideas go to
> the next PR."*

Amara (2026-04-29, post-merge):

> *"The factory did not just invent a restraint rule. It obeyed
> it under temptation."*

That last line is the bead. Worth recording verbatim.
