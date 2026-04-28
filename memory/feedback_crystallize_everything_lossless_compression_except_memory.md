---
name: Crystallize everything — lossless compression, less is more (memory files exempt)
description: Factory-wide default — prose/docs/skills/specs crystallize toward minimum-size-preserving-meaning; memory files exempt (preserve-original-and-every-transformation wins). Aaron 2026-04-22 verbatim directive.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Crystallize everything — lossless compression, less is more

Aaron verbatim, 2026-04-22, mid-flow while I was executing
crystallization turn 2 on `docs/VISION.md`:

> *"we should crystalize everything really it's like lossles
> compression really less is more, except for the momory files"*

Follow-up 2026-04-22 same day — metaphor-extension after I
acknowledged the policy:

> *"i guess we are making a diamon now :)"*

**Diamond = the noun for the output of crystallization.** The
factory's committed artifacts (docs/specs/skills after
crystallization has been applied) are *diamonds*: hardest-
natural-material (durable), lossless-clarity (compression-
preserving), refraction-from-every-angle (same meaning from
every reader's vantage). The metaphor chain so far:
**blade → crystallize (verb) → diamond (noun-of-output) →
materia (FF7 skill-frame)**. Blade is the weapon we're
forging; crystallize is the operation; diamond is what
each committed artifact becomes; materia is the skill
library the diamonds feed.

## What this means

The **crystallize** verb — originally scoped to the
`crystallize-vision` skill's VISION.md operation — is **not
VISION-specific**. It is a **factory-wide compression
operation** that applies to every prose/doc/skill/spec
artifact the factory produces. The operation is:

1. Take the artifact in its current form.
2. Identify residual verbosity, redundant phrasing,
   repetition across sections, prose that restates what
   neighboring prose already said.
3. Rewrite such that **every surviving word carries load**.
4. **Preserve meaning exactly.** This is "lossless
   compression" in Aaron's frame — the signal is the same;
   only the bits drop.
5. Verify by re-reading: can the crystallized form be
   un-read back to the same understanding the verbose form
   conveyed? If yes, the compression was lossless. If no,
   the compression dropped signal — undo and redo.

## Why: less is more

Aaron's frame is compression-theoretic:

- **Verbose prose is high-entropy for the reader** —
  finding the signal costs attention.
- **Crystallized prose is low-entropy at read-time,
  high-density at the word-level** — every word earns its
  space.
- **The factory's output catalog is an index into meaning**,
  not a document archive. Smaller indexes with the same
  meaning are strictly better for every downstream
  consumer (agents who re-read at wake, humans who
  audit, future contributors who onboard).

This matches existing factory policy that crystallization
itself measures convergence by **output-size shrinkage over
turns** (`docs/research/crystallization-ledger.md`): if the
residue shrinks, the loop is converging. Scaling that
principle outward — "everything shrinks over time toward
the minimum-size-preserving-meaning form" — is what Aaron
just landed.

## Exception: memory files

Verbatim: **"except for the momory files"**.

Memory files are **not artifacts to be crystallized**.
They are the factory's **primary data substrate** and are
governed by the existing
`memory/feedback_preserve_original_and_every_transformation.md`
policy — Aaron's voice is preserved **verbatim**, and every
transformation an agent performs on a memory leaves both the
original quote and the transformed paraphrase in place.

Concretely:

- **Do NOT crystallize**: content inside `memory/*.md` body
  text when it quotes Aaron, summarizes Aaron's reasoning,
  or preserves agent-authored reasoning about Aaron. The
  verbatim quote is the gold standard; the agent's
  paraphrase is the index. Both stay.
- **DO crystallize**: `MEMORY.md` index entries (one-line
  descriptions can tighten over time); frontmatter
  `description:` fields (can sharpen for better triggering);
  and any `docs/` prose that restates memory content —
  the `docs/` restatement can crystallize; the `memory/`
  source stays.

**Why the asymmetry:** memory files are the record of what
Aaron said and how the factory understood it at a point in
time. A lossless compression claim is only credible when
the original exists to verify against. Deleting the
"verbose" original breaks the verification contract. The
memory-file exception is the principled case where
**preservation beats compression** because the preservation
is the load-bearing property of the artifact class.

## How to apply

**Default posture going forward** (factory-wide):

- When authoring new prose in `docs/`, `.claude/skills/`,
  `openspec/`, `docs/DECISIONS/`, or anywhere else in the
  repo: **draft, then crystallize before committing**.
  The draft can be verbose; the commit should be tight.
- When editing existing prose: **crystallize opportunistically
  alongside the substantive edit**. Don't do big-bang
  crystallization passes (that's ceremony); do landed-as-you-
  go compression during normal work.
- When a round closes: the round-close narrative in
  `docs/ROUND-HISTORY.md` is a natural crystallization
  target — long in-flight paragraphs compress into the final
  arc summary.
- When a research note's findings get absorbed into
  committed doctrine: the note itself often becomes
  redundant and can be crystallized down (or retired
  with a pointer) per the landed-state convention.

**Does NOT apply to:**

- Verbatim user quotes anywhere in the repo — Aaron's
  voice stays exact.
- Memory file bodies — the
  preserve-original-and-every-transformation rule wins.
- Research notes while still active — crystallization
  happens **after** findings land in doctrine, not during
  research.
- Reversible factory logs (crystallization-ledger,
  meta-wins-log, agent-cadence-log): these record
  state over time; compression would lose the
  time-series.

## Connection to existing policy

This policy generalizes several existing rules into one
principle:

- `feedback_practices_not_ceremony_decision_shape_confirmed.md`
  — practices not ceremony; small direct artifacts beat
  big-bang new skills. Crystallization is the compression
  axis of that principle.
- `feedback_preserve_original_and_every_transformation.md`
  — the memory-file exception is literally this rule.
- `docs/research/crystallization-ledger.md` convergence
  metric — per-turn output-size shrinkage measures
  factory-wide convergence; this policy says the whole
  factory should exhibit the same shrinkage over time.
- `feedback_factory_default_scope_unless_db_specific.md`
  — factory defaults. Less-is-more is now a factory
  default.

## Why Aaron said this now

Context: I had just committed turn 2 of the crystallization
ledger with output-size = 2 (two vision-edit refinements).
The verb "crystallize" was live. Aaron's signal is that
the verb should **spread** — not stay bottled in the
VISION.md skill. This is the cartographer generalizing
her operation: the map is crystallized; the roads,
notes, and commentary should be too.

The "except for the memory files" clause is Aaron's
explicit anti-generalization guard — he saw where the
generalization would go wrong (memories shouldn't
compress) and named the exception in the same breath.
That is the durable-policy shape: rule + named exception.
