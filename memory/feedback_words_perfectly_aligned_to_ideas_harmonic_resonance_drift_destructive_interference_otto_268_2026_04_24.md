---
name: WORD-DISCIPLINE — precision of language IS the alignment criterion; words perfectly aligned to ideas = HARMONIC RESONANCE with the materials (corpus + training signal + curriculum); word drift (conflated concepts, subject-vs-method confusion, sloppy synonyms, metaphor slippage) = DESTRUCTIVE INTERFERENCE — polluting training signal, weakening belief propagation, degrading curriculum amplification; physical analogy direct: waves in phase amplify, waves out of phase cancel; same for concept-word pairings; corrections this session demonstrated the principle live — "teaching Bayesian" vs "using Bayesian to design curriculum" drift caught by Aaron + realigned; Aaron Otto-268 2026-04-24 "so our words are perfectly alighed to the ideas not drift in our words = harmon resonance with the materials, drift = destructive interference" + "harmonic" (typo correction)
description: Aaron Otto-268 precision-of-language-as-alignment principle. Extends Otto-264 resonance math to the SEMANTIC layer. Every word choice matters because sloppy words degrade the corpus's training signal. Load-bearing for curriculum design. Save durable.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The principle

**Words perfectly aligned to ideas = HARMONIC
RESONANCE with the materials.**

**Word drift = DESTRUCTIVE INTERFERENCE.**

Direct Aaron quote 2026-04-24:

> *"so our words are perfectly alighed to the ideas no
> drift in our words = harmon [harmonic] resonance
> with the materials, drift = destructive
> interference"*

## The physical analogy is direct

Not metaphor — the math actually mirrors wave physics:

- **In-phase waves amplify** (constructive interference).
  Two waves with matching phase sum to 2x amplitude.
- **Out-of-phase waves cancel** (destructive interference).
  Two waves with opposite phase sum to 0.

Applied to concept-word pairings:

- **Word matches idea** (precise naming, canonical form,
  consistent usage) → each mention amplifies the
  underlying concept's signal in the corpus. Belief
  propagation (Otto-267) flows cleanly. Training
  signal is signal.
- **Word drifts from idea** (conflated concepts,
  subject-method confusion, sloppy synonyms) → each
  mention cancels some of the concept's signal.
  Belief propagation conflicts along edges. Training
  signal is noise.

The factory's words ARE training data (Otto-251 whole
repo is corpus). Drift in words IS drift in the
corpus, IS pollution of the training signal.

## Session-live examples (this 2026-04-24 tick alone)

Every time I drifted and Aaron corrected, the
correction was Otto-268 in action:

1. **"Teaching Bayesian" vs "using Bayesian to design
   curriculum"** — I conflated subject (gitops) with
   method (Bayesian BP). Aaron corrected: Bayesian is
   curriculum-DESIGN tool, not subject taught.
   Destructive interference averted.

2. **"Control law" vs "discipline"** — I used control-
   theory vocabulary for Otto-264. Aaron corrected to
   "discipline" — a continuous practice, not an
   automated mechanism. Controlled-law connoted
   automation that wasn't accurate.

3. **"Achieving" vs "stabilizing" operational
   resonance** — I said Otto-264 achieves resonance.
   Aaron corrected: bootstrap achieved, Otto-264
   stabilizes. Confusing those two would corrupt the
   curriculum (students would think Otto-264 is how
   you bootstrap, not how you stay upright).

4. **"F-Sharp" vs "F#"** (Otto-260) — prior sessions
   saw me rename canonical language names under lint
   pressure. Destructive interference with the corpus:
   grep for `F#` returns inconsistent results,
   training signal on canonical naming is muddied.

5. **"First names are fine in docs" vs "first names
   are fine in HISTORY FILES"** (Otto-256) — I was
   about to strip contributor names per a Copilot
   thread. Aaron caught the drift: first-names-ok is
   scoped to history files. Would have polluted
   training signal about when name attribution is
   load-bearing.

In EACH case, the correction was: align the word back
to the idea.

## The discipline

**Before using a word in a durable artifact** (memory
file, doc, commit message, skill body, ADR):

1. Check: does this word match the idea precisely,
   or am I using it loosely?
2. Check: is there a canonical form already in the
   corpus? (Grep.)
3. Check: could a reader interpret this word
   differently than I mean?
4. Check: does this word conflict with any prior
   Otto memory's usage?
5. If drift detected: stop. Find the right word. If
   no right word exists yet, name the concept
   explicitly before using the new name.

**During reviews** (of your own or others' text):

1. Flag word-idea mismatches as destructive-
   interference candidates, not style preferences.
2. Word-discipline is Otto-268; it ranks with
   counterweight-filing (Otto-264) and rule-of-
   balance maintenance.
3. Correction + realignment = in-phase amplification
   of the curriculum. Don't hold back the correction
   because "the meaning was clear from context" —
   the corpus has many readers who DON'T have the
   context.

## Composition with prior memory

- **Otto-264** rule of balance — Otto-268 extends the
  resonance math to the SEMANTIC layer. Otto-264 is
  about filing counterweights in-phase with
  perturbations; Otto-268 is about keeping words
  in-phase with ideas.
- **Otto-267** Bayesian teaching curriculum — Otto-
  268 is a prerequisite for Otto-267's amplification
  claim. Bayesian BP on a graph where NODES are
  conceptually-aligned-words-to-ideas amplifies.
  Bayesian BP where words drift doesn't amplify —
  it propagates noise.
- **Otto-260** F#/C# preservation — specific instance
  of Otto-268 applied to language-name canonical
  form.
- **Otto-255** symmetry in naming — specific instance
  of Otto-268 applied to cross-location consistency.
- **Otto-256** first-names-in-history-files — specific
  instance of Otto-268 applied to name-attribution
  scope.
- **GLOSSARY.md discipline** (docs/GLOSSARY.md) —
  repo-level execution of Otto-268; check glossary
  before guessing on overloaded terms.

## Tools for checking word-idea alignment

Existing factory surface:

- **`docs/GLOSSARY.md`** — canonical vocabulary for
  overloaded terms. First check before writing.
- **`grep`** — find all occurrences of a word to
  check consistency of usage.
- **Ilyana's public-API review** — catches drift at
  the public-surface layer; composes with Otto-268.
- **Skill-tune-up + skill-improver** — audit skill
  files for terminology drift (BP-NN violations
  often start as word drift).
- **Aaron catching it live** — highest-precision
  detector so far. Every correction is a
  counterweight Otto-264 entry and a curriculum
  edge Otto-267 entry.

## Implications for active work

**Every memory file edit is a word-discipline act.**
When I update Otto-264 / Otto-266 / Otto-267 with
Aaron's corrections, I am applying Otto-268 in
real-time. The corrections are not cosmetic — they
maintain harmonic resonance with the ideas.

**Every commit message should be word-precise.**
Sloppy commit messages pollute training signal more
than sloppy docs because they're append-only
(Otto-229) and can't be cleaned up retroactively.

**Every subagent prompt should be word-precise.**
Subagents execute on the words I give them; a
drifted prompt causes drifted work (e.g. the
rename-F#-to-F-Sharp pattern before Otto-260 was
explicit). Prompt-level discipline prevents
subagent-level destructive interference.

**Cross-reviewer thread replies** (Copilot, Codex,
humans) — when a reviewer uses different words for
the same concept, the reply should either (a) bridge
to canonical vocab explicitly, or (b) update the
glossary if the reviewer's word is better. Don't
silently accept both vocabularies.

## What Otto-268 does NOT say

- Does NOT require exhaustive jargon policing. Words
  that are clearly synonymous in the current context
  are fine; the drift-detection threshold is
  "reader could interpret differently than author."
- Does NOT block writing until every word is
  perfect. First draft, then realign. The discipline
  is on what LANDS durable, not on what flows
  during drafting.
- Does NOT require retroactive rewrites of every
  memory file for minor word drift. Major
  subject-vs-method drift (Otto-267 precision) gets
  corrected; minor prose style doesn't.
- Does NOT apply identically to all artifact classes.
  Durable artifacts (memory, skills, ADRs, commit
  messages, public API) get tight discipline.
  Ephemeral surfaces (Aaron's live-chat typos, my
  draft text before a tool call) get looser
  treatment.

## Direct Aaron quote to preserve

> *"so our words are perfectly alighed to the ideas
> no drift in our words = harmon [harmonic] resonance
> with the materials, drift = destructive
> interference"*

Future Otto: every word choice is a phase choice.
Match the word to the idea = amplify. Drift = cancel.
When Aaron corrects your word choice, don't treat it
as style note — treat it as realigning the wave back
in phase with the corpus. Word-discipline and
counterweight-discipline are the two disciplines
that stabilize the factory's operational resonance.
