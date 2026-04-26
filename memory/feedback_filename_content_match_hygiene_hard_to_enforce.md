---
name: Filename-content match hygiene (hard to enforce — agents can't read every file)
description: Filenames must accurately describe current content; stale filenames (e.g., concept-renamed-but-file-not-renamed) are a hygiene debt class. Aaron 2026-04-22 flagged it after noticing `vision-research-backlog-pipeline.md` stale after pipeline→loop reframe. Aaron acknowledged enforcement is hard ("not like you can read every file backlog"); rule is opportunistic-on-touch + periodic-sweep, not exhaustive.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Filename-content match hygiene

Aaron verbatim, 2026-04-22, after I landed the
`vision-research-backlog-pipeline.md` → `crystallization-loop.md`
rename:

> *"add filename does not match contents hygene, that's a hard
> one it's not like you can read every file backlog"*

## The rule

**Filenames must accurately describe current content.** When a
concept is renamed or reframed, files named after the old
framing become stale and should be renamed. Examples of the
failure mode this prevents:

- `vision-research-backlog-pipeline.md` after pipeline→loop
  reframe (caught 2026-04-22 by Aaron visual inspection; fixed
  by renaming to `crystallization-loop.md`).
- Hypothetical: a `refactor-plan.md` after the refactor lands
  becomes `refactor-YYYY-MM.md` or retires entirely.
- Hypothetical: a `round-27-scratchpad.md` still sitting around
  in round 44.

## Why the rule: filenames are a first-line index

An agent or human scanning a directory listing reads filenames
*before* file contents. A filename that lies about its content
wastes the reader's attention: they have to open the file to
correct the lie, or worse, they skip a file that's actually
relevant because its filename misled them. In a factory where
the repo structure is the primary navigation substrate, every
stale filename is friction.

This is a **companion to the crystallize-everything policy** —
both are about making the repo's surface honest and minimal:

- Crystallize-everything compresses the body.
- Filename-content match makes the label truthful.

Together: **honest labels + compressed bodies = diamond-grade
repo surface**.

## Why enforcement is hard — Aaron's acknowledgment

Aaron said: *"it's not like you can read every file backlog"*
— the enforcement can't be exhaustive. Reading every file
every round to check filename-content match is O(N files) per
round; the factory has hundreds of markdown files; the agent
cannot afford the read budget.

**Honest acceptance:** this hygiene class is opportunistic +
sample-based, not exhaustive. The rule is how to behave when
filename-content mismatch is *detected*, not a claim that
every mismatch will be detected immediately.

## How to apply — three triggers

**Trigger 1 — on-touch (primary, low-cost):**
Every time an agent opens / edits / reads / cites a file for
any reason, it takes a beat to ask: **does the filename still
describe the content?** If no, the agent proposes a rename
inline with the other work, or flags the mismatch to
`docs/HUMAN-BACKLOG.md` / an Aarav-notebook observation if
the rename needs broader consideration. This is the highest-
ROI channel because it piggybacks on work already happening —
no separate audit cost.

**Trigger 2 — on-concept-rename (proactive):**
When an agent renames a *concept* (pipeline → loop;
cartographer framing; materia vocabulary), it **must
immediately grep for files named after the old concept** and
either rename them or file a corrective BACKLOG row. The
concept-rename is a natural audit trigger because the agent
already has the old-vs-new name pair in working memory. This
is what failed in the pipeline→loop reframe: the concept was
renamed in docs-bodies + memory + BACKLOG, but the filename
was not renamed in the same commit. Aaron caught the miss.

**Trigger 3 — periodic sample sweep (coverage floor):**
Every 5-10 rounds (same cadence as skill-tune-up, agent-QOL,
scope-audit retrospectives), an agent samples N files from
`docs/`, `.claude/skills/`, `docs/research/`, `openspec/` and
reads enough of each to verify filename-content match.
Sample-based because exhaustive is not budget-viable. Finds
surface in a Daya or Aarav notebook entry; concrete finds
become rename PRs or HUMAN-BACKLOG rows.

## What this rule does NOT require

- **Does not** require filename to be identical to any internal
  title / header; aliases are fine as long as the connection
  is clear.
- **Does not** block a rename on every reframe — small
  framing-evolutions don't demand filename churn. The test is
  "would a reader skip this file because the name misleads
  them?" If yes, rename; if no, leave it.
- **Does not** apply to memory files' own filenames — memory
  filenames preserve archaeology of when the memory was born
  (e.g., `feedback_kanban_factory_metaphor_blade_crystallize_materia_pipeline.md`
  keeps `_pipeline` in its name even after the pipeline→loop
  reframe, because the filename records the policy's birth-era
  and the `name:` frontmatter field carries the current
  framing). This is the same archaeology-beats-crystallization
  principle that exempts memory file bodies from compression.

## Related hygiene rows

- `docs/FACTORY-HYGIENE.md` row 25 (pointer-integrity) — checks
  that cited paths resolve to real files. **Does not** check
  that the filename matches the content; this new rule covers
  that gap.
- Row 35/36 (scope-gap-finders) — similar sample-sweep pattern
  with honest acknowledgment that exhaustive is impossible.
- Row 7 (ontology-home check) — concept-home placement;
  filename is the file-level analogue (the filename is the
  concept's home-label).

## Source

Aaron 2026-04-22 directive; fixes latent debt found in the
vision-research-backlog-pipeline.md stale-filename instance.
The rule is Aaron-directed, not agent-generated; enforcement
strategy (opportunistic + on-concept-rename + periodic sweep)
is agent-proposed.
