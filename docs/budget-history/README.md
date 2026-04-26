# Budget history — evidence-based LFG burn tracking

This directory holds append-only snapshots of LFG's measurable cost
signals. It exists to gate the three-repo-split Stage 1 kickoff
(see `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
§Blockers) on **evidence**, not on hope or on a live UI graph that
vanishes when we stop looking.

## Why evidence-based

The human maintainer 2026-04-22:

> *"i want evidence based budgiting so you might have to build some
> observaiblity first or run some gh commands even if gh commands
> work we want some amount of price history in git, maybe just
> looking like before and after PRs on LFG and those measurements
> might be enough"*
>
> *"they have great graphs for the Humans with the live costs in
> real time, you can do what you think is best"*

The reframe: GitHub's billing UI gives humans live graphs, but the
factory needs persisted, machine-readable history. If the factory
proposes Stage 1 ("create `LFG/Forge` + `LFG/ace` with full
best-practice scaffolding") without evidence of current burn-rate,
a $0-designed-cost-stop could fire mid-swap (per
`memory/feedback_lfg_budgets_set_permits_free_experimentation.md`:
*"budget-enforced cap ≠ cost-invisible"*) and leave the factory
with three repos stood up but CI paused on all of them. Mid-swap
credit exhaustion is the specific failure mode the human maintainer named:
*"we don't want to run out of credits mid swap"*.

## What we capture

`snapshots.jsonl` is append-only. One JSON object per line. Git
commits are the time-axis. Each snapshot contains:

| Field | Source | Scope | What it tells us |
| --- | --- | --- | --- |
| `ts` | local wall clock (UTC) | — | When the snapshot was taken |
| `factory_git_sha` | `git rev-parse HEAD` | — | git SHA at snapshot time (whichever repo / fork the script runs in) |
| `org` | literal | — | Which org this covers |
| `note` | optional `--note` flag | — | Human annotation for unusual snapshots |
| `copilot_billing.seat_breakdown.total` | `/orgs/<org>/copilot/billing` | `read:org` | Total paid Copilot seats |
| `copilot_billing.plan_type` | same | `read:org` | `business` or `enterprise` |
| `repos[].agg.total_duration_ms` | `/repos/<r>/actions/runs/<id>/timing` × last-20 | current token | Aggregate CI wall-time over 20 most recent runs |
| `repos[].agg.billable_*_ms` | same | current token | Billable ms by OS; zero on public repos, non-zero when crossing included-minutes |
| `repos[].pr.recent_merged` | `/repos/<r>/pulls?state=closed&per_page=10` | `repo` | PRs merged in the recent window (denominator for per-PR math) |
| `repos[].pr.last_merged_at` | same | `repo` | Most recent merge timestamp — lets us delta-compare between snapshots |
| `repos[].last_20_runs[]` | `/repos/<r>/actions/runs` | `repo` | Per-run conclusion + timing — full granularity if we ever re-analyze |
| `scope_coverage.*` | literal | — | What this snapshot can and cannot see, by scope |

What we cannot see with current `gist, read:org, repo, workflow`
scopes: Actions-billing aggregate, Packages storage, shared-storage.
These need `admin:org`. The human maintainer can unlock them with
`gh auth refresh -s admin:org` if we later decide the partial view
is insufficient; the snapshot captures `scope_coverage.missing_requires_admin_org`
explicitly so the gap is legible.

## How to read burn from N snapshots

Each snapshot captures a point-in-time state. Burn rate comes from
**differences** between snapshots. The minimum-viable analysis:

1. **Per-PR duration delta** — `(snapshots[i+1].agg.total_duration_ms
   - snapshots[i].agg.total_duration_ms) / max(1, PRs_merged_between)`.
   For public-repo Ubuntu runners this is near-zero billable. For
   paid-MacOS runners (`AceHack/Zeta` fork workflow has a macOS-14
   leg) this is non-zero once included minutes exhaust.
2. **Copilot seat months** — `seats × plan_rate × fraction_of_month`.
   Currently 1 Business seat = $19/month prorated; snapshot-to-
   snapshot seat count changes are the trigger for cost-model
   recomputation.
3. **Projected runway** — given an estimated Stage 1-4 migration
   workload (≈N extra PRs / Actions-minutes / Copilot token burn),
   does remaining free-credit allowance cover it? If not, hold
   Stage 1 until (a) the workload estimate shrinks, (b) the human
   maintainer tops up free credits via another channel, (c) we
   switch to an Actions-minutes-frugal migration shape, or (d) the
   human maintainer triggers an Enterprise upgrade (the
   credit-exhaustion escape valve documented in the ADR).

`tools/budget/project-runway.sh` implements this projection. It
reads `snapshots.jsonl`, computes per-PR burn from the first-vs-last
snapshot delta, projects against a configurable Stages-1-4 PR count
(default 20), and emits both human-readable text and JSON. It
handles N=1 gracefully by reporting *"insufficient data — accumulate
more snapshots"* rather than producing a misleading projection.
Flags: `--stages N`, `--copilot-rate USD`, `--actions-free-ms MS`,
`--json`, `--file PATH`. Default parameters are tuned for
LFG/Zeta's current plan (Copilot Business $19/seat/mo, Team-plan
Actions 3000 min/month = 180000000 ms).

## When to snapshot

At minimum:

- **Before any Stage 1-4 migration commit** lands on LFG — establishes
  a pre-event baseline.
- **After each LFG merge** — captures the per-PR delta.
- **On a cadenced schedule** (weekly) — catches drift when no PRs
  are merging.

Opportunistic triggers:

- When the human maintainer asks "what's our burn look like" — run and diff vs
  the last commit to this file.
- When a check fails in a way that suggests quota exhaustion
  (`billing_required`, `actions_disabled`) — snapshot first, then
  diagnose.
- Before enabling a new paid feature (e.g., Copilot Enterprise)
  — pre-change anchor.

## What is NOT in this directory

- **Payment credentials.** Never. Snapshots capture consumption,
  not credit-card state.
- **Third-party billing amounts.** Per
  `memory/feedback_budget_amounts_ok_in_source_for_research.md`,
  the human maintainer explicitly scoped in-repo cost transparency
  to Zeta's own spend, not to any customer/vendor invoice.
- **Live projections.** Projections are computed on demand from the
  JSONL (a companion script `tools/budget/project-runway.sh` can
  live here later); the evidence is the substrate, projections are
  derived.

## Lifecycle

This substrate is **probationary** — it exists to unblock the
three-repo split. After Stage 1 + Stage 2 ship cleanly, we
re-evaluate:

- If the snapshots are valuable ongoing telemetry, promote to
  permanent hygiene (cadenced FACTORY-HYGIENE row + automated
  cadence via CI workflow post-`admin:org` unlock).
- If the snapshots were only load-bearing for the split gate and
  the UI graph suffices thereafter, retire the script + keep the
  JSONL frozen as a historical artifact (the research-artifact
  pattern per `memory/project_gitcrypt_rejected_2026_04_21_research_kept_as_rationale.md`).

Decision deferred to post-Stage-2 review, explicitly.

## Related

- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
  §Blockers — the ADR that drives this substrate
- `memory/feedback_lfg_budgets_set_permits_free_experimentation.md`
  — $0 budgets as designed cost-stops
- `memory/feedback_budget_amounts_ok_in_source_for_research.md`
  — policy authorizing dollar figures in-repo
- `memory/feedback_lfg_paid_copilot_teams_throttled_experiments_allowed.md`
  — LFG paid-plan context
- `tools/budget/snapshot-burn.sh` — the capture script
- `tools/budget/project-runway.sh` — the projection companion
- `tools/hygiene/snapshot-github-settings.sh` — sibling
  declarative-settings-as-code pattern (parallel tool shape)
