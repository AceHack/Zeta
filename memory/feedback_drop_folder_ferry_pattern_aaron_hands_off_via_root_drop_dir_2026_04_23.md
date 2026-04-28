---
name: `drop/` folder is Aaron's ferry-space — check it at every wake; absorb content into proper substrate; don't commit the raw drop files
description: Aaron uses the repo-root `drop/` directory to ferry files from his side (ChatGPT sessions with Amara, notes, research reports, transfer artifacts) to the agent. Pattern: agent checks `drop/` on wake, reads new content, absorbs into the right in-repo home (docs/aurora/, docs/research/, memory/), commits the absorbed form; raw drop files stay local. Gitignored so raw files don't accidentally commit.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# The `drop/` ferry pattern

## How I discovered this

Aaron mentioned in 2026-04-23 messages: *"there is a operations
enahncemsn needed for auro i put in the human drop folder you
can integrate/absobe"* and later *"I just bootstrapped."* I
absorbed the content (Amara's transfer report) into
`docs/aurora/2026-04-23-transfer-report-from-amara.md` but left
the raw `drop/aurora-initial-integration-points.md` file
untracked in the working tree. A tick later I noticed the file
still there, read it, confirmed it was the source I'd already
ingested — but realised the pattern needs encoding so future
ticks don't miss fresh drops.

## Rule

**Check `drop/` at every session wake.** It's repo-root; a
single `ls drop/` is enough. If there's content, read it and
absorb into the proper substrate.

**Absorption paths by content type:**

- **Analysis / research from an external AI** (Amara, future
  collaborators) → `docs/aurora/YYYY-MM-DD-*.md` or
  `docs/research/YYYY-MM-DD-*.md` depending on scope.
- **Aaron's own notes / thoughts** → `memory/*.md` if
  durable-preference-shaped, or commit-message context if
  immediate-work-shaped.
- **Data files** (CSVs, JSON, images) → `docs/assets/` or
  `samples/` if they serve a sample, `memory/observed-phenomena/`
  if they're an artifact to be analysed.

**Ingestion policy:** preserve verbatim when the source is
another AI or human collaborator (signal-in-signal-out
discipline). Add an editorial header naming provenance + date
+ ferry mechanism, not content modifications.

**Disposal:** after absorption, the raw file in `drop/` can be
left there or deleted — it's Aaron's folder, not mine.
Gitignored either way. Do not commit.

## Why gitignore

`drop/` is now in `.gitignore` so:

- Raw transfers (often with chat-artifact citation markers,
  inline format leftovers, metadata irrelevant to the repo's
  clean form) never accidentally commit.
- Aaron can use the folder freely without worrying about
  accidentally exposing drafts.
- The absorption creates the cleanable in-repo form, which
  IS what ships.

## How to apply

- **Every tick that considers "is there new input from Aaron?"**
  — check `drop/`. Quick `ls drop/` as part of situation
  assessment.
- **When absorbing, note provenance.** Every absorbed-from-drop
  doc should name: date received, Aaron as ferry-bearer, the
  originating source (Amara via ChatGPT, Aaron himself,
  external document Aaron forwarded).
- **Do not paraphrase on ingest** (per
  `feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`).
  Editorial headers go above, not inside.
- **If `drop/` contains something I've already absorbed**, no
  action needed beyond confirming. The file can stay; Aaron may
  retrieve it or delete it.
- **If `drop/` contains something puzzling** (file I can't
  classify), flag it in the next tick's status and ask Aaron's
  direction rather than guessing.

## What this is NOT

- Not a rule that `drop/` must be checked on every tick. Once
  per session-wake is enough; mid-session re-checks only if
  Aaron explicitly references a new drop.
- Not a directive to automatically move / process drop content
  without thinking. Absorption is a judgment call; dumping
  drop/ content straight into `docs/` without shaping it breaks
  signal-preservation.
- Not authorization to write INTO `drop/`. It's Aaron's folder;
  the agent reads, absorbs, and leaves.

## Composes with

- `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  (preserve signal on absorption)
- `memory/feedback_mission_is_bootstrapped_and_now_mine_aaron_as_friend_not_director_2026_04_23.md`
  (Aaron ferries collaborator inputs; I process)
- `docs/aurora/collaborators.md` (the Amara ferry mechanism this
  pattern enables)
- `.gitignore` (the technical enforcement)
