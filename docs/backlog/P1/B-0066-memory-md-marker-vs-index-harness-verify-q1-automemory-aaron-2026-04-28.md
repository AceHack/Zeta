---
id: B-0066
priority: P1
status: open
title: MEMORY.md marker-vs-index — verify harness contract + Q1 AutoDream/AutoMemory compatibility, then migrate (Aaron 2026-04-28)
tier: factory-hygiene
effort: M
ask: maintainer Aaron 2026-04-28 ("MEMORY.md do you think it's possible to just put like a marker in MEMORY.md that says memorys in memory/ and that would work? or it's more root to you than that and that would not work. It needs to work with the built in Q1 AutoDream/AutoMemory and your harness that we have the leaked source for? this would stop this from backing a hotspot too")
created: 2026-04-28
last_updated: 2026-04-28
composes_with: [B-0061, B-0067]
tags: [memory-md, factory-hygiene, hotspot, claude-code-harness, q1-automemory, auto-generated-index]
---

# MEMORY.md marker-vs-index — verify, then migrate

`memory/MEMORY.md` is currently a hand-maintained one-line-per-
file index that becomes a git-hotspot — every memory-adding
PR touches it, and sequential merges of PRs all touching it
cause the DIRTY cascade observed 2026-04-28T04:18Z (PR #72
went DIRTY after PR #36 merged, both touched MEMORY.md).

Aaron 2026-04-28 asked whether MEMORY.md could become a bare
marker pointing at `memory/`. The answer is "probably yes,
with a verified harness contract + an auto-generated index
to preserve at-wake quick-scan." This row tracks the work.

## Two services MEMORY.md provides today

1. **Directory marker** — at-wake the harness knows
   `memory/` exists and what filenames live there. Service
   could be replaced by `ls memory/*.md` at the harness
   layer.
2. **Quick-scan descriptions** — one-line `[**Title**](file.md)
   — description` rows let the agent decide WHICH memory to
   read deeply without reading them all. Each memory file
   has `description:` in YAML frontmatter, but scanning all
   ~1500 files at every wake is expensive vs. one
   pre-rendered MEMORY.md.

A pure marker keeps service (1) and loses service (2).

## Three options

### Option A — Pure marker (Aaron's question)

Replace MEMORY.md content with a short pointer:
```markdown
# Memory index

Memory files live under `memory/` (this directory).
Read frontmatter `description:` of each `memory/*.md`
for what each one covers, OR ask the agent to summarise
on demand.
```

**Pros:** zero git-hotspot. Simplest possible.
**Cons:** loses at-wake quick-scan; agent must scan all
~1500 files OR drill in blind. Cold-boot fresh sessions
lose substrate visibility.

### Option B — Auto-generated index (recommended)

Same shape as `docs/BACKLOG.md ← docs/backlog/` migration
(B-0061): MEMORY.md becomes an auto-generated index built
from each memory's frontmatter. A pre-commit hook
regenerates on any `memory/*.md` add or modify. Manual
edits to MEMORY.md are forbidden; the file becomes a
build artefact.

**Pros:** zero git-hotspot (the index regenerates
deterministically; merge conflicts auto-resolve via
regeneration). Preserves service (2) at-wake quick-scan.
Composes with the existing `tools/backlog/generate-
index.sh` pattern.
**Cons:** requires authoring the generator + the hook.
Ordering is no longer "newest first by hand" — needs to
derive ordering from frontmatter (e.g., `created:` field
descending).

### Option C — Status quo + git-rerere

Today's tick already recorded a `git rerere` resolution
for the additive-merge conflict shape on memory/MEMORY.md.
Future identical conflicts auto-resolve.

**Pros:** zero work, immediate.
**Cons:** rerere is per-clone, not committed to the repo.
Each new contributor's clone has to record its own
resolutions. Doesn't eliminate the hotspot, just
reduces friction for the maintainer.

## Phase plan (Option B)

### Phase 0 — Harness contract verification (S effort, prerequisite)

Aaron 2026-04-28: *"It needs to work with the built in Q1
AutoDream/AutoMemory and your harness that we have the
leaked source for."* This step is the verification.

- Clone the third-party Claude Code reference repo per
  the read-only-no-vendoring boundary in
  `feedback_search_internet_when_self_fixing_*` to
  `../claude-code` (sister directory).
- Inspect how the harness loads MEMORY.md:
  - Does the harness require a specific format (one-line
    bullets, link-targets, etc.) or does it just embed
    the file content into context?
  - Does AutoDream / AutoMemory write back to MEMORY.md
    in any specific format the agent must preserve?
  - What happens at session-start if MEMORY.md is a
    short pointer instead of a full index? Does the
    harness short-circuit or scan `memory/*.md` directly?
- Document findings in
  `docs/research/memory-md-harness-contract-2026-04-NN.md`.

### Phase 1 — Generator + hook (M effort)

- Author `tools/memory/generate-memory-index.sh` modelled
  on `tools/backlog/generate-index.sh`. Reads each
  `memory/*.md`, extracts `name:` + `description:` from
  frontmatter, emits a one-line-per-file index. **Sort
  order:** memory frontmatter only carries
  `name`/`description`/`type` (not `created:`), so sort by
  filename's embedded date stamp (most memory filenames
  end in `_YYYY_MM_DD.md`) descending, falling back to
  filesystem mtime, then alphabetical name. Phase 1
  also: extend the memory frontmatter spec to make
  `created:` optional but supported, so future files can
  use it for finer-grained ordering.
- Pre-commit hook: on any `memory/*.md` add or modify,
  regenerate `memory/MEMORY.md`.
- CI check: `tools/memory/generate-memory-index.sh
  --check` (drift detector) runs on every PR touching
  `memory/*.md`.

### Phase 2 — Cutover (M effort)

- Run the generator once to produce the new MEMORY.md.
- Diff against current to verify substrate-preservation
  (no entries lost, descriptions match).
- Land the cutover in a single commit.
- Document in `docs/research/` how the new pattern works
  + how to add new memories.

### Phase 3 — AutoDream / AutoMemory integration (S effort, ongoing)

- Verify after Phase 2 that AutoDream still writes to the
  expected location.
- If AutoDream expects to write to MEMORY.md directly,
  intercept those writes via the hook (treat them as a
  request to add a memory file + regenerate index).

## Done-criteria

- [ ] Phase 0 verification report shipped
      (docs/research/memory-md-harness-contract-*.md).
- [ ] tools/memory/generate-memory-index.sh lands +
      pre-commit hook + CI drift check.
- [ ] MEMORY.md becomes auto-generated; manual edits are
      forbidden by the hook.
- [ ] No regression in at-wake quick-scan service —
      fresh-boot Claude Code session reaches the same
      conclusions about what's in `memory/` as before.
- [ ] AutoDream / AutoMemory continues to function (or
      its writes are correctly intercepted).
- [ ] git-hotspot status of `memory/MEMORY.md` drops
      below the top-10 hotspot threshold in the cadenced
      detector (B-0067) within one round of cutover.
      (Note: cannot be 0 — the regenerator-on-every-
      memory-add commits MEMORY.md continuously by
      design. The threshold-based criterion is what's
      observable; 0 would be uncloseable.)

## Composes with

- **B-0061** — docs/BACKLOG.md monolith → per-row
  migration. Same problem class, same solution shape;
  the generator pattern transfers.
- **B-0067** — cadenced git-hotspot detection (filed
  alongside this row). The hotspot detector should
  highlight any other files exhibiting the same
  pattern (e.g., docs/hygiene-history/loop-tick-
  history.md, which also accumulates).
- `feedback_search_internet_when_self_fixing_*` — the
  Phase 0 verification uses the third-party Claude Code
  reference clone with the read-only-no-vendoring
  boundary.
- `feedback_natural_home_of_memories_is_in_repo_now_all_types_*`
  — the in-repo memory-canonical direction; this row
  refines HOW the in-repo memory directory works, not
  WHETHER.

## What this row does NOT do

- Does NOT recommend Option A (pure marker) without
  Phase 0 verification. The harness contract may
  require specific MEMORY.md structure.
- Does NOT delete any memory files. Memory content
  preservation is non-negotiable; only the index format
  changes.
- Does NOT touch user-scope MEMORY.md at
  `~/.claude/projects/<slug>/memory/MEMORY.md`. That
  file is per-user and outside the in-repo migration
  scope; the harness handles it separately.
