# First Trajectory Drift Report Table Shape

Status: table-shape draft for the report-only trajectory drift lane.
Date: 2026-05-28.

## Purpose

The first trajectory drift report needs a stable table shape before any script
tries to produce it. The report is evidence, not an automatic rewrite. It
compares committed substrate against the current trajectory packet set and
surfaces reviewable drift candidates.

## Inputs

- `docs/trajectories/*/RESUME.md` for the declared packet state.
- Recent `origin/main` commits for landed work signals.
- Open PR heads and active `origin/claim/*` refs for current ownership
  signals.
- Optional local broadcasts only as supporting context, never as authority.

## Report Table

| Column | Meaning | Required evidence |
|---|---|---|
| `trajectory` | Packet path under `docs/trajectories/`. | Exact `RESUME.md` path. |
| `declared_state` | Current status, blocker, and next action stated by the packet. | Quoted or line-referenced packet text. |
| `observed_signal` | Recent commit, PR, claim, or workflow evidence that bears on the packet. | Commit SHA, PR number, claim ref, or workflow/job URL. |
| `drift_class` | The smallest useful classifier for the mismatch, or `none`. | One classifier from the list below. |
| `recommended_next_action` | Report-only suggestion for a future claim or review. | One bounded action with path scope. |
| `owner_surface` | Current path owner, if any. | Open PR head, active claim ref, or `none observed`. |

## Drift Classes

- `none`: declared state matches observed evidence.
- `stale_next_action`: the packet asks for work already landed or superseded.
- `missing_next_action`: the packet has no bounded next action.
- `blocked_without_owner`: the packet names a blocker but no live owner or
  path surface is visible.
- `owned_elsewhere`: the packet's next path is already owned by an open PR or
  active claim.
- `evidence_gap`: the packet makes a state claim without a resolvable substrate
  pointer.

## First Report Rules

1. A row may recommend work, but it must not edit the trajectory packet.
2. A row must cite at least one durable substrate signal.
3. A row with `owned_elsewhere` must name the owner surface instead of
   proposing a competing claim.
4. A row with `stale_next_action` must identify the landed or superseding
   evidence.
5. A row with `missing_next_action` may recommend decomposition, not
   implementation.

## Focused Check

The first manual report can be validated without a new tool:

```bash
rg -n "Status|Current blocker|Next concrete action|Recommended Next Action|Current Next Action" docs/trajectories -g RESUME.md
gh pr list --state open --json number,headRefName,title,files
git branch -r --list 'origin/claim/*'
```

Automation should wait until this table has survived at least one manual report
and one review pass.
