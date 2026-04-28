# Trajectories — open-ended improvement tracks

A **trajectory** is an open-ended discipline where the bar is
"keep improving + don't go stale," not "finish a backlog row."
Each trajectory has a current state, a target state, what's left,
a cadence, and a future forecast. Trajectories are world-modeled
so future-Otto can answer *"how's it going with X?"* by reading
the trajectory file rather than re-deriving from scratch.

> Maintainer 2026-04-28: trajectories vs swim lanes — *"swim
> lanes we already have the concept for but these seems to have
> future forcats and stuff world modeling almost are trajectoris
> and swim lanes are just orginization."*

Distinction:

| | Swim lane | Trajectory |
|---|---|---|
| Purpose | Organize related work items | World-model an open-ended discipline |
| Time horizon | Current backlog | Past + present + forecast |
| State | "What's queued" | "Where we are vs target, what's left, what's coming" |
| Cadence | Ad-hoc | Recurring research/update beat |
| Owner | Implicit (whoever picks up the row) | Named (the trajectory has a steward) |
| Termination | Backlog row closes | Never (or only on retirement) |

## Trajectory schema

Every trajectory file under `docs/trajectories/*.md` has six
sections (in this order):

1. **Scope** — what discipline does this trajectory cover; what's
   the ongoing-improvement target?
2. **Cadence** — how often does the trajectory get updated; what
   triggers a refresh?
3. **Current state** — with a timestamp. What's deployed today;
   what's the current coverage / quality / depth?
4. **Target state** — where we're aiming. Beacon-safe naming for
   the goal; concrete enough to know when we hit it.
5. **What's left** — gap between current and target; ordered by
   leverage when possible.
6. **Recent activity + forecast** — last few updates (date +
   one-line); next 1-3 months (what's coming, what to watch).

Optional sections:

- **Pointers** — related skills, BACKLOG rows, ADRs, memories.
- **Decisions log** — major direction calls, with dates.

## Active trajectories

| Name | File | Steward | Cadence | Last refresh |
|---|---|---|---|---|
| Static analysis | [static-analysis.md](trajectories/static-analysis.md) | Otto + maintainer | per-tool research weekly; gap audit monthly | 2026-04-28 |
| Formal analysis | [formal-analysis.md](trajectories/formal-analysis.md) | Soraya (formal-verification-expert) | per-property review monthly; tool radar quarterly | 2026-04-28 |
| OpenSpec specs | [openspec-specs.md](trajectories/openspec-specs.md) | Otto + spec-zealot | per-capability when spec churns; full audit monthly | 2026-04-28 |
| Documentation | [docs.md](trajectories/docs.md) | Otto + Samir (documentation-agent) | per-PR (touched-files); hot-file audit weekly | 2026-04-28 |
| Memory hygiene | [memory-hygiene.md](trajectories/memory-hygiene.md) | Otto + claude-md-steward | per-memory-file (paired with index); monthly index audit | 2026-04-28 |
| Skill ecosystem | [skill-ecosystem.md](trajectories/skill-ecosystem.md) | Aarav (skill-tune-up) + Yara (skill-improver) | per-5-10-rounds tune-up; per-gap-finder invocation | 2026-04-28 |
| CI/CD infrastructure | [ci-infrastructure.md](trajectories/ci-infrastructure.md) | Dejan (devops-engineer) + Otto | per-workflow-edit; per-incident; weekly cost/duration review | 2026-04-28 |

(Add a row when a new trajectory lands; never remove rows —
retired trajectories get a "Retired" status in the file head.)

## How to use

When asked *"how's it going with X?"* where X is a trajectory:

1. Open the trajectory file.
2. Read **Current state** (where we are now).
3. Read **What's left** (the gap to target).
4. Read **Forecast** (what's coming + what's blocking).
5. Answer in 2-3 sentences citing the file.

If the trajectory file is older than its cadence, refresh it
before answering — staleness is the failure mode.

## Adding a new trajectory

When a swim lane reveals open-ended-improvement shape (new tools
emerge, current state changes meaningfully over time, "how's it
going" is a recurring question), promote it to a trajectory:

1. Create `docs/trajectories/<name>.md` with all 6 sections.
2. Add an Active-trajectories row above.
3. Cite the trajectory in the related skill / BACKLOG row /
   memory so future readers find it.

## What this is NOT

- Not a tracker for one-shot tasks (those go in BACKLOG).
- Not a way to avoid actually doing the work (the trajectory
  documents the work; it doesn't replace it).
- Not a substitute for swim lanes — both coexist (trajectories
  for open-ended disciplines, swim lanes for current-PR
  organization).
