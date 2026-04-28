---
name: Gap-in-gap-analysis audit — look for unexpected gap classes and codify them so the factory looks for that class going forward
description: 2026-04-20 late; Aaron explicit refinement to the never-idle policy. When doing speculative work, a preferred mode is gap-of-gaps auditing — looking for gap classes the existing gap-analysis surfaces don't cover. When an unexpected gap class is discovered, codify it (add to ranker criteria, new audit skill, etc.) so the factory looks for it from that point on. Self-extending gap-discovery repertoire.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Gap-of-gaps audit

## Rule

When speculative work is genuinely needed (never-idle step
2 returned "no structural fix"), one of the highest-value
modes is **auditing the factory's gap-analysis surfaces for
gaps**. That is: look for *unexpected gap classes* that the
current set of audits / rankers / living-lists does not
cover. When found:

1. **Codify the class.** Add the new criterion to the
   most-appropriate existing ranker (e.g. extend
   `skill-tune-up`'s ranking criteria list), OR author a new
   audit-surface skill if no existing skill fits.
2. **Close the specific instance** in the same tick if
   reasonable, so the discovery ships with a worked example.
3. **Log the meta-win** if the codification is the structural
   fix (depth ≥ 2 likely, because the codification itself
   predicts future coverage).

The factory's gap-discovery repertoire **must self-extend**.
Unexpected gaps *will* happen — the only question is whether
the next one of the same class gets caught.

## Aaron's verbatim statement (2026-04-20 late)

> "I would also say when you finally do decide to do
> speculative work becasue there was no way to imporove the
> factory where the speculatire work was needed the first
> things i would go is any of the gap analysis and fix thoe
> or even better just look for generaing impovments to our
> factory, another meta kind of things you could do is look
> for gaps in gap analyss to see if there any unexpected
> gaps we have not covered and get that gap cleanup just a
> naturel flow of the software factory, gaps are gooing to
> happen so we just need to make sure we are looking for
> gaps we didn't pre think of, unexpect gaps that we
> discover, we make sure that class of gap is looked for
> from that point on."

Key substrings:

- *"look for gaps in gap analyss"* — the meta-audit itself.
- *"gaps we didn't pre think of, unexpect gaps"* — the
  *class* of gap the factory isn't yet looking for.
- *"we make sure that class of gap is looked for from that
  point on"* — the codification obligation. One-time
  discovery is not enough; the class must enter the repertoire.
- *"naturel flow of the software factory"* — framing: this
  is part of the factory's normal self-maintenance, not an
  exceptional event.

## Speculative-work priority ordering (Aaron's "first things
I would go")

Explicit from the same statement:

1. **Known-gap fixes** — any open item from an existing
   gap-analysis surface.
2. **Generative factory improvements** — structural
   additions ("just look for generaing impovments to our
   factory"). Note: Aaron ranked this *equal or better*
   than (1) — "or even better." Generative > reactive.
3. **Gap-of-gaps audit** — "another meta kind of things
   you could do." The audit-the-audits layer.
4. Classic cadence-obligation fallback (tune-up etc.) if
   none of (1-3) produces work.

The priority is not strict — Aaron's framing is soft. But
the *ordering* of recommendations is clear: fix > generate >
meta-audit > routine.

## Current factory gap-analysis surfaces (audit baseline)

This list lets me recognise what is *already* covered so I
can look for what is *not*. Drift-prone; refresh when
skill-tune-up reports new audit surfaces.

- `skill-tune-up` — skills by tune-up urgency
  (drift / contradiction / staleness / user-pain / bloat /
  best-practice-drift / portability-drift).
- `verification-drift-auditor` — proof artefacts vs
  source papers.
- `ontology-home` — concepts in `docs/GLOSSARY.md`.
- BP living-lists — per-tech best-practices scratchpad +
  stable BP-NN rules.
- `docs/TECH-RADAR.md` — Trial-tier graduation watch.
- `docs/BACKLOG.md` — P0/P1/P2/P3 sweep.
- `skill-gap-finder` — absent skills that should exist.
- Persona-notebook hygiene (oversize / prune-due).
- Harsh-critic / spec-zealot / threat-model-critic /
  public-api-designer findings — per-round queues.
- Upstream-PR watchlist.
- Matrix-mode skill-group coverage for adopted
  technologies.
- Matrix-mode skill-group coverage for adopted
  *strategies* (post-Event-Storming generalisation).

## Example gap classes the baseline might miss (seed list)

These are the kinds of things a gap-of-gaps audit would
look for. Not exhaustive; the point is the shape of the
questions.

- **Cross-reference integrity** — do all `docs/*.md`
  internal links resolve? Any stable BP-NN citations
  pointing at retired rules?
- **Failure-mode drill coverage** — is there a drill for
  every class of production failure we claim to handle
  (incident-response, cron-durability, agent-halt,
  compaction-mid-write)?
- **Orphan artefact detection** — files no skill or
  doc references (e.g. stale scratchpads, dangling
  research reports).
- **Consent-primitive enforcement** — every claimed
  consent-primitive instance has a corresponding audit?
- **Dual-register coverage** — every technical spec has
  its alignment / consent framing (per the sacred-tier
  memories)?
- **Reversibility coverage** — every reversible operation
  has its retraction verb documented?
- **Persona coverage** — is every named role in
  `docs/EXPERT-REGISTRY.md` actually invokable, or are
  some ghost personas?
- **Strategy coverage** — every named strategy
  (Event Storming, Wardley mapping, ...) has its
  Matrix-mode skill-group?
- **Test-naming drift** — are test names still accurate
  descriptors of what they check?
- **Frontmatter / body divergence** — every skill's
  frontmatter description still matches what the body
  actually does (BP-08 already exists; gap is whether
  we're *checking*)?
- **Meta-win rate** — is the meta-wins log producing
  rows, or has meta-check stopped firing (per
  `feedback_meta_wins_tracked_separately.md` cadence
  note)?

These are seeds. Real gap-of-gaps audits will produce
classes nobody wrote down.

## How to codify a newly discovered gap class

When a gap class surfaces that the baseline doesn't
cover:

1. **Pick the home.** Usually the nearest existing ranker
   skill (e.g. add to `skill-tune-up`'s ranking criteria)
   if the class is judgement-heavy. Author a new
   audit-surface skill if the class is mechanical and
   repeatable (e.g. cross-reference-integrity).
2. **Update the skill.** Via `skill-creator` workflow
   per GOVERNANCE.md §4. Add the criterion with a one-
   line rationale and an example.
3. **Run once immediately.** The codification ships
   with its first application — the unexpected gap that
   triggered the codification is closed in the same tick
   (or logged to BACKLOG if close-in-tick is not
   reasonable).
4. **Log to `docs/skill-edit-justification-log.md`** per
   `feedback_skill_edits_justification_log_and_tune_up_cadence.md`.
5. **Log to `docs/research/meta-wins-log.md`** if the
   codification was the structural fix from a never-idle
   meta-check firing. Depth ≥ 2 is the common outcome
   because codification *itself* predicts future
   coverage.

## Why:

- **Gaps are inevitable.** Aaron: *"gaps are gooing to
  happen."* Factory cannot pre-think every class of gap
  at design time. The honest engineering position is
  to build gap-discovery that *adapts*.
- **One-time fixes are first-aid; codification is the
  cure.** This is the same principle as never-idle
  step 2 (structural > speculative), applied at the
  audit-repertoire level.
- **Avoids gap-analysis calcification.** Without this
  rule, the factory's audit surfaces become a
  fixed checklist — which is exactly the shape a
  production system hardens into when it stops
  improving. The rule keeps the repertoire alive.
- **Compound-meta payoff.** A gap-of-gaps audit that
  finds a new class *and* codifies it is a depth-2
  meta-win by construction. Multiple classes found in
  one tick is depth-3. The meta-wins log will see
  this.

## Cadence

- No fixed cadence — the audit is a *mode*, not a ritual.
- Fire whenever (1) never-idle meta-check returned
  "no structural fix" AND (2) known-gap and generative
  options are exhausted for the moment AND (3) the
  tick has time for a proper audit (not a 60-second
  fragment).
- Lower-bound expectation: at least once every 10
  rounds the factory should produce *some* new gap-
  class codification. Zero for 10+ rounds is either
  "the factory is genuinely mature" (unlikely pre-v1)
  or "the meta-audit stopped firing" (regression).

## Interaction with other rules

- `feedback_never_idle_speculative_work_over_waiting.md`
  — parent policy. This memory is the speculative-work
  *priority ordering* extension.
- `feedback_new_tech_triggers_skill_gap_closure.md`
  (Matrix-mode) — tech-coverage gap is one class of
  gap-class; strategy-coverage is another
  (post-Event-Storming).
- `feedback_meta_wins_tracked_separately.md` — most
  codifications from this rule are meta-wins and
  should be logged.
- `feedback_skill_edits_justification_log_and_tune_up_cadence.md`
  — the edit-log is where the mechanical record lands.
- `feedback_tech_best_practices_living_list_and_canonical_use_auditing.md`
  — living-lists are one of the audit surfaces
  most likely to have hidden gap classes (new
  anti-patterns, new best practices).

## Status as of 2026-04-20 late

- Policy durable.
- Seed list of candidate gap classes above — first
  gap-of-gaps audit pass can triage them.
- First meta-win candidate from this rule: the Event
  Storming research just filed
  (`docs/research/event-storming-evaluation.md`) surfaced
  that **strategy-coverage is a gap class the current
  Matrix-mode tech-coverage audit does not check** —
  codification is the depth-2 fix.
