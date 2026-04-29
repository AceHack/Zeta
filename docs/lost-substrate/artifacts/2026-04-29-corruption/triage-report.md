# Corruption triage — 2026-04-29 — empirical artifact

This file captures the exact commands run, the raw outputs (in
sibling files), and the conclusion drawn. It exists so a future
reader can verify the prose conclusions in the ledger against the
artifacts, rather than trusting the summary.

## Sibling artifact files (load-bearing extracts only)

Per Aaron 2026-04-29 (the repo is the soulfile — keep it
clean): only the **load-bearing extracts** are committed,
not the raw multi-MB diagnostic dumps. The grep recipes that
produce these extracts are below; future readers can re-run
locally to regenerate the raw outputs if needed.

| File | Source command (extract-recipe in re-run section) |
|---|---|
| `fsck-extracts.txt` | grep -C 5 of corrupt SHAs against `git fsck` outputs in three modes (reflog-inclusive / `--no-reflogs` / `--connectivity-only`) plus per-mode line-counts to evidence mode-dependence |
| `rev-list-extracts.txt` | grep of corrupt SHAs against `git rev-list --objects --all` |
| `git-gc-config.txt` | git version + per-key `git config --get gc.*` + `gc.rerereResolved` / `gc.rerereUnresolved` snapshot |
| `hour-05Z-show-ref.txt` | `git show-ref \| grep hour-05Z` |
| `hour-05Z-ls-remote.txt` | `git ls-remote --heads origin hour-05Z` (empty = origin no longer has the branch) |

All files are point-in-time evidence; do not edit.

### Re-run recipe (regenerates raw outputs locally)

If a future reader wants the raw multi-MB dumps (this file
intentionally does not commit them — see Aaron's
soulfile-cleanliness rule), run from repo root:

```bash
mkdir -p /tmp/corruption-triage-raw
git fsck --full --no-progress              > /tmp/corruption-triage-raw/fsck-full.txt 2>&1
git fsck --full --no-reflogs --no-progress > /tmp/corruption-triage-raw/fsck-full-no-reflogs.txt 2>&1
git fsck --connectivity-only --no-progress > /tmp/corruption-triage-raw/fsck-connectivity.txt 2>&1
git rev-list --objects --all               > /tmp/corruption-triage-raw/rev-list-all-objects.txt 2>&1
ls -la /tmp/corruption-triage-raw/
```

The raw outputs are reproducible from any clone with the same
local refs at the same point in time. Committing the extracts
preserves the load-bearing evidence; committing the raw dumps
would dirty the soulfile.

## Two corrupt objects under triage

| SHA | Type | Size | Source path |
|---|---|---|---|
| `9bf2daee3ce53c88633824f9532a0158aaa92ed9` | blob (recovered from origin) | 16,455,417 bytes | unknown — large blob |
| `8d5e67fd313573855848705e4af114f3ff0eecbc` | blob (corrupt loose, locally) | unrecoverable from origin | `docs/hygiene-history/loop-tick-history.md` (intermediate version) |

## Three-bucket reachability — `8d5e67fd`

Per Amara 2026-04-29: `git fsck` reachability is mode-dependent
(reflog-inclusive vs `--no-reflogs`). A correct classification
distinguishes three buckets:

| Bucket | Definition | Verdict for `8d5e67fd` |
|---|---|---|
| A | Live branch / tag / ref reachable | **YES** — `refs/heads/chore/heartbeat-batch-2026-04-26-hour-05Z` reaches it (local-only; the same-named remote-tracking ref is stale — origin no longer has the branch) |
| B | Reflog / stash / local-recovery reachable | Indeterminate from this scan; reflog scan was reflog-inclusive fsck (showed dangling adjacency); `refs/stash` is empty |
| C | Dangling / unreachable only | **NO** — bucket A applies, so C does not |

### Verifying bucket A

```text
$ git rev-list --objects --all | grep 8d5e67fd
8d5e67fd313573855848705e4af114f3ff0eecbc docs/hygiene-history/loop-tick-history.md

$ git for-each-ref ... | per-ref rev-list grep
ref=refs/heads/chore/heartbeat-batch-2026-04-26-hour-05Z   → reaches it
ref=refs/remotes/origin/chore/heartbeat-batch-2026-04-26-hour-05Z → reaches it (stale)
```

### Verifying the remote-tracking ref is stale

```text
$ git ls-remote origin refs/heads/chore/heartbeat-batch-2026-04-26-hour-05Z
(empty — origin no longer has this branch)

$ git clone --no-checkout --quiet \
    --branch chore/heartbeat-batch-2026-04-26-hour-05Z \
    https://github.com/Lucent-Financial-Group/Zeta.git \
    /tmp/repo-fresh-corruption-recheck-2026-04-29
fatal: Remote branch chore/heartbeat-batch-2026-04-26-hour-05Z not found in upstream origin
```

### Content-equivalence verification — `8d5e67fd`

Per Amara's correction: verify squash-preservation by **content**,
not by ancestry vibe.

```text
$ BR=refs/heads/chore/heartbeat-batch-2026-04-26-hour-05Z
$ OBJ=8d5e67fd313573855848705e4af114f3ff0eecbc

$ git ls-tree -r "$BR" | grep "$OBJ"
(no path-match — corrupt blob is NOT at the branch tip)

$ git show "$BR":docs/hygiene-history/loop-tick-history.md | head -1
# Loop-tick history          ← branch tip's tick-history.md is readable

$ git diff --name-status origin/main..."$BR" \
    -- docs/hygiene-history/loop-tick-history.md
M docs/hygiene-history/loop-tick-history.md   ← diff succeeds

$ git log --oneline -1 "$BR"
d9feb3f chore(loop-tick-history): hour-05Z bundle close 2026-04-26T05:59:36Z ...
```

**Branch tip is clean.** The corrupt blob `8d5e67fd` is from
the branch's **intermediate history** (an earlier commit on the
same branch path), NOT the current tip. The branch is also NOT
an ancestor of `main` (its tip is post-squash-merge and
abandoned), and `main` carries the equivalent content under a
different blob (`de670f72d6fd34208d04863818288d764150a151`).

```text
main's tick-history blob: de670f72d6fd34208d04863818288d764150a151
branch-tip's blob:        (different, clean — readable via git show)
corrupt blob:             8d5e67fd313573855848705e4af114f3ff0eecbc
                          ← appears only in intermediate history
```

## Final classification — `8d5e67fd`

```text
CORRUPT_BLOB_REFERENCED_BY_LIVE_LOCAL_BRANCH_AND_STALE_REMOTE_TRACKING_REF
```

(sub-bucket of bucket A under the three-bucket schema; refined
sub-condition: branch TIP is clean, corrupt blob is in
intermediate history of the branch only.)

Substrate-loss assessment:

- **Current-state use** (checkout / hard-reset-to-tip / diff vs
  main): zero impact. Branch tip and main are both readable.
- **Bisect-through-pre-merge-history**: impacted. Bisecting
  `loop-tick-history.md` through this branch's intermediate
  revisions would surface the corrupt blob; that pre-merge
  bisect-step granularity is the only thing actually lost,
  and it's a niche use case for a stale post-merge local
  branch.

## Hard-reset readiness — qualified statement

```text
This corruption does not appear to affect current main, but it
DOES affect at least one live local branch (specifically, the
intermediate history of refs/heads/chore/heartbeat-batch-2026-
04-26-hour-05Z). Hard reset / branch cleanup remains blocked
until the branch's content is classified as preserved,
obsolete, or explicitly abandoned.
```

Branch-tip checkout / hard-reset-to-tip is fine. Reading
intermediate-history blobs would surface the corruption.

## Stale remote-tracking ref — evidence, not origin recovery

```text
$ git show-ref | grep 'chore/heartbeat-batch-2026-04-26-hour-05Z'
d9feb3f08603e37118491e26527c03e6e5760d5b refs/heads/chore/heartbeat-batch-2026-04-26-hour-05Z
d9feb3f08603e37118491e26527c03e6e5760d5b refs/remotes/origin/chore/heartbeat-batch-2026-04-26-hour-05Z
                                         ↑ same SHA → ref is stale, not authoritative

$ git ls-remote --heads origin chore/heartbeat-batch-2026-04-26-hour-05Z
(empty — origin no longer has this branch)
```

The remote-tracking ref is **stale** — origin deleted the
branch (presumably after squash-merge), but the local repo
still carries the same-named ref under
`refs/remotes/origin/...`. This stale ref is evidence about
the prior state of origin; it is NOT proof origin currently
has the object. Do not prune it during triage — `git fetch
--prune origin` and `git remote prune` would remove it, and
that's a destructive cleanup decision under the same rule as
GC.

```text
Stale remote-tracking ref is evidence, not origin recovery.
Do not prune it while investigating lost substrate.
```

## Cleanup posture

```text
Cleanup is a destructive decision, not a repair step.
```

`git gc` / `git prune` / `git repack -Ad` / `git fsck --lost-found`
remain forbidden during triage. Auto-gc thresholds are at default
(per `gc-config-snapshot.txt`); below-threshold loose-object count
means auto-gc is not imminent, but the discipline is "no implicit
cleanup decision" not "we have time."

A future cleanup may remove this unreachable/corrupt evidence, so
cleanup must wait until related dangling/reflog/stash surfaces
are classified and either preserved or explicitly abandoned.

## Composes with

- `docs/lost-substrate/inventory-ledger-2026-04-29.md` — the
  inventory ledger that surfaced these findings.
- `memory/feedback_corruption_triage_discipline_object_health_incident_aaron_amara_2026_04_29.md`
  — the durable discipline rule.

## Distilled keepers (Amara 2026-04-29)

```text
A corrupt object is not a backlog item — it is a substrate health incident.
Do not prune the evidence while investigating lost evidence.
Recoverable-from-origin requires fresh-clone cat-file type + size verification.
Cleanup is a destructive decision, not a repair step.
Corruption lane means exclusive lane.
If corruption is the incident, everything else is noise.
```
