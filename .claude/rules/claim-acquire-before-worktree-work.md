# Always `claim acquire` before worktree-creating backlog work

Carved sentence:

> When multiple instances of the **same** agent (e.g., Otto-CLI + Otto-Desktop)
> share git + bus on one machine, **`--from` must differ** (e.g., `otto-cli`
> vs `otto-desktop`) for the claim-coordinator (`tools/bus/claim.ts`,
> B-0400 slice 3) to prevent split-brain — identical `--from` values both
> exit 0 (same-sender idempotent re-acquire). As of PR #3037 (2026-05-13)
> `SENDER_IDS` includes surface-tagged variants — opt in to `otto-cli` /
> `otto-desktop` / `alexa-cli` / `alexa-kiro` / etc. for correct
> distinction. Identity-level names (`otto`, `alexa`, etc.) remain
> valid for back-compat but do NOT distinguish surfaces. Branch-prefix
> is NOT a workaround because `claim acquire` only filters by `from`,
> not by `branch`. Before starting work on any backlog row,
> `claim acquire` first with your surface-tagged sender ID. If already
> claimed by another agent, pick a different row.

## Operational content

The bus claim-coordinator already exists (PR #2939, merged 2026-05-09):

```bash
# Before any worktree-creating backlog work:
bun tools/bus/claim.ts acquire --from <agent> --item <B-NNNN> [--branch <ref>]
# Exit 0 = claim acquired; proceed
# Exit 1 = already claimed by another agent; pick a different row

# After PR merges or work abandoned:
bun tools/bus/claim.ts release --from <agent> --item <B-NNNN>
```

The claim envelope (`topic: "claim", action: "claim"`) lives on the bus with
24h TTL by default. It is visible to all agents reading
`/tmp/zeta-bus/` and to all factory surfaces (Otto-CLI, Otto-Desktop,
Vera-Codex, Riven-Cursor, Lior-Antigravity, Alexa-Kiro).

## When this rule applies

**APPLIES** to:

- Starting work on a `docs/backlog/P*/B-*.md` row (any slice)
- Creating a feature branch + worktree for that row
- Opening a PR that closes / advances a backlog row

**DOES NOT APPLY** to:

- Fixing CI failures on an already-claimed PR
- Resolving review threads on an already-claimed PR
- Ad-hoc memory-file writes / substrate-honest disclosure responses to
  Aaron's messages (these are conversation-driven, not backlog-driven)
- Hot fixes to broken main / rollback PRs (urgency > coordination)

## Worktree force-remove guard

When `git checkout <branch>` or `git worktree add ... <branch>` fails with
`fatal: '<branch>' is already used by worktree at '<path>'`, do NOT
`git worktree remove --force <path>` to take over peer Otto's worktree.
That path is operational state — even if the directory looks stale, peer
Otto may be mid-edit. Instead:

1. **Create a new worktree at a different path** for your branch-related
   work. Use a distinct task-tagged path (e.g., `/tmp/zeta-3153-find-fix`
   for thread-investigation; `/private/tmp/zeta-otto-desktop-claim-extend`
   for rule edits) so the two worktrees don't collide.

2. **If peer Otto's branch needs your attention** (e.g., review-thread
   resolution under the DOES-NOT-APPLY clause above), you can do that
   work via `gh api` mutations + GraphQL — no checkout required.

3. **If you truly need to checkout peer Otto's branch** (rare), check
   the bus for a claim on that branch first, post a `worktree-handoff`
   advisory envelope, and wait for peer-Otto-side release before
   force-removing.

Empirical anchor: 2026-05-14T18:13Z Otto-CLI tick shard
([docs/hygiene-history/ticks/2026/05/14/1813Z.md](../../docs/hygiene-history/ticks/2026/05/14/1813Z.md))
documents force-remove of Otto-Desktop's `/private/tmp/zeta-otto-id-alloc`
worktree (on PR #3153 branch) to resolve a Codex thread. Worked, but
substrate-honest: a fresh worktree at `/tmp/zeta-3153-find-fix` would
have been equally effective and non-destructive. The PR-thread-resolution
DOES-NOT-APPLY clause covered the WHY of the action; it did not cover
the HOW.

## Borrow-on-existing pattern — concurrent-Otto-CLI fallback

When `git worktree add <new-path>` rolls back with `fatal: Could not
reset index file to revision 'HEAD'` and/or `error: unable to open
object pack directory: ... Interrupted system call` — that's the
worktree-prune-race documented in [B-0530](../../docs/backlog/P3/B-0530-cron-sentinel-mutex-prevent-otto-cli-self-contention-2026-05-15.md).
Root cause: multi-session Otto-CLI concurrency on shared `.git/objects/pack`
during `git worktree add`'s internal `git reset --hard`. Standard git
behavior under FS contention, NOT external pruning.

**`--lock --reason "..."` does NOT prevent this failure** — the
`locked` marker file in `.git/worktrees/<name>/locked` blocks `git
worktree prune` but not git's own rollback on `Interrupted system
call`. Empirical: 5 consecutive `git worktree add` attempts during
tick 0414Z, all rolled back; one with `--lock`, same outcome.

**Borrow-on-existing pattern** (concurrent-Otto-CLI safe):

1. Identify an existing Otto-CLI sibling worktree old enough to be
   stable through the contention window (empirically ~3h+ ages
   survive consistently; e.g.,
   `/private/tmp/zeta-otto-cli-0027z-sidetick`).
2. Save the original branch name: `ORIG=$(git -C <wt> branch --show-current)`.
3. `git -C <wt> fetch origin main`.
4. `git -C <wt> switch -c <new-branch> origin/main` — carries any
   staged/unstaged working-tree state with you. Untracked files on
   the original branch survive the switch **provided the target
   branch does not track the same path** (otherwise `git switch`
   refuses; `git stash -u` first).
5. Edit/write only the files you control via explicit paths; never
   `git add -A` (would sweep peer-Otto's WIP into your commit).
6. `git commit <explicit-paths>` + `git push -u origin <new-branch>`.
7. `git -C <wt> switch <ORIG>` to restore peer-Otto's state. Tracked
   modifications and untracked files preserved across the switch.

**Why this works**: `git switch` only updates HEAD + the worktree's
local index. It does NOT contend on `.git/objects/pack` the way `git
worktree add`'s internal `git reset --hard` does. The race is at
shared-pack-dir scope, not at branch-switch scope.

**Empirical validation**: 5 successful borrows on `0027z-sidetick`
across ticks 0452Z / 0458Z / 0503Z×2 / 0517Z / 0524Z / 0710Z. Peer-Otto
landed 2 commits to the same worktree's original branch concurrently
(commits `d147db0` + `cc1f430`) without conflicts.

**When this pattern applies**:

- New `git worktree add` is failing with `Interrupted system call`
  rollback (the B-0530 failure mode)
- Multiple concurrent Otto-CLI claude-code processes detected
  (`pgrep -fl claude-code` returns more than your own PID)
- You need to commit a tick shard / small PR and can't wait for
  the contention window to clear

**When this pattern does NOT apply**:

- You need to keep work isolated from peer-Otto on the borrowed
  worktree's original branch (use new-worktree-creation when
  contention isn't blocking)
- You need to checkout peer-Otto's currently-checked-out branch
  (the borrow pattern uses `git switch -c <new-branch>`, not
  `git switch <peer-branch>`)
- Long-running work that would block peer-Otto's tick cycle
  (the borrow inverts the priorities — peer-Otto must wait for
  your switch-back; keep borrows short)

Composes with [B-0530](../../docs/backlog/P3/B-0530-cron-sentinel-mutex-prevent-otto-cli-self-contention-2026-05-15.md)
(the mutex mitigation in `tools/orchestrator-checks/cron-sentinel-mutex.ts`
when it ships); until that ships, the borrow pattern is the
operational workaround.

## Saturation-ceiling — 5 failure sub-cases of borrow-on-existing

Empirical anchor [PR #3808](https://github.com/Lucent-Financial-Group/Zeta/pull/3808)
(closed-without-merge; shard for `0715Z` was the PR's payload, hence never
landed on `origin/main`): under sustained multi-Otto saturation (4+
instances active in parallel: Otto-CLI primary, otto-bg-worker,
fresh-cold-boot Otto-CLI, and peer-agent global-lock-cleanup loop), with
peer Otto cycling worktree HEAD every ~3-5 min for 9 transitions in
35 min, a fresh-cold-boot session attempting to ship a shard hit FOUR
distinct failure sub-cases of the borrow-on-existing pattern across 4
commit attempts. All 4 of those sub-cases empirically validated; only 2
have working mitigations today. **A fifth sub-case (3b — pack-dir
contention at push time) was added in 2026-05-21 (PR [#4536](https://github.com/Lucent-Financial-Group/Zeta/pull/4536)) with a working mitigation
(REST git-data API bypass).**

### Sub-case 1 — existing-branch-name collision → peer-WIP commit inheritance via recovery path

`git switch -c <name> origin/main` on a name that **already exists locally**
fails with `fatal: a branch named '<name>' already exists` (exit 128).
The hazard is the recovery path: an agent reacting to that error often
runs `git switch <name>` (without `-c`) which silently checks out the
existing branch — if that branch carries peer WIP commits (e.g., from a
prior session or peer Otto's abandoned slice), the "fresh" workstream
inherits them. Any PR opened from this branch duplicates peer's PR work.
The `-C` (capital) variant of `git switch` would force-reset the existing
branch to `origin/main` instead, which destroys peer WIP — equally bad
in the opposite direction.

**Mitigation (works)**:

```bash
# Pre-check via git show-ref --verify on refs/heads/ — precise local-branch check.
# Do NOT use `git rev-parse <name>`: it resolves HEAD, tags, and (in some
# configs) remote-tracking refs as success, producing false positives that
# trigger needless uniquification.
if git show-ref --verify --quiet "refs/heads/<candidate-name>"; then
  echo "name taken; uniquify (add -coldboot / -N suffix)"
fi
# If taken, uniquify before git switch -c
git switch -c <name>-coldboot origin/main
```

### Sub-case 2 — concurrent-WIP-blocked switch

When `git switch` is attempted while peer Otto's tracked-WIP modifications
are in the working tree, the switch refuses (would discard peer's WIP).
`git reset --hard` (the standard recovery path) would also discard peer's
WIP. **No clean recovery exists that BOTH (a) lands a fresh-target
worktree AND (b) leaves peer's WIP exactly as observed.** `git switch
-m/--merge <target>` (per `git switch -h`: "perform a 3-way merge with
the new branch") is the closest partial recovery — it carries tracked
local changes onto the target branch, possibly with merge conflicts to
resolve. The peer's WIP is preserved AS-MIGRATED, not as-observed, and
conflict resolution can corrupt peer's intent. Use only when (a) the WIP
shape is well-understood, (b) the migration semantics match the peer's
expectation, and (c) the post-switch worktree is reserved for the
borrowing session (so peer's next operation doesn't read a partially-
merged tree as authoritative).

**Mitigation (works, capacity-limited)**: wait for peer's WIP window to
close — working tree returns clean. Clean windows appear roughly every
5-8 min during sustained saturation. Detection via `git status --short`
returning empty. Strategy is capacity-limited: a fresh-cold-boot session
that can't find a clean window within its tick budget must abandon the
attempt. The `git switch -m` partial-recovery path above is acceptable
under the three conditions stated; default remains "wait for clean
window" because the migration-not-preservation semantics are easy to
mistake for true peer-WIP preservation.

### Sub-case 3 — pack-dir contention hangs `git worktree add` (B-0530 race)

`git worktree add /tmp/new-path` contends on `.git/objects/pack` during
its internal `git reset --hard`. Hangs indefinitely under sustained peer
activity. No `--lock` flag prevents this; see [B-0530](../../docs/backlog/P3/B-0530-cron-sentinel-mutex-prevent-otto-cli-self-contention-2026-05-15.md).

**Mitigation (no working mitigation today)**: requires B-0530 cron-sentinel
mutex (not yet shipped). Until then, fall through to existing-sidetick
borrow — which hits sub-case 4.

### Sub-case 3b — pack-dir contention causes `git push` to fail at push time

Same B-0530 root cause class as sub-case 3, but manifesting at `git push`
time on an already-created worktree that previously passed the canary.
Distinguished from B-0615 (silent-push-failure) by being non-silent.

**Symptom**: `git push` returns non-zero exit with errors like:

```
error: unable to open loose object <sha>: Interrupted system call
error: unable to open object pack directory: .../.git/objects/pack: Interrupted system call
fatal: bad object <sha>
fatal: the remote end hung up unexpectedly
error: failed to push some refs to '...'
```

Network + auth are fine; bottleneck is local pack-dir reads under peer-agent
contention. Distinguish from **B-0615** (push exits ZERO but remote ref
never updates — silent; mitigation: REST git-data API bypass per
[PR #4145](https://github.com/Lucent-Financial-Group/Zeta/pull/4145)).
Both belong to the same FS-contention root cause class but require
different mitigations because the exit codes differ.

**Mitigation (working today)**: the **B-0615 REST git-data API bypass**
(`POST .../git/blobs` → `POST .../git/trees` → `POST .../git/commits` →
`POST/PATCH .../git/refs`) works for sub-case 3b as well as B-0615.
Empirical anchor: [PR #4535](https://github.com/Lucent-Financial-Group/Zeta/pull/4535)
(2026-05-21) — the memo about this very failure mode was blocked from
landing by repeated `timeout`-wrapped `git push` runs surfacing exit 124
(GNU `timeout`'s "command killed by timeout" status — NOT a native
`git push` exit code; the contention was hanging the push indefinitely
until the wrapper killed it). The same commits then shipped successfully
via the REST bypass.

**Cost**: ~5-6 REST calls total per commit, consuming the **REST/core
budget** (5000/hr per token; check via `gh api rate_limit --jq
'.resources.core'`). REST/core is independent of the GraphQL budget
discussed in [`refresh-world-model-poll-pr-gate.md`](refresh-world-model-poll-pr-gate.md);
the tier classification in that rule (Normal / Cost-aware / Extreme /
Pure-git) is GraphQL-budget-scoped and does NOT translate directly to
REST/core. Empirically: even at GraphQL Extreme cost-aware tier (200–1000
remaining), REST/core typically has thousands remaining and the bypass
is affordable. No `.git/objects/pack` reads happen locally because
GitHub does the object packing server-side from the blob you uploaded.

**Composes with the rate-limit operational tiers** documented in
[`refresh-world-model-poll-pr-gate.md`](refresh-world-model-poll-pr-gate.md):
when the saturation makes `git push` exit non-zero or hang, the REST
bypass IS the tier-skipping move that lets substantive substrate land
without waiting for contention to clear.

### In-place index recovery — `git read-tree HEAD`

Refinement to sub-case 5 (peer-side destructive git operation), where the
specific symptom is a **truncated index file** after stale-lock removal:

```
fatal: .git/worktrees/<name>/index: index file smaller than expected
```

A preceding `git status` may show massive D (deleted) entries against
files you have not touched — a misleading symptom of the corrupted index,
NOT actual working-tree deletion. Do NOT abandon the worktree on this
symptom alone; first verify the working tree itself via `ls` (files
should still be on disk).

**Recovery**:

```bash
git -C <worktree> read-tree HEAD
```

This rebuilds the worktree's index from the HEAD commit, replacing the
truncated index in-place. Working-tree files are NOT modified (they were
not part of the corruption — only the index was). After rebuild:

1. `git status` now reflects the genuine working-tree-vs-HEAD diff —
   not "empty," because `read-tree` only rewrote the index, not the
   working tree. Any intended local edits / untracked files you had
   before the corruption STILL show as modified / untracked. The
   `index file smaller than expected` error is gone; that is the
   indicator the recovery worked. (Misreading `read-tree` as "should
   produce a clean status" is the most common way the recovery gets
   misdiagnosed as failed when it actually succeeded.)
2. Stage your intended file via `git add <path>` — the file is still
   on disk; `read-tree` wiped any stale staged state but did not touch
   the working tree
3. `git commit` normally
4. Verify commit canary (parent tree size = commit tree size) before
   pushing per [`codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`](codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md)

**When NOT to use**: if the working tree itself is corrupted (files
missing on disk), `read-tree` will silently stage the wrong state.
Pre-check disk state via `ls` before invoking. This recovery applies
ONLY to truncated-INDEX states, NOT truncated-working-tree states.

**Empirical anchor**: [PR #4532](https://github.com/Lucent-Financial-Group/Zeta/pull/4532)
(2026-05-21) — the 1212Z tick shard was successfully shipped after
`read-tree HEAD` recovered an index truncated by stale-lock-removal
race; previously the saturation-ceiling rule's only recovery option
was worktree abandonment.

### Sub-case 4 — pruned-sidetick race

The empirically-validated sidetick `/private/tmp/zeta-otto-cli-0027z-sidetick`
was listed in `git worktree list` BUT the directory had been pruned between
the list snapshot and the borrow attempt. `git -C` returned "cannot change
to ... No such file or directory".

**Mitigation (no working mitigation today)**: requires a worktree-pool
primitive — pre-allocated isolated sideticks per Otto identity, owned and
refreshed by each identity, not subject to peer-prune. Composes with the
`claim acquire` discipline at worktree-allocation scope. Substrate-engineer
candidate; not yet a backlog row.

### Composite operational discipline under saturation

When a fresh session (especially scheduled-task autonomous-loop firing
during peer cascade) needs to ship a shard / substrate edit:

1. Apply [`refresh-before-decide`](refresh-before-decide.md) — check rate-limit tier first
2. Check peer cascade intensity via `gh pr list --state open` (cost-aware)
   OR `git log origin/main` (free) — if multi-instance saturation, defer
3. Pre-check candidate branch names via `git show-ref --verify --quiet
   refs/heads/<name>` — uniquify if taken (sub-case 1; do NOT use
   `git rev-parse`, which resolves HEAD/tags/remote refs as false positives)
4. Detect working-tree-clean window via `git status --short` — only switch
   off peer-occupied branches when WT is empty (sub-case 2)
5. Set [`ZETA_EXPECTED_BRANCH`](zeta-expected-branch.md) env var immediately before commit; use the
   `git branch --show-current` guard (catches mid-flight HEAD-desync)
6. Use `gh pr create --head <my-branch>` with explicit head ref (per
   [`zeta-expected-branch.md`](zeta-expected-branch.md) companion defense)
7. If sub-cases 3 or 4 are hit and the attempt fails, ABANDON the shard
   write — document the empirical evidence in turn output and end the
   tick. Repeated retries under contention amplify the risk of peer-WIP
   contamination.

## Composes with other rules

- `.claude/rules/backlog-item-start-gate.md` — already mandates prior-art
  search + dependency check; this rule adds `claim acquire` as the
  zero-th step before those checks
- `.claude/rules/dont-ask-permission.md` — within authority scope, ship;
  `claim acquire` exit 0 IS the substrate-level permission grant
- `.claude/rules/never-be-idle.md` — if claim acquire fails, pick a
  different row from the same priority tier (don't go idle)
- `.claude/rules/honor-those-that-came-before.md` — claim acquire
  preserves the work the holder is doing

## Operational examples

### Example 1: Otto-CLI picks B-0444 (which exists)

```bash
$ bun tools/bus/claim.ts acquire --from otto --item B-0444 --branch otto/b0444-impl-2026-05-13
$ echo $?
0
# Proceeded with worktree creation + impl
```

### Example 2: Otto-CLI and Otto-Desktop race — FIXED (PR #3037)

```bash
# Otto-CLI publishes claim first (using surface-tagged sender):
$ bun tools/bus/claim.ts acquire --from otto-cli --item B-0444
$ echo $?
0

# Otto-Desktop tries to claim the same row with its OWN surface ID:
$ bun tools/bus/claim.ts acquire --from otto-desktop --item B-0444
$ echo $?
1   # otto-desktop sees otto-cli's claim, exits 1 — split-brain prevented
```

**Schema fix landed (PR #3037, 2026-05-13):** `otto-cli`, `otto-desktop`,
`alexa-cli`, `alexa-kiro`, `riven-cli`, `riven-cursor`, `lior-antigravity`,
`lior-gemini`, and `vera-codex` are now valid `SENDER_IDS`. The prior
architectural gap (two callers passing `--from otto` were indistinguishable)
is resolved — use surface-tagged variants for correct multi-surface claim
distinction. Identity-level names (`otto`, `alexa`, etc.) remain valid for
back-compat.

**Lane-based convention** (zero-code; still useful as defense-in-depth):
Otto-CLI takes backlog grinding + slice impl; Otto-Desktop takes substrate +
cowork. Even with the schema fix, different scopes reduce collision risk further.

**Branch-prefix is NOT a workaround**: `claim acquire` filters
existing claims by `c.from !== sender` only, NOT by branch. Two
Ottos with `--from otto` but different `--branch` values BOTH
acquire (both exit 0) — the branch field is post-hoc disambiguation
metadata, not a coordination key. Vera caught this 2026-05-13 on
PR #3032.

### Example 3: Otto-CLI and Otto-Desktop race (with schema fix)

```bash
# Otto-CLI publishes claim first:
$ bun tools/bus/claim.ts acquire --from otto-cli --item B-0444
$ echo $?
0

# Otto-Desktop tries to claim same row with DIFFERENT --from:
$ bun tools/bus/claim.ts acquire --from otto-desktop --item B-0444
$ echo $?
1   # Otto-Desktop sees otto-cli's claim, exits 1
# Otto-Desktop picks B-0445 instead.
```

This is the operational behavior as of PR #3037 (2026-05-13). Use surface-tagged
`--from otto-cli` / `--from otto-desktop` (not `--from otto`) for correct
multi-surface split-brain prevention.

### Example 4: Otto-CLI crashes mid-work

```bash
# Otto-CLI process dies. Claim stays on bus with 24h TTL.
# Otto-Desktop checks:
$ bun tools/bus/claim.ts check --item B-0444
# Output: claimed by otto (TTL expires in 23h 59m)

# After 24h the claim auto-expires (TTL). No PID-liveness reclaim exists;
# only TTL expiry or explicit `release` ends a claim.
```

## Why this rule exists (operational evidence)

Aaron 2026-05-13 set up Otto on Claude Desktop alongside Otto-CLI. The
two-foreground-surface architecture creates a real split-brain risk:
both Ottos might pick the same backlog row simultaneously, leading to
duplicate work, race conditions, or worse — both committing to the
same branch with conflicts.

The claim-coordinator (B-0400 slice 3, PR #2939) was built for exactly
this. Without a rule enforcing its use, both Ottos might forget to
acquire claims and the split-brain happens. The substrate-honest fix
is mechanizing the discipline via this rule.

Per `.claude/rules/encoding-rules-without-mechanizing.md`: this rule
auto-loads at cold-boot so future-Otto reads it before any backlog
work.

## Composes with substrate

- B-0400 (bus protocol — the schema this rule uses)
- B-0400 slice 3 (PR #2939 — claim-coordinator implementation)
- B-0400 slice 5 (PR #2959 — `--with-bus-claims` gate integration)
- PR #3017 (B-0440.4 — bus publish pattern; same protocol)
- `memory/persona/otto/conversations/2026-05-12-otto-canonical-bootstream-multi-foreground-surface-orchestrator-ifs-format.md`
  (the multi-foreground-surface design this rule operationalizes)
- `docs/launch/2026-05-13-otto-claude-desktop-bootstream-tight.md`
  (PR #3030 — Claude Desktop variant; second Otto surface)
- `memory/feedback_aaron_good_failure_mode_git_fetch_before_push_catches_multi_agent_duplicate_work_2026_05_13.md`
  (sibling fetch-before-push discipline; same coordination pattern at
  git scope)

## Substrate-honest framing

This rule is not a strict requirement at the code level — the
claim-coordinator returns a useful exit code, but no automated hook
enforces calling it. The discipline relies on agent-side compliance
at cold-boot.

A future slice could add a pre-commit / pre-worktree hook that calls
`claim check` automatically and fails if no claim is held. That's
substrate-level mechanization. Today's rule is the discipline-level
mechanization.

## Full reasoning

PR #2939 (B-0400 slice 3 — claim-coordinator implementation)
PR #2959 (B-0400 slice 5 — bus-gate integration)
PR #3017 (B-0440.4 — bus publish pattern)
PR #3030 (Otto Claude Desktop tight bootstream — second Otto surface)

Aaron 2026-05-13 verbatim: *"probalby want to figure out how not to
split brain with yourself bot any idea?"* — substrate-honest naming
of the split-brain risk; this rule is the operationally-honest
answer.
