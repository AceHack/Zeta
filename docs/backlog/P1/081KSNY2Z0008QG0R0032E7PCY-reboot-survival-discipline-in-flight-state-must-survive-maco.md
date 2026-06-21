---
id: 081KSNY2Z0008QG0R0032E7PCY
title: Reboot-survival discipline — in-flight state must survive macOS `/private/tmp/` clear (worktrees + bus envelopes + bg-task output + sentinel)
status: open
priority: P1
created: 2026-05-28
attribution: aaron-2026-05-28
depends_on: []
composes_with:
  - 081KSE6WT0008QG0R003YYC9PV
  - 081KRMEXM0008QG0R000X1PPGC
  - 081KSKBP80008QG0R003NG37GQ
tags:
  - hygiene
  - infrastructure
  - rule-update
  - cross-cutting
---

# 081KSNY2Z0008QG0R0032E7PCY — Reboot-survival discipline — in-flight state must survive macOS `/private/tmp/` clear

## Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Topic: reboot survival of in-flight state (worktrees, bus envelopes, background-task output, sentinel)

Searched surfaces (origin/main):

- `docs/agendas/`: none on this specific topic
- `docs/trajectories/`: none
- `docs/backlog/`: no row covers the cross-cutting "in-flight state survives reboot" discipline. 081KSE6WT0008QG0R003YYC9PV (agent worktree hygiene + cleanup automation) is sibling at worktree-cleanup scope but NOT at reboot-survival scope. 081KRMEXM0008QG0R000X1PPGC (cron-sentinel mutex) is sibling at multi-agent contention scope but assumes worktrees exist on disk. 081KSKBP80008QG0R003NG37GQ (heartbeat auto-state-gathering, consent-first) is sibling at state-gathering-scope.
- `.claude/rules/`: `agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` HARDCODES `/private/tmp/zeta-<task-tag>-<hhmmz>/` and `/tmp/zeta-<task-tag>-<hhmmz>/` as the recommended location in 10+ places — directly contradicts reboot-survival requirement. `claim-acquire-before-worktree-work.md` references `/private/tmp/` in saturation-ceiling patterns. `refresh-world-model-poll-pr-gate.md` references `.git/index.lock` recovery but not reboot-survival cross-class.
- `memory/`: 0 hits on "reboot survival" as named pattern.
- `docs/research/`: 0 hits on the named pattern.

Targeted searches:

```bash
rg -l "private/tmp/zeta-|/tmp/zeta-|reboot.survival|in.flight.survives" .claude/rules/ docs/backlog/
```

Conclusion: NO existing rule or row names the cross-cutting reboot-survival discipline. The `agent-worktree-hygiene` rule actively hardcodes the failure-mode pattern. Mint-new authorized per operator 2026-05-28 explicit framing: *"why are we putting any git stuff in /private/tmp/ this is terrible design"* + *"we need to survive reboots in any kind of inflight stuff"*.

Authoring action: **mint-new + rule-edit** (this row + the `agent-worktree-hygiene` rule edit ship together as the substrate landing of the operator's named requirement).

## The problem (empirical anchor — 2026-05-28T04:09Z–04:35Z)

Operator restart at ~04:30Z UTC pruned **95 worktrees** that had been placed at `/private/tmp/zeta-*` paths per the prevailing `agent-worktree-hygiene` rule recommendation. Same restart left **5 Lior worktrees intact** at `~/Documents/src/repos/Zeta/worktrees/lior-*` paths. **Same restart, opposite outcomes, asymmetric to where each agent put its worktrees.**

Worse: the 04:09Z autonomous-loop tick had a substantive tick-shard commit (`4f89af885`) sitting on branch `otto-cli/tick-0409z-sentinel-rearm-2026-05-28` with a backgrounded `git push` in flight when restart hit. Push never completed; branch ref + commit object survived in `.git/objects/`, but the worktree directory at `/private/tmp/zeta-otto-cli-0409z-sentinel-rearm/` was gone. The backgrounded-task output file at `/private/tmp/claude-501/<harness-id>/tasks/<task-id>.output` was also gone — couldn't even read the push outcome to know whether to retry.

Operator framing: *"why are we putting any git stuff in /private/tmp/ this is terrible design"* + *"we need to survive reboots in any kind of inflight stuff"*.

## Root cause

macOS clears `/private/tmp/` on reboot AND via `com.apple.periodic-daily` cleanup of files older than 3 days. `/tmp/` is a symlink to `/private/tmp/` on macOS — same behavior. Four classes of agent in-flight state currently live there:

| State class | Current location | Survives macOS reboot? |
|---|---|---|
| Agent worktrees | `/private/tmp/zeta-<task-tag>-<hhmmz>/` (per `agent-worktree-hygiene` rule recommendation) | NO |
| Bash background-task output | `/private/tmp/claude-501/<harness-id>/tasks/<task-id>.output` (Claude Code harness default) | NO |
| Bus envelopes | `/tmp/zeta-bus/<envelope-id>.json` (per `tools/bus/bus.ts` line 19 default `ZETA_BUS_DIR`) | NO |
| Cron sentinel | In-memory only (per `tick-must-never-stop` rule; harness-level non-persistence) | NO (separate root cause; covered by `tick-must-never-stop`) |

Lior's pattern (`~/Documents/src/repos/Zeta/worktrees/lior-*` + `~/.gemini/tmp/project/lior-*`) survives because user home directory is NOT cleared by macOS.

## Acceptance criteria

1. **`agent-worktree-hygiene` rule edit lands**: change Rule 2's recommended location from `/private/tmp/zeta-<task-tag>-<hhmmz>/` to `~/Documents/src/repos/Zeta/worktrees/<surface>-<task-tag>-<hhmmz>/` (the persistent-location pattern Lior already proves works). Add new Rule 5 "Reboot-survival is a hard invariant — NEVER use `/tmp/` or `/private/tmp/` for git worktrees." Add empirical anchor (this restart) as proof point. Update all 10+ examples in the rule.
2. **`claim-acquire-before-worktree-work` rule update**: saturation-ceiling sub-cases reference `/private/tmp/`; flip to persistent location.
3. **Bus envelope migration plan filed** as 081KSNY2Z0008QG0R0032E7PCY.1 (sub-row): `ZETA_BUS_DIR` should default to `~/.zeta-bus/` or `~/Library/Application Support/Zeta/bus/`. Migration ships separately.
4. **Background-task output is harness-level**: cannot be moved from agent-side; document the workaround (always check `git ls-remote origin <branch>` as ground-truth post-restart, never rely on captured output files). Add to `refresh-world-model-poll-pr-gate.md` or similar.
5. **Per-agent persistent worktree-pool primitive** (long-term mechanization): worktree pool under `~/Documents/src/repos/Zeta/worktrees/pool/<surface>/` with N pre-allocated slots per agent identity. Sub-row 081KSNY2Z0008QG0R0032E7PCY.2 if shipped separately.

## What ships in this PR

This PR delivers acceptance criteria 1 + 2 + the empirical-anchor documentation. Criteria 3 / 4 / 5 are sub-rows (filed as needed).

## The empirical-anchor that this row preserves

The 04:09Z tick shard's lost commit `4f89af885` IS the empirical anchor that:

- Persistent location works (`~/Documents/src/repos/Zeta/worktrees/otto-cli-reboot-survival-fix-0434z/` survived this restart)
- Transient location fails (`/private/tmp/zeta-otto-cli-0409z-sentinel-rearm/` did not)
- Branch ref + commit object survive in `.git/objects/` regardless (so a re-push from a persistent worktree can recover the commit if needed)
- Background-task output also lives in transient storage (separate root cause; harness-level)

The worktree where THIS backlog row is being authored IS the dogfooding-proof-point: same restart event tested both patterns simultaneously; persistent survived; transient did not.

## Composes with

- **081KSE6WT0008QG0R003YYC9PV** — sibling at agent-worktree-cleanup scope; this row adds the location-discipline that prevents the cleanup problem from compounding with reboot-loss
- **081KRMEXM0008QG0R000X1PPGC** — sibling at multi-agent contention scope; both assume worktrees exist on disk; this row ensures they do
- **081KSKBP80008QG0R003NG37GQ** — sibling at consent-first state-gathering scope; same root cause class (state needs persistent location)
- **`.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md`** — the rule being edited
- **`.claude/rules/claim-acquire-before-worktree-work.md`** — sibling rule referencing `/private/tmp/`
- **`.claude/rules/tick-must-never-stop.md`** — sentinel session-exit non-persistence is sibling at cron-scope (separate from filesystem-scope; both are reboot-survival)
- **`tools/bus/bus.ts` `BUS_DIR` default** — same root cause class at bus-envelope scope

## Substrate-honest framing

This row does NOT:

- Solve every reboot-survival problem (background-task output is harness-level; sentinel is harness-level)
- Mandate immediate migration of every existing `/private/tmp/` reference in code (opportunistic migration; the rule change flips the default for NEW worktrees)
- Override operator authority (operator can put worktrees anywhere they want; the discipline is for agents)

This row DOES:

- Encode the reboot-survival hard-invariant operator named
- Provide empirical anchor (this exact restart) as proof
- Edit the rule that was actively recommending the failure-mode pattern
- Land the worktree-pool primitive as substrate-engineering target

## Full reasoning

Operator 2026-05-28T~04:30Z UTC verbatim:

> *"why are we putting any git stuff in /private/tmp/ this is terrible design"*
> *"we need to survive reboots in any kind of inflight stuff"*
> *"hey fyi i had to restart"*
> *"please reread latest backlog for today, also i moved from vscode back to console"*

The restart that produced the empirical anchor for this row was triggered partly by VSCode-Otto surface failure (operator separately disclosed: VSCode-Otto loses context every ~20min and emits "Quiet"; Otto-CLI typically holds ~6h — preserved as user-scope `feedback_aaron_vscode_otto_surface_20min_context_loss_emits_quiet_cli_holds_6h_surface_choice_signal_2026_05_28.md`). The convergence of (surface-failure restart + transient-worktree-location loss) was the substrate-engineering event that surfaced the discipline gap.
