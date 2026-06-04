# BLOCKED-with-green-CI means investigate unresolved threads first

Carved sentence:

> The block is virtually never opaque — it's almost always a
> small countable set of threads with addressable findings.

## Operational content

When `bun tools/github/poll-pr-gate.ts <PR>` reports
`gate: "BLOCKED"` AND `requiredChecks.failed: 0` AND
`autoMerge: "armed"`:

1. Check `unresolvedThreads` in the same JSON payload **FIRST**.
2. Filter on `isResolved == false` only — outdated unresolved
   threads (after a force-push) STILL block merge under
   `required_conversation_resolution` and must be explicitly
   resolved.
3. The block is almost always a small set of threads. Address
   the findings; don't just wait.

**Failure mode**: outputting "gated wait" or "Holding" more
than once without having run the threads query. If this happens,
stop and run it.

## Composes with: verify-before-fix on reviewer findings

Once threads are surfaced, **verify each finding against the
source before applying a fix**. Reviewer tools (Copilot, etc.)
produce real findings AND hallucinations; treating both as
equally actionable wastes commits and can introduce regressions.

Verification anchors:

- **Direct line-level inspection**: substitute the literal line number for
  `<N>` via `-v` — `awk -v N=22 'NR==N { print NR": ["$0"]" }' <file>` —
  to read the exact bytes the reviewer is commenting on. (Without
  `-v N=…`, awk treats `N` as an uninitialized variable equal to 0 and
  prints nothing.)
- **`gh api repos/<owner>/<repo>/pulls/<N>`** to fetch PR metadata
  (state, merge_commit_sha, head SHA); **`gh pr view <N> --json
  commits,mergeCommit`** to inspect commits; plus
  `git log --grep '#<N>'` to find the merge commit by PR-number in the
  local repo: confirm historical / cross-reference claims, not memory.
  (Plain `git log <N>` does NOT work — git log expects
  refs/commits/paths, not PR numbers.)
- **Local lint/build**: re-run the relevant check locally to see
  if the reviewer's failure-mode reproduces.

### Suspect-by-default Copilot finding classes

Empirical patterns observed multiple times during a single
autonomous session (2026-05-16) where Copilot reported a
finding that direct inspection confirmed as false:

| Class | Reviewer claim | Reality |
|-------|----------------|---------|
| Table double-pipe (`\|\|`) | "extra leading `\|` in tables creates empty first column" | Direct `awk` shows single `\|` rows; 4 confirmed FPs in one session (PR #3685, #3690, #3699-era, #3709) |

When a thread matches a known-FP class:

1. Verify via direct inspection (don't trust the reviewer's quote)
2. If confirmed FP, resolve no-op with a brief comment OR just resolve
3. Do NOT push a fix that would change correct content

This list is empirical; new FP classes get appended as they
accumulate evidence. A single FP doesn't justify entry —
two-or-more across distinct PRs is the threshold for
"suspect-by-default."

### Verify-also-on-stale-but-fresh-looking findings

A second class: findings that were TRUE at thread-filing time
but became STALE by review-resolution time. Common cases:

- Parent-tick links to shard files in sibling PRs — the link
  is broken at file-tree time but resolves once the sibling
  PR merges. The thread is filed correctly but resolution-time
  state has self-healed.
- "Inconsistency between X status and Y status" prose
  observations — true at write-time, accurate then,
  but the underlying state has moved.

Resolve these no-op (the prose was correct at write-time;
substrate edits would be retroactive rewriting). Stale ≠
false; it just means the action window closed.

#### Worked example — 2-finding pre-fixed cascade with immediate auto-merge fire

Empirical anchor [PR #4097](https://github.com/Lucent-Financial-Group/Zeta/pull/4097)
(merged 2026-05-17T21:29Z at `e1704a26`):

- `poll-pr-gate.ts 4097` returned `gate: "BLOCKED"`, `requiredChecks.failed: 0`,
  `autoMerge: "armed"`, `unresolvedThreads: 2`
- Both threads (Codex P2 `PRRT_kwDOSF9kNM6Cppvx` + Copilot
  `PRRT_kwDOSF9kNM6Cppwe`) on the same file + same line
  (`docs/backlog/P3/B-0613-...md` line 75), same finding
  ("Option A is `compgen -G`, a bash builtin, not zsh-valid")
- **Both threads had `isOutdated: false`** even though peer Otto's
  commit `6f91e9c` ("fix(B-0613): drop Option A from zsh fallback
  recommendation") had already addressed both findings before the
  current session's tick-open. `isOutdated=false` is NOT a
  reliable signal that the finding is still actionable; GitHub
  does not auto-outdate threads when a fix touches the same line
  unless the comment's diff-hunk anchor itself drifts.
- Verification via direct `awk -v N=75 'NR==N { print NR": ["$0"]" }'`
  on the file content confirmed line 75 already read "use **Option C
  (find — fully portable)** since Option A (`compgen -G`) is also
  bash-only" — the precise correction both reviewers had asked for.
- `resolveReviewThread` GraphQL mutation × 2 → both `resolved=true`.
  Within 5 seconds the armed auto-merge fired and the PR landed
  on main.

**Operational lesson**: `isOutdated=true` is a strong signal that
a thread is safely no-op-resolvable, but `isOutdated=false` is NOT
a counter-signal — the thread may still be substantively stale.
The verify-via-direct-inspection step (with `-v N=<line>`) is the
load-bearing discriminator between "fix needed" and "fix already
landed, just resolve." Resolving threads on the latter case is
correct discipline, not retroactive rewriting.

### Stale-armed-PR resolution patterns

Empirical anchor 2026-05-16T13:10Z-16:33Z (one session, 5 stale-armed PR investigations):

A stale-armed PR is one with auto-merge armed for hours/days where checks fail or merge conflicts persist. Investigation per this rule typically classifies it into one of three resolution patterns:

| Pattern | Apply when | Empirical instance |
|---|---|---|
| **Close as redundant** | The PR's substrate already exists on `main` via a different PR (byte-identical file paths, or content shipped via newer PR). Close with substrate-honest comment + cross-link to the merged equivalent. Preserves alternate-content version in branch history per [`lost-files-surface`](lost-files-surface.md) | [#3823](https://github.com/Lucent-Financial-Group/Zeta/pull/3823) — 07:58Z shard already on main via different PR; closed at 13:31Z |
| **Re-land via cherry-pick** | The PR's substrate is genuinely new but the branch is too stale to merge (CI fails on unrelated evolved files, merge conflicts on regenerated index files). Cherry-pick the substrate onto a fresh branch off current main, manually re-apply auto-generated files via the generator (e.g., `bun tools/backlog/generate-index.ts`), fix any lint issues that surface | [#3817 → #3894](https://github.com/Lucent-Financial-Group/Zeta/pull/3894) (B-0558 worktree-pool); [#3779 → #3904](https://github.com/Lucent-Financial-Group/Zeta/pull/3904) (0630Z shard re-land) |
| **Forward-signal comment** | The PR is too large (e.g., 61 files in [#3545](https://github.com/Lucent-Financial-Group/Zeta/pull/3545)) or otherwise impractical to re-land in a single tick. Leave a comment naming the two viable resolution paths (rebase OR cherry-pick) AND flagging any newer PRs that may supersede the substrate. Forward signal for whoever picks it up next | [#3545](https://github.com/Lucent-Financial-Group/Zeta/pull/3545#issuecomment-4467314174) — DIRTY 19+ hr, 61-file conflict |

**Decision tree** (in order):

1. Does the substrate already exist on `main` via a different PR? → **Close as redundant**
2. Is the substrate small enough to re-land in 1-2 ticks? → **Re-land via cherry-pick**
3. Otherwise → **Forward-signal comment** (the PR sits until someone else has the budget)

Composes with [`refresh-world-model-poll-pr-gate.md`](refresh-world-model-poll-pr-gate.md) rate-limit tiers — re-land requires normal-tier GraphQL budget; forward-signal works at any tier.

### Auto-merge-race-with-follow-up-commit anti-pattern

Empirical anchor 2026-05-19T08:03Z-08:16Z ([PR #4357](https://github.com/Lucent-Financial-Group/Zeta/pull/4357)):

Arming auto-merge while a **non-required check is failing** + pushing a **follow-up commit** to fix that check is a race window. The CLEAN-gate transition fires on required-checks-only state; if all required checks complete before the follow-up commit's CI run starts, auto-merge fires on the **first commit's content** and the follow-up lands on main never.

Empirical sequence on PR #4357:

1. First commit `45128146` pushed; auto-merge armed; lint (tick-shard relative-paths, non-required) failed on this commit
2. Follow-up commit `9c9c8e69` pushed ~5 min later fixing the lint
3. CI on first commit completed before lint job on second commit started
4. Required-checks state went green → auto-merge fired on `45128146` → merge commit `cfba8a64` contained the un-fixed lint state
5. Substrate-honest correction required a second PR ([#4358](https://github.com/Lucent-Financial-Group/Zeta/pull/4358)) to land the fix

**Operational discipline** (one of three resolutions in order):

1. **Don't arm auto-merge until all desired commits are pushed** — preferred; arming is cheap and reversible (`gh pr merge --disable-auto`)
2. **If arming early, treat non-required failures as if required during the arm window** — fix in-place before arming; check `bun tools/github/poll-pr-gate.ts <PR>` for `warnings` field listing non-required failures
3. **Accept that the first-commit content is what ships** — substrate-honest if the follow-up is cosmetic; otherwise ship the follow-up as a separate PR like #4358

**Detection**: `bun tools/github/poll-pr-gate.ts <PR>` surfaces non-required failures in the `warnings` array even when `gate: "CLEAN"` is reachable. Treat any `warnings` entry as a race-window indicator when auto-merge is armed and a follow-up commit is staged.

Composes with the stale-armed-PR resolution patterns above — race-merged content stays on main as substrate, even if the follow-up fix lands separately; the substrate-honest correction never deletes the race-merged commit, only adds the fix.

## Full reasoning

`memory/feedback_otto_355_blocked_with_green_ci_means_investigate_review_threads_first_dont_wait_2026_04_27.md`

`memory/feedback_outdated_review_threads_block_merge_resolve_explicitly_after_force_push_2026_04_27.md`
