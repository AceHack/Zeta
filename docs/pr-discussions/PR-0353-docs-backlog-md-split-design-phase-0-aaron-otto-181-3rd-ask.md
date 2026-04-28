---
pr_number: 353
title: "docs: BACKLOG.md split design \u2014 Phase 0 (Aaron Otto-181, 3rd ask; PR #213 hot-file detector referenced)"
author: AceHack
state: MERGED
created_at: 2026-04-24T10:22:21Z
merged_at: 2026-04-24T10:24:02Z
closed_at: 2026-04-24T10:24:02Z
head_ref: docs/backlog-split-design-otto-181
base_ref: main
archived_at: 2026-04-24T11:22:16Z
archive_tool: tools/pr-preservation/archive-pr.sh
---

# PR #353: docs: BACKLOG.md split design — Phase 0 (Aaron Otto-181, 3rd ask; PR #213 hot-file detector referenced)

## PR description

## Summary

Aaron Otto-181: *"BACKLOG.md-touching sibling we gonna split it lol, :)"* + *"approved whenever you want to do you this is the 3rd time i asked you even created a git hot file detector to find other hot files as hygene"*.

**Recognition of 3rd ask + factory already predicted this:** `tools/hygiene/audit-git-hotspots.sh` exists on branch `hygiene/git-hotspots-audit-tool-plus-first-run` (PR #213, BEHIND since 2026-04-23). Tool explicitly names "BACKLOG-per-swim-lane split" as a remediation option. This PR is the design bridge between "detected" and "executed."

## Structure proposed

Per-row YAML-frontmatter files at `docs/backlog/P<tier>/B-NNNN-<slug>.md` + generated `docs/BACKLOG.md` index + drift-CI workflow (same pattern as memory-index-integrity).

- Each PR adding a row = one new file
- Zero shared-file touch → zero positional-append conflict
- Eliminates the DIRTY-cascade documented in Otto-171 queue-saturation memory

## Phased execution

| Phase | Scope | Cost |
|---|---|---|
| 0 (this PR) | Design doc + 6 open questions | — |
| 1 | Tooling (index generator + schema lint + CI drift) | S |
| 2 | Content split mega-PR | L (one-time) |
| 3 | Convention updates + `backlog-new-row` scaffolder | S |

## 6 open questions for Aaron

1. ID scheme (`B-NNNN` / `P<tier>-NNNN` / slug-only)
2. Generator language (bash / bun+TS / F#)
3. Phase-2 timing (before or after queue drains)
4. Retire convention (delete vs `_retired/`)
5. Auto-ID assignment (factory tooling vs manual)
6. `composes_with` CI-lint enforcement (strict vs best-effort)

## Cost / benefit

Break-even: current positional-conflict overhead is ~50% of one tick's capacity (Otto-177 observed 53 DIRTY siblings). Mega-PR is 1-2 ticks. **Payback: one week.**

## Other hot files to consider after

`ROUND-HISTORY.md` / `loop-tick-history.md` / `FACTORY-HYGIENE.md` / `memory/MEMORY.md` / `TECH-RADAR.md` — run detector first, don't split blindly.

## Test plan

- [x] Markdownlint clean.
- [x] Research-grade; Phase 2 execution deferred to Aaron sign-off.
- [x] No code / workflow / BACKLOG changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-04-24T10:25:39Z)

## Pull request overview

Adds a research-grade design proposal for splitting `docs/BACKLOG.md` into per-row files with a generated index, aiming to eliminate frequent merge conflicts caused by concurrent tail-appends.

**Changes:**
- Introduces a Phase-0 design document proposing `docs/backlog/P<tier>/<id>-<slug>.md` per-row files with YAML frontmatter.
- Proposes generating `docs/BACKLOG.md` as an index and enforcing drift via CI (modeled after memory-index workflows).
- Captures a phased migration plan plus open sign-off questions for structure/tooling choices.

## Review threads

### Thread 1: docs/research/backlog-split-design-otto-181.md:13 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T10:25:37Z):

P1: This doc uses direct contributor name attribution (e.g., “Aaron …”) in the body. Repo standing rule is to avoid names in code/docs/skills and use role references (e.g., “human maintainer”, “architect”), keeping names only in `memory/persona/**` and optionally `docs/BACKLOG.md` for specific requests (docs/AGENT-BEST-PRACTICES.md:284-292). Please rewrite these references to role-based phrasing while retaining the Otto-### directive IDs if needed.

### Thread 2: docs/research/backlog-split-design-otto-181.md:33 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T10:25:37Z):

P2: The document claims `docs/BACKLOG.md` is “~6100 lines”, but in the current repo it is 7658 lines. Suggest avoiding a hard number (e.g., “7k+ lines”) or updating the figure so the justification doesn’t drift immediately.

### Thread 3: docs/research/backlog-split-design-otto-181.md:254 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T10:25:38Z):

P1: The cost/benefit table appears to have malformed Markdown syntax: rows start with `|| ...`, which renders as an empty first column (`| | ...`) in standard Markdown. Consider converting these rows to normal `| ... | ... |` table syntax so the table renders correctly in GitHub.

### Thread 4: docs/research/backlog-split-design-otto-181.md:22 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T10:25:38Z):

P1: This section states `tools/hygiene/audit-git-hotspots.sh` exists, but that file is not present in the current repository tree. If it’s only in PR #213 / another branch, please rephrase to reference the PR (or add a link) rather than implying the path exists on main, otherwise readers will hit a dead link.

### Thread 5: docs/research/backlog-split-design-otto-181.md:282 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T10:25:38Z):

P1: `docs/definitions/KSK.md` is referenced here as an existing precedent, but `docs/definitions/` does not exist in the repo right now. Please update this cross-reference to a file that exists (or to the BACKLOG row / PR that will introduce KSK.md) so the precedent claim is accurate.
```suggestion
- **Planned definitions-file pattern** — if a follow-up
  PR introduces `docs/definitions/KSK.md`, that would be
  a companion example of per-concept files with YAML
  frontmatter rather than an in-tree precedent today.
```

### Thread 6: docs/research/backlog-split-design-otto-181.md:337 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T10:25:38Z):

P1: The referenced memory file `memory/feedback_queue_saturation_throttle_ship_rate_under_ci_throughput_never_idle_switches_to_memory_reading_review_2026_04_24.md` does not exist in `memory/`. Please correct the filename/path (or reference the closest existing memory) so this cross-reference is resolvable.
```suggestion
- Otto-171 queue-saturation memory entry (2026-04-24) —
  queue-saturation observation.
```
