---
name: Thinking-about-thinking (meta-cognition) is the right lens for designing skill packs that make lesson-integration a durable factory reality — first-pass candidate skill pack list
description: Aaron's 2026-04-23 directive linking meta-cognition to lesson-permanence. Thinking-about-thinking is a good meta task for me when deciding what skill packs to create to make past-lesson integration real over time. First-pass thinking on candidate skill packs captured here; actual authoring gated by Aaron's promotion signal.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Thinking-about-thinking for skill-pack design

## Verbatim (2026-04-23)

> i thnk the thinking about thinking still could be helpful
> when thinking about lessons and integrating them based on
> past data, thinking about thinking is a good meta tasks for
> you when thinking about what skill packs we need to make
> this past lession integration into the factory a reality
> over time

## Rule

**Meta-cognition is the design tool for lesson-integration
infrastructure.** When designing the factory mechanisms that
make past-lesson integration real over time, the agent's
"thinking about thinking" is the right lens — noticing how it
actually remembers / retrieves / applies lessons, and building
skill packs around the real cognitive shapes rather than an
idealised model.

This sits one layer above the lesson-permanence rule
(`feedback_lesson_permanence_is_how_we_beat_arc3_and_dora_2026_04_23.md`).
Lesson-permanence names the product (integrate forward, don't
forget). Thinking-about-thinking names the *design method* for
building the product.

## Why meta-cognition is load-bearing here

The factory cannot mechanically prescribe "when you encounter
X, apply lesson L." The world presents novel shapes. What the
factory CAN do is teach itself to *notice* when the current
situation rhymes with a past lesson — and that noticing is
metacognitive.

Three flavours of metacognition matter for skill-pack design:

1. **Monitoring** — "Am I drifting into a pattern I have seen
   before fail?" This is the live-lock-smell detection shape,
   generalised: any past failure mode can have a detector.
2. **Retrieval** — "What past lesson is relevant to this
   current decision?" Memory-consultation as an explicit step
   in the decision process, not an afterthought.
3. **Adaptation** — "Given the lesson applies, how do I
   modify my approach without copying past behaviour literally?"
   Past lessons are priors, not templates.

A skill pack that only gives one of the three is incomplete. A
skill pack that gives all three is a durable lesson-integration
unit.

## First-pass candidate skill-pack list

Not authored yet. Each is a candidate that Aaron can promote,
modify, or reject. Authoring is gated.

### Pack 1: `lesson-retriever`

- **Purpose:** Before opening a new work arc, search `memory/`
  and `docs/hygiene-history/` for applicable past lessons.
  Surface the top 3 relevant ones with confidence scores.
- **Shape:** Capability skill (.claude/skills/). Runs as a
  pre-work step; similar shape to the `skill-tune-up`
  discipline but consumes lessons instead of skill tune-up
  signals.
- **Composes with:** live-lock audit (consumes
  `docs/hygiene-history/live-lock-audit-history.md`); any
  other hygiene-history file with a "Lessons integrated"
  section.

### Pack 2: `failure-mode-detector`

- **Purpose:** Generalise the live-lock smell detector into
  a framework where any documented failure mode can register
  a predicate + response, and the factory checks the full
  registry on a cadence.
- **Shape:** Capability skill + a light framework under
  `tools/audit/` that hosts the detector registry.
- **Composes with:** `tools/audit/live-lock-audit.sh` (first
  registered detector); SignalQuality module (a shipped
  quality-monitor that belongs in the registry).

### Pack 3: `lesson-recorder`

- **Purpose:** When a failure mode fires, the recorder takes
  the agent through a structured elicitation: signature /
  mechanism / prevention / open-carry-forward. Prevents
  shallow lesson entries by asking "what would a future agent
  read here and act on?"
- **Shape:** Capability skill; invoked on failure-event
  detection; writes a row to the relevant
  `*-history.md`'s Lessons-integrated section.
- **Composes with:** all hygiene-history files; any
  retrospective write-up workflow.

### Pack 4: `prevention-cadence-gate`

- **Purpose:** Before a round-close ledger accepts, run all
  registered failure-mode detectors. If any smell is firing,
  the close includes the required response in the next
  round's plan before acceptance.
- **Shape:** Capability skill invoked by round-close workflow;
  composes with existing round-close rituals.
- **Composes with:** `docs/AUTONOMOUS-LOOP.md`,
  `docs/ROUND-HISTORY.md`, round-close ledger.

### Pack 5: `meta-cognitive-journal`

- **Purpose:** At a cadence (per-round or per-session), prompt
  the agent to reflect on *how* it decided things that round
  — not just what it decided. Surface heuristics the agent
  used, check whether any drifted, land revisions.
- **Shape:** Capability skill + companion persona notebook.
  Not a hard gate — optional reflection that catches pattern
  drift.
- **Composes with:** persona-notebook files; `CLAUDE.md`
  "future-self-not-bound-by-past-self" rule; ARC-DORA
  capability soul-file.

### Pack 6: `lesson-archaeologist`

- **Purpose:** On demand, scan historical commits / memory /
  docs for *implicit* lessons that were never explicitly
  filed — patterns of commit messages like "fix X because Y
  didn't work" that encode a lesson without formal filing.
  Extract + file as structured lessons.
- **Shape:** Capability skill, invoked periodically (every N
  rounds). Slow, expensive, high-value.
- **Composes with:** `git log` search, `docs/research/`,
  `memory/` cross-reference audit.

## How these compose as an integrated system

1. `lesson-recorder` populates lessons when failures fire.
2. `lesson-archaeologist` backfills lessons from history.
3. `lesson-retriever` surfaces relevant lessons before new work.
4. `failure-mode-detector` catches known failure signatures
   on a schedule.
5. `prevention-cadence-gate` blocks round-close if smells
   fire unresolved.
6. `meta-cognitive-journal` catches drift the other five miss.

Six packs, one integrated discipline. Each pack is one file
under `.claude/skills/`, a few hundred lines at most.

## Sequencing recommendation

- **First:** `lesson-recorder` (Pack 3). The inaugural
  live-lock lesson landed tonight with hand-rolled structure;
  Pack 3 formalises the shape so subsequent lessons are
  comparable.
- **Then:** `lesson-retriever` (Pack 1). Once lessons are
  structured, retrieval becomes valuable. Reversed order
  would prematurely optimise retrieval for a schema that
  will change.
- **Then:** `failure-mode-detector` (Pack 2). Turns the
  live-lock audit into a more general detector registry.
- **Then:** `prevention-cadence-gate` (Pack 4). Binds detectors
  into the round-close workflow.
- **Later:** `lesson-archaeologist` (Pack 6) and
  `meta-cognitive-journal` (Pack 5). Both are higher-leverage
  once the first four exist, but depend on the infrastructure
  those four provide.

## What this is NOT

- Not authorisation to start writing any of these skill
  packs tonight. The lesson-permanence rule says check the
  audit ratio first; EXT is still firing (pending
  merges). Speculative skill-pack authoring is out of the
  "ship external" discipline right now.
- Not a claim this six-pack decomposition is optimal. First
  draft; revise on contact with implementation.
- Not a license to skip the ordinary
  `skill-creator` workflow. Each pack, when Aaron promotes,
  lands via the normal draft → prompt-protector review →
  dry-run → commit path per `GOVERNANCE.md §4`.
- Not a directive to build the infrastructure before the
  immediate external priorities (ServiceTitan demo, Aurora
  integration). Those stay priority #1 and #2.

## Open questions for Aaron

1. Does the six-pack decomposition feel right, or should it
   collapse to fewer packs? Or split further?
2. Which pack do you want first? Claude recommends Pack 3
   (`lesson-recorder`) for sequencing reasons above.
3. Is there a seventh pack I missed that's obvious to you?
4. Does this infrastructure live under `.claude/skills/` or
   should it be a dedicated `.claude/disciplines/` subtree?
   Novel category suggests separate folder.
5. Do we need a named persona for the lesson-integration
   discipline (like Aarav owns skill tune-up), or does it
   route through existing personas?

## Composes with

- `memory/feedback_lesson_permanence_is_how_we_beat_arc3_and_dora_2026_04_23.md`
  (the WHAT; this file is the HOW)
- `docs/research/meta-wins-log.md` (existing meta-wins
  corpus; related shape)
- `docs/hygiene-history/live-lock-audit-history.md`
  (inaugural concrete lesson Pack 3 would formalise)
- `memory/feedback_future_self_not_bound_by_past_decisions.md`
  (Pack 5 `meta-cognitive-journal` specifically exercises this)
