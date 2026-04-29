---
Scope: Read-only inventory ledger for lost-substrate audit. Generated as the prerequisite step before any destructive action (branch deletion, worktree pruning, hard reset).
Attribution: Aaron 2026-04-29 status-check question via Amara-translated multi-AI converged stance — *"When the factory has too many unknowns, do not choose a fix. Build the inventory ledger."*
Operational status: research-grade
Lifecycle status: active
Non-fusion disclaimer: This is a snapshot in time, not a continuous metric. Counts will drift as PRs land and worktrees are pruned. Re-run on cadence per B-0090.
---

# Lost-substrate inventory ledger — 2026-04-29

## Why this ledger exists

Aaron's 2026-04-29 status-check surfaced three real gaps:

1. 0/0/0 LFG ↔ AceHack divergence not satisfied (145 ahead / 562 behind)
2. Trajectory rules filed but mostly not automated
3. 284 gone-upstream branches + 57 locked worktrees not drained

Multi-AI converged stance (Aaron forwarding Amara): *"Do not
forward-sync 562 commits first. Do not delete branches/worktrees
first. Do not create new doctrine. First build the inventory
ledger."*

This ledger is that prerequisite step. Read-only audit. No
destructive action authorized by this file.

## Hard stop rules (binding)

```text
1. No destructive branch/worktree action until classification
   ledger exists.
2. No hard reset while UNKNOWN lost-substrate candidates remain.
3. [gone] upstream does NOT mean safe to delete.
4. locked worktree does NOT mean broken.
5. ahead/behind count does NOT equal content-loss surface.
```

GitHub compare API is diagnostic, not a reset/safety decision.
`git fetch --prune` cleans stale REMOTE-TRACKING refs only;
local branch decisions need separate classification.

## Top-level counts (snapshot 2026-04-29)

### LFG ↔ AceHack divergence

```text
status:     diverged
ahead_by:   145 (AceHack vs LFG main; in-flight feature work)
behind_by:  562 (AceHack vs LFG main; forward-sync gap)
```

Ahead/behind is a commit-graph metric. Real reset-readiness
depends on **content-loss surface**, not commit count.
Recomputing the content-loss surface is downstream of this
ledger's classification work.

### Worktrees

```text
total:           58
active:          1   (current main worktree)
locked:          57  (preserved candidates; do NOT prune blindly)
unlocked:        0
```

### Local branches

```text
total:                          869
BRANCH_HAS_OPEN_PR:             27   (in-flight; do not touch)
BRANCH_GONE_UPSTREAM:           284  (upstream removed; needs classification)
BRANCH_TRACKING_REMOTE:         406  (still tracking remote; classify)
BRANCH_NO_UPSTREAM:             152  (no upstream; local-only refs)
```

## Worktree bucket schema (per Amara's converged refinement)

| Bucket | Definition | This snapshot |
|---|---|---|
| WORKTREE_ACTIVE | Current main worktree | 1 |
| WORKTREE_STALE_BUT_PRESENT | Unlocked + branch landed elsewhere | 0 |
| WORKTREE_LOCKED_PRESERVE | Locked + no live PR + reason unknown — preserve until classified | 57 |
| WORKTREE_PRUNABLE_METADATA_ONLY | git worktree list --porcelain says prunable, no payload | TBD (need git worktree list --porcelain analysis) |
| WORKTREE_NEEDS_RECOVERY | Branch carries unique substrate not on main | TBD per-worktree audit |
| WORKTREE_OBSOLETE_AFTER_PROOF | Classified as ALREADY-COVERED with explicit lineage | TBD per-worktree audit |

Per Git's official `git worktree` docs: `lock` prevents
pruning/moving/deletion; `remove` requires force-twice for
locked worktrees. Locked worktrees are PRESERVED candidates
by default.

## Branch bucket schema (per Amara's converged refinement)

| Bucket | Definition | This snapshot |
|---|---|---|
| BRANCH_MERGED_TO_MAIN | Branch tip is reachable from main; safe to delete | TBD via `git branch --merged main` |
| BRANCH_HAS_OPEN_PR | Branch has an open PR; preserve | 27 |
| BRANCH_CONTENT_ON_MAIN | Branch tip ≠ main HEAD but content-equivalent (per content-classification) | TBD per-branch audit |
| BRANCH_CONTENT_ON_OTHER_BRANCH | Branch content lives on another branch (e.g., a successor branch) | TBD per-branch audit |
| BRANCH_NEEDS_RECOVERY | Branch carries unique substrate not yet integrated | TBD per-branch audit |
| BRANCH_OBSOLETE | Branch explicitly retired with rationale | TBD per-branch audit |
| BRANCH_UNKNOWN | Not yet classified | 842 (most branches; default until classified) |

Per Git's official `git branch` docs: `[gone]` means the
upstream-tracked remote ref no longer exists; it does NOT
imply local content safety. Classification before deletion.

## Sample of unclassified-substrate branches

These are the first 10 of each major bucket. Full listings in
`/tmp/branches-for-each-ref.txt` (working-copy snapshot only).

### BRANCH_GONE_UPSTREAM (sample)

```text
absorb/amara-conversation-2025-08-first-chunk
absorb/amara-conversation-2025-09-weekly-chunks
absorb/amara-conversation-2026-04-weekly-chunks
add-grok-cli-capability-map-sketch
agent-claim-protocol-git-native
agents/edit-1-absorbs-staged-not-ratified
alignment/edit-2-sd-9-agreement-is-signal-not-proof
artifact-c/tools-alignment-archive-header-lint
aurora/absorb-amara-5th-ferry-zeta-ksk-aurora-validation
aurora/absorb-amara-6th-ferry-muratori-pattern-mapping
```

These ALL look substrate-bearing (Amara conversation absorbs,
factory-doctrine edits, Aurora ferry absorbs). NONE should be
deleted without per-branch content-equivalence classification.

### BRANCH_NO_UPSTREAM (sample)

```text
heads/acehack/tick-history-2026-04-27T23-58
audit-607
audit-608
audit-610
audit-612
```

These look like local-only audit / tick-history branches; many
may be safely retired. Still requires classification before
delete.

## Open-PR mapping (top 10 of 27)

```text
#755 tick-history/2026-04-29-tick-0500Z-shard
#754 tick-history/2026-04-29-tick-0455Z-shard
#753 tick-history/2026-04-29-tick-0450Z-shard
#752 tick-history/2026-04-29-tick-0445Z-shard
#747 tick-history/2026-04-29-tick-0420Z-shard
#746 tick-history/2026-04-29-tick-0415Z-shard
#745 tick-history/2026-04-29-tick-0410Z-shard
... (and ~20 more, mostly tick-history shard PRs from this session)
```

These 27 open PRs are the queue the diagnostic-drain pattern
is currently working through. PR-queue-drain composes with
this ledger but is separate work.

## Recommended next safe actions (NOT executed by this ledger)

In order of safety + leverage:

1. **Run `git worktree list --porcelain`** + classify each
   locked worktree's branch into the bucket schema. Cross-
   reference each branch tip against main's tree using
   content-equivalence (per the metric ladder in
   `memory/feedback_reset_readiness_metric_ladder_content_loss_surface_amara_2026_04_28.md`).
2. **Run `git branch --merged main`** to identify
   BRANCH_MERGED_TO_MAIN bucket; these are deletion-safe.
3. **For BRANCH_GONE_UPSTREAM with substrate-y names**
   (Amara conversation absorbs, Aurora ferry absorbs,
   alignment edits): manual content-equivalence classification.
4. **Compute LFG-side content-loss surface** by running the
   metric ladder on the 562 commits LFG main is ahead by:
   most should be ALREADY-COVERED via different commit paths,
   but some may be NEEDS-FORWARD-SYNC.
5. **Only after** the above produces a clean classification:
   destructive actions become safe.

## Top 5 next recovery / audit targets (within authority)

Picked by leverage (most uncertainty per branch removed):

1. **Locked worktree audit** — sample 5 worktrees per tick;
   classify each into the bucket schema; build out the
   ledger over multiple ticks.
2. **`git branch --merged main`** — identifies safe-to-delete
   branches in one command; produces an immediate
   BRANCH_MERGED_TO_MAIN bucket.
3. **Cross-reference branches against open PRs** — already
   done in this snapshot (27 BRANCH_HAS_OPEN_PR).
4. **Content-equivalence audit on substrate-y branch names**
   (Amara, Aurora, alignment) — small batch per tick.
5. **Defer LFG-side 562-commit forward-sync analysis** until
   the local branch/worktree classification is well-progressed.

## Composition with existing substrate

- **B-0090** (cadenced lost-substrate audit) — this ledger is
  B-0090's first concrete cycle. Future cycles re-generate
  on cadence.
- **`memory/feedback_reset_readiness_metric_ladder_content_loss_surface_amara_2026_04_28.md`**
  — the metric ladder this ledger feeds into.
- **Task #264** (Recover 19 LOST branches) — overlaps with
  BRANCH_GONE_UPSTREAM work; re-route those 19 into this
  ledger's bucket schema.
- **Task #287** (Resource/costs monitoring) — separate
  visibility surface; this ledger doesn't address it.

## What this ledger does NOT do

- Does NOT delete any branch.
- Does NOT prune any worktree.
- Does NOT forward-sync any LFG commits to AceHack.
- Does NOT hard-reset main.
- Does NOT classify individual branches/worktrees beyond the
  top-level bucket counts.
- Does NOT recompute the content-loss surface (downstream of
  per-branch classification).

This ledger is the prerequisite. The classification work is
follow-up; the destructive action is downstream of
classification.

## Re-generation cadence

Re-run on cadence (e.g., weekly or after major queue events).
Each cycle:

1. Run the inventory commands.
2. Classify deltas since last cycle.
3. Mark any newly-classified buckets.
4. Update `Last surfaced` in the status header.
5. Append observations to a new ledger file
   (`docs/lost-substrate/inventory-ledger-YYYY-MM-DD.md`)
   rather than mutating this one.

## The keeper rule

> *When the factory has too many unknowns, do not choose a
> fix. Build the inventory ledger.* (Amara via Aaron, 2026-04-29)
