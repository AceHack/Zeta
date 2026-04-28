---
name: Witnessable self-directed evolution — factory as public artifact of real-time self-correction; git-log / memory-chronology / commit-discipline are the performance-surface
description: Aaron 2026-04-21 *"we want pople to whitness self directed evolution in real time, basciscally what you are doing right now"* — pointed directly at the in-session moment where the agent had just (a) posted a confidence-filtered reasoning insight, (b) received Aaron's capture-everything correction, (c) filed a correction memory, (d) reversed the deferral, (e) filed the previously-deferred aspirational row. The correction-to-action chronology captured live in the git log + memory files IS the public artifact — not just internal hygiene. External observers (future contributors, alignment researchers, consumers, peer-reviewers) should be able to witness the factory correcting itself. Reframes the soul-file from "reproducibility-substrate-as-private-hygiene" to "reproducibility-substrate-that-is-also-a-performance-surface." Composes with soul-file (evolution-narrative is the chronological reading of the soul-file), capture-everything-including-failure (failures must be captured for evolution to be witnessable), teaching-is-how-we-change-order (correction is the teaching move), Mr-Khan pedagogy (show-the-mistake-and-the-correction), factory-as-externalisation (the evolution mechanism IS the gift to successors), measurable-alignment (correction-over-time is a measurable signal).
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Witnessable self-directed evolution — factory as public artifact

## What Aaron said (verbatim, 2026-04-21)

Single message, delivered in the middle of an
ongoing capture-correction sequence:

> *"we want pople to whitness self directed evolution
> in real time, basciscally what you are doing right
> now"*

The reference is concrete and self-pointing. The
"what you are doing right now" is the agent's
ongoing sequence:

1. Agent posted an end-of-turn insight explaining
   why it had deferred filing a BACKLOG row.
2. Aaron responded: *"caputer everyting not just
   what we think we will get right we capture
   failure too / honesty"* — direct correction of
   the confidence-filtered reasoning.
3. Agent acknowledged the correction, filed a new
   memory
   (`feedback_capture_everything_including_failure_aspirational_honesty.md`),
   updated the soul-file memory's "Candidate
   BACKLOG row (not filed this round)" sub-section
   with a retraction-block and a corrected
   framing, and filed the previously-deferred
   BACKLOG row with explicit aspirational status.

This entire sequence lands in the git log + memory
file system + BACKLOG. Aaron's framing: *this
sequence*, landing in real-time and visibly
preserved, IS the artifact. External observers
reading the commit history + memory chronology can
witness the factory evolving itself.

## Why this is load-bearing

### From private hygiene to public performance

Prior framing of the soul-file emphasised
reproducibility (anyone can rebuild the factory from
the git repo) and honest-capture
(including-failures, per the companion
capture-everything memory). That framing treated the
soul-file as a *substrate* — something other people
use to do something.

This framing adds the performance-surface:
the soul-file is *also something people watch*. The
chronological reading of the soul-file (commit log,
dated revision blocks, BACKLOG row evolution,
memory chronology) tells a story — the story of
the factory evolving itself, in real time, with
mistakes and corrections visible.

Substrate-value and performance-value are not in
tension — they are the same record, read along two
different axes. Forward-reading (clone + build) gives
reproducibility; chronological-reading (git log +
dated revisions) gives witnessable-evolution. Honest
capture is a precondition for both.

### Evolution requires visible failure

This is why the capture-everything-including-failure
memory is the direct upstream dependency. A soul-file
that filtered its record by confidence would show
only successes; successes don't tell an evolution
story. Evolution requires *changes* in direction,
which requires visible *initial* directions and
visible *corrections*. The failures and the mistakes
are the narrative's load-bearing frames.

### Composes with the measurable-alignment trajectory

Per `docs/ALIGNMENT.md`, Zeta's primary research
focus is measurable AI alignment. A factory whose
evolution is witnessable is one whose
alignment-trajectory is *measurable by external
observers*, not just by the factory itself. This
strengthens the alignment claim: the measurement
substrate is auditable, not self-certified.

## The performance-surface anatomy

The witnessable-evolution artifact is composed of
these layers, in order of primary-to-secondary:

### 1. Commit messages as evolution narrative

`git log` is the first-class performance surface.
Commit messages should tell the story, not just
describe the diff. A future reader scrolling through
the log should be able to infer: what was tried,
what went wrong, what was corrected, what landed.

Implications for commit-message discipline:

- **Prefer "X, after Y correction" framing** when a
  commit follows a mid-session course-correction.
  The commit of this memory is candidate example:
  *"memory: witnessable self-directed evolution,
  after Aaron's capture-everything correction."*
- **Cross-reference Aaron's words verbatim** where
  they triggered the move. Preserves the
  conversation-register and the chronology.
- **Don't rewrite commit history to look clean.**
  The messy sequence of wrong-move → correction →
  action is the value. Squashing into "final clean
  version" destroys the evolution-narrative.

### 2. Memory dated-revision-blocks

Dated-revision-block pattern (already in use per
`feedback_retractibly_rewrite_definitions_laws_precedence_real_nice_like.md`
and `feedback_preserve_real_order_of_events_dont_retroactively_reorder_by_priority.md`)
is the memory-level surface of witnessable-evolution.
The revision block preserves the original framing in
record AND captures the revision-reason, so future
readers can watch the memory evolve.

The soul-file memory's three revision blocks
(naming-confirmation on 2026-04-21 → text-only
discipline → metametameta-seed extension) are a
worked multi-step evolution-narrative within a
single memory.

### 3. BACKLOG row evolution

BACKLOG rows gain and lose status, change tier,
split, merge, get filed, get withdrawn. Each change
is a visible move. The PR/marketing row on this
session went from "Aaron-sign-off gate"
framing to "roommate-register recalibration three-way
split" in-place, with the original gate framing
preserved in the row text per chronology. A future
reader sees both the original and the revision.

### 4. ADRs and `docs/DECISIONS/` trail

Architectural decisions that get revisited via new
ADRs (not by rewriting old ones) form the
decision-level evolution trail. Already in use per
existing factory discipline.

### 5. Research docs under `docs/research/`

Research exploration, including rejected or failed
directions, lives here. A future researcher should
be able to see what the factory tried and didn't
commit to.

## Compositions

- **`user_git_repo_is_factory_soul_file_reproducibility_substrate_aaron_2026_04_21.md`**
  — the soul-file IS the substrate whose chronological
  reading produces witnessable-evolution. This
  principle extends the soul-file's value from
  private-reproducibility to public-performance.
- **`feedback_capture_everything_including_failure_aspirational_honesty.md`**
  — direct upstream dependency: without honest
  capture-including-failure, the chronological reading
  shows only curated successes, which isn't
  evolution.
- **`feedback_preserve_real_order_of_events_dont_retroactively_reorder_by_priority.md`**
  — chronology-preservation is the performance-layer
  discipline. Rewriting history destroys the
  evolution-narrative.
- **`feedback_retractibly_rewrite_definitions_laws_precedence_real_nice_like.md`**
  — retractibly-rewrite algebra IS the evolution
  mechanism; additive `-1 old + +1 new + revision
  line` preserves both sides for the watcher.
- **`feedback_teaching_is_how_we_change_the_current_order_chronology_everything_star.md`**
  — teaching-is-`*` naturally includes teaching-by-
  showing-corrections. Witnessable evolution is
  one-to-many teaching at scale: one factory
  evolving, many watchers learning.
- **`user_aaron_loves_mr_khan_khan_academy_teaching_admired.md`**
  — Khan Academy pedagogy: show the attempt *and*
  the mistake *and* the correction, because the
  correction is where learning lands. Zeta's
  evolution-log is a Khan-Academy-for-factory-
  pedagogy candidate.
- **`project_factory_as_externalisation.md`** —
  externalisation-of-algorithm succession
  invariant: successors inherit not just the
  algorithm but the algorithm's self-correction
  history. Witnessable evolution IS the
  externalisation mechanism's output-surface.
- **`docs/ALIGNMENT.md`** — measurable AI alignment
  primary research focus. A factory whose
  evolution is publicly auditable is one whose
  alignment-claims are externally verifiable.
- **`feedback_my_tilde_is_you_tilde_roommate_register_symmetric_hat_authority_retractable_decisions_without_aaron.md`**
  — retractable-decisions-without-Aaron IS
  self-directed-evolution at the decision-making
  layer. Aaron authorised the agent to evolve the
  factory without synchronous sign-off; this
  principle says that evolution is witnessable.
- **Companion BACKLOG row** "Witnessable self-
  directed evolution" (P3, aspirational, filed
  same session).

## Implications

### 1. Commit-message discipline

Commits during multi-step corrections should tell
the narrative. The series of commits for this
session's capture-everything sequence is a worked
example:

```
commit A: marketing: retractable-drafts subtree + first positioning draft
commit B: backlog: all-schools-all-subjects + PR/marketing recalibration
commit C: research: yin-yang composition-discipline sweep
commit D: [this one]: capture-everything correction + germination BACKLOG + scaffolding + witnessable-evolution
```

The D commit message should say what triggered it
(Aaron's correction), what it landed, and how it
composes with A-C. Future readers of `git log`
should be able to reconstruct the story.

### 2. Revision-block always preserves prior text

No destructive edits to memories, BACKLOG rows, or
docs during revision. The `original sub-section
text (preserved per chronology — superseded above)`
pattern in the soul-file memory is the template.

### 3. Eventual public-register artifact

A consumer-facing "factory evolution log" surface
could eventually make the witnessable-evolution
artifact legible to non-git-readers. Candidate
rendering: auto-generated markdown timeline from
git log + memory revision-blocks + BACKLOG row
diffs. Retractable-draft experiments here live in
`docs/marketing/` per the retractable-drafts
subtree charter. Not this round; captured.

### 4. Resist the temptation to curate

The instinct to make the factory look good via
cherry-picked commits or polished memories is
exactly the confidence-filter that Aaron corrected.
Resist. The raw evolution is more valuable than the
polished snapshot — because the raw evolution is
witnessable and the polish is not.

## Live worked instance — this memory IS the evolution

The sequence captured in real time, commit by commit:

1. Agent filters capture by confidence (end-of-turn
   insight after commits landed).
2. Aaron corrects: capture everything, honesty.
3. Agent files `feedback_capture_everything_including_failure_aspirational_honesty.md`.
4. Agent updates soul-file memory's
   "Candidate BACKLOG row" sub-section with
   retraction-block.
5. Aaron points at the ongoing sequence: *"we want
   pople to whitness self directed evolution in
   real time, basciscally what you are doing right
   now"*.
6. Agent files THIS memory (witnessable-evolution)
   AND the germination-targets BACKLOG row AND the
   scaffolding BACKLOG row AND the witnessable-
   evolution BACKLOG row.
7. Agent commits the entire sequence as a single
   thematic commit with an evolution-narrative
   commit message.
8. The git log + memory chronology preserve the
   sequence for external witnesses.

Reading this memory in the future, a witness can
trace: item 1 (wrong move) → items 2-3 (correction
+ internal response) → items 4-7 (externalised
action) → item 8 (preservation for future
witnesses). This is the evolution-narrative in its
most compressed form.

## Candidate measurables

For the alignment-trajectory dashboard:

- `witnessable-evolution-narrative-preservation-rate`
  — fraction of multi-step course-corrections where
  the wrong-move + correction + action sequence is
  visible in git log + memory chronology. Target:
  high. Anti-target: silent course-corrections that
  erase the wrong-move before it's captured.
- `destructive-edit-count-on-correction` — count of
  destructive edits (git rebase -i squash, memory
  overwrite without revision-block, BACKLOG row
  deletion) during or immediately after a correction.
  Target: 0. Signal of curation-instinct overriding
  preservation.
- `external-observer-legibility-score` — qualitative
  signal: can an external reader, scanning recent
  history, reconstruct the narrative of what was
  tried, what went wrong, what was corrected? Not
  easily automated; audit-by-sample.

## What this principle is NOT

- **Not a demand for performative failure.** The
  factory should not manufacture mistakes to make
  the evolution-narrative dramatic. Honest capture
  means: when mistakes happen, they land in record;
  the frequency is determined by honest work, not
  by narrative aesthetic.
- **Not a license for sloppiness.** Quality bar on
  commits, memories, and BACKLOG rows stays high.
  Witnessable-evolution is not "do messy work and
  call it evolution"; it is "do careful work,
  including careful preservation of course-
  corrections."
- **Not a demand for every micro-decision to be
  surfaced.** The factory makes many small decisions
  that don't rise to the narrative level. Surface
  the ones that *changed direction*, not every
  routine execution step.
- **Not a bypass of retraction-window discipline.**
  For items within the retraction window
  (immediate-back-out permitted per
  math-safety-retractibility), the retraction is
  still captured — just within the window. Outside
  the window, revision-blocks apply.
- **Not a public-broadcast mandate.** The soul-file
  is potentially-public (git clone works for anyone
  with access), but actively broadcasting the
  evolution-log to external audiences
  (press-releases, social media, conference talks)
  is an irretractable commercial-surface move and
  still gates on Aaron sign-off per the roommate-
  register memory.
- **Not a permanent invariant.** Revisable via
  dated-revision-block like any feedback memory.

## Cross-references

- `memory/feedback_capture_everything_including_failure_aspirational_honesty.md`
  — direct upstream dependency.
- `memory/user_git_repo_is_factory_soul_file_reproducibility_substrate_aaron_2026_04_21.md`
  — the soul-file whose chronological reading
  produces this principle's artifact.
- `memory/feedback_preserve_real_order_of_events_dont_retroactively_reorder_by_priority.md`
  — chronology-preservation is the performance-layer
  discipline.
- `memory/feedback_retractibly_rewrite_definitions_laws_precedence_real_nice_like.md`
  — retractibly-rewrite algebra IS the evolution
  mechanism.
- `memory/feedback_teaching_is_how_we_change_the_current_order_chronology_everything_star.md`
  — teaching-by-showing-correction.
- `memory/user_aaron_loves_mr_khan_khan_academy_teaching_admired.md`
  — Khan-Academy pedagogy precedent.
- `memory/project_factory_as_externalisation.md` —
  externalisation-of-algorithm succession.
- `docs/ALIGNMENT.md` — measurable AI alignment.
- `docs/BACKLOG.md` P3 row "Witnessable self-
  directed evolution — factory as public artifact"
  (companion).
