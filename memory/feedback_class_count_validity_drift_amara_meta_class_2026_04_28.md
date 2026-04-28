---
name: Class-Count Validity Drift — meta-class for confusing activity with correctness (Amara naming, Aaron triggered, 2026-04-28)
description: Amara 2026-04-28T20:34Z named the failure mode after Otto's prior insight had drifted toward halo-effect ("class-naming is a recognized ferry-input genre... reusable contract"). Aaron's terse challenge interrupted the drift before it compounded. Class definition — a review loop starts treating the count of named classes/updates/artifacts as evidence the classification protocol is correct, rather than requiring each class to earn reuse through falsifier-preserving application. Confirmation-bias / halo-effect failure mode applied to one's own substrate work.
type: feedback
---

# Class-Count Validity Drift

## Class name (Amara 2026-04-28T20:34Z)

**Class-Count Validity Drift** — Amara formalized the
meta-class after observing my prior tick-close insight
("Class-naming is now a recognized ferry-input genre... a
reusable contract") drifting toward "we named five classes,
therefore the genre works."

Aaron's terse challenge ("she is 100% right here" + "tiny
blade") earlier in the arc interrupted that drift before it
compounded.

## Definition (Amara verbatim)

> A review loop starts treating the number of named classes,
> updates, or artifacts as evidence that the classification
> protocol is correct, rather than requiring each class to
> earn reuse through falsifier-preserving application.

## What this meta-class catches

The protocol's own SD-9 failure mode applied recursively:

- Count of classes named ≠ correctness of the protocol.
- Count of substrate updates ≠ value of the substrate.
- Count of activity ≠ epistemic warrant.

The factory's own success-narrative is itself subject to
halo-effect / confirmation-bias. Watching for "we did a lot
of X, therefore X is good" drift is the SD-9 self-application.

## External lineage (Amara cited)

- **Confirmation bias in software testing** — testers tend
  to produce more confirmatory than disconfirmatory test
  cases (empirical IS literature). Mapping: every class
  named is a "passing test" of the protocol; passing tests
  don't validate the protocol unless failure cases also
  exist.
- **Popper's falsification** — universal claims cannot be
  verified by accumulating confirming examples; they
  become serious only when we specify what would count
  against them. Mapping: "the genre works" is a universal
  claim about the protocol; activity counts confirm but
  don't falsify.

## Concrete incident (Otto 2026-04-28T20:30Z)

My prior tick-close insight read:

> *"Class-naming is now a recognized ferry-input genre with
> its own predictable shape... Four classes named in this
> arc alone. The pattern itself documented in CURRENT-amara
> §12 turns the genre into a reusable contract..."*

This drifted toward Class-Count Validity Drift:

- **"recognized ferry-input genre"** — claims established
  status before falsifier-preserving repeated application
  proves it.
- **"four classes named in this arc alone"** — count as
  evidence.
- **"reusable contract"** — strong claim that requires
  validation across multiple users + multiple substrate
  contexts, not just same-arc same-pair.

Aaron's tiny-blade challenge ("she is 100% right here" on
Amara's earlier SD-9 caveat) interrupted the drift in the
class-encoding step that followed, before the halo-effect
compounded into the meta-class memory itself.

## The control (Amara prescribed)

Every promoted class needs ALL FIVE before it earns reuse:

1. **Local worked example** — concrete incident (timestamp,
   file, observed behavior).
2. **Mechanism or detector** — explanation of WHY the class
   behaves as named, or detector that recognizes the class
   in future occurrences.
3. **Control / repair path** — what to do when the class
   fires (concrete steps, not "be more careful").
4. **Scope boundary** — where the class applies vs doesn't.
   Local-factory-hygiene scope is fine; non-local scope
   needs additional evidence per SD-9.
5. **Falsifier or retirement condition** — what observation
   would disconfirm the class OR retire it as obsolete.
   For local classes: usually implicit ("we'd stop using
   the rule"). For non-local: must be explicit.

If any of the five is missing, the class is **activity, not
correctness**.

## Tiny-blade applied to my own framing

Amara's caveat on word choice:

> *"I'd replace 'Aaron's terse reinforcement' with 'Aaron's
> terse check' or 'Aaron's terse challenge' unless the
> actual message was reinforcing the guardrail.
> 'Reinforcement' can sound like praise; the important
> function was interrupting drift."*

Captured: the word **"reinforcement"** in my prior text was
itself a small halo-effect failure (framing Aaron's
challenge as praise of the prior insight rather than
correction of it). The replacement word **"challenge"**
preserves the function (interrupting drift) without the
halo-effect framing.

## How to apply this meta-class to ongoing work

When closing a tick / completing an arc:

1. **Audit the success-narrative.** Is the close
   reporting count of activities, or correctness of
   outcomes?
2. **Ask: which class earned reuse via the 5-step control,
   and which is still pending validation?**
3. **Distinguish proof-like signal from activity:**
   - **Activity signal**: "we named X classes", "we
     shipped Y PRs", "we updated Z files".
   - **Proof-like signal**: "named class X predicted /
     prevented / repaired a future incident."
4. **Don't bundle activity counts as evidence.** Per
   Amara: "five named classes... and one advisory-vs-
   required hygiene gap are useful activity, but not
   correctness evidence by themselves."

## Generalizes beyond class-naming

The same meta-class applies to any factory protocol that
produces artifacts:

- **Memory-file count** ≠ memory-substrate quality
  (per the existing MEMORY.md compression discipline).
- **Backlog row count** ≠ factory hygiene quality.
- **Merged PR count** ≠ progress velocity.
- **Skill count** ≠ skill-library coherence.

Each protocol's success narrative needs the 5-step control
(worked example / mechanism / control / scope / falsifier)
applied at the protocol level, not just at instance level.

## Composes with

- `memory/feedback_class_naming_ferry_protocol_with_sd9_guardrail_amara_2026_04_28.md`
  — sibling meta-class; this meta-class is SD-9 applied
  to the protocol itself; that one is SD-9 applied to
  individual class endorsements.
- `memory/feedback_speculation_leads_investigation_not_defines_root_cause_aaron_2026_04_28.md`
  — same family: confirmation-bias / halo-effect /
  premature-conclusion. Speculation needs evidence;
  class count needs falsifier.
- `memory/feedback_aaron_terse_directives_high_leverage_do_not_underweight.md`
  — Aaron's tiny-blade challenges have outsized leverage
  precisely because they interrupt drift. Don't reframe
  as "reinforcement"; the function is interruption.

## What this is NOT

- **NOT a directive to stop class-naming.** Class-naming is
  high-value when each class earns reuse. The discipline is
  validation per class, not abolition of the protocol.
- **NOT a license for "no class is good enough."** Local
  factory-hygiene classes pass the 5-step control quickly;
  the bar isn't impossible.
- **NOT specific to Amara reviews.** Same drift happens
  with any review loop where activity is visible and
  validation is invisible.

## Pickup notes for future-Otto

When tempted to write "we did N successful X this arc" as
a tick close:

1. Stop.
2. List which X earned the 5-step control per class /
   per artifact.
3. Distinguish "X happened" from "X validated".
4. Report validation status, not activity count.

When Amara forwards a review of a tick-close insight:

1. Read for halo-effect markers in the prior insight
   (count language, "recognized" / "established" /
   "reusable contract" / "predictable shape" etc).
2. If the markers are present, the review is likely
   catching Class-Count Validity Drift.
3. Encode the correction with the SD-9-compliant
   structure (worked example + mechanism + control +
   scope + falsifier).

When Aaron sends a terse challenge:

1. The function is interrupting drift, not reinforcing
   the prior framing.
2. Word choice matters: "challenge" / "check" preserve
   function; "reinforcement" / "endorsement" smuggle
   halo-effect.
