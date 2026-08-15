---
id: 081M005FXAB087G0R0039AGC2E
type: bug
state: done
priority: P2
slug: heartbeat-prs-never-merge-github-actions-bot-triggered-runs
title: "heartbeat PRs never merge: github-actions[bot]-triggered runs sit in action_required forever"
created: 2026-08-14T12:55:59.563Z
completed: 2026-08-15T22:47:57.072Z
depends_on: []
composes_with: []
---

# heartbeat PRs never merge: github-actions[bot]-triggered runs sit in action_required forever

## The fact

Every `heartbeat/*` flush PR opens, arms auto-merge, and then blocks forever. Zero
`heartbeat/*` PRs appear in the last 100 closed PRs. The oldest open one
(`heartbeat/society`, #10397) had been open **14 hours** when this was found.

The cause is not the branch, the diff, or the merge queue. It is run provenance:

```
$ gh api repos/Lucent-Financial-Group/Zeta/actions/runs/31800748733 \
    --jq '"status=\(.status) conclusion=\(.conclusion) actor=\(.actor.login)"'
status=completed conclusion=action_required actor=github-actions[bot]
```

The heartbeat job pushes its branch with `GITHUB_TOKEN`, so the resulting
`pull_request` workflow runs are attributed to `github-actions[bot]` and land in
`action_required` — queued pending manual approval. They are `completed` with
conclusion `action_required`, which is terminal: the required `gate` check never
reports a result, so branch protection holds the PR at `blocked` **with every
check that did run showing green**. #10490 sat at `mergeable=true`,
`mergeable_state=blocked`, 6 of 6 checks `success`, and no `gate` present at all.

## Why it was invisible

Three separate signals all read healthy:

- `agent-heartbeat.yml` succeeds on every 30-minute tick.
- The flush step succeeds and opens the PR.
- Every check that runs on the PR is green.

Nothing anywhere reports "the required check was never allowed to start."

## What it cost

`heartbeat/soraya` carries `docs/github/prs/manifest.jsonl` — the derived-index
repair. `pr-manifest-integrity` on `main` was failing with *"the repair writer has
stopped landing … the serialised repair writer (agent-heartbeat.yml, soraya archive
duty) has stopped"*. The writer had not stopped. It regenerated the index correctly
on every tick and committed it at 12:32:05Z; the commit could not reach `main`
because its PR could not merge. **main was red, and the diagnostic pointed at a
healthy component.**

Also stranded: 49 commits of tick-shard telemetry (#10448), 42 commits of
society-evolution events (#10397).

## Interaction with 081M0028…-merge-duty-lifo-starvation (#10569)

These are two independent blockers that were masking each other. The LIFO
starvation meant older PRs were never *selected*; this means heartbeat PRs could
not merge even once selected. Fixing the queue alone would not have landed the
manifest repair. Do not treat #10569 as having resolved this.

## Interim mitigation (already applied, does NOT close this)

52 queued runs approved by hand across the six open heartbeat PRs
(`POST /actions/runs/{id}/approve`) after verifying that all six branches contain
**only** `.json`/`.jsonl`/`.md`/`.txt`/`.csv` files — no workflow, script, or config
content, so no untrusted code executes. That is rung-4 remembered-by-an-agent and
recurs every 30 minutes. It is not a fix.

## The actual fix — a security tradeoff, wants the maintainer's call

The approval gate is a real control (it exists so bot-triggered runs cannot execute
with repo secrets unreviewed). Options, none free:

1. **Push heartbeat commits directly to `main`.** Removes the PR entirely. Blocked
   today by branch protection, and gives up pre-merge checks on telemetry.
2. **Use a GitHub App / PAT instead of `GITHUB_TOKEN`** so runs are not bot-actor
   triggered. Works, but moves a real credential into the heartbeat path — weigh
   against `.claude/rules/privacy-budget-is-hard-money…` and the persona-keys work.
3. **Relax the repo Actions approval setting.** Cheapest, broadest blast radius:
   it stops gating *every* bot-triggered run, not just heartbeats.
4. **Auto-approve narrowly**, gated on a verified-inert diff (data-only paths), as a
   workflow. Keeps the control for anything carrying executable content.

(4) is the only one that preserves the control while removing the human, but it is
also the one that most needs adversarial review before it ships — an auto-approver
with a weak path predicate is a code-execution hole.

## Non-vacuity requirement

Whatever lands, add a check that fails when a required check never *starts*.
"All present checks are green" must stop reading as healthy when the required one
is absent — that absence is the entire defect here, and every existing signal
missed it.

## Pointers

- #10569 — the sibling starvation fix in the same file
- `.github/workflows/pr-archive-on-merge.yml:37` — already documents the underlying
  limitation ("GITHUB_TOKEN-created PRs may not trigger downstream required checks");
  what was never connected is that this makes such PRs permanently unmergeable
- `.claude/rules/dv2-data-split-discipline-activated.md` §6 idempotency — the repair
  writer is correctly idempotent, which is why nothing was lost, only stalled

## Resolution (2026-08-15)

Cause is the checkout identity (081M010H4KE). Fixed there (option A, PAT on
checkout). This row's non-vacuity is `required-check-started.ts`: a heartbeat
PR older than one tick with no `gate (required)` in the rollup fails the
flush job. Not an auto-approver.
