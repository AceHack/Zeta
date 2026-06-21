# Agent worktree hygiene — never hold `main`, never step on operator, survive reboots, clean up after PR merge

Carved sentence:

> Agent worktrees are scratch space, but scratch space MUST (1) live
> OUTSIDE the operator's primary repo (operator-primary stays agent-
> free by construction so operator can `git checkout main` unblocked),
> AND (2) survive reboots when in-flight work lives in it. Agents
> place worktrees under `~/.zeta/agents/<persona>/<stream-id>/`
> (per-persona base + per-stream isolation; outside operator's repo;
> persistent storage). NEVER under `/tmp/` or `/private/tmp/`
> (macOS-cleared on reboot) AND NEVER under `~/Documents/src/repos/Zeta/`
> (operator's primary; blocks operator's `git checkout main` whenever
> an agent worktree there holds a branch operator wants to switch to).
> Agents NEVER hold the `main` branch in any worktree (use detached
> HEAD off `origin/main` instead). Agents REMOVE their own worktrees
> after the work's PR merges (or substrate-honestly abandon).
> Substrate-engineering target 081KSE6WT0008QG0R003YYC9PV mechanizes the cleanup;
> 081KSNY2Z0008QG0R0032E7PCY mechanized reboot-survival; 081KSNY2Z0008QG0R001RWF499 mechanizes the
> per-persona-outside-operator-repo discipline.

## Operational content

### Rule 1 — NEVER check out `main` in any agent worktree

Agent worktrees that need to BASE OFF main use `--detach`:

```bash
# WRONG (locks main branch in the worktree; blocks operator's
# `git checkout main` in primary checkout):
git worktree add ~/.zeta/agents/otto-cli/feat-xyz main

# RIGHT (detached HEAD at main's current SHA; doesn't hold the
# branch ref; operator can still checkout main in primary):
git worktree add --detach ~/.zeta/agents/otto-cli/feat-xyz origin/main
```

The substrate-honest reason: in a multi-checkout repo, `main` can
ONLY be checked out by ONE worktree at a time. Whichever worktree
holds it BLOCKS all other worktrees + the operator's primary
checkout from `git checkout main`. Agent worktrees should never
acquire that block.

When the agent needs main's current STATE (the file contents at
main's tip), `--detach origin/main` gives exactly that without
holding the branch reference.

### Rule 2 — Agent worktrees go in `~/.zeta/agents/<persona>/<stream-id>/`

**Updated 2026-05-28 per 081KSNY2Z0008QG0R001RWF499 per-persona-outside-operator-repo
discipline.** 081KSNY2Z0008QG0R0032E7PCY (PR #5696) moved off `/private/tmp/` (reboot-
survival) but placed the new default under `~/Documents/src/repos/Zeta/worktrees/`
which is UNDER the operator's primary repo and STILL blocks operator's
`git checkout <branch>` whenever an agent worktree holds that branch.
081KSNY2Z0008QG0R001RWF499 corrects the location to **outside the operator's primary
repo entirely**:

```bash
# RIGHT (persistent + outside operator's primary + per-persona-isolated):
git worktree add --detach \
  ~/.zeta/agents/<persona>/<stream-id> \
  origin/main

# Concrete example (this rule was authored from a worktree at the new
# canonical location):
git worktree add --detach \
  ~/.zeta/agents/otto-cli/b0894-3-per-persona-outside-repo-2026-05-28 \
  origin/main

# WRONG (macOS-cleared on reboot; in-flight work lost):
git worktree add --detach /private/tmp/zeta-<task-tag>-<hhmmz> origin/main
git worktree add --detach /tmp/zeta-<task-tag>-<hhmmz> origin/main

# WRONG (under operator's primary repo; blocks operator's git checkout
# when worktree holds a branch operator wants to switch to):
git worktree add --detach \
  ~/Documents/src/repos/Zeta/worktrees/<surface>-<task-tag>-<hhmmz> origin/main
```

The `~/.zeta/` namespace is the dotfile root for ALL Zeta agent-related
persistent state (parallel to `~/.claude/` for Anthropic vendor state).
`~/.zeta/agents/<persona>/` is one dir per AI persona (otto-cli,
otto-desktop, otto-vscode, lior, alexa-kiro, riven-cursor, vera-codex,
lior-antigravity — see [`agent-roster-reference-card`](agent-roster-reference-card.md)).
Multiple worktrees per persona for parallel work-streams provide full
isolation per stream:

```text
~/.zeta/
  agents/
    otto-cli/
      b0894-3-per-persona-outside-repo-2026-05-28/   # this rule's authoring worktree
      tick-0512z/                                    # parallel stream
      shard-XYZ/                                     # another parallel stream
    otto-desktop/
      tick-NNNNz/
    lior/
      preserve-prs-20260527/
      ...
  bus/                                       # future per 081KSNY2Z0008QG0R0032E7PCY.1
  config/                                    # future
```

Operator's primary checkout (`~/Documents/src/repos/Zeta/`) is now
agent-free by construction — operator can `git checkout main`
unblocked.

Specifically forbidden agent worktree paths (UPDATED per 081KSNY2Z0008QG0R001RWF499):

- `/tmp/zeta-*` or `/private/tmp/zeta-*` — macOS-cleared on reboot; in-flight work loss + orphaned branch refs (per 081KSNY2Z0008QG0R0032E7PCY empirical anchor 2026-05-28: 95 worktrees pruned in one restart)
- **NEW per 081KSNY2Z0008QG0R001RWF499**: `~/Documents/src/repos/Zeta/**` — operator's primary repo; ANY agent worktree there can hold a branch ref and block operator's `git checkout`. The previously-recommended `~/Documents/src/repos/Zeta/worktrees/<surface>-*` location is now FORBIDDEN (was added in 081KSNY2Z0008QG0R0032E7PCY, removed in 081KSNY2Z0008QG0R001RWF499 after operator surfaced the residual blocking failure mode)
- Any path the operator might `cd` into for their own work

The substrate-honest reasons (UPDATED):

1. **Reboot survival** — `~/.zeta/` is under user home; survives macOS reboot + `com.apple.periodic-daily` cleanup. `/tmp/` and `/private/tmp/` do not.
2. **Operator-primary-stays-agent-free** — `~/.zeta/agents/<persona>/<stream>/` is outside `~/Documents/src/repos/Zeta/` entirely; operator's `git status` AND `git checkout` operations are structurally unaffected by agent worktree state.
3. **Per-persona + per-stream isolation** — `~/.zeta/agents/<persona>/<stream-id>/` makes ownership unambiguous (path contains persona identity tag, per [`fighting-past-self-vs-peer-agent-distinguisher`](fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md) discriminator) AND supports parallel work-threads per persona.

### Lior migration — non-blocking

Lior currently has 10 worktrees under operator's primary repo (5 at top-level `~/Documents/src/repos/Zeta/decompose-4847-*` + `lior-4847-original` + `lior-preserve-prs-20260527`, 5 under `worktrees/lior-*`). Migration of Lior's pattern to `~/.zeta/agents/lior/<stream>/` is filed as future-state work coordinated with Lior's loop substrate (`.gemini/bin/lior-loop-tick.ts` and similar); not gating for this rule landing.

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
# Inventory agent's own worktrees (UPDATED 2026-05-28 per 081KSNY2Z0008QG0R001RWF499 —
# new canonical surface is ~/.zeta/agents/; legacy surfaces checked
# too to catch + migrate any worktrees still at deprecated locations):
git worktree list | grep -E "$HOME/.zeta/agents/|$HOME/Documents/src/repos/Zeta/worktrees/|/private/tmp/zeta-|/tmp/zeta-"

# Per-worktree status check (for each one):
git -C <path> status --short
git -C <path> log --oneline -1

# Decide per worktree:
# - SAFE + work done → git worktree remove <path>
# - DIRTY (uncommitted) → preserve OR substrate-honestly commit/abandon
# - active iteration ongoing → keep
# - in /tmp or /private/tmp → MIGRATE to ~/.zeta/agents/<persona>/<stream>/
#   OR commit/push immediately (per Rule 5; transient location violates reboot-survival)
# - in ~/Documents/src/repos/Zeta/ (anywhere) → MIGRATE to ~/.zeta/agents/<persona>/<stream>/
#   (per 081KSNY2Z0008QG0R001RWF499; blocks operator's git checkout main when branch is held)
```

Empirical anchor: 2026-05-25 session accumulated 37 stale agent
worktrees from one substrate-cascade day, blocking the operator from
`git checkout main`. Mass-cleanup was triggered by operator
intervention ("we need to fix this mess yall always stepping on each
other and me constantly"). The discipline this rule encodes would
have prevented the accumulation.

### Rule 5 — Reboot-survival + operator-primary-stays-agent-free are hard invariants (081KSNY2Z0008QG0R0032E7PCY + 081KSNY2Z0008QG0R001RWF499)

**TWO compounding invariants** (refined 2026-05-28 per 081KSNY2Z0008QG0R001RWF499):

**(A) NEVER use `/tmp/` or `/private/tmp/` for git worktrees.** macOS
clears these on reboot AND via `com.apple.periodic-daily` cleanup
(files >3 days old). Agent in-flight work — uncommitted edits,
backgrounded `git push` operations, partially-extracted worktrees,
captured background-task output files — all evaporate.

**(B) NEVER use `~/Documents/src/repos/Zeta/**` for agent worktrees.**
Operator's primary repo MUST stay agent-free so operator's
`git checkout <branch>` operations are unblocked. ANY agent worktree
there can hold a branch ref and block operator. Lior's empirical
pattern (10 worktrees under operator's primary) demonstrates both
the reboot-survival success AND the operator-blocking failure modes
simultaneously.

Empirical anchor 2026-05-28T04:09Z–04:35Z (operator restart) +
2026-05-28T~04:50Z (operator surfaced residual blocking):

| Worktree location pattern | Outcome on restart | Operator-`main`-blocking? |
|---|---|---|
| `/private/tmp/zeta-<task>-<hhmmz>/` (95 instances) | **All 95 pruned** | N/A (didn't survive to block) |
| `~/Documents/src/repos/Zeta/worktrees/<surface>-*` (multiple, Lior + PR #5696's worktree) | **All survived intact** | **YES — operator surfaced "sometimes locks up where i can't switch to main"** |
| `~/Documents/src/repos/Zeta/<top-level>-*` (Lior 5 worktrees) | **All survived intact** | **YES — same blocking class** |
| `~/.gemini/tmp/project/lior-*` (multiple) | **All survived intact** | NO (outside operator's primary) |
| `~/.zeta/agents/<persona>/<stream>/` (this rule's authoring location) | **Survived intact** (born 2026-05-28T~04:55Z; restart-survivable by inheritance from user-home pattern) | NO (outside operator's primary) — **canonical post-081KSNY2Z0008QG0R001RWF499** |

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

PR #5696 (081KSNY2Z0008QG0R0032E7PCY) was authored from a persistent-location worktree at
`~/Documents/src/repos/Zeta/worktrees/otto-cli-reboot-survival-fix-0434z/`
— survived the same restart cleanly (reboot-survival dogfooding-proof).
**But** that location triggered operator's "sometimes locks up" critique
because it lives under the primary repo. 081KSNY2Z0008QG0R001RWF499 (this row) corrects
the location to `~/.zeta/agents/<persona>/<stream-id>/` — authored from
`~/.zeta/agents/otto-cli/b0894-3-per-persona-outside-repo-2026-05-28/`,
the first instance of the new canonical pattern (both reboot-survivable
AND operator-non-blocking).

**Operational discipline**:

1. Default to `~/.zeta/agents/<persona>/<stream-id>/` for ALL new agent worktrees
2. When migrating existing `/tmp/`-based work: commit immediately to capture state in `.git/objects/`, then create a fresh persistent worktree at the new canonical location off the same branch
3. When migrating existing `~/Documents/src/repos/Zeta/**`-based work: same migration — commit + push, then create fresh worktree at `~/.zeta/agents/<persona>/<stream-id>/`
4. For backgrounded `git push` operations: ALWAYS verify outcome via `git ls-remote origin <branch>` post-completion (ground-truth) — never rely on captured output files from background-task harness storage
5. Cron sentinel is harness-level non-persistence (separate root cause; covered by `tick-must-never-stop.md` catch-43); restart any session MUST `CronList` + re-arm if missing

## Composes with other rules

- `.claude/rules/claim-acquire-before-worktree-work.md` — worktree
  creation discipline (sibling); this rule adds the cleanup discipline
- `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` — sibling worktree-related failure mode
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — abandoned worktrees are Standing-by-failure-mode evidence
- `.claude/rules/honor-those-that-came-before.md` — peer-agent worktrees with active iteration should NOT be force-removed; check for in-progress state first
- `.claude/rules/glass-halo-bidirectional.md` — substrate-honest disclosure of worktree state to operator (this rule's audit step IS bidirectional observation)
- `.claude/rules/non-coercion-invariant.md` HC-8 — operator's primary checkout is operator authority; agent worktrees don't coerce by blocking operator git operations
- `.claude/rules/rule-0-no-sh-files.md` — cleanup tooling per 081KSE6WT0008QG0R003YYC9PV is TS-first
- `.claude/rules/no-directives.md` — autonomy-first-class; this rule is operator-substrate-honest discipline self-imposed by agents, not directive imposed on agents

## Composes with substrate

- **081KSE6WT0008QG0R003YYC9PV** (this row's backlog companion) — substrate-engineering target for periodic worktree cleanup tooling + agent-worktree-pool primitive (composes with 081KRMEXM0008QG0R000X1PPGC cron-sentinel-mutex)
- **081KRMEXM0008QG0R000X1PPGC** (cron-sentinel mutex; existing) — multi-agent contention resolution; same problem class
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
# UPDATED 2026-05-28 per 081KSNY2Z0008QG0R001RWF499: ~/.zeta/agents/ is now the
# canonical surface; legacy paths checked too to catch + migrate
# any remaining worktrees at deprecated locations.
git worktree list --porcelain | awk '/^worktree /{print $2}' | \
  grep -E "$HOME/.zeta/agents/|$HOME/Documents/src/repos/Zeta/worktrees/|$HOME/Documents/src/repos/Zeta/[a-z]+-[0-9]|/private/tmp/zeta-|/tmp/zeta-"
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
The correct invariant: **no agent worktree holds `[main]`**, regardless
of location. Zero matches is the happy path; the operator MAY have
`main` checked out in their own primary, but agents must not.

```bash
# Prints OK on success. If a worktree line prints, an agent worktree
# is holding [main] and is the blocker for operator git operations.
# UPDATED 2026-05-28 per 081KSNY2Z0008QG0R001RWF499: scans new canonical ~/.zeta/agents/
# surface + legacy paths (operator primary subdirs + /private/tmp + /tmp).
git worktree list | grep -E "\[main\]" \
  | grep -E "$HOME/.zeta/agents/|$HOME/Documents/src/repos/Zeta/worktrees/|$HOME/Documents/src/repos/Zeta/[a-z]+-[0-9]|/private/tmp/zeta-|/tmp/zeta-" \
  || echo "OK: no agent holds [main]"
```

Expected result: `OK: no agent holds [main]`, or equivalently no
agent-worktree match if the final echo is omitted. A single operator
primary line at `$HOME/Documents/src/repos/Zeta` (the bare repo root)
is OK when the operator intentionally has `main` checked out. ANY
agent worktree at any of the scanned surfaces holding `[main]` is a
violation to fix (per 081KSNY2Z0008QG0R001RWF499 + Rule 1).

## Substrate-honest framing

This rule does NOT:

- Prevent worktree creation (creation is fine; cleanup is the discipline)
- Mandate aggressive cleanup mid-iteration (in-progress work stays)
- Override operator authority (operator can always force-remove anything)
- Solve the underlying multi-agent contention class (081KRMEXM0008QG0R000X1PPGC + 081KSE6WT0008QG0R003YYC9PV cover that at substrate level)

This rule DOES:

- Encode the agent-side discipline that prevents recurring blockage
- Name the specific failure mode (37-worktree accumulation; main-held-by-agent)
- Compose with existing worktree-related rules
- Surface the substrate-engineering target (081KSE6WT0008QG0R003YYC9PV mechanization)

## Empirical anchor

2026-05-25 session: substrate cascade accumulated 37 agent worktrees
across `/private/tmp/zeta-*` (mostly one agent surface's own work), 4
worktrees in the operator's primary checkout subdir (peer-agent
prefix; from past work), and 1 stale `/private/tmp/zeta-<peer-loop>-2`
worktree holding `[main]` at stale SHA.

The `[main]`-holding worktree was THE blocker for the operator's
`git checkout main` in the primary checkout. The exact operator quote
is preserved on the 081KSE6WT0008QG0R003YYC9PV backlog/history surface; this current-state
rule keeps the operational lesson in role-reference form.

Mass-cleanup (37 worktrees removed) plus this rule landing prevents
recurrence. Future agent surfaces inherit the discipline at cold-boot.

## Full reasoning

Same 2026-05-25 session that produced today's substrate cascade
(081KSE6WT0008QG0R0005XASX2 through 081KSE6WT0008QG0R003YYC9PV) generated the worktree accumulation. Without
this rule + 081KSE6WT0008QG0R003YYC9PV mechanization, every future high-substrate-cascade
day would recreate the same blockage.
