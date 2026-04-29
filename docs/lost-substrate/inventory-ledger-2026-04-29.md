---
Scope: Read-only inventory ledger for lost-substrate audit. Generated as the prerequisite step before any destructive action (branch deletion, worktree pruning, hard reset).
Attribution: per Aaron's 2026-04-29 input + Amara synthesis — *"When the factory has too many unknowns, do not choose a fix. Build the inventory ledger."* Peer-verified by Codex + Gemini (independent harnesses); their findings appended below as the "Peer verification gaps" section.
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

Per Aaron's input + Amara synthesis: *"Do not forward-sync 562
commits first. Do not delete branches/worktrees first. Do not
create new doctrine. First build the inventory ledger."*

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
| BRANCH_MERGED_TO_MAIN_CANDIDATE | Branch tip mechanically reachable from main per `git branch --merged origin/main`; deletion **candidate**, NOT automatic clearance — still needs open-PR mapping + worktree mapping + peer verification | 121 (sampled 2026-04-29; see Day-2 follow-up below) |
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
2. **Run `git branch --merged origin/main`** to identify
   `BRANCH_MERGED_TO_MAIN_CANDIDATE` bucket; these are deletion
   **candidates** (mechanical reachability), NOT automatic
   clearance — still need open-PR mapping + worktree mapping
   + peer verification per the bucket schema above.
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
2. **`git branch --merged origin/main`** — produces an
   immediate `BRANCH_MERGED_TO_MAIN_CANDIDATE` bucket
   (deletion candidates, NOT auto-cleared; need open-PR +
   worktree + peer verification before any delete).
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

## Peer verification gaps (Codex + Gemini, 2026-04-29)

Aaron requested adversarial peer-verification: *"You've thought
you were safe before and every time the others CLIs found
something you missed."* Two independent harnesses found
substantial surfaces this initial inventory MISSED. Counts in
the top-level table are **not yet a substrate-loss proof** —
they are a branch/worktree snapshot only.

### Surfaces Gemini caught (independent reviewer #1)

**Ephemeral Git state** (the "almost commits"):

- **Index / staged-but-uncommitted across all 58 worktrees** —
  explicit unfinalized intent that won't sync via push.
- **Git notes** (`git notes`) — invisible in standard logs;
  metadata attached to commits.
- **Orphaned objects** (`git fsck --lost-found`) — blobs/trees
  dropped from reflog but not yet GC'd. Hard-reset substrate
  may be floating here.

**Untracked local substrate**:

- **`.gitignore`'d files** — `.env`, local SQLite DBs,
  uncommitted `memory/` shards, `.mise` tweaks. Structurally
  load-bearing locally.
- **`.git/config` + `.git/hooks/`** — custom workflows,
  aliases, pre-commit hooks. Encode intent but unversioned.

**Networked / outer substrate**:

- **Submodule state** — local detached HEADs / unpushed
  commits in submodules.
- **Git LFS objects** — commit pointer ≠ asset; LFS sync is
  separate from commit sync.
- **GitHub-native state** — draft PRs, Wiki pages, Actions
  variables/secrets, branch protection rules, Project Boards.

### Surfaces Codex caught (independent reviewer #2)

**Repository-internal state** the ledger missed:

- **Rerere cache** (`.git/rr-cache`) — 293 conflict-resolution
  records. Real merge/rebase substrate.
- **Per-worktree transaction state** — `REBASE_HEAD`,
  `AUTO_MERGE`, `ORIG_HEAD`, `FETCH_HEAD`, `COMMIT_EDITMSG`
  in `.git/worktrees/*/`. Locked-worktree count alone is
  insufficient; some are mid-operation.
- **History-rewriting ref namespaces** — `refs/replace`,
  `refs/original`, `refs/bisect`, `refs/pull`, `refs/changes`,
  plus `.git/info/grafts`. Should prove these are empty/audit.
- **Index flags via `git ls-files -v`** —
  `assume-unchanged` / `skip-worktree` flags can hide tracked-
  file drift from ordinary `git status`. Plus
  `.git/info/exclude` and global excludes (separate from repo
  `.gitignore`).
- **Patch/mailbox/bundle artifacts** — search `*.patch`,
  `*.diff`, `*.mbox`, `*.eml`, `*.bundle`. Local evidence:
  `references/upstreams/voltdb/voltcore.eml` + others.

**Outer-boundary substrate**:

- **Nested upstream mirrors** (`references/upstreams/*`) —
  embedded `.gitmodules`, lockfiles, upstream state. Each may
  need its own inventory; not Zeta branch math.
- **Sibling/factory repos** — `../claude-code`, `../SQLSharp`,
  `../runtime`. If "AceHack=LFG" means factory substrate,
  repository-local Git is too narrow a boundary.

### What this means for the ledger

The branch/worktree snapshot at the top of this ledger is
**not yet a substrate-loss proof**. It is a useful first pass.
Substrate-loss proof for 0/0/0 requires three layers:

```text
1. Commit graph: ahead/behind counts (already snapshotted)
2. Tree state: git diff --stat --name-status both directions
3. Content-loss surface: classified files/branches/worktrees +
   peer-verified missed surfaces above + per-row evidence
```

Per Amara's framing: *"A count is not a clearance. A bucket is
not proof. A ledger row needs evidence."*

### Day-2 inventory results (executed 2026-04-29 post-peer-verification)

The Day-2 commands ran. **Real findings** — not just empty checks:

| Surface | Finding |
|---|---|
| **Stashes** | **8 entries** with substantive WIP. stash@{3} alone is 668 files / 208,844 deletions. Each stash is unfinalized intent on a different branch. |
| **Reflog** | 13,822 entries (rich machine-local history; ~30-90 day TTL) |
| **Git notes** | 0 (clean) |
| **fsck dangling objects** | **1,109** (substantial; 1,000+ dangling commits/trees/blobs not on any branch) |
| **Pack corruption** | **`.git/objects/pack/pack-16732bccb3ace9ec45c913c57a1fd050fd730c3f.pack` has data-stream errors**; 2 specific corrupt objects identified — see "Corruption triage results" section below. |
| **History-rewriting refs** | All 5 namespaces (`replace` / `original` / `bisect` / `pull` / `changes`) empty + no `.git/info/grafts`. Clean. |
| **Index flags** | 0 `assume-unchanged` / `skip-worktree` (clean) |
| **Per-worktree mid-operation** | 0 worktrees in REBASE/MERGE/AUTO_MERGE state (clean) |
| **Rerere cache** | **293 conflict-resolution records** (real merge-resolution substrate; codified knowledge) |
| **Patch / bundle artifacts** | 0 outside `references/upstreams/` (clean) |
| **Submodules / LFS** | None / `git lfs` not installed (clean) |
| **Tags** | 0 (none in use) |

### Corruption triage results (executed post-Amara-correction)

Two corrupt objects identified + classified per Amara's bucket schema:

| Object | Type | Size | Bucket | Notes |
|---|---|---|---|---|
| `9bf2daee3ce53c88633824f9532a0158aaa92ed9` | blob | 16,455,417 bytes | RECOVERABLE_FROM_ORIGIN | Fresh clone (`/tmp/zeta-fresh-corruption-check`) returns type+size cleanly. Recovery via `git fetch --refetch origin`. |
| `8d5e67fd313573855848705e4af114f3ff0eecbc` | blob | 439,327 bytes (early `docs/hygiene-history/loop-tick-history.md`) | Round 1: `MISSING_UNRECOVERED` (superseded). **Final (Round 3): `CORRUPT_BLOB_REFERENCED_BY_LIVE_LOCAL_BRANCH_AND_STALE_REMOTE_TRACKING_REF`** | Fresh clone returns "could not get object info" (origin no longer has the branch). Round-3 reachability scan placed it in bucket A: live-local branch reachable; same-named remote-tracking ref is stale. Branch tip is clean — corrupt blob is from intermediate history of the branch only. See "Day-2+: corrected reachability via three-bucket scan" section below for details. |

**Critical finding (Round 3, final)**: `8d5e67fd` is referenced by a live local branch (`refs/heads/chore/heartbeat-batch-2026-04-26-hour-05Z`) plus a stale same-named remote-tracking ref. Origin no longer has the branch (verified via `git ls-remote`). The branch TIP is clean — the corrupt blob is from the branch's intermediate history only. Substrate-loss for current-state use is zero; only bisect-through-pre-merge-history would surface the corruption. See the corrected reachability + content-equivalence section below.

### Day-2+: corrected reachability via three-bucket scan (Amara 2026-04-29)

The first follow-up under-scanned reachability and reached the
wrong conclusion. Amara's correction asked for a three-bucket
schema instead of the implicit two-bucket dangling-vs-live split.

**Three reachability buckets (Amara 2026-04-29)**:

```text
A. live branch / tag / ref reachable
B. reflog / stash / local-recovery reachable
C. dangling / unreachable only
```

`git fsck` reachability is **mode-dependent** — by default fsck
includes reflogs as heads, but `--no-reflogs` excludes them, so
"dangling under no-reflogs" is not the same as "irrelevant to
all local recovery surfaces." The first follow-up only sampled
10 of 888 commits touching `loop-tick-history.md` and missed
the live-ref reach.

**Re-verification commands** (artifacts persisted under
`docs/lost-substrate/artifacts/2026-04-29-corruption/`):

```bash
git rev-list --objects --all | grep 8d5e67fd
git fsck --full --no-progress | grep -C 5 8d5e67fd
git fsck --full --no-reflogs --no-progress | grep -C 5 8d5e67fd
git rev-list --objects refs/stash | grep 8d5e67fd
git for-each-ref --format='%(refname)' | while read r; do
  git rev-list --objects "$r" 2>/dev/null | grep 8d5e67fd && echo "ref=$r"
done
```

**Result — `8d5e67fd` is bucket A, not bucket C**:

```text
ref=refs/heads/chore/heartbeat-batch-2026-04-26-hour-05Z         → reaches the corrupt blob
ref=refs/remotes/origin/chore/heartbeat-batch-2026-04-26-hour-05Z → reaches the corrupt blob (stale)
```

The local branch `chore/heartbeat-batch-2026-04-26-hour-05Z`
is a **live local ref** that reaches the corrupt blob. The
same-named remote-tracking ref is **stale**: a fresh clone of
origin shows the branch was deleted upstream
(`git ls-remote origin refs/heads/chore/heartbeat-batch-2026-04-26-hour-05Z`
returns empty). So the live-ref reach is local-only.

**Squash-merge equivalence**: the local branch tip `d9feb3f` is
NOT an ancestor of `main`, but the equivalent **content** of
`docs/hygiene-history/loop-tick-history.md` is preserved on
main under a different blob SHA
(`de670f72d6fd34208d04863818288d764150a151`) via the squash-merge
that absorbed the original branch. The intermediate-revision
provenance (per-commit bisect granularity from the pre-squash
branch) exists only locally and cannot be recovered from origin.

**Corrected classification (Amara 2026-04-29)**:

```text
CORRUPT_BLOB_REFERENCED_BY_LIVE_LOCAL_BRANCH_AND_STALE_REMOTE_TRACKING_REF
```

(sub-bucket of bucket A — live-local-ref reachable; origin no
longer has the branch; the same-named remote-tracking ref
preserves evidence but does not provide origin recovery.)

**Content-equivalence verification (Amara 2026-04-29)**:
Squash-merge preservation must be verified by **content**, not
by ancestry vibe. Empirical findings:

```text
$ git ls-tree -r refs/heads/.../hour-05Z | grep 8d5e67fd
(no path-match — corrupt blob is NOT at the branch tip)

$ git show refs/heads/.../hour-05Z:docs/hygiene-history/loop-tick-history.md
# Loop-tick history
... (succeeds — branch tip's tick-history.md is readable)

$ git diff --name-status origin/main...refs/heads/.../hour-05Z \
  -- docs/hygiene-history/loop-tick-history.md
M docs/hygiene-history/loop-tick-history.md
(diff succeeds — corrupt blob is not needed for the diff)
```

The branch TIP is **clean**. The corrupt blob `8d5e67fd` is
from the branch's **intermediate history** (an earlier commit
on the same branch path), not the current tip. Substrate-loss
for any current-state use case (checkout, hard-reset to tip,
diff vs main) is zero. Substrate-loss for bisect-through-
pre-merge-history is the only real impact, since bisect would
need to read each historical revision of `loop-tick-history.md`.

**Recovery urgency**: LOW–MEDIUM. Current-state use of the
branch is unaffected. Bisect-through-history of this branch's
intermediate revisions IS affected, but that's a niche use
case for a post-merge stale local branch.

**Hard-reset readiness — qualified statement (Amara correction)**:

```text
This corruption does not appear to affect current main, but it
DOES affect at least one live local branch (specifically, the
intermediate history of refs/heads/chore/heartbeat-batch-2026-
04-26-hour-05Z). Hard reset / branch cleanup remains blocked
until the branch's content is classified as preserved,
obsolete, or explicitly abandoned.
```

Branch-tip checkout / hard-reset-to-tip is fine; reading
intermediate-history blobs would surface the corruption.

**Cleanup posture (Amara correction)**:

```text
Cleanup is a destructive decision, not a repair step.
```

A future cleanup may remove this unreachable/corrupt evidence,
so cleanup must wait until related dangling/reflog/stash
surfaces are classified and either preserved or explicitly
abandoned. `git gc` / `git prune` / `git repack -Ad` /
`git fsck --lost-found` remain forbidden during triage.
Auto-gc thresholds are at default per
`docs/lost-substrate/artifacts/2026-04-29-corruption/git-gc-config.txt`;
below-threshold loose-object count
means auto-gc is not imminent — the discipline is "no implicit
cleanup decision" not "we have time."

**Single-lane exclusivity (Amara correction)**:

```text
Corruption lane means exclusive lane.
If corruption is the incident, everything else is noise.
```

While corruption triage is active, all unrelated automation /
backfill / scanner / queue-drain work pauses. The triage lane
is exclusive until object classification is stable.

**Initial fsck adjacency observation (preserved)**:

```text
dangling tree ba5cc0356d2b571ba19477f5be8c16e15993faf6
dangling commit 9d5db210aee2b017e99c8d2c78f77242fb24ec0b
missing blob 8d5e67fd313573855848705e4af114f3ff0eecbc
```

This adjacency is real but does not by itself prove "ONLY
dangling" — the same blob is also reached by the live-local
ref above. Both observations are consistent: the corrupt blob
is referenced from a live local branch tip AND from dangling
substrate, and was not preserved on origin.

**Per Amara's correction**: do NOT declare "origin has it" without fresh-clone verification. Wording corrected throughout this ledger.

**Highest-risk findings**:

1. **1,109 dangling objects** — substrate not reachable from any branch. Hard-reset would destroy these. fsck-recovery is read-only and possible IF the dangling commits encode something we care about. Each requires `git show <sha>` per-object inspection to know what it carries.

2. **Pack corruption** — one pack file has a data-stream error. Object `9bf2daee3ce53c88633824f9532a0158aaa92ed9` cannot be unpacked. This is a real durability-of-history concern. May need `git fsck --full` + possibly `git repack` + re-fetch from origin if the missing object is also on origin.

3. **8 stashes** — explicit unfinalized intent. stash@{3} is enormous (668 files; could be a bulk-revert or a test run). Each stash needs per-stash content classification before any stash-prune operation.

4. **293 rerere records** — codified conflict-resolution knowledge from past merges. NOT auto-disposable; this is real factory-discipline substrate that speeds up future merges.

**Updated count of substrate surfaces this ledger needs to track**: not just 869 branches + 58 worktrees (top of ledger) — also 8 stashes + 1,109 dangling objects + 293 rerere records + pack-corruption to repair + the 15+ surfaces from peer verification.

**Honest-statement update**: this ledger v2 (after peer verification + Day-2 execution) is closer to a substrate-loss audit but still NOT complete — the 1,109 dangling objects need per-object classification before any reset/forward-sync is safe.

### Day-2 follow-up: next safe inventory passes

Each pass is read-only:

```bash
# Ephemeral Git state
git stash list
git reflog --all
git notes list
# fsck WITHOUT --lost-found here: --lost-found writes dangling
# objects into .git/lost-found/, which is NOT read-only. Use
# --no-reflogs alone for the read-only mode-comparison check.
git fsck --no-reflogs --no-progress

# History-rewriting ref namespaces
git for-each-ref refs/replace refs/original refs/bisect refs/pull refs/changes
ls -la .git/info/grafts 2>&1 || echo "no grafts file"

# Index flags
git ls-files -v | grep -v '^[H ]' | head -30

# Per-worktree transaction state
ls .git/worktrees/*/REBASE_HEAD .git/worktrees/*/AUTO_MERGE .git/worktrees/*/ORIG_HEAD 2>&1 | head -20

# Rerere cache
ls .git/rr-cache 2>&1 | head -10
ls .git/rr-cache | wc -l

# Patch/mailbox/bundle artifacts (excluding upstream mirrors)
find . -path ./references -prune -o \( -name '*.patch' -o -name '*.diff' -o -name '*.mbox' -o -name '*.eml' -o -name '*.bundle' \) -print | head -20

# .gitignore'd substrate
git status --ignored --porcelain | head -30

# Submodule + LFS
git submodule status 2>&1 || echo "no submodules"
git lfs ls-files 2>&1 | head -10 || echo "no LFS or git lfs not installed"
```

These commands run in subsequent ticks. Each finding extends
this ledger; deletion / pruning / forward-sync / hard-reset
remain blocked until the full surface is mapped.

### Evidence-column schema (per Amara's refinement)

A useful per-row format for future cycles:

```text
branch | head_sha | upstream | upstream_status | open_pr | worktree_path | worktree_locked | merged_to_origin_main | content_equivalence_status | classification | recommended_action | evidence_command
```

Without evidence columns, future cycles must re-run the audit
to know why each bucket assignment was made. Per-row evidence
makes the classification self-justifying.

### Three-layer 0/0/0 verification (binding)

AceHack = LFG at 0/0/0 with NO content loss requires ALL
THREE layers clean:

```text
Layer 1 — commit graph:
  ahead/behind both 0
  status not "diverged"

Layer 2 — tree state:
  git diff origin/main..AceHack/main --stat   = empty
  git diff AceHack/main..origin/main --stat   = empty

Layer 3 — content-loss surface:
  classified files/branches/worktrees show no NEEDS-RECOVERY
  NEEDS-FORWARD-SYNC = 0
  CONFLICTS-WITH-CURRENT-MAIN = 0
  NEEDS-HUMAN-REVIEW = 0
  Peer-verified surfaces (above) all classified
```

Compare API counts alone are NOT proof. They are diagnostic.

## The keeper rule

> *When the factory has too many unknowns, do not choose a
> fix. Build the inventory ledger.* (Amara via Aaron, 2026-04-29)

> *A count is not a clearance. A bucket is not proof. A ledger
> row needs evidence.* (Amara, 2026-04-29 peer-verification
> follow-up)
