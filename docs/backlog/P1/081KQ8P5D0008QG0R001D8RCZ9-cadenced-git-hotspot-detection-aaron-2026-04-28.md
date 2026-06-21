---
id: 081KQ8P5D0008QG0R001D8RCZ9
priority: P1
status: closed
closed: 2026-05-07
closed_by: "Phase 3 triage routing exercised — all 20 hotspots triaged (already-tracked or acceptable-by-design)"
title: Cadenced git-hotspot detection — all 3 phases complete
tier: factory-hygiene
effort: S
ask: maintainer Aaron 2026-04-28 ("checking for git hotspots should be on some cadence somwhere. we can backlog this")
created: 2026-04-28
last_updated: 2026-05-03
depends_on: []
composes_with: [081KQ8P5D0008QG0R001BH93SA, 081KQ8P5D0008QG0R003KFRGJ0]
tags: [factory-hygiene, git-hotspot, cadence, structural-fix, audit, phase-1-2-landed]
---

# Cadenced git-hotspot detection

A git-hotspot is a single file touched by many PRs across
a short time window. Hotspots cause sequential merges to
DIRTY-cascade (each merge flips the next ones to require
manual rebase). Examples observed in this factory:

- `docs/BACKLOG.md` — 17,084-line monolith touched by
  every backlog-adding PR. Migration in progress (081KQ8P5D0008QG0R001BH93SA).
- `memory/MEMORY.md` — index touched by every memory-
  adding PR. Migration scoped (081KQ8P5D0008QG0R003KFRGJ0).
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

- Already-tracked (e.g., MEMORY.md → 081KQ8P5D0008QG0R003KFRGJ0,
  BACKLOG.md → 081KQ8P5D0008QG0R001BH93SA) → no action; status quo.
- Untracked → file a per-row backlog item documenting
  the hotspot + propose migration (per-row split,
  generator pattern, or other structural fix).
- Acceptable (generator output, append-only logs
  designed to grow) → add to the `--exclude` list with
  rationale comment.

## Done-criteria

- [x] Phase 1 detector landed at `tools/hygiene/audit-git-hotspots.ts` (TS+Bun port; `.sh` predecessor migrated). Default window 60d, top 20, excludes `docs/hygiene-history/` `openspec/changes/` `references/upstreams/`. Supports `--window N{d|w|m|y}` shorthand + raw approxidate strings.
- [x] **Latent bug found + fixed (2026-05-03)** during phase-2 wiring: the detector's `--window 60d` shorthand was passed verbatim to `git log --since=60d`, which is NOT a valid approxidate format and silently matched zero commits. Empirically caught when the cadence workflow's first run reported "no commits in window '60d' (or all filtered)" while the repo had 1274 commits in that window. Fix: `expandWindowShorthand()` translates `60d → "60 days ago"` at the script boundary so existing CLI syntax keeps working while git sees a string it can parse.
- [x] Phase 2 cadence wired at `.github/workflows/git-hotspot-cadence.yml` — weekly Sundays 16:43 UTC + workflow_dispatch + path-filtered PR trigger on the script + workflow file. Markdown report uploaded as 90-day workflow artifact. Modeled on `.github/workflows/budget-snapshot-cadence.yml`.
- [x] Phase 3 triage routing exercised (2026-05-07). 20 hotspots triaged:

**Already-tracked (no action needed):**

| File | Touches | Tracked by |
|------|---------|------------|
| memory/MEMORY.md | 362 | 081KQ8P5D0008QG0R003KFRGJ0 |
| docs/BACKLOG.md | 217 | 081KQ8P5D0008QG0R001BH93SA |

**Acceptable (by design — exclude-list candidates):**

| File | Touches | Rationale |
|------|---------|-----------|
| docs/github/prs/manifest.jsonl | 63 | Append-only PR archive manifest (generated by pr-archive-on-merge workflow) |
| CLAUDE.md | 34 | Session bootstrap — touched by rule additions; monolith-trim tracked at 081KQJZR90008QG0R002Z4B6VW |
| .github/workflows/gate.yml | 31 | CI config — touched by every CI improvement; 2 authors is healthy |
| memory/CURRENT-aaron.md | 29 | Per-maintainer distillation — by design refreshed frequently |
| docs/trajectories/typescript-bun-migration/RESUME.md | 25 | Active trajectory — touches decrease as migration completes |
| AGENTS.md | 21 | Universal onboarding — touched by rule additions; monolith-trim tracked at 081KQJZR90008QG0R002Z4B6VW |
| .gitignore | 20 | Accumulates exclusions; low conflict risk (append-only pattern) |
| docs/ROUND-HISTORY.md | 20 | Append-only history surface |
| docs/trajectories/typescript-bun-migration/slice-audits.md | 19 | Active trajectory log |
| docs/VISION.md | 18 | Terminal purpose doc — 7 PRs is moderate |
| docs/FACTORY-HYGIENE.md | 17 | Hygiene tracker — touched by rule additions |
| tests/Tests.FSharp/Tests.FSharp.fsproj | 17 | Project file — touched by every new test file; structural |
| docs/CURRENT-ROUND.md | 15 | Append-only round log |
| docs/backlog/P0/081KQ8P5D0008QG0R002XFQ305-*.md | 14 | Active work item — touches decrease when closed |
| src/Core/Core.fsproj | 14 | Project file — touched by every new source file; structural |
| docs/GLOSSARY.md | 13 | Append-only definitions |
| docs/active-trajectory.md | 12 | Refreshed periodically |
| docs/AGENT-BEST-PRACTICES.md | 12 | Rule additions; moderate touch rate |

**New hotspots requiring action:** None. All 20 findings are either already-tracked or acceptable-by-design. The detector is working; the factory's hotspot surface is well-understood.

## Composes with

- **081KQ8P5D0008QG0R001BH93SA** — docs/BACKLOG.md monolith→per-row
  migration. The detector should validate that the
  migration is reducing the BACKLOG.md hotspot.
- **081KQ8P5D0008QG0R003KFRGJ0** — MEMORY.md marker-vs-index. The detector
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
