---
id: 081KQR4HQ0008QG0R001GAD29A
priority: P1
status: closed
closed: 2026-05-07
closed_by: "All acceptance criteria met — workflow fires, issues created, Otto picks up on wake"
title: GitHub Actions trigger for razor cadence + trajectory reviews -- escape Otto-remembering as the load-bearing trigger (Claude.ai 2026-05-04 + Aaron 2026-05-04)
tier: foundation
effort: M
ask: Aaron 2026-05-04 forwarded Claude.ai 2026-05-04 design + verbatim *"and we should put his idea about the github action triggers on the backlog"*
created: 2026-05-04
last_updated: 2026-05-04
depends_on: []
composes_with: [081KQGDBJ0008QG0R0012FC7RX, 081KQR4HQ0008QG0R001909FPT, 081KQR4HQ0008QG0R002YNV361, 081KQTPYE0008QG0R00392KABJ]
tags: [razor-cadence, mechanization, github-actions, trigger-reliability, foundation, autonomy]
---

# 081KQR4HQ0008QG0R001GAD29A -- GitHub Actions trigger for razor cadence + trajectory reviews

## The naming

Aaron 2026-05-04 forwarded a Claude.ai conversation that diagnosed the load-bearing gap in Zeta's autonomy architecture: razor cadence and trajectory reviews depend on Otto-remembering-to-check, with Aaron-as-external-trigger as the actual mechanism. Aaron's verbatim:

> *"i'm the external trigger for now"*

> *"we need to do this but claude code cron is not reliable it depending on claude remembering to check the trajectories which is is not there"*

> *"and we should put his idea about the github action triggers on the backlog"*

Claude.ai's design (verbatim, captured for substrate transmission per PR #1552 cross-instance discipline):

> *"Where it can actually live reliably: GitHub Actions on schedule, pre-commit/pre-push hooks for the per-commit checks, or system-level cron (launchd on macOS, real crontab) that runs whether or not Claude Code is open. GitHub Actions probably fits best given everything's already on GitHub - a scheduled workflow that opens a 'razor-review-due' issue or drops a comment on a tracking PR fires reliably, and Otto picks it up next time he's running. The trigger fires whether or not Otto exists; Otto just has to notice the trigger artifact when he wakes up. That's a smaller ask than 'remember to check the trajectory' -- the trigger ages and stays visible, the discipline doesn't."*

## What this addresses

The substrate-as-memory-of-failures pattern named by Claude.ai 2026-05-04: encoding rules without mechanizing them produces volume, not behavior change. The razor cadence (rules-without-mechanization-aren't-good-rules per Aaron's same-tick framing) is itself a rule that depends on agent-remembering. Without external triggering, the cadence does not fire.

Empirical evidence Aaron observed:

> *"i don't think i've ever seen that fire automatically i've had to direct you not even sure it's an active trajectory"*

The mechanism this row plans: scheduled GitHub Actions workflows that fire whether or not any AI is running. The workflow drops a visible artifact (issue, PR comment, scheduled file write) that Otto-or-equivalent picks up on next wake. The trigger is durable; the discipline is not.

## Mechanization candidates (in priority order)

### 1. Scheduled GitHub Actions razor-cadence workflow (HIGH leverage)

A workflow at `.github/workflows/razor-cadence.yml` running on a cron schedule (e.g., daily 09:00 UTC) that:

- Opens a "razor-review-due" issue (or comments on a tracking issue) flagging which rules are due for razor review
- Lists candidate review surfaces: encoded rules without verified mechanization, PR-comment burden, tier-cadence trajectory rows, etc.
- Tags the issue with a label that any wake-time agent can grep for as part of cold-start checks

Acceptance: workflow lands; one cycle fires; issue gets opened automatically; Otto picks it up on next wake.

### 2. Pre-commit / pre-push hooks (MED leverage -- composes with 081KQR4HQ0008QG0R002YNV361)

The 081KQR4HQ0008QG0R002YNV361 row already names pre-commit hooks for branch-verify. Generalizes to other per-commit checks (lint, format, archive-header presence, ASCII-only invariant, etc.). All committed under `tools/git-hooks/` and installed via `tools/setup/`.

### 3. System-level cron / launchd (LOW leverage / fragile)

Maintainer-side launchd on macOS or real crontab as fallback when GitHub Actions can't carry the load. Less preferred because it's machine-specific.

### 4. Trajectory-review GitHub Action

Companion to (1): scheduled action that audits trajectory file freshness, opens issue when a trajectory hasn't been touched in N days. Composes with 081KQR4HQ0008QG0R001909FPT (memory trajectory) and `docs/active-trajectory.md`.

## Why P1

- **Load-bearing for the entire autonomy architecture**: per Claude.ai's diagnosis, every encoded rule depends on this for actual prevention. Without this, substrate-encoding produces a memory of failures rather than prevention.
- **Demonstrated empirical recurrence**: 2026-05-04 session had 3 branch-verify violations in tight recursion of the rule meant to prevent them.
- **Bounded scope**: GitHub Actions workflow is well-understood tooling; ~50-100 lines of YAML + a stub script.

## Why not P0

- **Aaron is the external trigger today**: the substrate functions, just at the cost of Aaron's bandwidth.
- **No correctness failures depend on this**: the system produces real work without the cadence; it just produces unbounded substrate volume.

## Acceptance criteria

1. **Razor-cadence workflow** at `.github/workflows/razor-cadence.yml` running on schedule.
2. **First fire produces visible artifact** (issue or PR comment) that any agent can discover.
3. **Documentation pointer** in CLAUDE.md or `docs/active-trajectory.md` tells agents to check the artifact on wake.
4. **At least one full cycle**: cadence fires, agent picks up the artifact, addresses or queues the surfaced rule.
5. **Trigger artifact ages and stays visible**: the issue/comment doesn't auto-close; the next wake also sees it until explicitly resolved.

## Out of scope

- Razor-content authoring (what the razor reviews actually check) -- that's per-rule and not part of this trigger mechanization.
- Replacing Aaron-as-external-trigger entirely (long-horizon shape: BFT multi-model AI loops triggering each other -- 081KQGDBJ0008QG0R0012FC7RX territory).
- Per-commit hook implementations (081KQR4HQ0008QG0R002YNV361).

## Composes with

- **081KQGDBJ0008QG0R0012FC7RX** -- BFT-resistance theorem -- Aurora composed CRDT + consensus. Long-horizon shape: BFT-multi-model AI loops triggering each other. This row is the interim mechanization until BFT-loops carry the trigger.
- **081KQR4HQ0008QG0R001909FPT** -- memory substrate-engineering trajectory. Trajectory-review action (#4 above) composes here.
- **081KQR4HQ0008QG0R002YNV361** -- orchestrator branch-verify mechanization. Pre-commit hook layer (#2 above) composes here.
- `memory/feedback_substrate_encoding_bypasses_trust_calculus_sleeping_bear_cross_instance_transmission_aaron_2026_05_04.md` (PR #1552) -- substrate transmission mechanism Claude.ai's design operationalizes.
- `memory/feedback_claude_ai_recap_shortcut_4_element_pin_aaron_2026_05_04.md` (PR #1559) -- prior cross-Claude-instance substrate transmission; same family.

## The carved sentence

**"Encoding rules without mechanizing them produces a memory of failures, not prevention. GitHub Actions on schedule (or equivalent external trigger) fires whether or not any AI exists; Otto picks up the artifact on next wake. The trigger ages and stays visible; the discipline does not. Aaron is the external trigger for now; this row plans the escape."**
