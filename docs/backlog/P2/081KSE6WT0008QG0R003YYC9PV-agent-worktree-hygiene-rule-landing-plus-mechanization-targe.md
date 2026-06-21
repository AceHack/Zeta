---
id: 081KSE6WT0008QG0R003YYC9PV
priority: P2
status: open
created: 2026-05-25
last_updated: 2026-05-26
title: Agent worktree hygiene — rule-landing + substrate-engineering mechanization target — periodic cleanup tooling + worktree-pool handoff to 081KRQ1AB0008QG0R001KQ9S4B plus PR #5019 clone-architecture sibling; operator's 'we need to fix this mess yall always stepping on each other and me constantly' anchor 2026-05-25 (37 worktrees mass-cleaned + rule landed simultaneously)
domain: ops-tooling
ferried_by: aaron
owners: [aaron]
composes_with:
  - 081KRMEXM0008QG0R000X1PPGC
  - 081KRQ1AB0008QG0R001KQ9S4B
related_substrate:
  - .claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md
  - .claude/rules/claim-acquire-before-worktree-work.md
tags: [agent-worktree-hygiene, multi-agent-worktree-contention, operator-unblocking, cleanup-tooling, worktree-pool-handoff, b0530-compose, never-hold-main, substrate-engineering-mechanization-target]
---

# 081KSE6WT0008QG0R003YYC9PV — Agent worktree hygiene mechanization target

## Carved blade

> Operator 2026-05-25: *"i'm stuck (max) ➜ Zeta git:(lior-archive-prs-2026-05-26) ✗ git checkout main → fatal: 'main' is already used by worktree at '/private/tmp/zeta-riven-loop-2'... nope we need to fix this mess yall always stepping on each other and me constantly."* The proximate cause was 37 agent worktrees from one substrate-cascade day, including one peer-agent worktree holding `[main]` at stale SHA. Mass-cleanup unblocked + the agent-worktree-hygiene rule landed simultaneously, but the substrate-engineering target is mechanization: periodic cleanup tooling (auto-prune post-PR-merge) plus an ownership architecture handoff. The older worktree-pool primitive remains in 081KRQ1AB0008QG0R001KQ9S4B; the per-agent isolated-clones architecture in PR #5019 supersedes the pool as the preferred architecture for future agent isolation, but is not listed in `composes_with` until its backlog row is main-visible. Until mechanization lands, agent-side compliance with the rule operates the discipline.

## Origin

Operator 2026-05-25, mid-session:

> *"i'm stuck... yall always stepping on each other and me constantly"*

Empirical anchor: 37 agent worktrees in `/private/tmp/zeta-*` + 4 worktrees in operator's primary checkout subdir (peer-AI legacy) + 1 `/private/tmp/zeta-riven-loop-2` holding `[main]` at stale SHA. Mass-cleanup (37 removed) unblocked the operator's `git checkout main`. Same-PR landing: `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` ensures future-AIs inherit the discipline at cold-boot.

## What this row ships in this PR

### Rule landed (auto-loads at cold-boot)

`.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md`

4 operational disciplines:

1. **Never check out `main` in any agent worktree** — use `--detach origin/main` instead
2. **Never create agent worktrees under operator's primary checkout path** — use `/private/tmp/zeta-<task-tag>-<hhmmz>/` or `/tmp/zeta-<task-tag>-<hhmmz>/`
3. **Remove agent worktrees after the work's PR merges** (or substrate-honestly abandon)
4. **Audit + cleanup before substrate-cascade-style work** — agents pre-clean state before starting multi-PR work

Plus specific cleanup commands (audit / per-worktree clean check / mass-remove safe worktrees / verify operator can checkout main).

## Substrate-engineering mechanization scope

### Scope item 1 — Periodic cleanup tooling

- TS script at `tools/worktree/cleanup-stale-agent-worktrees.ts` (or similar)
- Audits all worktrees; classifies per-worktree (SAFE: no uncommitted, branch PR merged or stale > N days; DIRTY: has uncommitted; ACTIVE: PR open + recent commits)
- Runs periodically (via cron or harness hook) — agents inherit clean state automatically
- Reports cleanup actions to provenance chain (081KSE6WT0008QG0R002YBWBB1 Layer 1) for audit
- Composes with 081KRMEXM0008QG0R000X1PPGC cron-sentinel mutex semantics
- Acceptance: tool exists; runs successfully; at least one cycle of auto-cleanup demonstrated

### Scope item 2 — Worktree-pool primitive handoff (081KRQ1AB0008QG0R001KQ9S4B + PR #5019)

- 081KRQ1AB0008QG0R001KQ9S4B already owns the original worktree-pool primitive
  (pre-allocated sideticks per Otto identity; PR #3894 archive:
  `docs/pr-discussions/PR-3894-backlog-b-0558-worktree-pool-primitive-re-land-of-3817-backl.md`)
- PR #5019 (per-agent isolated clones architecture) supersedes a
  shared worktree pool as the preferred architecture for per-agent
  isolation. It is referenced by PR URL/number here, not frontmatter
  `composes_with`, because its backlog row is not yet main-visible.
- This 081KSE6WT0008QG0R003YYC9PV row therefore tracks only the hygiene delta: agents must
  not hold `main`, must not use operator paths, and must clean up owned
  worktrees after merge/abandon
- Any future pool work should compose through 081KRQ1AB0008QG0R001KQ9S4B or be explicitly
  deferred under the PR #5019 clone architecture; 081KSE6WT0008QG0R003YYC9PV should not
  grow a second pool implementation track

### Scope item 3 — Post-PR-merge auto-cleanup hook

- GitHub Action that fires on PR merge
- Identifies the branch + finds any local worktree pointing to that branch (across all agent machines via shared state mechanism)
- Triggers cleanup (via bus envelope OR direct webhook) per-machine
- Composes with 081KSE6WT0008QG0R002YBWBB1 Layer 1 provenance + 081KSE6WT0008QG0R0025QPP05 (GitHub PR mechanics lessons)
- Acceptance: PR merge → corresponding worktrees cleaned automatically within N hours

### Scope item 4 — Operator-checkout-path protection

- Pre-Bash hook that refuses worktree-creation under the operator's
  primary checkout path (`<OPERATOR_PRIMARY_CHECKOUT>/`)
- Prevents the peer-agent-surface + main subdir worktree creation pattern
- Allowlist for legitimate exceptions (rare; documented per case)
- Acceptance: hook exists; blocks accidental worktree-creation under operator path

### Scope item 5 — Main-branch-hold detector

- Periodic check: does any agent worktree hold `[main]`? If yes, alert + offer cleanup
- Composes with the rule's Rule 1 enforcement
- Acceptance: detector exists; catches violations before they accumulate

## What's NOT in scope (deferred)

- **Cross-machine agent worktree coordination** — if agents run on different machines + share git via push/pull, the worktrees are per-machine; cross-machine cleanup is future scope
- **New worktree-pool implementation** — 081KRQ1AB0008QG0R001KQ9S4B owns the historical
  pool primitive; PR #5019 per-agent clones supersede the shared-pool
  approach for new architecture work
- **Operator's own worktree creation** — operator can always create worktrees anywhere; rule applies to agents only
- **Automated branch deletion** — separate scope; depends on PR-mergedness + downstream dependencies (per 081KSE6WT0008QG0R002CC6314 fork interop)
- **Repo-level git config for worktree-pool defaults** — future scope; would require operator-side config buy-in

## Composes with .claude/rules/

- `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` (the rule this row ships)
- `.claude/rules/claim-acquire-before-worktree-work.md` (worktree creation discipline; sibling)
- `.claude/rules/non-coercion-invariant.md` HC-8 (operator's primary checkout is operator authority; agents don't coerce)
- `.claude/rules/dont-ask-permission.md` (cleanup operates within authority once rule landed; doesn't ask per-cleanup)
- `.claude/rules/glass-halo-bidirectional.md` (cleanup substrate is observable; provenance chain captures)

## Composes with backlog substrate

- **081KRMEXM0008QG0R000X1PPGC** (cron-sentinel mutex; existing partial substrate) — same problem class at runtime scope; this row's cleanup discipline composes
- **081KRQ1AB0008QG0R001KQ9S4B** (worktree-pool primitive per Otto identity) — owns the
  historical pool design; 081KSE6WT0008QG0R003YYC9PV narrows to hygiene + cleanup delta
- **PR #5019** (per-agent isolated clones) — supersedes shared pool
  direction as the preferred isolation architecture; intentionally not
  in `composes_with` until its B-row exists on main
- **081KSE6WT0008QG0R002YBWBB1** (leverage-class safety substrate) — Layer 1 provenance chain captures cleanup events
- **081KSE6WT0008QG0R003WZAQKV** (zflash empirical anchor) — operator was trying to use zflash when the worktree mess blocked them; concrete pain
- **081KSE6WT0008QG0R0025QPP05** (GitHub force-push lesson) — related sibling failure mode at GitHub-state scope

## Empirical anchor — 2026-05-25 session

The cleanup itself + this rule landing:

```
=== mass cleanup: removing all /private/tmp/zeta-* worktrees + <OPERATOR_PRIMARY_CHECKOUT>/{main,peer-*} worktrees ===
---removed 37 worktrees---

=== final state ===
<OPERATOR_PRIMARY_CHECKOUT> d2ca111e8 [operator-feature-branch]

=== now can Aaron checkout main? ===
  main    ← BRANCH FREE
```

Operator unblocked. Rule landed simultaneously. Future agent surfaces inherit the discipline at cold-boot.

## Substrate-honest framing

This row PROPOSES the mechanization target. It does NOT:

- Implement any of the scope items (they're future shippable work)
- Force any specific tooling implementation (per-scope-item design pass)
- Override operator authority (operator can always create/remove worktrees)
- Solve cross-machine coordination (deferred)

Per `.claude/rules/no-directives.md`: operator-substrate-honest scoping; Aaron + Knights Guild retain authority over which scope items ship when.

P2 priority — high reuse-leverage; addresses recurring operator pain; not P1 because the rule landing + this session's mass-cleanup already resolved the immediate blockage. Becomes P1 if the rule doesn't hold + worktree accumulation recurs next high-substrate-cascade day.
