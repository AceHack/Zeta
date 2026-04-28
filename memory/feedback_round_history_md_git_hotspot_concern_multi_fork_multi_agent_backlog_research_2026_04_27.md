---
name: ROUND-HISTORY.md (and similar shared single-writer files) become git-hotspots under multi-fork or multi-autonomous-agent contention — backlog research, after 0/0/0 starting point (Aaron 2026-04-27)
description: Aaron 2026-04-27 architectural concern raised during fork-storage taxonomy work — `docs/ROUND-HISTORY.md` (and analogous single-writer shared files) classified as Category A (shared-on-LFG) but will become a git-merge-hotspot when multiple forks or multiple autonomous agents write round-close summaries concurrently. Today's single-pair (Aaron + Otto on AceHack) doesn't surface the contention; future multi-pair / multi-autonomous-agent operation will. Backlog research item, NOT for current session — explicitly deferred per Aaron until 0/0/0 starting point reached. Possible architectures named: per-pair partitioned round-history with compiled synthesis, append-only structured format, CRDT-style merge-friendly format, etc. — research before deciding.
type: feedback
---

# ROUND-HISTORY.md hotspot under multi-fork / multi-autonomous-agent contention — backlog research

## Verbatim quote (Aaron 2026-04-27)

After Otto categorized `docs/ROUND-HISTORY.md` as Category A (shared-on-LFG, project-wide):

> "- docs/ROUND-HISTORY.md — round-close synthesis is project-wide
> seems like we are going to need to backlog some research on this, this could become an integration point git hot spot file if all forks are writing to it, what about when we have multiple atonomus agents, againt, we dont have to figure all this out now we are trying to get to the startign point"

## The concern

Today's operating model: single maintainer-agent pair (Aaron + Otto on AceHack), single autonomous loop, single writer to `docs/ROUND-HISTORY.md`. No contention.

Future operating model surfaces multi-writer pressure:

- **Multi-fork**: a future maintainer-agent pair on a different fork (Bob + Claude-Sonnet pair, say) also writes round summaries. Now two pairs both want to append to `docs/ROUND-HISTORY.md`. Each pair's PR touching the file → merge conflict on the next pair's PR.
- **Multi-autonomous-agent**: even within a single fork, multiple autonomous loops running in parallel (different agents, different tasks) all wanting to write round-close summaries → same conflict pattern, faster cadence.

A single-writer markdown file is **a git-merge-hotspot by design** — every concurrent writer must serialize, every PR cycle pays merge-conflict-resolution cost. Scales linearly with number of writers, super-linearly with cadence × writers.

## Why this matters now (sort of) but doesn't need solving now

Aaron's explicit framing: *"we dont have to figure all this out now we are trying to get to the startign point"*. The 0/0/0 starting-point work is the priority. ROUND-HISTORY hotspot doesn't bite until multi-fork / multi-autonomous-agent operation goes live, which is post-starting-point.

But it DOES bite eventually, and the architecture choice affects today's data shape (e.g., if we move to per-pair partitioning, the migration cost grows with each round-history entry we add to the shared file under the current model). So flagging it now means the eventual research can find the architecture before the hotspot pressure arrives.

## Possible architectures to research (post-starting-point)

Not committing to any of these — research will surface trade-offs:

1. **Per-pair partitioned round-history (Category B per the fork-storage taxonomy)**
   - `docs/round-history/<fork-or-pair-identifier>.md` per pair
   - Compiled synthesis at `docs/ROUND-HISTORY.md` (auto-generated, append-only or rebuilt)
   - Pro: no merge conflicts; each pair writes only its own file
   - Con: synthesis-compilation step needed; ordering across pairs is tricky

2. **Append-only structured format with no edits-in-place**
   - Each round = one row, immutable once landed
   - Pro: no conflicts on existing rows; conflicts only on the same-row case (rare)
   - Con: still hotspot if many writers append simultaneously

3. **CRDT-style merge-friendly format**
   - Round history as a CRDT (e.g., a sequence with timestamp-based ordering)
   - Pro: arbitrary concurrent writers, automatic merge
   - Con: text-based git tooling fights CRDT semantics; new tooling required

4. **Per-fork round-history + project-wide round-of-rounds**
   - Each fork has its own round-history (Category B)
   - LFG has a project-wide "round-of-rounds" file that synthesizes across forks at a coarser cadence
   - Pro: separates per-pair journaling from project-wide synthesis
   - Con: two surfaces to maintain

5. **Move ROUND-HISTORY.md to Category B entirely, drop the single-shared-file**
   - Stop pretending it's project-wide; admit it's per-pair journaling
   - Pro: simplest split
   - Con: loses the project-wide cross-fork narrative surface

## Class of concerns: shared single-writer files in general

ROUND-HISTORY.md is the named example, but the same hotspot pattern applies to any shared single-writer file under multi-writer pressure:

- `docs/BACKLOG.md` — already restructured into per-row files (`docs/backlog/**`) for similar reasons (Otto-181 per-row pattern). The same restructure may apply to other big shared files.
- `docs/INSTALLED.md`, `docs/HUMAN-BACKLOG.md`, `docs/POST-SETUP-SCRIPT-STACK.md` — all currently single-file, would face the same pressure.
- Future large doc surfaces — design with multi-writer in mind from the start.

The research isn't just "fix ROUND-HISTORY" — it's "identify the class of single-writer hotspot files and design a scalable pattern."

## Composes with

- **`feedback_acehack_pre_reset_sha_loss_acceptable_lfg_is_preservation_layer_fork_storage_for_data_collection_2026_04_27.md`** — the Category A vs Category B fork-storage taxonomy this refines.
- **`docs/BACKLOG.md` per-row restructure (Otto-181)** — same pattern already applied to BACKLOG; extension to ROUND-HISTORY is the obvious move if per-pair partitioning wins.
- **`feedback_zero_diff_means_both_content_and_commits_cognitive_load_for_future_changes_2026_04_27.md`** — the 0/0/0 starting-point invariant. This research is post-starting-point; doesn't block reaching the line.

## Forward-action

NOT now. After 0/0/0 starting point reached:

1. File a `docs/BACKLOG.md` row capturing this research item (P1 substrate, M effort).
2. Survey `docs/` for other single-writer shared files that face the same concern (the "class of concerns" framing).
3. Research the listed architecture options + any others discovered during survey.
4. Pick a pattern, document the migration plan, schedule the work.

For now: leave `docs/ROUND-HISTORY.md` in Category A (shared) as the current best guess, knowing it's a known weak spot under multi-writer pressure, and revisit with research before that pressure arrives.
