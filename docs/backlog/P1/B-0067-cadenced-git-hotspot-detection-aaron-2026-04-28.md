---
id: B-0067
priority: P1
status: open
title: Cadenced git-hotspot detection — find files-touched-by-many-PRs and migrate to per-row format (Aaron 2026-04-28)
tier: factory-hygiene
effort: S
ask: maintainer Aaron 2026-04-28 ("checking for git hotspots should be on some cadence somwhere. we can backlog this")
created: 2026-04-28
last_updated: 2026-04-28
composes_with: [B-0061, B-0066]
tags: [factory-hygiene, git-hotspot, cadence, structural-fix, audit]
---

# Cadenced git-hotspot detection

A git-hotspot is a single file touched by many PRs across
a short time window. Hotspots cause sequential merges to
DIRTY-cascade (each merge flips the next ones to require
manual rebase). Examples observed in this factory:

- `docs/BACKLOG.md` — 17,084-line monolith touched by
  every backlog-adding PR. Migration in progress (B-0061).
- `memory/MEMORY.md` — index touched by every memory-
  adding PR. Migration scoped (B-0066).
- `docs/hygiene-history/loop-tick-history.md` — touched
  by every autonomous-loop tick close.
- (potential) `docs/ROUND-HISTORY.md` — touched by every
  round close.
- (potential) `CURRENT-aaron.md` / `CURRENT-amara.md` —
  refreshed periodically; less hotspot-y but still
  shared-write.

The structural fix for any hotspot is the per-row split
pattern (see `docs/BACKLOG.md` → `docs/backlog/PN/B-NNNN-
*.md` migration). But you can't migrate what you don't
detect.

This row tracks a **cadenced detector** that audits the
git history for hotspots + flags them for triage.

## Detection mechanism

Simple `git log` analysis:

```bash
# Files touched by 5+ commits in the last 100 commits:
git log --name-only --pretty=format:"" -n 100 \
  | sort | uniq -c | sort -rn \
  | awk '$1 >= 5 { print }'
```

A more refined version weights by:

- **Touch count** — primary signal.
- **Distinct authors / agents** — same-author hotspot is
  often acceptable (e.g., a generator's output); multi-
  author hotspot is the merge-cascade-prone shape.
- **Conflict history** — files where merge conflicts
  actually happened (queryable via `git rerere` or
  reflog) are the real hotspots, not just touch-frequent
  ones.

## Scope

### Phase 1 — Detector script (S effort)

`tools/hygiene/audit-git-hotspots.sh`:

- Default window: last 100 commits.
- Default threshold: 5+ touches.
- Output: ranked list `<count>  <path>` to stdout.
- `--enforce` flag: exit non-zero if any file exceeds a
  configurable hard cap (e.g., 20 touches).
- `--exclude` flag: ignore listed paths (for known-
  acceptable hotspots like generator output).

### Phase 2 — Cadence (S effort)

Wire the detector into one of:

- A scheduled GitHub Actions workflow (weekly?). On
  hotspot detection, opens an issue or comments on the
  P1 backlog index.
- An autonomous-loop tick task: every Nth tick (~10?),
  run the detector + log findings to
  `docs/hygiene-history/git-hotspot-audit-YYYY-MM-DD.md`.

### Phase 3 — Triage routing (S effort)

For each detected hotspot:

- Already-tracked (e.g., MEMORY.md → B-0066,
  BACKLOG.md → B-0061) → no action; status quo.
- Untracked → file a per-row backlog item documenting
  the hotspot + propose migration (per-row split,
  generator pattern, or other structural fix).
- Acceptable (generator output, append-only logs
  designed to grow) → add to the `--exclude` list with
  rationale comment.

## Done-criteria

- [ ] Phase 1 detector lands at
      `tools/hygiene/audit-git-hotspots.sh` with default
      window + threshold + exclude list.
- [ ] Phase 2 cadence wired (workflow OR auto-loop task);
      first audit shipped as evidence.
- [ ] Phase 3 routing triggered at least once on a real
      hotspot finding (validates the loop closes).

## Composes with

- **B-0061** — docs/BACKLOG.md monolith→per-row
  migration. The detector should validate that the
  migration is reducing the BACKLOG.md hotspot.
- **B-0066** — MEMORY.md marker-vs-index. The detector
  should validate that the migration (if it lands)
  reduces the MEMORY.md hotspot.
- `feedback_orthogonal_axes_factory_hygiene.md` — Aaron's
  framing: factory-hygiene rules sit on orthogonal axes.
  The hotspot detector is one such axis (process-axis
  audit) that triggers structural-fix migrations on
  another axis (substrate-axis change).

## What this row does NOT do

- Does NOT auto-migrate hotspots. Detection + triage
  routing only; the actual structural fix is a per-
  hotspot decision (per-row split / generator pattern /
  exclude-list with rationale).
- Does NOT replace the per-hotspot tracking rows. Each
  detected hotspot still gets its own backlog row with
  done-criteria.
- Does NOT cap hotspot count at zero. Some files (tick-
  history append logs by design) are acceptable
  hotspots; the cap exists to flag NEW unintentional
  hotspots, not to forbid all multi-touch files.
