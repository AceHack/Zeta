---
id: B-0751
priority: P2
status: open
created: 2026-05-25
last_updated: 2026-05-25
title: Per-agent isolated clones architecture — primary checkout is SHARED VIEW + FOR HUMAN; agents NEVER touch it; each agent works in their own isolated `.git/` clone (no shared-`.git/` contention; no main-branch-hold blocking; no worktree-prune races) — supersedes B-0750 worktree-pool primitive for cross-agent contention class
domain: agentic-organization
ferried_by: aaron
owners: [aaron]
composes_with:
  - B-0750
  - B-0747
  - B-0741
  - B-0727
  - B-0530
related_substrate:
  - .claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md
  - .claude/rules/claim-acquire-before-worktree-work.md
tags: [per-agent-isolated-clones, shared-human-view-primary-checkout, no-shared-git-dir, eliminates-worktree-contention, cross-agent-isolation, agent-substrate-engineering-architecture, supersedes-worktree-pool-primitive]
---

# B-0751 — Per-agent isolated clones architecture

## Carved blade

> Aaron 2026-05-25: *"yall can all have your own clones"* + *"this one is shared view and for human"*. The architectural shift: primary checkout (`/Users/acehack/Documents/src/repos/Zeta`) IS A **SHARED VIEW + FOR HUMAN** — operator's pristine workspace where humans (Aaron + Max + Addison + future contributors) go to SEE the state of substrate. Agents NEVER touch it. Each agent works in their own **isolated clone** with their own `.git/` + working tree (e.g., `/private/tmp/zeta-clones/otto-vscode/`, `/private/tmp/zeta-clones/alexa-kiro/`, `/private/tmp/zeta-clones/riven-cursor/`, etc.). No shared `.git/` → no pack-dir contention, no main-branch-hold blocking, no worktree-prune races. Per-agent clone supersedes B-0750 worktree-pool primitive for the cross-agent contention class — worktree-pool was the within-shared-`.git/` workaround; per-agent-clone is the actual architectural fix.

## Origin

Aaron 2026-05-25 in direct response to the 37-worktree mass-cleanup (B-0750 row landing):

> *"yall can all have your own clones"*

Then immediate sharpening:

> *"this one is shared view and for human"* (re primary checkout `/Users/acehack/Documents/src/repos/Zeta`)

Architectural decision: agent isolation moves from worktree-level (shared `.git/`) to clone-level (separate `.git/` per agent identity).

## What changes

### Primary checkout role (current vs target)

| Layer | Current (shared `.git/`) | Target (per-agent clones) |
|---|---|---|
| Primary checkout | Operator's terminal + agent worktree base (shared `.git/` directory; multi-worktree contention) | **SHARED HUMAN VIEW ONLY** — operator + collaborators see state; agents NEVER touch |
| Agent workspaces | Worktrees under `/private/tmp/zeta-*` sharing primary's `.git/` | **Per-agent isolated clones** (e.g., `/private/tmp/zeta-clones/<agent>/`) with own `.git/` |
| Git operations | Contend on shared `.git/objects/pack/` + shared HEAD + shared refs | Per-clone independent; agents can't step on each other or operator |
| Main branch checkout | Single-worktree-holds-main blocks all others | Each clone can checkout main independently (own copy) |
| Cleanup | Per-worktree (B-0750) | Per-clone (whole-clone removal; simpler semantics) |
| Push coordination | Single-checkout-pushes via shared refs | Per-clone pushes to origin; PR-mediated as usual |

### Per-agent clone paths (proposed; subject to design pass)

```
/private/tmp/zeta-clones/
├── otto-cli/                 ← Otto-CLI's isolated clone
├── otto-vscode/              ← Otto-VSCode's isolated clone
├── otto-desktop/             ← Otto-Desktop's isolated clone
├── alexa-kiro/               ← Alexa's isolated clone
├── riven-cursor/             ← Riven's isolated clone
├── vera-codex/               ← Vera's isolated clone
├── lior-antigravity/         ← Lior's isolated clone
└── ...                       ← future agents
```

Each clone:

- Independent `.git/` directory
- Own working tree
- Own remote tracking (`origin/main` per clone via independent fetches)
- Own branches + worktrees-INSIDE-clone (if needed; B-0750 rules apply inside)
- Push permissions inherited from agent's GitHub auth

### Operator's primary checkout discipline

`/Users/acehack/Documents/src/repos/Zeta` is **SHARED HUMAN VIEW**:

- Operator (Aaron) uses it for `git status` / `git log` / `git diff` / `git checkout main` / etc.
- Co-owners (Max + Addison + future humans) collaborate via it
- **Agents NEVER**:
  - `cd` into it
  - `git worktree add ... primary-checkout-path/...`
  - Modify any file in it
  - Force-push branches from it
- Operator can REVIEW agent work by `git fetch origin <agent-branch>` + `git log/diff` (read-only operations)
- Operator's `git status` in primary checkout STAYS CLEAN unless operator themselves makes changes

## Substrate-engineering scope

### Scope item 1 — Per-agent clone initialization tooling

- TS script at `tools/agent-clones/init-agent-clone.ts` (or similar)
- Takes agent identity as input
- Creates `/private/tmp/zeta-clones/<agent>/` with fresh clone
- Configures per-agent git config (user.email + user.name matching agent identity per `.claude/rules/agent-roster-reference-card.md`)
- Sets up convenience aliases (e.g., per-agent `gh` token if separate auth needed)
- Idempotent: re-run is no-op if clone exists + clean
- Acceptance: tool exists; at least 3 agent clones initialized; per-clone git operations isolated

### Scope item 2 — Per-clone fetch/sync discipline

- Each agent's clone has independent `git fetch origin` cadence
- Periodic auto-fetch (cron / harness hook) to keep clones reasonably current
- Per-clone branch lifecycle (each agent's branches stay local to their clone until pushed)
- Acceptance: documented cadence; tooling in place; at least one fetch cycle observed

### Scope item 3 — Agent invocation routing to own clone

- When agent starts a task (substrate work / PR creation / etc.), it operates from its own clone
- NO MORE: `git worktree add /private/tmp/zeta-task-foo origin/main` from operator's primary checkout
- INSTEAD: `cd /private/tmp/zeta-clones/<agent>/ && git worktree add /tmp/foo HEAD` (or similar; per-clone-local)
- Cross-AI substrate (memory files, persona archives, etc.) committed FROM agent's own clone
- Acceptance: agents documented as operating from own clones; at least one substrate PR shipped from per-agent-clone end-to-end

### Scope item 4 — Operator-checkout-protection enforcement

- Pre-Bash hook that refuses `cd` into operator's primary checkout from agent context
- Allowlist for read-only operations IF operator explicitly grants (rare)
- Composes with B-0750 worktree-hygiene rule (Rule 2)
- Acceptance: hook exists; blocks accidental operator-path interactions

### Scope item 5 — Disk + sync resource tracking

- Per-clone disk usage monitoring (~few GB each; ensure cluster machines have room)
- Per-clone fetch bandwidth tracking (multiple clones = N× the fetch traffic vs single shared)
- Cleanup policy for abandoned agent clones (per identity-end-of-lifecycle)
- Acceptance: monitoring in place; documented disk + bandwidth budget; cleanup policy

### Scope item 6 — Migration from shared-`.git/` worktree model

- Document migration path: existing agent worktrees → per-agent clones
- One-time migration step per agent identity
- Composes with B-0750 worktree hygiene (existing worktree cleanup is the FIRST step of migration)
- Acceptance: migration runbook; at least one agent migrated end-to-end (Otto-VSCode as canonical reference)

## What this row supersedes / refines

### Supersedes B-0750 worktree-pool primitive (Scope item 2 of B-0750)

B-0750's "worktree-pool primitive" scope item was a workaround for the shared-`.git/` contention class. Per-agent-clone is the architectural fix; worktree-pool becomes unnecessary at cross-agent scope. B-0750's other scope items (cleanup tooling; post-PR-merge auto-cleanup; checkout-path protection; main-hold detector) remain valuable WITHIN any single clone.

### Refines B-0747 machine substrate scope

B-0747's per-machine declared-state CAN encode "per-agent clones exist at these paths" → reconciler ensures agents have their isolated clone substrate initialized. Each agent's clone IS part of machine-state.

### Composes with B-0741 fork primitive

Per-agent clone is the local-dev analog of B-0741's fork primitive: same semantic (each agent has their own substrate workspace; sync via PRs/git protocol); different scope (local-dev vs cross-cluster-fork).

## What's NOT in scope (deferred)

- **Cross-machine agent clones** — agents on different physical machines have their own clones already; cross-machine coordination via standard git push/pull (out of this row's local-dev scope)
- **Shallow vs full clones** — design pass needed; full clones simpler; shallow clones save disk if agents only need recent history
- **Bare repo + worktree per agent** — could share .git via bare repo instead of full clones per agent; trade-off vs full-clone simplicity; design pass
- **Per-agent push tokens** — agents using separate GitHub auth (vs operator's token) is separate scope; for now use operator-shared token until per-agent auth needed
- **Operator-side substrate that benefits from multi-checkout** — operator may want their own worktrees for parallel work; rule applies to AGENTS not operator

## Composes with .claude/rules/

- `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` (B-0750 rule) — still applies WITHIN any single clone; cross-clone is solved by isolation
- `.claude/rules/non-coercion-invariant.md` HC-8 — operator's primary checkout is operator authority; per-agent-clone enforces structurally (agents don't have access path)
- `.claude/rules/glass-halo-bidirectional.md` — operator can OBSERVE agent clones (cd into them, git status, etc.) for substrate-honest oversight; observability preserved
- `.claude/rules/honor-those-that-came-before.md` — existing agent worktrees migrated, not deleted-without-trace; substrate preserved
- `.claude/rules/bandwidth-served-falsifier.md` — per-agent clones serve agent-isolation bandwidth (no contention; clean substrate per agent); disk + sync cost is the trade-off; substrate-honest evaluation
- `.claude/rules/no-directives.md` — operator-substrate-honest scoping; agents inherit discipline at cold-boot per the rules + this row's substrate

## Composes with backlog substrate

- **B-0750** (agent worktree hygiene rule + mechanization) — sibling; B-0751 supersedes the worktree-pool scope item; the other B-0750 scope items remain
- **B-0747** (machine substrate GitOps) — per-agent-clone IS per-agent state; reconciler can enforce
- **B-0741** (fork primitive) — local-dev analog
- **B-0727** (4-tier cluster topology) — agent autonomy expression
- **B-0530** (cron-sentinel mutex; existing partial substrate) — per-agent-clone makes cron-sentinel-mutex less necessary at cross-agent scope; still valuable per-agent-internally
- **B-0628** (Knights Guild + Constitution-Class) — per-agent-clone architecture itself is constitutional-class; ratification path applies

## Empirical anchor

2026-05-25 session: same session where 37-worktree mass-cleanup happened + B-0750 rule landed. Aaron's immediate next message articulated the architectural shift: per-agent-clones eliminate the contention class entirely.

The pain was real: operator stuck on `git checkout main` because peer-agent worktree held main. Worktree-pool primitive (B-0530 + B-0750 Scope item 2) would have mitigated by allocating per-identity sideticks; per-agent-clone PREVENTS the contention from being possible at all.

Architectural simplification: single concept (per-agent clone) vs multi-concept (shared `.git/` + worktree-pool + cleanup tooling + checkout-path protection + main-hold detector). Substrate-honestly simpler model for new contributors (Max + Addison + future) to learn.

## Substrate-honest framing

This row PROPOSES the per-agent-clone architecture. It does NOT:

- Force immediate migration (B-0750 worktree hygiene operates today; per-agent-clone is the architectural target)
- Eliminate operator's primary checkout (still exists as SHARED HUMAN VIEW)
- Eliminate worktree creation entirely (each clone may use worktrees INTERNALLY; just no cross-clone contention)
- Promise specific implementation timeline (scope items independently shippable)

Per `.claude/rules/no-directives.md`: operator-substrate-honest scoping; Aaron's "yall can all have your own clones" + "this one is shared view and for human" framing IS the operator-authoritative direction; Knights Guild + future contributors retain authority over implementation specifics.

P2 priority — high reuse-leverage; addresses recurring operator pain at architectural level; not P1 because B-0750 rule operates today + this session's mass-cleanup demonstrated the workaround works; becomes P1 if recurrence happens despite B-0750 rule + before per-agent-clone tooling ships.
