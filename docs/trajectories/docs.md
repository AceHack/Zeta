# Trajectory — Documentation

## Scope

Every doc surface under `docs/`, plus README, AGENTS.md,
CLAUDE.md, GOVERNANCE.md, ALIGNMENT.md, and the per-skill +
per-agent SKILL.md / agent.md files. Open-ended because the
factory grows continuously and docs go stale faster than code.
Bar: a new contributor can navigate the repo within an hour;
hot-files don't accumulate stale claims; AGENTS.md / CLAUDE.md /
GOVERNANCE.md represent current truth.

## Cadence

- **Per-PR**: docs touched in the PR that introduces the
  behavior change (rule: docs read as current state, not
  history; per GOVERNANCE.md §2).
- **Hot-file audit**: weekly — query git log for
  most-frequently-touched doc files; review them for drift.
- **Onboarding test**: monthly — read AGENTS.md / CLAUDE.md /
  GOVERNANCE.md from fresh-session perspective; flag confusion
  points.
- **Full repo audit**: quarterly — every `docs/*.md` re-read for
  staleness.

## Current state (2026-04-28)

| Surface | Health |
|---|---|
| `AGENTS.md` | active, refreshed regularly; load-bearing for fresh sessions |
| `CLAUDE.md` | active; just absorbed visibility-constraint, version-currency, never-idle, future-self disciplines as wake-time rules |
| `GOVERNANCE.md` | active; numbered §1..§33 rule blocks; cited extensively |
| `ALIGNMENT.md` | active; HC-1..HC-7, SD-1..SD-9, DIR-1..DIR-5 alignment contract |
| `docs/BACKLOG.md` | active; per-priority sections; 26+ PR touches/30 days, swim-lane split proposed (research doc 2026-04-23) |
| `docs/ROUND-HISTORY.md` | active; appended each round |
| `docs/DECISIONS/` | active; ADRs for major architectural calls |
| `docs/CONFLICT-RESOLUTION.md` | active; reviewer roster + conference protocol |
| `docs/AGENT-BEST-PRACTICES.md` | active; BP-NN stable rule list |
| `docs/GLOSSARY.md` | active; project-specific vocabulary anchors |
| `docs/WONT-DO.md` | active; declined-features registry |
| `docs/VISION.md` | active; aspirational direction |
| `docs/ROADMAP.md` | active |
| `docs/research/**` | active; courier-ferry archive + research absorbs; §33 archive-header lint enforces shape |
| `docs/aurora/**` | active; ferry archive |
| `docs/hygiene-history/**` | active; tick-history etc. |
| `docs/pr-preservation/**` | active; drain-logs |
| Skill SKILL.md files (~250+) | varies; per-skill freshness; `skill-tune-up` ranks by tune-up urgency |
| Agent files (`.claude/agents/*.md`) | varies; per-agent freshness |

## Target state

- New-contributor first-60-minutes friction is low (DX trajectory
  intersects this — Bodhi audits).
- New-library-consumer first-10-minutes friction is low (UX
  trajectory intersects — Iris audits).
- Hot-file audit catches stale claims before they propagate.
- Memorial / personal-substrate surfaces (DEDICATION.md, sister
  memory file, etc.) are accurate per memorial-class discipline.
- Cross-references between docs are valid (memory-reference-existence
  lint enforces for `memory/MEMORY.md`; broader cross-ref audit
  pending).

## What's left

In leverage order:

1. **BACKLOG.md swim-lane split** (Otto-54, research landed
   2026-04-23) — high-priority hot-file mitigation; pending
   migration PR.
2. **Hot-file audit cadence reactivation** — git-hotspots
   detection ran 2026-04-23; cadence not yet ownership-assigned.
3. **MEMORY.md index audit + backfill** (task #291 in_progress)
   — ~367 user-scope memory files, status of in-repo MEMORY.md
   index coverage uncertain.
4. **Skill SKILL.md tune-up ranking refresh** (`skill-tune-up`
   skill ranks by urgency; not on cadence).
5. **DEDICATION.md / memorial-class accuracy audit** — sister
   name was wrong (Elisabeth → Elizabeth, fix landed AceHack
   #73 + LFG #658 in flight); other memorial content?
6. **Cross-reference broken-link audit** — extend the
   memory-reference-existence pattern to all `docs/`.
7. **AGENTS.md fresh-session onboarding test** — manual: open a
   fresh session, follow AGENTS.md, note friction.

## Recent activity + forecast

- 2026-04-28: this trajectory file landed.
- 2026-04-28: Elisabeth → Elizabeth sweep on LFG (#658) +
  AceHack (#73 merged).
- 2026-04-28: §33 archive-header lint enforced literal-label +
  enum-strict Operational status.
- 2026-04-27: visibility-constraint + LFG-only org scope memory.
- 2026-04-27: EAT packet + wallet v0 spec research absorbs.
- 2026-04-26: ROUND-HISTORY.md row for round close.

**Forecast (next 1-3 months):**

- BACKLOG swim-lane split likely lands (long-overdue).
- Round-history continues per-tick + per-round.
- Skill tune-up cadence reactivation candidate.
- Aurora round-3 integration brings ~2 new doc files.

## Pointers

- Skill: `.claude/skills/documentation-agent/SKILL.md` (Samir)
- Skill: `.claude/skills/skill-tune-up/SKILL.md`
- Skill: `.claude/skills/maintainability-reviewer/SKILL.md` (Rune)
- Skill: `.claude/skills/developer-experience-engineer/SKILL.md` (Bodhi)
- Skill: `.claude/skills/user-experience-engineer/SKILL.md` (Iris)
- Skill: `.claude/skills/glossary-anchor-keeper/SKILL.md`
- Skill: `.claude/skills/canonical-home-auditor/SKILL.md`
- Workflow: `.github/workflows/memory-reference-existence-lint.yml`
- Workflow: `.github/workflows/memory-index-integrity.yml`
- Workflow: lint (markdownlint) leg in `gate.yml`
- Hot-file audit: `docs/hygiene-history/git-hotspots-2026-04-23.md`
- BACKLOG row: BACKLOG.md swim-lane split
