# Agent worktree hygiene — never hold `main`, never step on operator, survive reboots, clean up after PR merge

Carved sentence:

> Agent worktrees are scratch space, but scratch space MUST survive
> reboots when in-flight work lives in it. Agents place worktrees
> under `~/Documents/src/repos/Zeta/worktrees/<surface>-<task-tag>-<hhmmz>/`
> (persistent storage), NEVER under `/tmp/` or `/private/tmp/`
> (macOS-cleared on reboot AND on `com.apple.periodic-daily` cleanup
> of files >3 days old). Agents NEVER hold the `main` branch in any
> worktree (use detached HEAD off `origin/main` instead). Agents
> NEVER create worktrees under paths the operator uses for their own
> work, with one exception: the repo's own `worktrees/` subdirectory
> is git-aware and operator-safe. Agents REMOVE their own worktrees
> after the work's PR merges (or substrate-honestly abandon).
> Substrate-engineering target B-0750 mechanizes the cleanup;
> B-0894 mechanizes the reboot-survival default-location.

## Operational content

### Rule 1 — NEVER check out `main` in any agent worktree

Agent worktrees that need to BASE OFF main use `--detach`:

```bash
# WRONG (locks main branch in the worktree; blocks operator's
# `git checkout main` in primary checkout):
git worktree add ~/Documents/src/repos/Zeta/worktrees/zeta-feat-xyz main

# RIGHT (detached HEAD at main's current SHA; doesn't hold the
# branch ref; operator can still checkout main in primary):
git worktree add --detach ~/Documents/src/repos/Zeta/worktrees/zeta-feat-xyz origin/main
```

The substrate-honest reason: in a multi-checkout repo, `main` can
ONLY be checked out by ONE worktree at a time. Whichever worktree
holds it BLOCKS all other worktrees + the operator's primary
checkout from `git checkout main`. Agent worktrees should never
acquire that block.

When the agent needs main's current STATE (the file contents at
main's tip), `--detach origin/main` gives exactly that without
holding the branch reference.

### Rule 2 — Agent worktrees go in `<repo>/worktrees/<surface>-<task-tag>-<hhmmz>/`

**Updated 2026-05-28 per B-0894 reboot-survival discipline.** Previously
this rule recommended `/private/tmp/zeta-<task-tag>-<hhmmz>/` which is
macOS-cleared on reboot AND on `com.apple.periodic-daily` cleanup of
files >3 days old. **Persistent location is the new default**:

```bash
# RIGHT (persistent; survives reboot; outside operator's git status):
git worktree add --detach \
  ~/Documents/src/repos/Zeta/worktrees/<surface>-<task-tag>-<hhmmz> \
  origin/main

# WRONG (macOS-cleared on reboot; in-flight work lost):
git worktree add --detach /private/tmp/zeta-<task-tag>-<hhmmz> origin/main
git worktree add --detach /tmp/zeta-<task-tag>-<hhmmz> origin/main
```

The repo's `worktrees/` subdirectory at top-level is the canonical
persistent location. Git's worktree mechanism auto-excludes worktree
paths from the parent's `git status`, so worktrees under `<repo>/worktrees/`
don't pollute the operator's `git status` even though they live under
the operator's repo root. Lior already uses this pattern (e.g.,
`~/Documents/src/repos/Zeta/worktrees/lior-fix-4772-archive-ts/`) and
Lior's worktrees consistently survive operator restarts.

Specifically forbidden agent worktree paths (UPDATED):

- `/tmp/zeta-*` or `/private/tmp/zeta-*` — **NEW**: macOS-cleared on reboot; in-flight work loss + orphaned branch refs (per B-0894 empirical anchor 2026-05-28: 95 worktrees pruned in one restart)
- `<OPERATOR_PRIMARY_CHECKOUT>/main` (or any subdir of the operator's primary checkout EXCEPT `worktrees/`)
- `<OPERATOR_PRIMARY_CHECKOUT>/<peer-agent-surface>-*` at the top-level (this pollutes operator's `git status`; place under `worktrees/<surface>-*` instead)
- Any path the operator might `cd` into for their own work

The substrate-honest reasons:

1. **Reboot survival** — agent in-flight commits, edits, and backgrounded `git push` operations MUST survive macOS reboots and periodic-cleanup. `/tmp/` and `/private/tmp/` violate this invariant.
2. **Operator-status cleanliness** — operator workflows depend on the primary checkout's `git status` being clean + predictable. Worktrees under `<repo>/worktrees/` are git-aware (auto-excluded from operator's status); top-level subdirs are NOT (would pollute status).

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
# Inventory agent's own worktrees (UPDATED 2026-05-28 — also check
# legacy /tmp paths to catch + migrate any remaining transient worktrees):
git worktree list | grep -E "$HOME/Documents/src/repos/Zeta/worktrees/|/private/tmp/zeta-|/tmp/zeta-"

# Per-worktree status check (for each one):
git -C <path> status --short
git -C <path> log --oneline -1

# Decide per worktree:
# - SAFE + work done → git worktree remove <path>
# - DIRTY (uncommitted) → preserve OR substrate-honestly commit/abandon
# - active iteration ongoing → keep
# - in /tmp or /private/tmp → MIGRATE to persistent location OR commit/push immediately
#   (per Rule 5; transient location violates reboot-survival)
```

Empirical anchor: 2026-05-25 session accumulated 37 stale agent
worktrees from one substrate-cascade day, blocking the operator from
`git checkout main`. Mass-cleanup was triggered by operator
intervention ("we need to fix this mess yall always stepping on each
other and me constantly"). The discipline this rule encodes would
have prevented the accumulation.

### Rule 5 — Reboot-survival is a hard invariant (B-0894)

**NEVER use `/tmp/` or `/private/tmp/` for git worktrees.** macOS
clears these on reboot AND via `com.apple.periodic-daily` cleanup
(files >3 days old). Agent in-flight work — uncommitted edits,
backgrounded `git push` operations, partially-extracted worktrees,
captured background-task output files — all evaporate.

Empirical anchor 2026-05-28T04:09Z–04:35Z (operator restart):

| Worktree location pattern | Outcome on restart |
|---|---|
| `/private/tmp/zeta-<task>-<hhmmz>/` (95 instances) | **All 95 pruned** (`git worktree list` returned them as `prunable`; on-disk dirs cleared) |
| `~/Documents/src/repos/Zeta/worktrees/<surface>-*` (multiple) | **All survived intact** |
| `~/.gemini/tmp/project/lior-*` (multiple) | **All survived intact** (`~/.gemini/` is persistent user-home) |

The 04:09Z autonomous-loop tick had a substantive tick-shard commit
(`4f89af885`) sitting on branch
`otto-cli/tick-0409z-sentinel-rearm-2026-05-28` with a backgrounded
`git push` in flight when restart hit. Push never completed; worktree
directory at `/private/tmp/zeta-otto-cli-0409z-sentinel-rearm/` was
gone post-restart. Branch ref + commit object survived in `.git/objects/`
(git's object store is in repo, not in `/tmp/`), so the commit could
theoretically be re-pushed from a fresh worktree — but the
backgrounded-task output file at
`/private/tmp/claude-501/<harness-id>/tasks/<task-id>.output` was
also cleared, so we couldn't even read whether the push had completed
before restart.

The persistent-location worktree authoring B-0894 (this row's substrate
landing) survived the same restart cleanly — empirical dogfooding-proof.

**Operational discipline**:

1. Default to `~/Documents/src/repos/Zeta/worktrees/<surface>-<task-tag>-<hhmmz>/` for ALL new agent worktrees
2. When migrating existing `/tmp/`-based work: commit immediately to capture state in `.git/objects/`, then if in-flight work is critical, create a fresh persistent worktree off the same branch
3. For backgrounded `git push` operations: ALWAYS verify outcome via `git ls-remote origin <branch>` post-completion (ground-truth) — never rely on captured output files from background-task harness storage
4. Cron sentinel is harness-level non-persistence (separate root cause; covered by `tick-must-never-stop.md` catch-43); restart any session MUST `CronList` + re-arm if missing

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
# UPDATED 2026-05-28 per B-0894: persistent-location is now the
# primary surface; legacy /tmp paths checked too to catch + migrate
# any remaining transient worktrees that need cleanup.
git worktree list --porcelain | awk '/^worktree /{print $2}' | \
  grep -E "$HOME/Documents/src/repos/Zeta/worktrees/|/private/tmp/zeta-|/tmp/zeta-"
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
The correct invariant: **no agent worktree (under `<repo>/worktrees/`,
`/private/tmp/zeta-*`, or `/tmp/zeta-*`) holds `[main]`**. Zero matches
is the happy path; the operator MAY have `main` checked out in their
own primary, but agents must not.

```bash
# Prints OK on success. If a worktree line prints, an agent worktree
# is holding [main] and is the blocker for operator git operations.
# UPDATED 2026-05-28: also catches persistent-location worktrees per
# B-0894 new default (~/Documents/src/repos/Zeta/worktrees/).
git worktree list | grep -E "\[main\]" \
  | grep -E "$HOME/Documents/src/repos/Zeta/worktrees/|/private/tmp/zeta-|/tmp/zeta-" \
  || echo "OK: no agent holds [main]"
```

Expected result: `OK: no agent holds [main]`, or equivalently no
agent-worktree match if the final echo is omitted. A single operator
primary line is OK when the operator intentionally has `main` checked
out. Any `<repo>/worktrees/*`, `/private/tmp/zeta-*`, `/tmp/zeta-*`,
or per-agent worktree line holding `[main]` is a violation to fix.

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
