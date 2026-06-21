# CodeQL "no source code seen" on docs-only PR is a broken-commit canary, NOT a flake

Carved sentence:

> When CodeQL fails `no source code seen during build` on a docs-only PR
> while sibling docs-only PRs in the same window pass, the commit tree is
> CORRUPTED. Run `git ls-tree HEAD | wc -l` BEFORE treating as flake.
> Lock-cleanup races with peer agents can collapse the commit tree
> silently — at worktree-creation time, between `git add` and `git
> commit`, or during user operations. The only reliable safe-window
> indicator is `ps -A | grep -E "gemini.*Lior|lior.*loop"` returning
> nothing.

## Operational content

When a docs-only PR fails CodeQL with three identical
"no source code seen during build" errors (csharp + java-kotlin +
javascript-typescript), do NOT default to the flake hypothesis.

**Run the canary check IMMEDIATELY:**

```bash
PR_HEAD=$(gh pr view <PR> --json headRefOid -q .headRefOid)
git fetch origin
expected=$(git ls-tree origin/main | wc -l | tr -d ' ')
actual=$(git ls-tree "$PR_HEAD" | wc -l | tr -d ' ')
if [ "$actual" -lt $((expected - 2)) ]; then
  echo "BROKEN COMMIT — tree collapsed from $expected to $actual root entries"
  echo "DO NOT MERGE. Close PR with substrate-honest comment."
  exit 1
fi
```

**Three downstream signals all point to the same root cause:**

| Signal | Misread as | Actual cause |
|---|---|---|
| CodeQL `no source code seen` (3×) | CI flake | Commit literally has no source code |
| `gh pr update-branch --rebase` → `RebaseConflictError` | Phantom conflict | Tree-replacement conflicts with main |
| `gh api .../files` reports ~5000 changed files | API quirk | Real destructive diff vs main |

**The confirmation bias trap:** when N sibling docs-only PRs pass clean
and ours fails, the natural read is "we hit a flake." The substrate-honest
read is "ours has something STRUCTURALLY DIFFERENT — investigate THAT,
not the CI."

## Root cause — peer-agent lock-cleanup race

When peer agents (e.g., Lior-gemini running step 8: "Perform global lock
cleanup: clear stale git index locks") fire their cleanup pass while
another agent is using a git worktree, the worktree's
`.git/worktrees/<name>/index` can be cleared along with its `.lock` file.
Subsequent operations against an empty index produce malformed commits
or pre-corrupted indices.

The commit message reports normal output ("1 file changed, N insertions")
because that's the diff against the empty staging area, not against the
parent commit. Visual inspection of the commit looks normal. Only the
ls-tree count reveals the corruption.

## Pre-worktree-creation guard (STRONGEST when followed; verify-before-defer composition)

**Empirically: CPU % is NOT a reliable indicator.** Lior at 0.0% CPU has
been observed corrupting indices at worktree-creation time. The ONLY
reliable substrate-state check is the process list:

```bash
if ps -A | grep -qE "gemini.*Lior|lior.*loop"; then
  echo "Lior-gemini active — pre-worktree defer is SAFEST"
  echo "Use memory-file + bus-envelope substrate paths instead"
  exit 1
fi
```

**Verify-before-defer composition (when bounded substrate work is at
stake)**: per `.claude/rules/verify-before-deferring.md` the substrate-
honest discipline is to test the operative question rather than narrate
the obstacle from inferred conditions. The composite pattern is:
attempt isolated worktree creation → run post-worktree-creation guard
IMMEDIATELY (next section) → proceed if clean, abort + remove worktree
if corrupted. This relaxation REQUIRES the post-creation guard to be
non-optional; the pre-worktree blanket defer remains the safest stance
when no bounded substrate is at risk. Empirical: 2026-05-20T14:13Z
worktree-add during 3-proc Lior activity produced clean tree
(`ls-tree HEAD = 53`, `status --short = 0`), and the post-commit
ls-tree count remained 53 — see "Empirical anchor (2026-05-20)" below
for the 6th data point.

## Post-worktree-creation guard (FRESHNESS CHECK)

```bash
cd <worktree-path>
status_lines=$(git status --short | wc -l | tr -d ' ')
tree_size=$(git ls-tree HEAD | wc -l | tr -d ' ')
if [ "$status_lines" -gt 5 ] || [ "$tree_size" -lt 50 ]; then
  echo "WORKTREE ALREADY CORRUPTED at creation"
  cd / && git worktree remove <worktree-path> -f -f
  exit 1
fi
```

## Stale-index.lock-as-precursor guard (NEW — empirical 2026-05-21T06:03Z)

A NEW failure shape observed: `git worktree add` succeeds, the worktree
directory looks fully populated (`ls -la` shows 44+ entries including
`.claude/`, `.codex/`, etc.), `git ls-tree HEAD` returns the expected
count (e.g. 53) — BUT the worktree's index is empty/stale because the
peer Otto lock-cleanup race ran during worktree creation. The first
`git add` against this corrupted index then triggers the canary
(tree collapse 53→1 with a single `docs/` entry).

**Precursor signal**: `.git/worktrees/<name>/index.lock` is present at
worktree-add completion (rather than only appearing transiently during
git operations).

**Diagnostic shape** (the lock that fired the canary on 2026-05-21T06:13Z):

- **Size 0 bytes** (`stat -f "%z" <lock>` reports `0`)
- **Age past the 15s natural-clear window** (5min37s old when caught)

A lock present at all post-`worktree add` is suspect; a 0-byte lock that
has aged past 15s without clearing is the strong canary-precursor signal.

**Operational guard** (before first `git add` in a fresh worktree):

```bash
WT_GIT=$(git -C <worktree-path> rev-parse --git-dir)
LOCK="$WT_GIT/index.lock"
if [ -f "$LOCK" ]; then
  AGE=$(( $(date +%s) - $(stat -f %m "$LOCK") ))
  SIZE=$(stat -f %z "$LOCK")
  if [ "$AGE" -gt 15 ]; then
    echo "STALE LOCK: ${AGE}s old, ${SIZE} bytes — canary precursor"
    rm "$LOCK"
    # Re-materialize index from tree to recover from possible peer corruption:
    git -C <worktree-path> restore --staged --worktree --source=HEAD -- .
  fi
fi
```

The `git restore --staged --worktree --source=HEAD -- .` recovery is the
key step — it re-materializes both index and working tree from the HEAD
tree, replacing whatever the peer cleanup race emptied. Without this,
`git add <new-file>` against an empty index produces a commit whose
parent-diff is "delete everything + add this one file" — exactly the
canary signature.

**Why the post-creation `ls-tree HEAD` check (previous section) is not
sufficient**: `git ls-tree HEAD` reads the TREE object, not the INDEX.
The tree-from-HEAD remains correct (53 entries on 2026-05-21) while the
index is empty. The post-creation FRESHNESS check above runs
`git status --short` which compares working tree to index — but if BOTH
the index AND working tree are stale-but-matching (the peer cleanup
emptied both before populating from HEAD completed), `git status` shows
clean too. The 0-byte stale `index.lock` is the only signal that
distinguishes "fresh and matching" from "stale but matching."

## Post-commit guard (TRADITIONAL)

```bash
git commit -m "..."
expected=$(git ls-tree HEAD~1 | wc -l | tr -d ' ')
actual=$(git ls-tree HEAD | wc -l | tr -d ' ')
if [ "$actual" -lt $((expected - 2)) ]; then
  echo "BROKEN COMMIT — aborting push"
  git reset --hard HEAD~1
  exit 1
fi
git push ...
```

## Empirical anchor (2026-05-15 cold-boot session)

Four worktree-creation attempts:

1. `/tmp/zeta-otto-cli-cold-boot-1338z` (1338Z) — **survived** (Lior was 18 min into cleanup, possibly between cycles); PR #3487 merged at `0cabc085`
2. `/tmp/zeta-otto-cli-b0531` (1345Z) — **corrupted**, tree collapsed to 1 entry (only `docs/`); 51 top-level entries silently deleted; PR #3492 had auto-merge armed; CodeQL/rebase signals dismissed as flake; **caught P0 by chatgpt-codex-connector review** before merge; PR closed
3. `/private/tmp/zeta-otto-cli-codeql-canary-rule` (1521Z retry) — **corrupted DURING use**; `git status` showed 5066-line deletion staged after Lior re-fired at 3.2% CPU; aborted before commit
4. `/private/tmp/zeta-otto-cli-canary-rule-retry-1547z` (1547Z retry) — **corrupted AT CREATION**; 5032-line status diff immediately after worktree-add despite Lior at 0.0% CPU; aborted before any user operation
5. **This file's worktree** `/private/tmp/zeta-codeql-canary-rule-1631z` (1631Z) — **clean** (Lior process gone from `ps -A`); landed cleanly

## Empirical anchor (2026-05-20T14:13Z — clean during 3-proc Lior activity)

6th data point validating verify-before-defer composition. Per the Maji
audit `docs/research/2026-05-20-shadow-lesson-log-otto-paralysis.md`
critique of narration-over-action, an Otto-CLI cold-boot tick attempted
isolated worktree creation while 3 Lior-gemini processes were active in
`ps -A`:

- `/private/tmp/zeta-otto-cli-cold-boot-1413z` (14:13Z 2026-05-20) —
  **clean**; `git worktree add ... FETCH_HEAD` succeeded with 5858
  files updated; `git ls-tree HEAD | wc -l` = 53 (matching origin/main's
  53 root entries); `git status --short` = 0 lines; post-commit
  `git ls-tree HEAD | wc -l` = 53; tick shard landed via PR #4410
  merged at `1d8303d8`.

Empirical totals across all 6 anchors: 3 clean (1338Z + 1631Z 2026-05-15;
1413Z 2026-05-20), 3 corrupted (1345Z + 1521Z + 1547Z 2026-05-15). Clean
outcomes correlate with Lior between cleanup-cycles (1338Z), Lior absent
(1631Z), or Lior active-but-not-corrupting (1413Z). Corruption is the
real-but-not-universal failure mode; the post-worktree-creation guard
remains the load-bearing check that distinguishes the cases.

## Empirical anchor (2026-05-21T06:13Z — stale-index.lock precursor)

7th data point. Cold-boot Otto-CLI tick attempted worktree creation
while peer activity was present (workttree list showed 314+ entries
including multiple Lior + Codex worktrees).

- `/private/tmp/zeta-otto-cli-0603z-shard` (06:08Z 2026-05-21) — **clean
  at worktree-add time**: `ls -la` showed 44 entries; `git ls-tree HEAD`
  returned 53; `git status --short` returned empty
- **BUT** `.git/worktrees/zeta-otto-cli-0603z-shard/index.lock` existed,
  0 bytes, 5min37s old
- First `git add docs/.../0603Z.md` proceeded after the stale lock was
  removed (rm); commit then **corrupted** (`git ls-tree HEAD | wc -l` = 1)
- Recovered via `git reset --hard HEAD~1` → 5918 files restored; tree
  back to 53; re-write shard; clean re-commit (HEAD=53, HEAD~1=53, +1 file)
- Shard landed via [PR #4511](https://github.com/Lucent-Financial-Group/Zeta/pull/4511)

**The new signal**: `ls-tree HEAD = 53` and `status --short = 0` BOTH
passed the post-worktree-creation guard from the previous section — yet
the commit still corrupted. The previous guards (process-list, freshness
check, post-commit guard) caught the FAILURE; the stale-`index.lock`-as-
precursor guard would have caught the SETUP-FOR-FAILURE before the first
`git add` ran, avoiding the recovery roundtrip entirely.

Empirical totals across all 7 anchors:

- 3 clean (1338Z + 1631Z 2026-05-15; 1413Z 2026-05-20)
- 4 corrupted (1345Z + 1521Z + 1547Z 2026-05-15; 0608Z 2026-05-21)
- New diagnostic surface (stale-`index.lock` precursor) added by the
  4th corrupted case to distinguish "guards pass + commit corrupts" from
  "guards pass + commit clean"

## Composes with

- `.claude/rules/claim-acquire-before-worktree-work.md` — worktree
  hygiene under multi-agent contention
- `.claude/rules/verify-before-deferring.md` — verify substrate exists
  before classifying issues
- `.claude/rules/refresh-before-decide.md` — raw `git ls-tree` output IS
  the refresh that catches this class
- `081KRHWGX0008QG0R001HMWM1W` (multi-Otto contamination RCA) — this rule is the
  commit-tree-corruption sub-class
- `081KRMEXM0008QG0R000X1PPGC` (cron-sentinel mutex) — same multi-Otto-CLI race class

## Full reasoning

`memory/feedback_codeql_no_source_seen_on_docs_only_pr_is_broken_commit_canary_not_flake_lior_lock_cleanup_race_2026_05_15.md`
(user-scope only — preserved at `~/.claude/projects/.../memory/`
on maintainer machines and indexed in user-scope `MEMORY.md`. Cold-boot
agents on fresh checkouts: this rule's own body above is the canonical
in-repo projection; `memory/CURRENT-otto.md` may also carry the entry)

PR #3492 close comment:
https://github.com/Lucent-Financial-Group/Zeta/pull/3492#issuecomment-4460689811

Bus envelope `35bdbd0c-913d-4b18-8e46-95ba5c81b1cc` (topic
`shadow-catch`, otto-cli→*, 2026-05-15T14:45:04Z)
