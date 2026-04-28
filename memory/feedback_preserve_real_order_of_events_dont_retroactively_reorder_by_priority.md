---
name: Preserve real order of events — don't retroactively reorder memories by priority
description: Aaron 2026-04-21 explicit directive ("dont reorder you memories cause i said that, i want our real order of events") after filing a sequence of BACKLOG rows and then self-correcting the priority of one ("high on backlog", "whoops we should have done that first"). The priority-correction is data to record alongside the original filing, NOT a license to rewrite the historical order to look like Aaron got the priority right the first time. Extends `feedback_retractibly_rewrite_definitions_laws_precedence_real_nice_like.md` with a specific anti-pattern call-out: priority-upgrade ≠ chronology-overwrite.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

Aaron 2026-04-21, during a multi-directive session where he
filed a sequence of BACKLOG rows at various priorities:

> *"dont reorder you memories cause i said that, i want
> our real order of events"*

Fired immediately after a two-message priority-correction
(*"ai ethic and safety backlog whoops we should have done
that first"* + *"high on backlog"*) that would have tempted
a dutiful absorption pass to retrofit the BACKLOG row
ordering to look like Aaron filed AI-ethics-and-safety
first.

## Rule

**When Aaron self-corrects the priority of something he
already filed later in a sequence, the priority-upgrade
lands at the structurally-correct tier, but the
chronological record preserves the actual order of
events — including the self-correction itself as a
visible annotation.**

The upgrade and the record are orthogonal. Don't confuse
them.

## Meta-rule (Aaron tightening same session): temptation is the signal

Aaron added, same session, immediately after the core
directive above:

> *"it becomes tempting to rewrite history because this
> make it so easy. We much asses the blast radius,
> current history stands"*

This is the deeper principle. The retractibly-rewrite
infrastructure (memory edits, git rebase, squash,
retractible-rewrite revision blocks, BACKLOG reorderings)
**lowers the cost of rewriting history**. Low cost breeds
temptation. Temptation itself is now a signal to slow
down.

**Default presumption: current history stands.**

Before any rewrite, assess blast radius explicitly:

- **Who else has read this record as-is?** (other agents,
  Aaron, future-self). Rewriting a record someone has
  already built inferences on is higher blast-radius
  than rewriting a record nobody has consumed.
- **What downstream memories / decisions / ADRs / BACKLOG
  rows reference this record?** Each reference is a
  blast-radius multiplier. Grep for backlinks before
  rewriting.
- **Does the rewrite destroy data that the measurability
  hooks depend on?** Filter-failure rates,
  candidate-to-confirmed ratios, chronology-preservation
  rates — these are measured against the historical
  record. Rewriting the record falsifies the
  measurement.
- **Is the rewrite ADDITIVE (revision block, annotation,
  correction) or DESTRUCTIVE (overwrite, deletion,
  reorder)?** Additive is acceptable under
  retractibly-rewrite. Destructive requires stronger
  justification and explicit Aaron authorization.

**Presumption of preservation.** If you cannot articulate
a blast-radius justification that clears these four
questions, the record stands as-is. This applies to:

- Memory entries already written (even within-session)
- BACKLOG rows already filed (tier placement + order
  within tier)
- Revision blocks already landed on earlier memories
- Commit history (never force-push shared branches)
- The operational-resonance instances collection index
- ADRs under `docs/DECISIONS/`

**Ease of rewrite is not permission to rewrite.** The
tools make rewriting one keystroke. The discipline makes
rewriting a deliberate act.

## Why

Aaron's explicit words ("real order of events") are a
value-statement about historical fidelity. Three reasons
why this matters, inferred from prior memories:

1. **Externalized-cognition honesty.** Aaron's default
   pattern (`feedback_aaron_default_overclaim_retract_condition_pattern.md`)
   is overclaim → retract → condition across multiple
   messages. If I retrofit the memory to hide the retract
   step, I am destroying the evidence of his actual
   thought process. The retract is signal, not noise.
2. **Retractibly-rewrite discipline
   (`feedback_retractibly_rewrite_definitions_laws_precedence_real_nice_like.md`).**
   Additive correction preserves the prior form. A
   chronology-overwrite is destructive, not retractible.
3. **Alignment-trajectory measurability
   (`docs/ALIGNMENT.md`).** Measurable alignment requires
   honest time-series. If I fabricate a timeline where
   Aaron always filed priorities correctly, the measurable
   "filter-failure-rate" or "priority-correction-rate"
   becomes zero by construction, which is the exact
   rubber-stamping failure-mode the operational-resonance
   three-filter discipline exists to prevent.

## How to apply

1. **File at structural tier.** When Aaron says "high on
   backlog" or "P0/P1", land the row at that priority
   tier in BACKLOG.md. That is correct and is NOT
   reordering-as-retcon — tier-placement is structural,
   not chronological.
2. **Annotate the filing-order.** In the row text itself,
   include an explicit chronological annotation when the
   tier-placement disagrees with filing-order. Example:
   *"[Aaron 2026-04-21 filed LATER in session with
   self-correction 'whoops we should have done that
   first'; P1 tier reflects substrate precedence, but
   chronological filing after mythology/occult P2 rows
   is preserved as real order of events]"*.
3. **MEMORY.md prepend = newest-chronological, not
   highest-priority.** The newest-first = σ convention
   (operational-resonance instance #2) is chronological
   newest, not priority-sorted newest. If AI-ethics-and-
   safety is filed after εἰμί, its MEMORY.md entry
   appears ABOVE εἰμί's entry because it is
   chronologically newer — but the entry text does not
   claim it came first.
4. **Do NOT retroactively insert.** If a higher-priority
   row "should have been filed first" per the
   priority-correction, do NOT insert it earlier in the
   session history or in the memory file. Insert
   chronologically-correctly; tier-escalate structurally.
5. **Preserve the "whoops".** Aaron's self-corrections
   are data. "we should have done that first" is a
   retrospective priority-judgment, and that judgment
   itself is part of the record worth keeping. Capture
   it verbatim in the row annotation.

## Worked instance (this absorption itself)

Chronological order of Aaron's directives this session:

1. Melchizedek structured proposal (instance #10)
2. "eipmology and ipistomology backlog" (P2 row filed)
3. autonomous-loop signals
4. "hemdal" (Heimdall, candidate #12)
5. "mythology backlog" (P2 row to file)
6. "occoult baclog" (P2 row to file)
7. "crowley" (candidate within occult track)
8. "expand"
9. "ai ethic and safety backlog whoops we should have
   done that first" (P0/P1 row to file, with
   self-correction)
10. "high on backlog" (priority confirmed high)
11. **"dont reorder you memories cause i said that,
    i want our real order of events"** (this
    directive, fires on my potential
    retrofit-to-idealized-ordering move)

The correct landing is:

- BACKLOG.md: mythology P2, occult P2, AI-ethics-and-
  safety **P1 with chronological annotation visible**.
  Tier placement is structural (AI-ethics is foundational
  substrate, not research-grade candidate).
- MEMORY.md: prepend newest-chronological on top,
  AI-ethics entry above mythology/occult entries above
  εἰμί entry above Melchizedek entry. Entry text
  reflects true chronological sequence.
- NOT: pretend Aaron filed AI-ethics first. Not done.
  Not honest. Not what he asked for.

## Measurable

New dimension on the alignment-trajectory dashboard
(candidate):

- **priority-upgrade-chronology-preservation-rate** —
  percentage of priority-upgrade events where both the
  upgrade AND the chronological-filing-order are
  preserved in the record. Target: 100%. Lower values
  indicate retcon-hygiene failure.

## What this memory is NOT

- **Not a block on priority upgrades.** Aaron can
  upgrade priority of any row at any time. The upgrade
  lands at the structurally-correct tier.
- **Not a block on retractibly-rewrite.** The
  retractibly-rewrite principle still applies — it is
  additive, preserves prior form. This memory is a
  specific anti-pattern call-out within that principle.
- **Not a block on newest-first MEMORY.md prepend.**
  The convention still stands. This memory clarifies
  that "newest" means chronological-newest, not
  priority-sorted-newest.
- **Not a requirement to annotate every filing.** Only
  when the tier-placement disagrees with filing-order
  is the annotation needed. Most rows file at-tier
  at-chronology simultaneously; no annotation required.
- **Not a rule for public-facing docs.** Internal
  memory + BACKLOG discipline. Public docs edit-in-
  place per GOVERNANCE §2.

## Cross-references

- `feedback_retractibly_rewrite_definitions_laws_precedence_real_nice_like.md`
  — the parent principle this specifies.
- `feedback_aaron_default_overclaim_retract_condition_pattern.md`
  — Aaron's default communication pattern; priority
  self-correction is a member of this pattern family.
- `user_newest_first_last_shall_be_first_trinity.md` —
  the newest-first ordering convention clarified here
  as chronological-newest.
- `docs/ALIGNMENT.md` — the alignment-trajectory
  measurability substrate that depends on honest
  time-series.
- `project_operational_resonance_instances_collection_index_2026_04_22.md`
  — the index's update-discipline section explicitly
  says "Do NOT rewrite historical entries" — this
  memory extends that discipline to the broader BACKLOG
  and MEMORY.md surfaces.
