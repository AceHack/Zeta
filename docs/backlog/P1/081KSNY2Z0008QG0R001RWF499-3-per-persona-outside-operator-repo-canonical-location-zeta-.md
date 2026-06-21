---
id: 081KSNY2Z0008QG0R001RWF499
title: Per-persona worktree base must be OUTSIDE operator's primary repo — canonical location `~/.zeta/agents/<persona>/<stream>/`
status: open
priority: P1
created: 2026-05-28
attribution: aaron-2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R0032E7PCY
composes_with:
  - 081KSE6WT0008QG0R003YYC9PV
  - 081KSE6WT0008QG0R003YYC9PV
  - 081KRMEXM0008QG0R000X1PPGC
tags:
  - hygiene
  - infrastructure
  - rule-update
  - architectural-correction
---

# 081KSNY2Z0008QG0R001RWF499 — Per-persona worktree base must be OUTSIDE operator's primary repo — canonical location `~/.zeta/agents/<persona>/<stream>/`

## Refinement to 081KSNY2Z0008QG0R0032E7PCY

[081KSNY2Z0008QG0R0032E7PCY](081KSNY2Z0008QG0R0032E7PCY-reboot-survival-discipline-in-flight-state-must-survive-macos-private-tmp-clear-aaron-2026-05-28.md) (shipped 2026-05-28 via PR #5696) correctly moved agent worktrees OFF `/private/tmp/` (reboot-survival fix) but placed the new default at `~/Documents/src/repos/Zeta/worktrees/<surface>-*` — UNDER the operator's primary repo. Operator 2026-05-28T~04:50Z immediately surfaced the residual failure mode this leaves intact:

> *"~/Documents/src/repos/Zeta/worktrees/lior-* this sometimes locks up where i can't switch to main cause lior has it locked to a worktree isolated branches per persona or even per persona's parallel strems just for full isolation. I think ~/Documents/src/repos/Zeta/ is for shared up to date main and for me to push changes"*
> *"or maybe just .zeta/agents/"*

The PR #5696 fix is partial: reboot-survival works (Lior's `worktrees/lior-*` survived the 04:35Z restart cleanly), but operator-`main`-blocking failure mode persists because agent worktrees still live UNDER the operator's primary checkout, where they can hold `[main]` and block operator's `git checkout main`.

## The architecture (operator-named, 2026-05-28)

| Scope | Location | Purpose |
|---|---|---|
| **Operator primary** | `~/Documents/src/repos/Zeta/` | Operator-only — shared up-to-date main + operator's push surface; agents NEVER place worktrees inside this path |
| **Per-persona base** | `~/.zeta/agents/<persona>/` | One dir per AI persona (otto-cli, otto-desktop, otto-vscode, lior, alexa-kiro, etc. per [`agent-roster-reference-card`](../../../.claude/rules/agent-roster-reference-card.md)) — outside operator's repo entirely |
| **Per-stream within persona** | `~/.zeta/agents/<persona>/<stream-id>/` | Multiple parallel work-threads per persona — full isolation per stream |

`~/.zeta/` becomes the namespace root for ALL Zeta agent-related dotfile state. Composes with 081KSNY2Z0008QG0R0032E7PCY.1 (bus envelope migration to `~/.zeta/bus/`) — same namespace.

### Concrete examples

```text
~/.zeta/                                    # Zeta namespace root
  agents/
    otto-cli/
      b0894-3-per-persona-outside-repo-2026-05-28/   # this PR's worktree
      tick-0512z/                                    # parallel stream
      shard-XYZ/                                     # another parallel stream
    otto-desktop/
      tick-NNNNz/
    otto-vscode/
      ...
    lior/
      preserve-prs-20260527/
      decompose-4847/
      ...
    alexa-kiro/
      ...
    riven-cursor/
      ...
    vera-codex/
      ...
  bus/                                       # future: 081KSNY2Z0008QG0R0032E7PCY.1 bus envelopes
  config/                                    # future
~/Documents/src/repos/Zeta/                  # OPERATOR primary — agent worktrees forbidden
```

## Why operator-primary-MUST-stay-agent-free

`git` only allows one worktree per branch ref. If an agent worktree under `~/Documents/src/repos/Zeta/worktrees/<surface>-foo/` holds `[some-branch]`, and operator does `git checkout some-branch` from `~/Documents/src/repos/Zeta/`, git refuses. For the specific case of `[main]`, this blocks operator from inspecting current main from their primary checkout. Empirical evidence per `agent-worktree-hygiene` Rule 5 (081KSNY2Z0008QG0R0032E7PCY anchor) + operator's lockup observation.

Moving agent worktrees OUTSIDE `~/Documents/src/repos/Zeta/` makes this structurally impossible. The operator's primary checkout becomes shared-with-no-other-worktrees state by construction.

## Lior migration — non-blocking

Lior currently has 10 worktrees under operator's primary repo (5 at top-level, 5 under `worktrees/`). This row does NOT mandate immediate Lior-side migration — Lior's worktrees survived the 2026-05-28 restart cleanly (composes with 081KSNY2Z0008QG0R0032E7PCY reboot-survival), and the operator-blocking failure mode is intermittent ("sometimes locks up"). Migration of Lior's pattern is filed as future-state work coordinated with Lior's loop script (`.gemini/bin/lior-loop-tick.ts` and similar); not gating for the rule-edit landing.

## Acceptance criteria

1. **`agent-worktree-hygiene` rule update**: change Rule 2 default location from `~/Documents/src/repos/Zeta/worktrees/<surface>-<task-tag>-<hhmmz>/` (current per PR #5696) to `~/.zeta/agents/<persona>/<stream-id>/` (this row's canonical). Update carved sentence, Rule 5 empirical-anchor table (preserve `~/Documents/src/repos/Zeta/worktrees/<surface>-*` reference as historical context per Lior's pattern), audit + verify-no-main-held commands.
2. **`~/.zeta/agents/` namespace established** on operator's machine (this PR creates the dir as side-effect of dogfooding).
3. **081KSNY2Z0008QG0R0032E7PCY backlog row updated** with Refinement section pointing at 081KSNY2Z0008QG0R001RWF499 + retraction-native preservation (PR #5696 substrate stays; this row refines).
4. **Future autonomous-loop ticks observed creating worktrees at `~/.zeta/agents/<persona>/<stream>/`** — validation by observation.

## What this PR (substrate landing) delivers

This PR (the one filing 081KSNY2Z0008QG0R001RWF499) delivers criteria 1 + 2 + 3. Criterion 4 is validation-by-observation over future ticks.

## Composes with

- **081KSNY2Z0008QG0R0032E7PCY** — parent row; this row refines the location-default
- **081KSE6WT0008QG0R003YYC9PV** — agent worktree cleanup; cleanup commands need to scan `~/.zeta/agents/<persona>/` surface
- **081KSE6WT0008QG0R003YYC9PV** — per-agent isolated clones; 081KSNY2Z0008QG0R001RWF499 is the worktree-level realization of the per-agent-isolation pattern at clone-level
- **081KRMEXM0008QG0R000X1PPGC** — cron-sentinel mutex; multi-agent contention solved by per-persona base directories
- **081KSNY2Z0008QG0R0032E7PCY.1** (filed later) — bus envelope migration to `~/.zeta/bus/`; same namespace
- **`.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md`** — rule being edited
- **`.claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md`** — per-persona dir = unambiguous ownership signal (path contains identity tag); discriminator-pass auto-resolves to MINE/PEER

## Empirical anchor

This PR's worktree is at `~/.zeta/agents/otto-cli/b0894-3-per-persona-outside-repo-2026-05-28/` — first instance of the new canonical pattern. Operator primary checkout (`~/Documents/src/repos/Zeta/`) is unaffected (no `git status` pollution, no `[main]` blocking risk).

## Substrate-honest framing

This row does NOT:

- Mandate immediate migration of Lior's existing 10 worktrees (separate coordination required with Lior's loop substrate)
- Override operator authority (operator can put worktrees anywhere; the discipline is for agents)
- Solve every reboot-survival problem (background-task output is harness-level; sentinel is harness-level — same as 081KSNY2Z0008QG0R0032E7PCY)

This row DOES:

- Move agent worktrees OUTSIDE operator's primary repo, structurally preventing operator-`main`-blocking
- Establish `~/.zeta/` namespace root for all Zeta agent-related dotfile state
- Use per-persona + per-stream isolation as default — full isolation as operator framed
- Dogfooding-validate by authoring at the new canonical location

## Full reasoning

Operator 2026-05-28 conversation thread following PR #5696 merge:

- Operator: critique of `/private/tmp/` worktree location → PR #5696 (partial fix)
- PR #5696 merged at `d3962a9ef`
- Operator: *"~/Documents/src/repos/Zeta/worktrees/lior-* this sometimes locks up where i can't switch to main..."* — surfaces residual operator-`main`-blocking failure mode
- Operator: *"~/Documents/src/repos/Zeta/ is for shared up to date main and for me to push changes"* — names operator-primary-MUST-stay-agent-free invariant
- Operator: *"...per persona or even per persona's parallel strems just for full isolation"* — names per-persona + per-stream isolation discipline
- Operator: *"or maybe just .zeta/agents/"* — names canonical location convention

This row + accompanying rule edit operationalize the operator's full architectural framing.
