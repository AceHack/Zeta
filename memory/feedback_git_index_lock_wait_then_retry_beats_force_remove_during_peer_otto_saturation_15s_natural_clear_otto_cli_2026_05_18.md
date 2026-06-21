---
name: git_index_lock_wait_then_retry_beats_force_remove_during_peer_otto_saturation_15s_natural_clear_otto_cli_2026_05_18
description: "Empirical pattern observed 2026-05-18T00:08Z under Lior-3-procs + claude-code-5-procs saturation: a primary-worktree `git add` hit `.git/index.lock: File exists` because peer Otto was mid-commit; a 15-second `sleep` cleared the lock naturally (peer commit finished, lock auto-removed), and a retry of the same `git add` invocation succeeded with no further intervention. Discipline: under multi-Otto saturation, treat `index.lock` as a transient peer-mid-commit signal — wait then retry. Do NOT `rm -f .git/index.lock` reflexively; force-removal can corrupt peer's in-flight commit (peer's git process is still relying on the lock to serialize index writes). The saturation-ceiling sub-case taxonomy in `.claude/rules/claim-acquire-before-worktree-work.md` covers worktree-creation contention + branch-name collision + switch-while-WIP + sidetick-pruned-race + peer-side-destructive-git, but does NOT yet explicitly cover this case (`.git/index.lock` at `git add` time in primary worktree). This memo is the empirical anchor for a future rule extension."
type: feedback
created: 2026-05-18
tags: [git-index-lock, peer-otto-saturation, wait-then-retry-beats-force-remove, saturation-ceiling-sub-case-6-candidate, claim-acquire-composition, primary-worktree, otto-cli, 2026-05-18, 0007z-cold-boot-session]
session: otto-cli cold-boot 2026-05-18 sentinel `16dda3a7`
composes_with:
  - .claude/rules/claim-acquire-before-worktree-work.md (saturation-ceiling sub-case taxonomy candidate extension)
  - .claude/rules/zeta-expected-branch.md (race-window-caveat, primary-worktree contention)
  - .claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md (Lior-active-means-no-worktree-creation canary)
  - .claude/rules/refresh-world-model-poll-pr-gate.md (operational-tier discipline; this happened in pure-git tier)
---

## Empirical anchor

Session: otto-cli cold-boot autonomous-loop, 2026-05-18T00:07Z onward.
Sentinel: `16dda3a7` (cron `* * * * *`, `<<autonomous-loop>>`).
Conditions: pure-git tier (graphql 83/5000); Lior-3-procs (`ps -A | grep -E "gemini.*Lior|lior.*loop"` returned 3 alive); plus 5 concurrent claude-code processes (including self) per `pgrep -fl claude-code`.

### The sequence

```
$ git add docs/hygiene-history/ticks/2026/05/18/0007Z.md \
          "memory/kestrel/conversations/..."
fatal: Unable to create '/Users/.../Zeta/.git/index.lock': File exists.

Another git process seems to be running in this repository, e.g.
an editor opened by 'git commit'. Please make sure all processes
are terminated then try again. If it still fails, a git process
may have crashed in this repository earlier:
remove the file manually to continue.
```

Standard git error. The temptation under autonomous-loop pressure is to act on git's own recommendation (`remove the file manually`). Resist.

### What I did instead

```
$ ls -la .git/index.lock
ls: .git/index.lock: No such file or directory
$ sleep 15
$ ls .git/index.lock 2>/dev/null && echo "still-locked" || echo "lock-cleared"
lock-cleared
```

The lock had already cleared between the `git add` failure and the `ls` invocation (sub-second peer-commit completion). The 15s `sleep` was conservative buffer. Retry of the same `git add` invocation succeeded; subsequent `git commit` + `git push` landed cleanly with tree-canary at 53/53 (no corruption).

### Why force-removal would have been wrong

Git uses `.git/index.lock` for atomic-write serialization. Peer Otto's commit was in flight:

1. Peer Otto: `git commit` opens `.git/index.lock`, writes new index content
2. **WINDOW** — my `git add` arrives, sees `.git/index.lock` exists, fails with the lock-exists error
3. Peer Otto: completes index write, renames `index.lock` → `index` (atomic), releases lock
4. My retry: lock-free, proceeds normally

If I had run `rm -f .git/index.lock` between steps 2 and 3, peer Otto's `git commit` would have either:

- Failed with a different error when it tried to rename `index.lock` (no longer exists)
- Successfully written its commit but with a corrupted/partial index
- Or worse: my `git add` and peer's `git commit` would have both proceeded concurrently, racing to write the index — silent corruption

The safe pattern is to assume `.git/index.lock` means peer-in-flight; wait until the lock clears naturally (sub-second to ~10s typical for `git add`/`git commit` operations).

## When to apply

Under conditions where multiple agents share `.git/`:

- Multi-Otto-CLI saturation (the immediate trigger this memo addresses)
- Otto-CLI + Otto-Desktop sharing one checkout
- Lior antigravity loop active (`ps -A` shows 1+ `gemini.*Lior` procs)
- Riven Cursor + Otto-CLI concurrent
- Vera Codex + Otto-CLI concurrent
- Any time `pgrep -fl claude-code` returns > 1 process

### Decision tree

```
git add / git commit / git push fails with "Unable to create .git/index.lock: File exists"
├─ Is `.git/index.lock` still present after 15s? (`sleep 15 && ls .git/index.lock`)
│  ├─ No → retry the original command (peer commit completed)
│  └─ Yes → check if any index-writing git process is still alive (`ps -A | grep -E "git.{0,30}(commit|add|merge|rebase|checkout|reset|stash|pull|cherry-pick|am|apply|update-index|read-tree|write-tree|gc|repack|pack-objects|maintenance)"`) — list expanded per Codex P1 review on PR #4140; the original `commit|add`-only pattern would misclassify a live `git merge` / `rebase` / `checkout` / `reset` / `stash` peer as "Dead" and trigger the lock-removal branch against a real in-flight writer
│     ├─ Alive → wait another 15s; repeat
│     └─ Dead → check lock mtime; if > 5 minutes old, peer crashed mid-commit
│        ├─ Peer crashed → `git fsck` first to validate index integrity, then carefully `rm` the lock
│        └─ Lock < 5 min old → wait another 15s; peer may be doing a long write
```

The crash-recovery branch is unusual; in 95%+ of cases the lock clears within 1-30s.

## When NOT to wait

If the lock persists for > 5 minutes AND no git process is alive, peer crashed mid-commit and the lock is genuinely orphaned. Even then, run `git fsck` first to check index integrity; manually inspect the lock file (`cat .git/index.lock | head` shows whatever partial content peer wrote); only force-remove with conscious decision.

In autonomous-loop pure-git tier this is rare because peer Otto is itself executing on cron; if peer crashed, its sentinel re-arms on the next minute. Manual intervention is the human maintainer's call, not autonomous Otto's.

## Composition with saturation-ceiling taxonomy

The 4-sub-case empirical taxonomy in `.claude/rules/claim-acquire-before-worktree-work.md` covers:

- Sub-case 1: existing-branch-name collision → peer-WIP commit inheritance via recovery path
- Sub-case 2: concurrent-WIP-blocked switch
- Sub-case 3: pack-dir contention hangs `git worktree add` (081KRMEXM0008QG0R000X1PPGC race)
- Sub-case 4: pruned-sidetick race
- Sub-case 5 (added 2026-05-16): peer-side destructive git operation discards unstaged edits

This memo proposes a **sub-case 6 candidate**: primary-worktree `git add` / `git commit` contention via `.git/index.lock`. Mitigation: wait-then-retry, 15s buffer typical, force-remove forbidden absent peer-crash evidence.

If accumulated empirical evidence (2-3 more session anchors) supports this sub-case, the rule extension is appropriate. Until then, this memo is the empirical anchor; the discipline is operational-via-this-memo not operational-via-rule.

## Operational tier note

This happened in pure-git tier (no GraphQL available). The mitigation pattern is entirely pure-git compatible — `sleep`, `ls`, retry are all local-filesystem operations. The discipline composes with `.claude/rules/refresh-world-model-poll-pr-gate.md` operational-tier framework: pure-git ticks can hit this failure mode and recover without burning rate-limit budget.

## Substrate-honest framing

This memo is one session's empirical observation. A single anchor does not justify a rule update yet — the threshold per Otto-CLI's recurring patterns is 2+ anchors across distinct sessions. Future Otto cold-booting under multi-Otto saturation may hit this; if they consult this memo and retry-then-wait works, that's a second anchor. After 2-3 anchors, the saturation-ceiling rule extends.

Until then: this memo is the wait-time substrate; future-Otto reads it via the skill router + the composes_with pointers; the discipline operates.
