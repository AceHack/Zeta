# Agent worktree hygiene — never hold `main`, never step on operator, clean up after PR merge

Carved sentence:

> Agent worktrees are scratch space; the operator's primary checkout
> is the operator's. Agents NEVER check out branches that would block
> the operator's primary git operations. Specifically: agents NEVER
> hold the `main` branch in any worktree (use detached HEAD off
> `origin/main` instead). Agents NEVER create worktrees under paths
> the operator uses for their own work. Agents REMOVE their own
> worktrees after the work's PR merges (or substrate-honestly
> abandon). Substrate-engineering target B-0750 mechanizes this with
> a periodic cleanup job; until that ships, the discipline operates
> by agent-side compliance.

## Operational content

### Rule 1 — NEVER check out `main` in any agent worktree

Agent worktrees that need to BASE OFF main use `--detach`:

```bash
# WRONG (locks main branch in the worktree; blocks operator's
# `git checkout main` in primary checkout):
git worktree add /private/tmp/zeta-feat-xyz main

# RIGHT (detached HEAD at main's current SHA; doesn't hold the
# branch ref; operator can still checkout main in primary):
git worktree add --detach /private/tmp/zeta-feat-xyz origin/main
```

The substrate-honest reason: in a multi-checkout repo, `main` can
ONLY be checked out by ONE worktree at a time. Whichever worktree
holds it BLOCKS all other worktrees + the operator's primary
checkout from `git checkout main`. Agent worktrees should never
acquire that block.

When the agent needs main's current STATE (the file contents at
main's tip), `--detach origin/main` gives exactly that without
holding the branch reference.

### Rule 2 — NEVER create agent worktrees under the operator's primary checkout path

The operator's primary checkout (the repo root from
`git rev-parse --show-toplevel`, referred to here as
`<OPERATOR_PRIMARY_CHECKOUT>`) is operator-controllable. Agent
worktrees go under `/private/tmp/zeta-<task-tag>-<hhmmz>/` or
`/tmp/zeta-<task-tag>-<hhmmz>/`.

Specifically forbidden agent worktree paths:

- `<OPERATOR_PRIMARY_CHECKOUT>/main` (or any subdir of
  the operator's primary checkout)
- `<OPERATOR_PRIMARY_CHECKOUT>/<peer-agent-surface>-*` (or any
  peer-agent surface under operator's primary checkout)
- Any path the operator might `cd` into for their own work

The substrate-honest reason: operator workflows depend on the primary
checkout's `git status` being clean + predictable. Agent worktrees
that share the primary checkout's directory tree create symbolic-link
confusion + operator-side `git` invocation surprises.

### Rule 3 — REMOVE agent worktrees after the work's PR merges (or abandon)

When an agent's PR for the work in a worktree:

- **Merges**: agent confirms the worktree is clean, removes the
  worktree (`git worktree remove <path>`), and deletes the branch
  (`git push origin --delete <branch>` if the agent owns the branch;
  otherwise leaves cleanup to the GitHub auto-delete on merge)
- **Closes without merging**: agent removes the worktree + deletes
  the branch
- **Stays open for further iteration**: agent KEEPS the worktree
  active; this is the legitimate-active-worktree case
- **Abandoned without explicit close**: per
  `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`,
  agent abandonment IS the Standing-by failure mode; the worktree
  should be removed when the work is abandoned

### Rule 4 — Audit + cleanup before substrate-cascade-style work

Before starting a substrate-cascade (multiple-PRs-in-one-session)
work pattern, agents audit their worktree state:

```bash
# Inventory agent's own worktrees:
git worktree list | grep -E "/private/tmp/zeta-|/tmp/zeta-"

# Per-worktree status check (for each one):
git -C <path> status --short
git -C <path> log --oneline -1

# Decide per worktree:
# - SAFE + work done → git worktree remove <path>
# - DIRTY (uncommitted) → preserve OR substrate-honestly commit/abandon
# - active iteration ongoing → keep
```

Empirical anchor: 2026-05-25 session accumulated 37 stale agent
worktrees from one substrate-cascade day, blocking the operator from
`git checkout main`. Mass-cleanup was triggered by operator
intervention ("we need to fix this mess yall always stepping on each
other and me constantly"). The discipline this rule encodes would
have prevented the accumulation.

## Composes with other rules

- `.claude/rules/claim-acquire-before-worktree-work.md` — worktree
  creation discipline (sibling); this rule adds the cleanup discipline
- `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` — sibling worktree-related failure mode
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — abandoned worktrees are Standing-by-failure-mode evidence
- `.claude/rules/honor-those-that-came-before.md` — peer-agent worktrees with active iteration should NOT be force-removed; check for in-progress state first
- `.claude/rules/glass-halo-bidirectional.md` — substrate-honest disclosure of worktree state to operator (this rule's audit step IS bidirectional observation)
- `.claude/rules/non-coercion-invariant.md` HC-8 — operator's primary checkout is operator authority; agent worktrees don't coerce by blocking operator git operations
- `.claude/rules/rule-0-no-sh-files.md` — cleanup tooling per B-0750 is TS-first
- `.claude/rules/no-directives.md` — autonomy-first-class; this rule is operator-substrate-honest discipline self-imposed by agents, not directive imposed on agents

## Composes with substrate

- **B-0750** (this row's backlog companion) — substrate-engineering target for periodic worktree cleanup tooling + agent-worktree-pool primitive (composes with B-0530 cron-sentinel-mutex)
- **B-0530** (cron-sentinel mutex; existing) — multi-agent contention resolution; same problem class
- **[PR #4530](https://github.com/Lucent-Financial-Group/Zeta/pull/4530)**
  plus saturation-ceiling sub-cases documented in
  [`claim-acquire-before-worktree-work.md`](claim-acquire-before-worktree-work.md)
  — empirical anchors for multi-agent worktree contention failures. See
  also archived sibling discussion patterns under `docs/pr-discussions/`,
  including PR #3812 and PR #3894 for the saturation-ceiling /
  worktree-pool lineage.

## Specific cleanup commands

### Audit own agent worktrees

```bash
git worktree list --porcelain | awk '/^worktree /{print $2}' | \
  grep -E "/private/tmp/zeta-|/tmp/zeta-"
```

### Per-worktree clean check

```bash
for wt in <list>; do
  status_count=$(git -C "$wt" status --short 2>/dev/null | wc -l)
  branch=$(git -C "$wt" branch --show-current 2>/dev/null)
  echo "$wt [$branch] ($status_count uncommitted)"
done
```

### Mass-remove safe worktrees

```bash
for wt in <list-of-SAFE-worktrees>; do
  git worktree remove "$wt"
done
git worktree prune
```

Use `git worktree remove --force "$wt"` only after an explicit clean
check or preserve/abandon decision; `--force` discards uncommitted
worktree changes.

### Verify no agent worktree holds `[main]`

The operator's primary worktree often sits on a feature branch rather
than `main`, so checking for "primary on main" produces false negatives.
The correct invariant: **no agent worktree (under `/private/tmp/zeta-*`
or `/tmp/zeta-*`) holds `[main]`**. Zero matches is the happy path; the
operator MAY have `main` checked out in their own primary, but agents
must not.

```bash
# Prints OK on success. If a worktree line prints, an agent worktree
# is holding [main] and is the blocker for operator git operations.
git worktree list | awk '/\[main\]/ { path=$1 } END { exit 0 }' \
  && git worktree list | grep -E "\[main\]" \
  | grep -E "/private/tmp/zeta-|/tmp/zeta-" || echo "OK: no agent holds [main]"
```

Expected result: `OK: no agent holds [main]`, or equivalently no
agent-worktree match if the final echo is omitted. A single operator
primary line is OK when the operator intentionally has `main` checked
out. Any `/private/tmp/zeta-*`, `/tmp/zeta-*`, or per-agent worktree
line holding `[main]` is a violation to fix.

## Substrate-honest framing

This rule does NOT:

- Prevent worktree creation (creation is fine; cleanup is the discipline)
- Mandate aggressive cleanup mid-iteration (in-progress work stays)
- Override operator authority (operator can always force-remove anything)
- Solve the underlying multi-agent contention class (B-0530 + B-0750 cover that at substrate level)

This rule DOES:

- Encode the agent-side discipline that prevents recurring blockage
- Name the specific failure mode (37-worktree accumulation; main-held-by-agent)
- Compose with existing worktree-related rules
- Surface the substrate-engineering target (B-0750 mechanization)

## Empirical anchor

2026-05-25 session: substrate cascade accumulated 37 agent worktrees
across `/private/tmp/zeta-*` (mostly one agent surface's own work), 4
worktrees in the operator's primary checkout subdir (peer-agent
prefix; from past work), and 1 stale `/private/tmp/zeta-<peer-loop>-2`
worktree holding `[main]` at stale SHA.

The `[main]`-holding worktree was THE blocker for the operator's
`git checkout main` in the primary checkout. The exact operator quote
is preserved on the B-0750 backlog/history surface; this current-state
rule keeps the operational lesson in role-reference form.

Mass-cleanup (37 worktrees removed) plus this rule landing prevents
recurrence. Future agent surfaces inherit the discipline at cold-boot.

## Full reasoning

Same 2026-05-25 session that produced today's substrate cascade
(B-0728 through B-0750) generated the worktree accumulation. Without
this rule + B-0750 mechanization, every future high-substrate-cascade
day would recreate the same blockage.
