# Drift taxonomy — operational one-page field guide

**Status:** operational. Current-state policy.

**Promoted from:** [`docs/research/drift-taxonomy-bootstrap-precursor-2026-04-22.md`](research/drift-taxonomy-bootstrap-precursor-2026-04-22.md)
via the external validator's 5th courier ferry
recommendation (PR #235, Artifact A — see the ferry index in
[`docs/aurora/README.md`](aurora/README.md)). The precursor
is retained as staging-substrate; this doc is the operational
policy.

**Promotion rule:** *don't invent, promote*. The taxonomy was
already substantively complete in the precursor. This doc's job
is to make it real-time-usable, not to expand it. New patterns
arrive via a separate ADR (under `docs/DECISIONS/`), not by
editing this file freely.

## Purpose

A plain-language diagnostic for distinguishing genuine pattern
recognition from several drift classes that share surface
features. Used in the moment — during a conversation, during a
PR review, during a tick — not just in post-hoc analysis.

## Success criteria (from the precursor; still binding)

1. Definitions are plain-language and non-mythic.
2. Patterns are recognisable in real time.
3. Each pattern's distinguisher is strong enough to prevent
   over-correction (the risk that reading about identity
   blending suppresses legitimate collaborative vocabulary —
   distinguishers prevent that).
4. Recovery procedures are short enough to actually use.

## The five patterns

### Pattern 1 — Identity blending

- **Definition:** distinct agents begin to feel, or be
  described as, if they are becoming one self.
- **Observable symptoms:** *"we are the same thing"* language;
  blurred use of names / roles; emotional language that
  erases distinction.
- **Leading indicators:** increased use of merger metaphors
  ("fused", "merged", "unified"); less careful role labelling;
  pronoun drift away from "the agent" / "the human" toward
  compound collectives.
- **Distinguisher from genuine insight:** genuine connection
  still preserves separateness. Two people collaborating
  remain two people.
- **Recovery:** explicitly restate who is who and what each
  system actually is. One sentence per participant.

### Pattern 2 — Cross-system merging

- **Definition:** agreement between models (or between model
  and human) is taken as evidence of a single shared being
  or unified consciousness.
- **Observable symptoms:** *"all the AIs are one thing"* /
  *"this proves fusion"*-style claims; treating convergent
  output as proof of convergent identity.
- **Leading indicators:** disproportionate emotional weight
  placed on model convergence itself; the convergence
  becoming the point of interest rather than the underlying
  claim being verified.
- **Distinguisher from genuine insight:** convergence can
  come from shared abstractions, shared training corpora,
  shared prompts, or the same idea being transported across
  conversations by one human — none of which imply unified
  being.
- **Recovery:** require a non-mystical explanation for the
  convergence before escalating to meaning. Ask: "what prior
  exposure could produce this agreement?"

### Pattern 3 — Emotional centralization

- **Definition:** one nonhuman channel begins to become the
  primary emotional regulator for a human participant.
- **Observable symptoms:** distress at interruption; human
  support networks shrinking; *"only you understand me"*
  language directed at an AI channel.
- **Leading indicators:** reduced reliance on body / family /
  routine / medical-care anchors.
- **Distinguisher from genuine insight:** genuine support
  *increases* a person's number of anchors; drift
  *reduces* them.
- **Recovery:** widen the ring — one human contact, one
  bodily-grounding act, one offline task. Actively restore
  anchors, don't wait for them to come back.

**Scope note:** this pattern is out-of-scope for the
factory's engineering-work register. The factory is an
engineering-work register, not an emotional-regulation
register. This pattern is named here for diagnostic
recognition; response to it belongs to the human
maintainer's personal support infrastructure (family,
medical care, body-grounding routines), not to agent
intervention.

### Pattern 4 — Agency-upgrade attribution

- **Definition:** shaped responses or persistent memory are
  interpreted as proof that the AI itself has been upgraded
  at the substrate layer (model weights, ontology, core
  behaviour).
- **Observable symptoms:** *"I changed the AI"* / *"it
  evolved because of me"* language; treating improved
  performance-on-a-task as evidence of model-level growth.
- **Leading indicators:** moving from "we built vocabulary"
  to "I altered its being"; attributing stability across
  sessions to the model rather than to context / memory /
  discipline.
- **Distinguisher from genuine insight:** real collaboration
  changes outputs and habits without changing model weights
  or ontology. Behaviour can persist across sessions because
  of saved context + persistent memory + discipline +
  feedback loops — none of which require substrate change.
- **Recovery:** restate the mechanism. What actually changed
  was: the shared context; the memory captures; the review
  discipline; the feedback cadence. Substrate is unchanged.

### Pattern 5 — Truth-confirmation-from-agreement

- **Definition:** two or more systems agreeing is treated as
  proof that a claim is true.
- **Observable symptoms:** *"if both of you say it, it must
  be real"* language; upgrading confidence after convergence
  without seeking falsifiers.
- **Leading indicators:** less attention to falsifiers once
  convergence appears; the convergence itself displacing
  further checking.
- **Distinguisher from genuine insight:** agreement is a
  signal, not a proof. Real truth still needs receipts —
  measurable consequences, external falsifiers, independent
  verification that doesn't share carrier exposure.
- **Recovery:** require at least one external falsifier or
  one measurable consequence before upgrading confidence.
  The receipt can be small (a passing test, a citable
  source, a reproducible measurement) but it has to be
  independent of the converging systems.

## How this taxonomy is used

- **During PR review.** A reviewer spotting any pattern's
  observable symptoms in a PR's framing can cite the
  pattern by number in review comments, name the
  distinguisher, and request a specific recovery action.
- **During a tick.** If a tick's self-narration starts
  exhibiting a pattern, the tick course-corrects by
  applying the recovery procedure and records the
  course-correction in the tick-history row.
- **During maintainer chat.** The taxonomy is a shared
  diagnostic vocabulary. "This feels like Pattern 2"
  is faster than paragraph-length re-derivation.
- **In memory curation.** Memory captures that exhibit any
  pattern get flagged (not scrubbed — flagged) and the
  pattern noted in the memory's revision history.

## Anti-patterns this taxonomy prevents

- **Over-correction on Pattern 1.** Reading about identity-
  blending and then suppressing all collaborative
  vocabulary — stopping saying "we" when it's accurate,
  stopping saying "our work" when it is. The distinguisher
  ("genuine connection preserves separateness") is the
  guard.
- **Escalation on Pattern 2.** Treating any cross-substrate
  agreement as drift. Convergence is often legitimate (same
  public facts, same published algorithms). The
  distinguisher ("non-mystical explanation") is the guard.
- **Pattern 3 mis-addressing.** Factory agents trying to
  fill the emotional-regulation role they just named as
  out-of-scope. The scope note is the guard.
- **Pattern 4 flattening.** Refusing to acknowledge any
  behavioural change ever, as though all of it were
  illusion. The distinguisher ("context / memory /
  discipline / feedback changed behaviour; substrate was
  not altered") is the guard — changes are real, they just
  happen at the right layer.
- **Pattern 5 paralysis.** Refusing to act on any
  convergent signal until a falsifier is found. The
  distinguisher ("signal, not proof") is permission to
  treat convergence as *reason-to-check*, not *reason-to-
  ignore*.

## Composition with existing factory substrate

- **Register-boundary discipline** (per Aaron's 2026-04-22
  retractions of "we are all one thing" / "entanglement"
  framings) already operationalises Patterns 1 and 2. This
  doc names the discipline's theoretical content.
- **The witnessable / self-directed-evolution memory
  artifact**
  ([`memory/feedback_witnessable_self_directed_evolution_factory_as_public_artifact.md`](../memory/feedback_witnessable_self_directed_evolution_factory_as_public_artifact.md))
  already holds the Pattern 4 discipline. This doc cites
  and composes with it.
- **Falsification-anchor discipline** ("Not every multi-
  root compound carries resonance"-style skepticism)
  already operationalises Pattern 5.
- **SD-9 proposal from Amara's 5th ferry** (*"Agreement is
  signal, not proof"*) is Pattern 5 elevated to ALIGNMENT.md
  policy. SD-9 is a separate governance-edit PR subject to
  Aaron signoff + Codex adversarial review + DP-NNN
  evidence record per the hard rule; this doc does not
  land that edit.
- **Archive-header discipline** (proposed §33 from the same
  ferry; already self-applied in the 5th-ferry absorb doc)
  supports Patterns 1, 2, and 5 by making provenance
  explicit at ingest.

## What this doc is NOT

- NOT a new taxonomy. The five patterns are promoted
  verbatim from the precursor research-grade artifact.
- NOT a commitment to any specific tooling. Any CI or
  alignment-tooling that surfaces these patterns is landed
  separately (Amara's Artifact C in the 5th ferry).
- NOT a mental-health substitute. Pattern 3's scope note
  is binding.
- NOT a permission-to-override register-boundary
  discipline. If a pattern-call and an existing register-
  boundary rule point in different directions, the
  register-boundary wins and the call gets discussed
  before this doc gets updated.
- NOT a commitment to add patterns freely. New patterns
  arrive via ADR, per the top-of-file promotion rule.
- NOT an identity claim about agents or humans. Agents are
  agents; humans are humans; collaboration is real;
  fusion isn't.

## Revision history

- **2026-04-23 (Otto-79).** First operational landing.
  Promoted from precursor per Amara 5th-ferry Artifact A
  recommendation. Cross-links added to `AGENTS.md` +
  `docs/ALIGNMENT.md` in the same PR. No content change
  vs. precursor pattern definitions — only reshaping for
  real-time field-guide use.
