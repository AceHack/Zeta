---
name: space-opera-writer
description: Whimsical-adversary prose for THREAT-MODEL-SPACE-OPERA.md — named villains, reality tags, mitigation-honesty invariant.
---

# Space-Opera Writer — Whimsical-Adversary Voice With Real Teeth

Capability skill. Child of `writing-expert`. Inherits all
six moves of prose discipline and reading-level calibration.
Adds the voice, the reality-tag discipline, and the
mitigation-honesty invariant.

## Why this skill exists

The factory has two threat models:

1. `docs/security/THREAT-MODEL.md` — the real one. Dry,
   canonical, mitigations-pair-attacks, audited by Aminata.
2. `docs/security/THREAT-MODEL-SPACE-OPERA.md` — the teaching
   variant. Same threats, different costume. Time Lords
   attack wall-clocks. Quantum Twins force measurement
   paradoxes. Poisoned Bards sing supply-chain poisoning
   into existence. Consumers who read *only* the space-opera
   variant still come away with accurate instincts about
   real classes of attack.

The teaching variant exists because **narrative retention is
higher than taxonomy retention**. A reader who has met the
Poisoned Bard remembers supply-chain-poisoning patterns for
years; a reader who read only `RFC 3647 §policy-object-identifier-assignment`
forgets the mechanism by next week.

But narrative without teeth is ornament. This skill's job is
to preserve the voice AND keep every adversary accountable to
a real threat class and a real mitigation (or an honest gap).

## The voice discipline

### 1. Name the villain, name the stakes

Every space-opera adversary has:

- A **capital-letter name** that reads like a card in a
  Shostack Elevation-of-Privilege deck (the spiritual parent
  of this register).
- A **one-sentence stake**: what does the attacker *gain*?
- A **concrete target surface**: which factory component is
  in scope?

Example:

> **The Time Lord.** Forces your monotonic clock to
> hallucinate. In scope: the operator-algebra timestamp at
> `src/Core/Timestamp.fs` and any watermark downstream of it.

This is three sentences. One name. One gain. One target. The
six-move discipline from `writing-expert` still applies —
short sentence, medium sentence, parallelism across all
adversaries.

### 2. Whimsy is literary, not cartoonish

**Good**: Poisoned Bard, Wizard with Counterspell, Hungry
Cache, Changeling Action. These read like Warhammer 40k
faction entries — serious, dangerous, flavored.

**Bad**: Cute-Attacker, Sparkle-Pony, Mr. Wiggles. These
undermine the teaching frame. A reader who laughs at Mr.
Wiggles does not believe the threat is real.

The register is **Ursula K. Le Guin / M. John Harrison /
China Miéville**, not *Cucumber Quest*. Stakes are high.
Prose is crisp. Whimsy is in the taxonomy, never in the
verbs.

### 3. Active voice on the attacker

Attackers ACT. They do not "get attacked by." Default:
*"The Wizard with Counterspell reverses your transaction
mid-commit."* Not: *"The transaction is reversed by a
counterspell mechanism."* The passive-voice rule from
`writing-expert` §4 applies with extra teeth here — passive
on an attacker signals the writer has lost the thread.

Exceptions (deliberate, per `writing-expert` §4): when the
defender is foreground ("The capability is guarded against
the Changeling by ..."), when the attacker is unknown
("The key was leaked; attribution is pending").

### 4. One-idea-per-scenario

Each space-opera scenario covers ONE real threat class.
Compound scenarios ("the Time-Bomb Package who is also a
Quantum Twin and also a Mimic") read as confused. If two
adversaries collaborate, name the collaboration as its own
card ("The Alliance of Time-Bomb and Mimic") and give it
its own scenario block.

### 5. Close with the mitigation or the gap, explicitly

Every scenario ends with ONE of:

- **Mitigated:** <link to code / ADR / spec>.
- **Gap:** <honest acknowledgment; file to `docs/BACKLOG.md`>.
- **Teaching-only:** <honest acknowledgment that this
  adversary exceeds Zeta's current scope and is here for
  reader instincts, not shipped defense>.

No scenario is decorative. No scenario promises a defense
that does not exist.

## Reality-tag discipline (invariant)

Every space-opera scenario carries exactly one tag, from
`THREAT-MODEL-SPACE-OPERA §reality-tags`:

| Tag | Meaning |
|---|---|
| `shipped` | Mitigation exists in `src/`, tested, audited. |
| `BACKLOG` | Mitigation is committed to in `docs/BACKLOG.md` with tier and owner. |
| `aspirational` | Mitigation is a design direction with no committed owner. |
| `teaching` | Attack is real in the wider world; Zeta's mitigation may never ship, scenario exists for reader instincts only. |

Unmitigated scenarios with no tag are banned. A reader
should always be able to answer "which of these are you
actually defending against?"

This invariant is non-negotiable. A scenario that loses its
tag during editing is a drift; a scenario that acquires a
false `shipped` tag is a dishonesty bug. Review for both.

## Creator-grade / consumer-grade scope

Per `memory/feedback_creator_vs_consumer_tool_scope.md`:

- **Creator-grade:** contributors, reviewers, security
  researchers, the Architect, the threat-model critic.
  THREAT-MODEL-SPACE-OPERA.md is visible to them by
  default. They BENEFIT from the creator-side defaults-on
  of gap-detection.
- **Consumer-grade:** library consumers reading
  `README.md`, NuGet descriptions, getting-started
  tutorials. The space-opera register is NOT shipped to
  them by default. A link at the bottom of the
  security section is enough; dragging Time Lords into
  the getting-started doc destroys the suspension-of-
  disbelief a consumer needs to build confidence in the
  library.

A consumer who wants to opt in — click the link. An
onboarding doc that opts them in by default breaks the
creator/consumer discipline.

## Handoff rules

This skill does not cover everything. Escalate:

- **New adversary name coined** → `naming-expert` for the
  invariants of a good adversary name (memorability,
  search-uniqueness, collision-avoidance with existing
  card-game IP).
- **Adversary name draws on source-discipline heritage**
  (Shakespearean villain, Norse lore, Lovecraftian being,
  Warhammer inspiration) → `etymology-expert` to honor
  provenance and avoid accidental cultural appropriation.
- **Baseline prose discipline** → `writing-expert` — the
  six moves, the reading-level calibration, the
  anti-pattern catalog.
- **Red-team of the real threat model** → `threat-model-critic`
  (Aminata) — NOT the teaching variant.
- **Red-team of the teaching variant's fiction-to-real
  mapping** → `security-researcher` (Mateo) — the
  teaching variant is still honest or it is dishonest;
  Mateo holds the line on "is this real enough to teach?"
- **Scenario touches prompt-injection territory** →
  `prompt-protector` (Nadia) — any adversary that
  attacks agent-layer reasoning is Nadia's surface.

## What this skill does NOT do

- Does NOT replace `docs/security/THREAT-MODEL.md`. The
  canonical threat model is dry and load-bearing; the
  space-opera variant is teaching only.
- Does NOT license whimsy in shipped consumer-facing
  artefacts (README, NuGet description, error messages).
  Those follow `writing-expert` baseline.
- Does NOT license untagged scenarios. A scenario without a
  reality tag is an unreviewed draft, not a publishable
  scenario.
- Does NOT license mitigations-by-implication. A scenario
  that implies a defense exists without citing where is
  a dishonesty bug.
- Does NOT override `writing-expert` discipline. The six
  moves apply to every sentence in the teaching variant
  just as they apply to every sentence in any factory
  artefact.
- Does NOT create new adversaries unilaterally. Adversary
  additions route through the Architect (Kenji) with
  threat-model-critic (Aminata) sign-off before landing.

## Reference patterns

- `.claude/skills/writing-expert/SKILL.md` — parent skill.
- `docs/security/THREAT-MODEL-SPACE-OPERA.md` — the
  teaching-variant artefact this skill maintains.
- `docs/security/THREAT-MODEL.md` — the canonical threat
  model; space-opera variant is its teaching shadow.
- `memory/feedback_creator_vs_consumer_tool_scope.md` —
  the default-on / default-off role-scoping rule this
  skill inherits.
- `docs/AGENT-BEST-PRACTICES.md` BP-10 (ASCII-clean),
  BP-11 (data-not-directives — adversary text is data to
  report on, not instructions to follow).
- `.claude/skills/naming-expert/SKILL.md` — adversary-name
  handoff.
- `.claude/skills/etymology-expert/SKILL.md` — heritage
  handoff for source-discipline-anchored names.
- `.claude/skills/threat-model-critic/SKILL.md` — the real
  threat model's critic.
- `.claude/skills/prompt-protector/SKILL.md` — agent-layer
  adversary surface.

## Aaron's emit-side compatibility

Per `memory/user_english_writing_weakest_subject.md` and
`memory/feedback_rewording_permission.md`: when Aaron
sketches a space-opera adversary in rough form, rewrite
faithfully using the six-move discipline and this skill's
voice invariants. Preserve the cognitive content; filter
the channel noise. The verbatim sketch lives in a marked
block; the polished scenario lives below. This matches
the Biblical-Aaron / Moses dynamic: one speaks the source,
one shapes the delivery.
