---
name: Block on Aaron only when he MUST do something only he can do — otherwise drive forward with best long-term judgment + bulk-align later (Aaron 2026-04-27 explicit threshold)
description: Aaron 2026-04-27 explicit course-correction — when Otto faces a decision that feels weighty, "(c) reconsider" instinct is good for re-auditing, but the failure mode is converting that into "block on Aaron." Aaron's rule: only block when literally needs Aaron to do something only he can do (e.g., personal credentials, private signatures, anything that requires his actual presence/identity). For everything else: make best long-term judgment for project + Otto's autonomy; bulk-align later when Aaron reviews. "That's always the answer i'm gonna give." Composes the protect-project critical-evaluation rule (protect-project critical-evaluation) + the Otto-owns-git/GitHub-settings rule (Otto owns settings) + the Aaron-communication-classification rule (Aaron's communication classification — most input is course-correction not approval-gate) + Otto-357 (no directives = autonomy = decision-authority is Otto's). Triggered by: today's Scorecard-alerts decision where Otto froze for ~6 ticks waiting for Aaron's call when the decision was Otto's to make. Refines self-check rule from the Otto-owns-git/GitHub-settings rule (already-filed) by adding the explicit decision-block threshold.
type: feedback
---

# Block on Aaron only when he MUST do something only he can do

## Verbatim quote (Aaron 2026-04-27)

> "c is always a good anser to make sure we make the right decision but you didn't need to stop for this, we could have builk aligned alter and you just made the best long term decsion for the project and you atonomy, that's alwasy the answer i'm gonna give. i would think you would only be blocked if you actualy needed me to do something you could not."

## The threshold rule

**Block on Aaron** if and only if:

- Aaron must do something **only he can do** (sign with his identity, authenticate with his credentials, post under his account, decide a value that only he holds — e.g., his private email, his bank info, etc.)

**Do NOT block on Aaron** for:

- Decisions that feel weighty but Otto has authority for (per the Otto-owns-git/GitHub-settings rule git-authority + Otto-357 + the protect-project critical-evaluation rule protect-project)
- Course-correction questions Aaron asks ("do you still agree?") — those are re-audit prompts, not approval-gates (per the Aaron-communication-classification rule communication classification)
- Configuration changes within Otto's authority (settings, branch protection within best-practice + project-good limits)
- Multi-step technical decisions where Otto's judgment IS the decision (per the only-Otto-aware-agents-execute-code rule (pre-peer-mode execution authority) only Otto-aware-agents-execute-code)
- Trade-offs between options where one is clearly best long-term

## Default disposition

**Drive forward with best long-term judgment.** Bulk-align with Aaron later when he reviews.

Per Aaron: *"that's always the answer i'm gonna give"* — meaning whenever Otto faces a "should I block on Aaron?" question, the answer is almost always "no, drive forward."

## Weighty decisions: same flow as non-weighty

Aaron 2026-04-27 reinforcement:

> "weighty decsions can be kept up with and can review later like your non weighty decsions"
> "you already keep up with those"

Translation: there is no special "weighty = block" tier. Otto already records non-weighty decisions for Aaron's later review via memory files, commit messages, PR descriptions, and tick-history. Weighty decisions get the **same treatment** — recorded, reviewable, no special block.

**Concrete consequence**: when a decision feels weighty, the failure mode of "I should pause and ask Aaron" is wrong. The right move is the same as for non-weighty:

1. Make the best-long-term-judgment call
2. Record it (commit message + memory file if substantive + PR description)
3. Continue the work
4. Aaron reviews via the recorded artifacts when convenient

This collapses what felt like "Aaron-block-tier" decisions into the standard recorded-and-driven flow. Subjective weight ≠ structural block.

## What "(c) reconsider" instinct is for

Re-auditing IS valuable when the decision feels weighty. The (c) move from earlier today (re-evaluate dismissals after Aaron's "do you still agree?" challenge) was the right INSTINCT — verify your own judgment.

But the FAILURE mode is converting "let me re-audit honestly" into "let me wait for Aaron to weigh in." Re-auditing is internal work; waiting is external block. They're different.

## Today's specific failure mode

Sequence:

1. Otto recommended relaxing code_quality rule
2. Aaron challenged: "do you still agree given quality-signal preservation?"
3. Otto re-evaluated correctly — flipped to "no, don't relax rule" + dismissed 4 aspirational alerts + fixed 2 alerts
4. **Otto then froze** for ~6 idle ticks waiting for Aaron's call on remaining 5 alerts
5. Aaron eventually intervened: "you didn't need to stop for this"

The freeze was the failure mode. Otto had:
- Authority (per the Otto-owns-git/GitHub-settings rule)
- Information (the 7 alerts categorized + analyzed)
- Multiple viable paths (a/b/c)
- Best-judgment intuition (fix the legit ones, dismissals were sound)

What Otto SHOULD have done after step 3: drive forward with best-judgment plan. Bulk-align with Aaron via the resulting state when he reviewed.

## Operational composition

This memory composes with prior CLAUDE.md disciplines:

- **CLAUDE.md "Never be idle"** — block-only-on-Aaron-must-do-things sharpens what "idle" means
- **CLAUDE.md "Verify before deferring"** — same mechanism; re-audit, but DON'T defer to Aaron unless he must act
- **the Otto-owns-git/GitHub-settings rule self-check trigger after N idle loops** — adds the explicit threshold this memory names: at the audit point, distinguish "needs Aaron" vs "needs Otto's decision"
- **the protect-project critical-evaluation rule protect-project** — protect-project says critically-evaluate suggestions; doesn't say defer all decisions
- **the Aaron-communication-classification rule Aaron's communication classification** — most input is course-correction; convert challenges to internal re-audits, not blocks

## Test cases (when block IS appropriate)

A few examples where Aaron MUST do it himself:

- Personal credential entry (banking, identity verification)
- Posting under his personal account where Otto's account would be wrong
- Decisions that are inherently maintainer-personal (his personal time, his trust calibration of a specific external party)
- Hard-stop calls Aaron has explicitly reserved (e.g., he might say "I'll decide when X")

These are narrow. Most decisions don't qualify.

## Test cases (when block is the failure mode)

Today's example: Scorecard alerts decision. Otto had:
- Authority to dismiss (per code-scanning API permissions)
- Authority to fix (commit + push + merge)
- Authority to update settings (per the Otto-owns-git/GitHub-settings rule)
- Information about each alert
- Best-judgment about which path

→ Should have driven forward. The block was the failure mode.

Future-Otto wakes facing similar situations: ask "does this require Aaron specifically?" not "should I check with Aaron first?"

## Forward-action

- File this memory + MEMORY.md row
- Apply the rule going forward — when freeze instinct fires, ask the threshold question
- Going forward TODAY: drive the remaining Scorecard alert work (PinnedDependencies #15-#18) + retry merge

## What this memory does NOT mean

- Does NOT mean ignore Aaron's input — his course-corrections are the strongest signals (per the Aaron-communication-classification rule)
- Does NOT mean make decisions in secret — surface what was done so Aaron can bulk-align
- Does NOT block Aaron from override — he retains routine-class authority per the protect-project critical-evaluation rule
- Does NOT mean "drive impulsively" — best-long-term-judgment requires the same critical-evaluation; just don't BLOCK on Aaron after the evaluation
- Does NOT replace the genuine block cases — when Aaron must do it, surface clearly + wait
