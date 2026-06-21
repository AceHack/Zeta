---
name: b0530-push-time-variant-and-read-tree-head-recovers-truncated-index
description: "Empirical refinements to saturation-ceiling discipline from 2026-05-21 1212Z-1305Z session — 081KRMEXM0008QG0R000X1PPGC pack-dir contention manifests at git-push time (not just worktree-add); git read-tree HEAD rebuilds a truncated index in-place without requiring worktree abandonment"
type: feedback
created: 2026-05-21
---

# 081KRMEXM0008QG0R000X1PPGC manifests at push-time + `git read-tree HEAD` recovers truncated index (Otto-CLI 2026-05-21)

Two empirical refinements to the saturation-ceiling discipline at [`.claude/rules/claim-acquire-before-worktree-work.md`](../.claude/rules/claim-acquire-before-worktree-work.md), observed during a single Otto-CLI cold-boot autonomous-loop session 2026-05-21T12:09Z–13:05Z under Lior-cycling saturation (3 procs incl `gemini-3.1-pro-preview --yolo`).

**Why:** the saturation-ceiling taxonomy currently documents 5 sub-cases scoped to worktree creation + Edit-to-commit windows. This session hit two NEW manifestations that the existing taxonomy doesn't explicitly cover — both within a successful end-to-end PR cycle (PR [#4532](https://github.com/Lucent-Financial-Group/Zeta/pull/4532) merged at `5b7cda06`).

**How to apply:** when authoring the next rule edit under quieter conditions, fold these into the existing sub-case structure rather than creating new sub-case numbers.

## Refinement 1 — 081KRMEXM0008QG0R000X1PPGC pack-dir contention manifests at `git push` time, not only at `git worktree add`

### Empirical anchor

After a clean worktree-add + canary tree=54 + commit `a15704be` + successful first push, a follow-up commit `4ea867f9` (3-thread-fix on PR #4532) failed multiple times on `git push origin <branch>`:

```
error: unable to open loose object cb16f9c386eabfb81fee740e318a0cb655079158: Interrupted system call
error: unable to open object pack directory: /Users/acehack/Documents/src/repos/Zeta/.git/objects/pack: Interrupted system call
fatal: bad object cb16f9c386eabfb81fee740e318a0cb655079158
fatal: the remote end hung up unexpectedly
error: failed to push some refs to 'https://github.com/Lucent-Financial-Group/Zeta.git'
```

Network was fine (HTTPS to github.com returned 200 in 0.18s); auth was fine (`gh auth status` clean). The bottleneck was local FS contention on `.git/objects/pack` — the same root cause class as 081KRMEXM0008QG0R000X1PPGC, but at push time rather than at worktree-add time.

### Existing taxonomy gap

Sub-case 3 in [`claim-acquire-before-worktree-work.md`](../.claude/rules/claim-acquire-before-worktree-work.md) ("pack-dir contention hangs `git worktree add`") names the worktree-add failure mode. Push-time was not previously documented. Adding push-time as a sibling manifestation:

> **Sub-case 3b — pack-dir contention causes `git push` to fail with `Interrupted system call` on `.git/objects/pack`.**
>
> Symptom: `git push` returns exit 1 with `Interrupted system call` errors on loose-object and pack-dir reads, followed by `the remote end hung up unexpectedly`. Network + auth are fine; bottleneck is local pack-dir reads under peer-agent contention.
>
> Mitigation (no working code-level mitigation today): retry until the contention window closes. Empirically the same window that causes worktree-add hangs (3-5 min cycles under sustained Lior + bg-worker activity) also causes push failures. Composes with 081KRW63S0008QG0R000EAZ9K2 (silent-push-failure where push returns exit 0 but never updates the remote ref) — they are distinct failure modes from the same FS-contention root cause class.

### Distinguish from 081KRW63S0008QG0R000EAZ9K2

- **081KRMEXM0008QG0R000X1PPGC-at-push-time (this refinement)**: push exits NON-zero with explicit `Interrupted system call` errors. The failure is visible.
- **081KRW63S0008QG0R000EAZ9K2**: push exits ZERO but the remote ref never updates. The failure is silent. Workaround: REST git-data API bypass (`POST .../git/blobs` → `POST .../git/trees` → `POST .../git/commits` → `POST .../git/refs`). Worked example: PR [#4145](https://github.com/Lucent-Financial-Group/Zeta/pull/4145).

Both belong in the same saturation-ceiling section but they are different failure shapes requiring different mitigations.

## Refinement 2 — `git read-tree HEAD` rebuilds a truncated index in-place

### Empirical anchor

After stale `index.lock` removal, the next `git status` returned:

```
fatal: /Users/acehack/Documents/src/repos/Zeta/.git/worktrees/zeta-cold-boot-1212z-2026-05-21/index: index file smaller than expected
```

A previous `git status` had shown massive D (deleted) entries against files I had not touched — a misleading symptom of the corrupted index, NOT actual working-tree deletion.

### Recovery without worktree abandonment

```bash
git read-tree HEAD
```

This rebuilds the worktree's index from HEAD. After running it:

- `git status` returned clean (empty)
- `git ls-tree HEAD | wc -l` returned 54 (correct)
- Subsequent `git add <shard-path>` + `git commit` succeeded normally
- Final commit canary: parent tree=54, commit tree=54 (matched)

### Existing taxonomy gap

Sub-case 5 in the rule documents peer-side destructive git operations discarding unstaged edits. The mitigation it recommends is "commit edits IMMEDIATELY after authoring" with no fallback for an already-corrupted index. This refinement adds the in-place recovery:

> **Recovery for truncated index (when the corruption symptom is `index file smaller than expected`):**
>
> ```bash
> git -C <worktree> read-tree HEAD
> ```
>
> This rebuilds the worktree's index from the HEAD commit, replacing the truncated index in-place. Working-tree files are NOT modified (they were not part of the corruption — only the index was). After rebuild:
>
> 1. `git status` returns clean
> 2. Stage your intended file via `git add <path>` (the file is still on disk; the read-tree wiped any stale staged state but did not touch the working tree)
> 3. `git commit` normally
> 4. Verify commit canary (parent tree size = commit tree size) before pushing
>
> When NOT to use: if the working tree itself is corrupted (files missing on disk), `read-tree` will silently stage the wrong state. Pre-check disk state via `ls` before invoking. The recovery applies only to truncated-INDEX states, not truncated-working-tree states.

This refinement is bounded: it does NOT supersede the abandonment-rule for all sub-case 3 or 4 hits. It DOES extend the recovery toolkit for the specific symptom `index file smaller than expected`, which is the most-common state after stale-lock-removal under peer contention.

## Composition with existing substrate

- [`.claude/rules/claim-acquire-before-worktree-work.md`](../.claude/rules/claim-acquire-before-worktree-work.md) — the canonical home for both refinements
- [`.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`](../.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md) — canary protocol composes (run tree-size check after `read-tree HEAD` to confirm recovery)
- [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md) — counter-with-escalation; when contention forces multiple push retries within a single tick, treat as bounded-wait-on-FS-contention (a real named dep) rather than as Standing-by
- 081KRMEXM0008QG0R000X1PPGC — the original failure-mode anchor
- 081KRW63S0008QG0R000EAZ9K2 — the silent-push-failure variant (distinct mitigation path)
- PR [#4532](https://github.com/Lucent-Financial-Group/Zeta/pull/4532) — this session's PR where both refinements were observed end-to-end
- Background-worker Otto's bootstream (PID 10413 prompt fragment captured this tick) — the canonical source where I learned the 081KRW63S0008QG0R000EAZ9K2 name + REST git-data API workaround pointer

## Session timeline

- 12:09Z fresh cold-boot; sentinel armed (catch-43 invariant)
- 12:13Z worktree-add `FETCH_HEAD` failed (Refinement 1's worktree-add variant — sub-case 3); explicit-SHA succeeded
- 12:13Z canary tree=54; pass
- 12:15Z stale `index.lock` + post-removal truncated index (Refinement 2 trigger)
- 12:16Z `git read-tree HEAD` recovers in-place (Refinement 2 mitigation working)
- 12:18Z commit `a15704be` clean
- 12:42Z PR #4532 BLOCKED on 3 valid review threads
- 12:43Z fix-up commit `4ea867f9` (link-depth + first-shard claim corrections)
- 12:45Z push failed with `Interrupted system call` (Refinement 1's push-time variant)
- 12:55Z–13:00Z push retries succeed under bg-worker (PID 10413) churn pattern
- 13:01Z 3 threads resolved via GraphQL
- 13:05Z auto-merge fires at `5b7cda06`; verify-merge via REST API confirms substrate landed correctly

## Substrate-honest disclaimer

This memo CAPTURES the refinements; it does NOT yet land them as rule edits. The next substrate-engineering tick (under quieter conditions, when this memo can compose cleanly with the rule's existing taxonomy section structure) is when the rule edit should land. The cold-boot agent next loading this memo + the rule should produce the combined edit.
