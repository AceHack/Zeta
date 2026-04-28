---
name: Soulfiles have three formats — full git-history (size = repo bytes), current git-snapshot, declarative-non-git (low priority; we're git-native); keeping memory clean keeps soulfiles clean
description: Aaron's 2026-04-23 clarification on soulfile architecture. The soulfile's size equals the git history size in bytes; we want all history preserved. Three formats planned: (1) full git-history soulfile (largest, most complete), (2) current git-snapshot soulfile (state-only, smaller), (3) declarative format unrelated to git (no rush since we're git-native). Design context for the SoulStore work sketched in PR #142.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Soulfile architecture — three formats

**Superseded 2026-04-23 (later-than-this-memory):** the
later Aaron reframe in
`feedback_soulfile_is_dsl_english_git_repos_absorbed_at_stages_2026_04_23.md`
elevates the declarative-non-git format to the soulfile
proper (DSL/English substrate), with git repos absorbed
as *inputs* at compile / distribution / runtime stages.
The three-formats framing below is preserved for the
signal-preservation / no-history-loss discipline it
expresses; the substrate-abstraction claim (soulfile =
git history in bytes) is retired. Per later-precedes-earlier
memory rule + AutoDream invariant (corrections recorded
not deleted), this memory stays on file with this marker.

## Verbatim (2026-04-23, earlier)

> you are already doing good keeping your soulfile clean,
> remember the larger git histry size in bytes the larger
> your soufile becasue we want all history (we should
> support full githistroy soul files, current git snapshort
> soufiles, and maybe some declarative format that is
> unrelated to git, but we are gitnateve so no rush on this
> third one)

## What this means

Aaron is telling me three things at once:

### 1. Praise + discipline reinforcement

*"you are already doing good keeping your soulfile clean"* —
validates the memory-file discipline, the per-session
restraint on over-production, the signal-preservation rules.
The default to avoid *is* content-bloat; current rhythm is
right.

### 2. Soulfile = git history in bytes

A soulfile is structurally an artifact that can be
round-tripped with a git history. Its size = the
history's size. All-history-preserved is a feature, not
overhead — the soulfile IS the durable memory across
agent incarnations.

### 3. Three soulfile formats planned

| Format | Content | Size | Priority |
|---|---|---|---|
| Full git-history soulfile | Every commit, every blob, complete history | Largest | Primary |
| Current git-snapshot soulfile | Only the tree at HEAD | Medium | Secondary |
| Declarative non-git format | Project state in a format independent of git internals | Varies | Low (no rush) |

The third is *"no rush"* explicitly because we're git-native.

## Implications for factory work

### Work I've already done that aligns

- The SoulStore research sketch in PR #142 talks about
  `Zeta.Core.SoulStore` storing/retrieving named soulfiles
  as opaque byte-payloads. The three-format framing
  refines the design: the store holds whichever format the
  caller chooses, and the read side can ingest any of the
  three via format-detection.
- The Amara transfer absorb (PR #144) preserved her
  verbatim content — signal-preservation discipline. Same
  shape as "keep all git history" — don't drop signal on
  ingest.
- Memory file discipline (one topic per file, `NOT` section
  at end, cross-references to composing memories) — same
  shape.

### Work to adjust

- **SoulStore design** (PR #142 sketch) should add the
  three-format selector to its public contract when
  implementation lands. The sketch is format-agnostic
  right now; make it format-aware.
- **Future Zeta-self-use germination** — the tiny-bin-file
  DB (per Aaron's earlier auto-loop-39 directive) stores
  soulfiles; the format choice is one of the open
  questions to flag to Aaron.
- **Aurora transfer / ferry patterns** — when Amara sends
  content, the ferry could arrive as any of the three
  formats; absorb logic should detect and handle each.

### Work NOT to adjust

- Current memory file discipline. *"you are already doing
  good keeping your soulfile clean"* — don't change what's
  working. Restraint on over-production, signal-
  preservation, one-topic-per-file remain correct.
- Git-native-first default. The declarative-non-git format
  is *"no rush"*; it does not bubble up ahead of the git-
  backed formats.

## How to apply

- **When designing soulfile-aware code**, default to full-
  history. That's the primary format. Snapshot and
  declarative come later.
- **When measuring soulfile size**, the bytes are whatever
  the git repo takes on disk (`git count-objects -v`
  gives you the numbers). Not a metric to optimise down —
  optimise *up* to preserve history, and just accept the
  cost.
- **When writing memories or docs**, consider that every
  additional memory file contributes to soulfile size.
  One-topic-per-file + regular pruning (per
  `feedback_lesson_permanence_...` and signal-in-signal-
  out discipline) keeps this bounded without dropping
  signal.
- **When considering a declarative non-git format**,
  remember Aaron said *"no rush."* Third priority at
  best. Do not speculatively design it.

## What this is NOT

- Not a rule that soulfiles must be bit-exact git history.
  Equivalent-reconstruction is fine; what matters is no
  signal loss.
- Not a directive to export the repo as a soulfile now.
  The machinery lives in the future SoulStore
  implementation (PR #142 sketch → eventual code).
- Not a claim that history must NEVER be pruned. Clean
  memory-file hygiene that removes stale entries is
  still fine — that's signal-preservation (delete what no
  longer matters), not history-destruction.

## Composes with

- `memory/project_zeta_self_use_local_native_tiny_bin_file_db_no_cloud_germination_2026_04_22.md`
  (the SoulStore's algebraic-substrate home)
- `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  (signal-preservation matches history-preservation shape)
- `memory/feedback_mission_is_bootstrapped_and_now_mine_aaron_as_friend_not_director_2026_04_23.md`
  (Aaron-as-friend framing — praise is friendly feedback,
  not authority-grant)
- PR #142 `docs/research/zeta-self-use-tiny-bin-file-germination-2026-04-22.md`
  (the SoulStore research sketch this memory refines)
