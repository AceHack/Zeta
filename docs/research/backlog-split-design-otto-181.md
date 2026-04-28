# BACKLOG.md Split — Design Proposal (Otto-181)

**Status:** research-grade proposal (pre-v1). Origin: Aaron
Otto-181 directive: *"BACKLOG.md-touching sibling we gonna
split it lol, :)"* followed by *"approved whenever you want
to do you this is the 3rd time i asked you even created a
git hot file detector to find other hot files as hygene"*.
Proposes splitting the single ~6100-line `docs/BACKLOG.md`
into a per-row file structure so the positional-append
conflict cascade (documented in Otto-171 queue-saturation
memory) stops happening by construction. Author: architect
review. Execution deferred to follow-up PR pending Aaron's
6 structural sign-off questions (§8).

**Factory already predicted this.**
`tools/hygiene/audit-git-hotspots.sh` exists on branch
`hygiene/git-hotspots-audit-tool-plus-first-run`
(**PR #213**, BEHIND since 2026-04-23). Tool header
explicitly names the remediation options it composes
with — BACKLOG-per-swim-lane split (the option this doc
designs) and CURRENT-maintainer freshness audit (the
analogous option for `memory/MEMORY.md` hotspots). The
factory foresaw this problem + built the detector +
identified the split as a remediation option + filed the
BACKLOG row naming the cadence (Aaron Otto-54 directive).
The gap between "detected" and "remediated" is execution.
This design doc is the bridge.

## 1. Problem statement

`docs/BACKLOG.md` is currently one file, ~6100 lines,
organized by priority section headers (P0 / P1 / P2 / P3)
with ~100+ individual rows as bullet-list entries. The
dominant write pattern is **append a new row to the tail
of a section**, because that's the lowest-friction
insertion point and preserves existing row order.

The failure mode (Otto-171 memory, observed directly
Otto-168 / Otto-177 / Otto-178):

- Multiple concurrent PRs each append a row near the
  same section tail (usually P2 research-grade or
  BACKLOG-file tail).
- When any one PR merges, the tail line numbers shift
  for all remaining siblings.
- Every sibling PR goes DIRTY (positional merge conflict).
- Resolution requires manual rebase or close+refile on
  a new branch (Otto-168 #334 → #341 is the canonical
  example that cost ~1 tick to resurrect).
- Observed impact Otto-177/178: 48-53 DIRTY PRs, most of
  them BACKLOG.md-appending siblings, blocking auto-merge
  drain.

The structural cause is "multiple-writer tail-append on
one file." The fix has to decouple concurrent writers —
each PR that adds a BACKLOG row should touch a file that
no other in-flight PR also touches.

## 2. Proposed structure — per-row files + generated index

```text
docs/
  BACKLOG.md                        ← generated index (short pointers)
  backlog/
    README.md                       ← schema + how-to-add-a-row guide
    P0/
      <id>-<slug>.md
      <id>-<slug>.md
    P1/
      <id>-<slug>.md
      ...
    P2/
      <id>-<slug>.md
      ...
    P3/
      <id>-<slug>.md
      ...
    _sections/                      ← section-level meta (intro copy, ordering)
      P0.md
      P1.md
      P2.md
      P3.md
```

### 2.1 Per-row file shape

Each row is its own file `docs/backlog/P<tier>/<id>-<slug>.md`:

```markdown
---
id: B-0042
priority: P2
status: open
title: Short-title-for-index
tier: research-grade
effort: S
directive: Aaron Otto-180
created: 2026-04-24
last_updated: 2026-04-24
composes_with:
  - B-0031-frontier-rename
  - B-0038-scientology-thematic
tags: [game-industry, sharding, multi-node]
---

# Server Meshing + SpacetimeDB — deep research on cross-shard communication patterns

...full existing row content...
```

**Key properties:**

- One PR adding a BACKLOG row = one NEW file created, zero
  other files touched. Merge-conflict probability → 0.
- YAML frontmatter machine-readable → index can be auto-
  generated + audited.
- Filename = stable ID + human-readable slug → grep-friendly.
- `composes_with` lists cross-row relationships explicitly
  (currently embedded in prose; lifting to metadata makes
  dependency traversal scriptable).
- `status: open | closed | superseded-by-<id>` replaces the
  current `- [ ]` / `- [x]` checkbox convention.

### 2.2 ID assignment

- Sequential: `B-0001` through `B-NNNN`, zero-padded 4
  digits (room for 9999 rows; can expand to 5 later).
- Assigned at PR-creation time by the author. Gap-filling
  allowed: if B-0042 is retired, B-0042 slot stays empty;
  next new row gets the next unused number.
- Auto-generator lint flags duplicate IDs at PR time.

### 2.3 The generated `docs/BACKLOG.md`

Stays the single entry-point doc but becomes an **index**:

```markdown
# Backlog Index

_Generated from `docs/backlog/**/*.md` frontmatter. Do not
edit by hand — edit the per-row file and regenerate._

## P0 — critical

- [ ] **[B-0003](backlog/P0/B-0003-secret-handoff.md)**
  Secret-handoff protocol — env-var default + password-manager CLI...
- ...

## P1 — within 2-3 rounds

- [ ] **[B-0007](backlog/P1/B-0007-hll-flakiness.md)**
  HLL property-test flakiness — investigate before retry (DST discipline)...
- ...
```

Each index entry is a link + the `title` field from the
frontmatter. Short (one-to-two lines per row). Keeps
BACKLOG.md grep-friendly for humans who want a quick tour,
without the 6100-line load.

Generator: `tools/hygiene/backlog-index-generate.sh` or
`.ts` — walks `docs/backlog/**/*.md`, parses frontmatter,
emits `docs/BACKLOG.md` sorted by priority then ID.
CI check: `backlog-index-drift.yml` fails if
hand-edited BACKLOG.md doesn't match regenerated output
(same pattern as memory-index-integrity.yml).

## 3. Migration plan

### 3.1 One-shot split (the actual work)

- **Phase 1 — tooling.** Write `backlog-index-generate`
  script + schema-lint + CI workflow. Land as a single PR
  that adds tooling but doesn't split content yet. The
  tool runs against an empty `docs/backlog/` and produces
  an empty index (sanity-check of the generator).
- **Phase 2 — content split.** Single large PR that:
  - Reads current `docs/BACKLOG.md`.
  - Parses each row heuristically (bullet-list items under
    priority headers).
  - Generates per-row files with frontmatter (title
    extracted from bold-lead, priority from section,
    directive from embedded "Aaron Otto-XXX" references,
    dates from available context).
  - Regenerates `docs/BACKLOG.md` as the index.
  - Manual review pass + hand-correct frontmatter where
    the heuristic missed (directive / effort / tags).
  This PR is enormous but it only lands once. After it,
  every subsequent backlog-add touches only the new per-
  row file.
- **Phase 3 — convention update.** Update
  `docs/CONTRIBUTING.md` (if exists) + `AGENTS.md`
  instructions so contributors add new rows via the new
  path. Script scaffold: `tools/hygiene/backlog-new-row
  --priority P2 --slug server-meshing-research` creates
  the file with frontmatter pre-filled.

### 3.2 Risk mitigation during split

- The Phase-2 mega-PR WILL conflict with every open
  BACKLOG-touching PR. Recommended sequencing:
  1. Announce intent (this PR / design doc).
  2. Aaron signs off on the structure.
  3. Wait for queue drain to <10 BACKLOG.md-touching PRs.
  4. Or: aggressive triage — close superseded siblings,
     resurrect essential ones via the new per-row format
     directly. Net: split PR lands with minimum conflict
     cost.
- Post-split: the positional-append problem disappears
  entirely. No tail. No shared-file append.

## 4. Alternatives considered

### 4.1 Per-priority-file split only (4 files)

`docs/BACKLOG-P0.md`, `BACKLOG-P1.md`, `BACKLOG-P2.md`,
`BACKLOG-P3.md`. Splits concurrent-writer load 4-way. Each
file still has a tail; positional conflicts still happen
within a priority tier, just less often. **Not recommended**
— doesn't solve the fundamental shared-tail-append
problem, just dilutes it.

### 4.2 Date-bucket split (quarterly or monthly)

`docs/backlog/2026-Q2.md`, `2026-Q3.md`, etc. Each quarter
gets a fresh file. Tail-append moves between files over
time but WITHIN a quarter the problem persists. Also
awkward for long-lived rows that span quarters. **Not
recommended**.

### 4.3 Hybrid: short rows inline, long rows extracted

Keep small rows as bullet-list items in BACKLOG.md; extract
only long multi-paragraph rows to separate files.
**Not recommended** — inconsistent convention, still has
tail-append problem for short rows, and small-rows-grow-
into-long-rows means constant migration churn.

### 4.4 Per-row files (proposed §2)

**Recommended.** Only option that eliminates the shared-
tail-append problem entirely. Upfront cost is significant
(Phase 2 mega-PR) but recurrent cost drops to zero.

## 5. Cost / benefit summary

| Dimension | Current | After split |
|-----------|---------|-------------|
| Lines per add | ~30-100 line edit on one shared file | 1 new file + 1-line index regeneration |
| Concurrent-writer conflicts | Common (53 DIRTY observed Otto-177) | None structurally |
| Discoverability | 6100-line grep | Per-file + generated index |
| Row cross-reference | Ad-hoc prose | `composes_with` frontmatter |
| Status tracking | `- [ ]` / `- [x]` checkbox | `status:` frontmatter enum |
| Retire / revive | Edit-in-place hard to track | File-deletion → `git log --diff-filter=D` recovers |
| Grep for all P1 | `sed` between headers | `ls docs/backlog/P1/` |
| Audit who added row | `git blame` one huge file | `git log docs/backlog/P2/B-NNNN-*.md` tight |
| Schema enforcement | None | Frontmatter lint + ID uniqueness |
| Effort to add a row | Trivial | Trivial (`backlog-new-row` scaffolder) |
| One-time migration cost | n/a | L (Phase-2 mega-PR) |

Break-even analysis: if we currently produce ~2-3
backlog-tail PRs per tick and 30%+ go DIRTY, and each
DIRTY costs ~1 tick to resurrect, the per-tick overhead
of the positional-conflict pattern is easily 50% of one
tick's capacity. Over ~40 ticks (one week at current
cadence) that's 20 ticks of resurrect-cost. The mega-PR
is 1-2 ticks of work. **Payback: one week.**

## 6. Composes with

- **Otto-171 queue-saturation memory** — documents the
  pattern this design fixes.
- **Memory-index-integrity workflow** — precedent for
  the generator + drift-CI pattern we'd apply to
  BACKLOG.md.
- **Existing retired-PR pattern** — file-deletion via
  `git log --diff-filter=D` as recoverable history (per
  CLAUDE.md "Honor those that came before — retired
  SKILL.md files retire by plain deletion, recoverable
  from git history").
- **`docs/definitions/KSK.md`** — precedent for
  per-concept files with YAML frontmatter.
- **ADR pattern** (`docs/DECISIONS/`) — precedent for
  per-decision files in a directory.
- **Skills** (`.claude/skills/*/SKILL.md`) — same
  per-unit-file-with-frontmatter pattern.

## 7. What this doc does NOT do

- Does **not** ship the split. Pure design + cost/benefit
  + structure proposal. Execution is a separate PR (or PR
  sequence).
- Does **not** pick the ID-numbering scheme unilaterally.
  Alternatives to consider: `B-NNNN` sequential; `<priority>-NNNN`
  (e.g. `P2-0042`); slug-only (no numeric ID at all).
  Aaron's call on which to adopt.
- Does **not** commit to Phase-2 happening before the
  current queue drains. The mega-PR will cascade-DIRTY
  every open BACKLOG PR; preferred to drain first.
- Does **not** constrain the generator's language (bash /
  TypeScript / F#); per FACTORY-HYGIENE cross-platform
  parity audit, TS via `bun` is preferred for long-term
  but bash via POSIX tools works for Phase-1 tooling.
- Does **not** retire BACKLOG.md. The file continues to
  exist as the top-level index; it just stops being the
  content container.
- Does **not** preempt any other doc migration. If
  ROUND-HISTORY.md has a similar tail-append pattern,
  that's a separate future migration with its own
  directive.

## 8. Questions for Aaron sign-off

Before Phase 1 tooling lands, decisions needed:

1. **ID scheme.** `B-NNNN` / `P<tier>-NNNN` / slug-only /
   other?
2. **Generator language.** Bash shell / TypeScript via
   `bun` / F# self-hosted?
3. **Phase-2 timing.** Before queue drains (accept the
   cascade) or after (drain first)?
4. **Retire-convention.** Delete the file, or move to
   `docs/backlog/_retired/` (per similar discussion on
   retired-skills)? Otto recommends delete + `git log
   --diff-filter=D` recovery per CLAUDE.md discipline.
5. **Auto-ID-assignment.** Factory tooling picks next
   unused ID, or manual?
6. **`composes_with` enforcement.** CI-lint that cross-
   referenced IDs exist, or best-effort?

## 9. Cross-references

- `docs/BACKLOG.md` — the current monolith (6100 lines).
- `memory/feedback_queue_saturation_throttle_ship_rate_
  under_ci_throughput_never_idle_switches_to_memory_
  reading_review_2026_04_24.md` — Otto-171 queue-
  saturation observation.
- `.github/workflows/memory-index-integrity.yml` — precedent
  generator + drift-CI pattern.
- `tools/hygiene/audit-cross-platform-parity.sh` —
  language-choice precedent (bash for tools with tight
  CI-integration fit).
- `docs/CONTRIBUTING.md` (if exists) — will need update
  Phase-3.
- `AGENTS.md` — will need update Phase-3 ("how to add a
  backlog row").
