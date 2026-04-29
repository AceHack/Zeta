---
name: Corruption triage is a substrate health incident, not a backlog item — Aaron + Amara 2026-04-29
description: When `git fsck` reports corrupt objects, the lane narrows hard — corruption-first triage outranks all background work (PR-queue drain / tick-history shards / scanner builds / branch deletion / worktree pruning). Treat as substrate health incident; corruption lane is exclusive, no side quests. Read-only diagnosis + fresh-clone verification before any repair. Per-object reachability scan uses Amara's three-bucket schema (live-ref / reflog-stash / dangling-only); reachability is mode-dependent on `git fsck` flags. Stale remote-tracking refs are evidence, not origin recovery — do not prune during triage. Verify squash-preservation by content, not ancestry. Cleanup is a destructive decision, not a repair step — never run `git gc` / `git prune` / `git repack -Ad` / `git fsck --lost-found` as a "fix" while investigating lost evidence.
type: feedback
---

# Corruption triage discipline — substrate health incident

## Source

Aaron 2026-04-29: *"you for sure need to make sure your future
self remembers this, this is very important"* — after a Day-2
inventory pass surfaced two corrupt git objects on this repo.

Amara synthesis 2026-04-29: *"A corrupt object is not a backlog
item. It is a substrate health incident. Do not prune the
evidence while investigating lost evidence."*

## The rule (load-bearing)

When `git fsck` reports corrupt objects, the lane narrows
**hard**. All background work stops:

```text
No PR-queue drain.
No tick-history shard generation.
No scanner builds.
No branch deletion.
No worktree pruning.
No new substrate unless it directly records corruption triage.
No git gc / git prune / git repack / git fsck --lost-found as a "fix" yet.
```

Corruption-first triage is the lane until object health is
understood. This is not "interesting extra signal"; it's
substrate floorboards creaking.

## Triage procedure (read-only first)

### Step 1: Diagnose without writing

```bash
git status --short
git fsck --full --no-reflogs --no-progress > /tmp/fsck-full.txt 2>&1
git fsck --connectivity-only --no-progress > /tmp/fsck-connectivity.txt 2>&1
git verify-pack -v .git/objects/pack/*.idx > /tmp/verify-pack.txt 2>&1
```

**Do NOT use `git fsck --lost-found` as a first move** — that
flag WRITES dangling objects into `.git/lost-found/`. It's not
read-only.

### Step 2: Per-corrupt-object inspection

For each `error: corrupt loose object <SHA>` or
`error: cannot unpack <SHA>`:

```bash
OBJ=<sha>
git cat-file -t "$OBJ"   # type (may succeed even when content corrupt)
git cat-file -s "$OBJ"   # size (may succeed even when content corrupt)
git cat-file -p "$OBJ"   # content (this is where corruption surfaces)
```

The header may be readable even when the content is corrupt —
type and size will print, but `-p` errors with `inflate: data
stream error`.

### Step 3: Fresh-clone verification (NOT just current repo)

```bash
git clone --no-checkout --quiet <origin-url> /tmp/repo-fresh-corruption-check
cd /tmp/repo-fresh-corruption-check
git cat-file -t <sha>
git cat-file -s <sha>
```

**Do NOT say "origin has it" without fresh-clone verification.**
The current repo may be the source of corruption; reading the
object via the same potentially-corrupt repo proves nothing.

### Step 4: Classify each corrupt object

**First — three-bucket reachability scan (Amara 2026-04-29)**.
`git fsck` reachability is mode-dependent: by default it
includes reflogs as heads; `--no-reflogs` excludes them. So the
correct frame distinguishes three reachability buckets:

| Bucket | Definition |
|---|---|
| A | Live branch / tag / ref reachable (`git rev-list --objects --all`; per-ref scan) |
| B | Reflog / stash / local-recovery reachable (default-fsck reach minus bucket A; `refs/stash` rev-list) |
| C | Dangling / unreachable only (no live ref, no reflog, no stash reaches it) |

**Reachability scan commands** (all read-only; per the soulfile-
cleanliness rule below, run the raw dumps to a `/tmp` working
directory and commit only the load-bearing extracts plus a
re-run recipe — NOT the multi-MB raw outputs themselves):

```bash
OBJ=<sha>
RAW=/tmp/corruption-triage-raw-$(date -u +%Y%m%d)
mkdir -p "$RAW"

# Raw dumps go to /tmp (NOT committed to soul repo):
git rev-list --objects --all > "$RAW/rev-list-all-objects.txt" 2> "$RAW/rev-list-all-objects.err"
git fsck --full --no-progress > "$RAW/fsck-full.txt" 2>&1
git fsck --full --no-reflogs --no-progress > "$RAW/fsck-full-no-reflogs.txt" 2>&1
git rev-list --objects refs/stash > "$RAW/rev-list-stash.txt" 2>&1 || true
git for-each-ref --format='%(refname)' | while read r; do
  git rev-list --objects "$r" 2>/dev/null | grep "$OBJ" && echo "ref=$r"
done > "$RAW/per-ref-grep.txt"

# Grep load-bearing lines:
grep "$OBJ" "$RAW/rev-list-all-objects.txt"
grep -C 5 "$OBJ" "$RAW/fsck-full.txt"
grep -C 5 "$OBJ" "$RAW/fsck-full-no-reflogs.txt"
grep "$OBJ" "$RAW/per-ref-grep.txt"

# Then commit ONLY the small extracts + a re-run recipe to:
#   docs/lost-substrate/artifacts/<date>-corruption/
# Per
#   memory/feedback_repo_is_soulfile_dont_commit_raw_diagnostic_dumps_aaron_amara_2026_04_29.md
```

Save extracts (not raw dumps) to the artifacts directory BEFORE
writing prose
conclusions. Future-Claude verifies prose against artifacts,
not the other way around.

**Then — Amara's recovery-source bucket schema** (orthogonal to
the reachability schema; once reachability is classified, this
table picks the recovery path):

| Bucket | Definition |
|---|---|
| RECOVERABLE_FROM_ORIGIN | Object exists in fresh clone with same SHA + type + size; recovery via re-clone or `git fetch --refetch` |
| RECOVERABLE_FROM_OTHER_LOCAL_CLONE | Object exists in another local clone of the same repo |
| DANGLING_CANDIDATE_NEEDS_CLASSIFICATION | Object is dangling/unreachable; may be lost substrate; per-object `git show` inspection needed |
| CORRUPT_LOOSE_OBJECT | Loose object in `.git/objects/XX/YY*`; can't be unpacked locally |
| CORRUPT_PACK_OBJECT | Object in pack file with data-stream error |
| MISSING_UNRECOVERED | Not in current repo, not in origin, not in other local clones — lost substrate |

### Step 5: Repair plan (only after classification)

```text
RECOVERABLE_FROM_ORIGIN          → git fetch --refetch origin (or re-clone)
RECOVERABLE_FROM_OTHER_LOCAL     → cherry-pick or fetch from local sibling
DANGLING_CANDIDATE               → git show <sha>; preserve before any GC
CORRUPT_LOOSE/PACK + recoverable → re-fetch; verify with git fsck
MISSING_UNRECOVERED              → record in lost-substrate ledger; substrate-loss event
```

## What this discipline forbids during triage

- **No `git gc` / `git prune` / `git repack -Ad`.** These can
  destroy unreachable evidence. Note: `gc.auto` may run
  housekeeping implicitly when porcelain commands grow the
  repo; record `git config --get gc.auto` /
  `gc.autoPackLimit` / `gc.pruneExpire` as artifact
  evidence at the start of triage. Disabling auto-gc
  (`git config gc.auto 0`) is itself a deliberate triage
  action, not casual.
- **No `git fsck --lost-found` as a first move.** It writes
  to `.git/lost-found/`; not read-only.
- **No `stash pop` / `stash apply`.** Stash entries reference
  objects that may be the only path to lost work.
- **No "origin has it" without fresh-clone verification.**
  Use `git cat-file -t` and `-s` against the fresh clone to
  confirm same SHA + type + size. The same-named
  remote-tracking ref in your local repo can be **stale**
  (origin may have deleted the branch); the stale ref does
  not prove origin has the object.
- **No background tasks — single-lane until corruption
  health understood.** While corruption triage is active,
  all unrelated automation, backfill, scanner, queue-drain,
  and substrate work pauses. Corruption lane means
  exclusive lane.

## Specific worked example: 2026-04-29 incident

Two corrupt objects identified during Day-2 inventory pass:

| Object | Type | Size | Reachability bucket | Recovery-source bucket | Final classification |
|---|---|---|---|---|---|
| `9bf2daee3ce53c88633824f9532a0158aaa92ed9` | blob | 16,455,417 bytes | A (live) | RECOVERABLE_FROM_ORIGIN | Fresh-clone cat-file confirmed; recoverable via `git fetch --refetch` |
| `8d5e67fd313573855848705e4af114f3ff0eecbc` | blob | 439,327 bytes (intermediate `docs/hygiene-history/loop-tick-history.md`) | A (live local only) | LOCAL_ONLY (origin deleted the branch) | `CORRUPT_BLOB_REFERENCED_BY_LIVE_LOCAL_BRANCH_AND_STALE_REMOTE_TRACKING_REF` |

**The `8d5e67fd` finding required three rounds of triage**
to classify correctly — each round overturned the prior
conclusion. Lineage:

- **Round 1**: classified as `MISSING_UNRECOVERED` (fresh
  clone "could not get object info"). Wrong scope — only
  checked origin recovery; did not check local reachability.
- **Round 2**: claimed `REFERENCED_BY_DANGLING_ONLY` based
  on fsck adjacency to a dangling tree. Wrong — sampled
  10 of 888 commits; missed the live-ref reach.
- **Round 3** (correct): three-bucket reachability scan +
  per-ref `rev-list` showed live-local-branch reach
  (`refs/heads/chore/heartbeat-batch-2026-04-26-hour-05Z`).
  Fresh `git ls-remote` confirmed origin no longer has the
  branch (the same-named remote-tracking ref is **stale**).
  Content-equivalence check (`git ls-tree` + `git show`)
  showed the branch TIP is clean — the corrupt blob is from
  the branch's intermediate history, not the tip.

**Final substrate-loss assessment**: zero impact on
current-state use (checkout / hard-reset-to-tip / diff vs
main all succeed). Impact only on bisect-through-pre-merge-
history of this stale post-merge local branch — niche.

This worked example is the canonical failure-mode template:
**reachability is mode-dependent; classification requires
three-bucket scan + content-equivalence verification, not
ancestry vibes; stale remote-tracking refs preserve evidence
and must not be pruned during triage.**

## Related discipline

- **Dangling objects are CANDIDATES, not lost-substrate-confirmed.**
  1,109 dangling objects on this repo include real factory
  substrate (Aaron's merge commits, round-44 tick-history).
  Apply Candidate-count Goodhart: classify before acting.
- **Rerere cache is merge-immune-memory, NOT a cleanup target.**
  293 rerere records on this repo encode codified conflict-
  resolution knowledge. Do NOT prune.
- **Stashes need ranked triage, not bulk.** Inspect each stash
  via `git stash show --stat stash@{N}`; no `pop` or `apply`
  until a recovery branch is created.

## Composes with

- `docs/lost-substrate/inventory-ledger-2026-04-29.md` — the
  inventory ledger that surfaced these findings.
- `docs/research/escrowed/aurora-autonomous-flywheel-thesis-2026-04-28.md`
  — the escrow primitive; corruption-triage uses similar
  bounded-preservation pattern.
- `memory/feedback_candidate_count_goodhart_raw_hits_are_not_violations_aaron_amara_2026_04_28.md`
  — Candidate-count Goodhart applies to dangling objects.

## Distilled rules (keepers)

```text
A corrupt object is not a backlog item.
It is a substrate health incident.
```

```text
Do not prune the evidence while investigating lost evidence.
```

```text
Recoverable-from-origin requires fresh-clone cat-file
type + size verification.
```

```text
A count is not a clearance. A bucket is not proof.
```

```text
Cleanup is a destructive decision, not a repair step.
```

```text
Stale remote-tracking ref is evidence, not origin recovery.
Do not prune it while investigating lost substrate.
```

```text
Live local branch reference means the incident is not closed.
```

```text
Corruption lane means exclusive lane.
Exclusive lane means no side quests.
If corruption is the incident, everything else is noise.
```

```text
Reachability is mode-dependent.
Three-bucket scan (live ref / reflog-stash / dangling)
beats two-bucket vibes.
```

```text
Verify squash-preservation by content, not by ancestry vibe.
Tip-clean does not prove history-clean; history-corrupt
does not prove tip-corrupt.
```

```text
rev-list can enumerate object references even when later
object reads fail.
Enumeration success is not content recovery.
```

```text
Reachability claims must record the fsck mode used.
"default fsck" and "fsck --no-reflogs" answer different
questions.
```

```text
Reachability is mode-dependent.
Enumeration is not recovery.
Cleanup is not triage.
```

```text
Don't dirty the soulfile (the git repo and all its history).
Triage artifacts go in via load-bearing extracts + a re-run
recipe, not multi-MB raw dumps. See
`memory/feedback_repo_is_soulfile_dont_commit_raw_diagnostic_dumps_aaron_amara_2026_04_29.md`.
```

## Why this is in memory/, not just a doc

Aaron emphasized: *"you for sure need to make sure your
future self remembers this, this is very important."* Per the
auto-memory protocol + Aaron's natural-home-of-memories-is-in-
repo rule (2026-04-24), this is durable substrate that future-
Claude must consult on cold-start when corruption is observed.
The ledger itself is point-in-time; this memory is the
discipline.
