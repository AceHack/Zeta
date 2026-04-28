---
name: Aaron drop-zone protocol — `drop/` folder as maintainer-to-agent inbox; untracked-except-sentinel; known-binary-type registry; absorb-then-delete
description: Aaron directive establishing drop/ folder as a persistent inbox for file deposits; agent audits at every tick-open; folder is gitignored except README+gitignore sentinels; binaries handled per closed-enumeration registry; unknown kinds flag to Aaron; absorbed artifacts go to docs/research/; 2026-04-22 auto-loop-43.
type: project
---

# Aaron drop-zone protocol — `drop/` folder as maintainer-to-agent inbox

Aaron 2026-04-22 auto-loop-43 established two load-bearing
rules for a new `drop/` folder:

**Initial directive:**

> *"new research just dropped in the repo can you make me a
> folder you check every now and then i can put files in for
> you to absorb"*

**Follow-up directive (same tick):**

> *"if i put a binary in there we should have specific rules
> for hadling the bindaries we know but they never get
> checked in this folder could be untracket with a single
> tracked file to make sure it get created"*

**Why:** Aaron needs a low-friction deposit mechanism —
drop a file, keep working, agent absorbs it when it next
wakes. Without a designated folder the file sits at repo
root (where `deep-research-report.md` sat for this tick,
the *triggering* deposit) and the agent has to guess intent
from filename placement. With a designated folder the agent
has a canonical audit target (`ls drop/`) and Aaron has a
canonical deposit target (drag-and-drop, paste, `mv` into
`drop/`). The gitignore discipline is Aaron's anticipation
of the mess-tolerance problem — if `drop/` tracked
everything deposited, every PDF + transcript + screenshot
would enter git history forever.

**How to apply (per-tick):**

1. **Tick-open audit.** Run `ls -la drop/` at step 2
   of the never-idle priority ladder (after PR-pool audit,
   before meta-check). If only the two tracked sentinels
   (`README.md`, `.gitignore`) plus harmless system files
   (`.DS_Store`) are present, no-op and continue. If any
   other file is present, **absorb it this tick**.
   Absorption beats other speculative work because Aaron's
   deposit is the closest signal to *directed* work the
   factory gets.

2. **Absorption procedure (per `drop/README.md`):**
   - Identify kind via the registry in `drop/README.md`.
   - Extract signal (per signal-in-signal-out discipline
     — `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`).
   - Land a tracked absorption note under `docs/research/`
     (or the topically-appropriate tracked location).
   - Delete the original from `drop/`.
   - Cross-reference from BACKLOG / memory / round-history
     as relevant.
   - Commit the absorption note as a normal tracked file.

3. **Known-binary-type registry (closed enumeration).**
   Registry lives in `drop/README.md` and is the
   authoritative list. Covers: Text, Source code, PDF,
   Image, Audio, Video, Archive, Binary executable,
   Office documents, Unknown. **Unknown kinds flag to
   Aaron** — do not improvise a handler. Registry edits
   are tracked; registry updates need a reason to land.

4. **Untracked-except-sentinel design.**
   - `drop/README.md` is tracked (the protocol doc).
   - `drop/.gitignore` is tracked and contains `*` followed
     by `!README.md` and `!.gitignore` — everything else
     ignored.
   - The folder is guaranteed to exist on every clone
     because the two sentinels keep it present, without
     any other file ever entering git history.

5. **Absorb-then-delete cadence.**
   Each absorption leaves exactly one tracked artifact
   (the absorption note); the original is gone. Git
   history of the absorption note is the provenance
   trail; the dropped file is ephemeral. Drop folder is
   therefore always either empty (agent caught up) or
   holding unabsorbed deposits (agent's queue).

## Composes with

- **`feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`**
  — absorption must preserve signal (intent, anchors,
  verbatims); the absorption note is the signal-preserved
  emission from the raw-file input.
- **`feedback_verify_target_exists_before_deferring.md`**
  — if the absorption note defers follow-up work ("Gemini
  Ultra transcript extraction next tick when substrate
  available"), the deferral target must be verifiable or
  dropped.
- **`feedback_never_idle_speculative_work_over_waiting.md`**
  — absorption is higher-priority than other speculative
  work because it is closest-to-directed.
- **`feedback_aaron_terse_directives_high_leverage_do_not_underweight.md`**
  — Aaron's one-sentence request is fully-loaded; the
  full protocol (tick-open audit + binary registry +
  sentinel design + absorb-then-delete) is inferred from
  that sentence plus the follow-up on binaries.
- **`feedback_maintainer_only_grey_is_bottleneck_agent_judgment_in_grey_zone_2026_04_22.md`**
  — absorption decisions (which handler, what structure
  for the absorption note, when to flag unknown) are
  gray-zone judgment calls; agent decides, records
  briefly, proceeds. Only flag when the kind is outside
  the registry (legitimately ask-first, per the
  novel-failure-class trigger).

## NOT authorization for

- Ingesting deposits without absorption notes — every
  drop gets a tracked artifact.
- Silently handling unknown binary kinds — registry is
  closed-enumeration; additions require reason.
- Treating `drop/` as long-term archive — files are
  ephemeral; absorption notes are the durable record.
- Skipping signal-preservation — a lazy "I absorbed this,
  here's a 3-sentence summary" is a failure of the
  signal-in-signal-out discipline.
- Accepting secrets. If Aaron accidentally drops something
  that looks like a secret (key, password, token), flag
  immediately and do not copy into the absorption note.

## Inaugural use

Triggering deposit was `deep-research-report.md` — OpenAI
Deep Research output on Zeta-repo archive + oracle-gate
design + Aurora branding — sitting at repo root (not yet
in `drop/` because `drop/` didn't exist yet). Created
`drop/` + sentinels first, then absorbed via
`docs/research/oss-deep-research-zeta-aurora-2026-04-22.md`,
then deleted the repo-root original. Future deposits
bypass repo-root entirely.
