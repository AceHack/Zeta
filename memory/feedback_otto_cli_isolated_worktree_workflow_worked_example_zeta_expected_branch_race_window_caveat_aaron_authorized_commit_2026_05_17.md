---
name: Isolated worktree workflow — worked example after new zeta-expected-branch race-window caveat under Aaron-authorized "commit the deferred substrate" (2026-05-17T07:40Z)
description: Mid-task encounter with rule update — zeta-expected-branch.md gained a race-window-caveat section requiring isolated worktree for all commits when peer agent activity may move HEAD in shared .git/. Documents the worked example of executing the new pattern (worktree-add + copy-from-primary + branch-guard + commit + ls-tree-verify + push) under Aaron's authorization to commit the session's deferred substrate. PR creation deferred (GraphQL pure-git tier). The worked example produced commit 432d49b on otto/b0611-audit-prep-substrate-plus-session-memos-2026-05-17 with 11 files, ls-tree count 53 matching origin/main (no canary corruption).
type: feedback
created: 2026-05-17T07:50Z
---

# Isolated worktree workflow — worked example (2026-05-17T07:40Z)

## Trigger

Aaron 2026-05-17T07:39Z: *"<ideal_next_message>commit the deferred
substrate</ideal_next_message> (shadow*)"* — authoritative
instruction to commit the 9 in-repo deferred files (10 with the
0418Z shard from prior session).

## Mid-task rule update

Between switching primary worktree to a new branch (`otto/b0611-...`)
and executing the commit, the harness surfaced an update to
[`.claude/rules/zeta-expected-branch.md`](../.claude/rules/zeta-expected-branch.md)
— a new "Race-window caveat (2026-05-16)" section landed,
mandating isolated worktree for any commit when peer agent activity
in shared `.git/` may move HEAD between Bash-tool calls. The new
rule explicitly forbids the primary contested root worktree for
commits.

The empirical anchor in the rule: 2026-05-16T22:29Z Otto-Desktop
tick where the guard-then-commit pattern raced — peer agent
created a branch and switched HEAD between the guard subprocess
and the commit subprocess, landing the commit on the WRONG branch.
Surgery would require force-push on now-public branch.

The substrate-honest move: pivot from primary-worktree commit to
isolated-worktree commit.

## Worked example — the workflow that succeeded

### Step 0 — Switch primary back, observe state

```bash
git switch otto/audit-dangling-memory-refs-tool-2026-05-17  # back to merged branch
git branch --show-current  # verify
pgrep -fl claude-code | wc -l  # peer-claude count (1 — just me)
```

The dirty state in primary stayed intact (tracked modifications and
untracked files survive `git switch` provided the target branch
does not conflict on the same paths).

### Step 1 — Create isolated worktree on the target branch

The first attempt failed because primary was still on the target
branch:

```bash
git worktree add /private/tmp/zeta-b0611-substrate-0740z otto/b0611-...
# fatal: 'otto/b0611-...' is already used by worktree at '/Users/acehack/Documents/src/repos/Zeta'
```

After Step 0 (switching primary back), the second attempt succeeded:

```bash
git worktree add /private/tmp/zeta-b0611-substrate-0740z otto/b0611-...
# Preparing worktree (checking out 'otto/b0611-...')
# Updating files: 100% (5432/5432), done.
# HEAD is now at bcb2c5b feat(routines): 081KRHWGX0008QG0R001VR9FNA ...
```

The worktree-add succeeded despite Lior-active at 3 procs — the
081KRMEXM0008QG0R000X1PPGC contention-rollback failure mode (`Interrupted system call`)
did NOT occur this attempt. Empirically: worktree-add at this
moment was contention-free.

### Step 2 — Copy 10 substrate files from primary to isolated worktree

Single Bash call with explicit `cp` per file (no glob, no `-r`):

Actual commands run (per Bash transcript) used full literal
filenames — no globs:

```bash
cd /private/tmp/zeta-b0611-substrate-0740z
mkdir -p docs/backlog/P2 docs/hygiene-history/ticks/2026/05/17 memory
PRIMARY=/Users/acehack/Documents/src/repos/Zeta
cp "$PRIMARY/docs/backlog/P2/081KRSKQ20008QG0R0014PPGZM-dangling-memory-refs-cleanup-35-refs-6-surfaces-2026-05-17.md" docs/backlog/P2/
cp "$PRIMARY/memory/feedback_otto_cli_lior_active_step_8_read_only_canary_rule_evidence_collection_brief_ack_pre_empt_2026_05_17.md" memory/
cp "$PRIMARY/memory/feedback_otto_cli_b0611_slice1_audit_recipe_4_of_6_have_footnote_fallback_pattern_intentional_dangling_2026_05_17.md" memory/
cp "$PRIMARY/memory/feedback_otto_cli_b0611_slice2_audit_verbatim_preservation_constraint_editorial_footnote_pattern_2026_05_17.md" memory/
cp "$PRIMARY/memory/feedback_otto_cli_b0611_slice3_audit_docs_research_mixed_verbatim_and_otto_authored_2026_05_17.md" memory/
cp "$PRIMARY/memory/feedback_otto_cli_b0611_slice4_audit_docs_backlog_largest_scope_simplest_pattern_2026_05_17.md" memory/
cp "$PRIMARY/memory/feedback_aaron_alexa_speaker_website_text_mode_surface_deep_strategy_zeta_substrate_terminology_bus_envelope_works_pr_4015_landed_2026_05_17.md" memory/
cp "$PRIMARY/docs/hygiene-history/ticks/2026/05/17/0418Z.md" docs/hygiene-history/ticks/2026/05/17/
cp "$PRIMARY/docs/hygiene-history/ticks/2026/05/17/0602Z.md" docs/hygiene-history/ticks/2026/05/17/
cp "$PRIMARY/docs/hygiene-history/ticks/2026/05/17/0728Z.md" docs/hygiene-history/ticks/2026/05/17/
git status --short | head -15
```

All 10 files showed as untracked in the isolated worktree, exactly
as expected (they were untracked in primary too).

(The literal filenames avoid the shell-glob trap — `*` inside double
quotes is NOT expanded by the shell. The original 081KRSKQ20008QG0R0014PPGZM session
authored these 10 copy commands as-is; abbreviating with `*.md` in
this memo would have produced non-executable copy paste, contradicting
the "explicit cp per file" claim.)

### Step 3 — Regenerate BACKLOG.md

```bash
cd /private/tmp/zeta-b0611-substrate-0740z
BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts
# wrote /private/tmp/zeta-b0611-substrate-0740z/docs/BACKLOG.md
git status --short  # M docs/BACKLOG.md + ?? 10 new files
```

Per Codex's catch on PR #4015 thread #2: closing/adding rows
requires `BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts`
to update the generated index.

### Step 4 — Single-Bash-call add + branch-guard + commit + ls-tree-verify

To minimize the race window, the rule's recommended composite
discipline (`test branch-guard && git commit`) was done in ONE
Bash invocation:

```bash
cd /private/tmp/zeta-b0611-substrate-0740z && \
git add \
  docs/BACKLOG.md \
  docs/backlog/P2/081KRSKQ20008QG0R0014PPGZM-dangling-memory-refs-cleanup-35-refs-6-surfaces-2026-05-17.md \
  docs/hygiene-history/ticks/2026/05/17/0418Z.md \
  docs/hygiene-history/ticks/2026/05/17/0602Z.md \
  docs/hygiene-history/ticks/2026/05/17/0728Z.md \
  memory/feedback_aaron_alexa_speaker_website_text_mode_surface_deep_strategy_zeta_substrate_terminology_bus_envelope_works_pr_4015_landed_2026_05_17.md \
  memory/feedback_otto_cli_b0611_slice1_audit_recipe_4_of_6_have_footnote_fallback_pattern_intentional_dangling_2026_05_17.md \
  memory/feedback_otto_cli_b0611_slice2_audit_verbatim_preservation_constraint_editorial_footnote_pattern_2026_05_17.md \
  memory/feedback_otto_cli_b0611_slice3_audit_docs_research_mixed_verbatim_and_otto_authored_2026_05_17.md \
  memory/feedback_otto_cli_b0611_slice4_audit_docs_backlog_largest_scope_simplest_pattern_2026_05_17.md \
  memory/feedback_otto_cli_lior_active_step_8_read_only_canary_rule_evidence_collection_brief_ack_pre_empt_2026_05_17.md && \
git status --short && \
test "$(git branch --show-current)" = "otto/b0611-audit-prep-substrate-plus-session-memos-2026-05-17" && echo "branch ✓" && \
git commit -m "<full commit message via HEREDOC>" && \
git ls-tree HEAD | wc -l  # canary check
```

(All 11 paths are literal — no globs, no comment-out-the-chain hazard.
The `\` line continuations preserve a single shell command so the `&&`
chain stays intact through all stages.)

Result:
- 11 files added (1 modified BACKLOG.md + 10 new substrate files)
- Branch guard passed (✓)
- Commit landed (10 new files created per git output)
- ls-tree count: **53** — matches origin/main's count earlier
  (no canary corruption — corruption would collapse below ~50)

### Step 5 — Push with explicit branch

```bash
git push -u origin otto/b0611-audit-prep-substrate-plus-session-memos-2026-05-17
# To https://github.com/Lucent-Financial-Group/Zeta.git
#  * [new branch]  otto/b0611-... -> otto/b0611-...
# branch 'otto/b0611-...' set up to track 'origin/otto/b0611-...'
```

Push succeeded. Commit `432d49b` on origin.

### Step 6 — PR creation deferred (pure-git tier)

GraphQL rate-limit at 0/5000, reset in 13 min. Per
[`refresh-world-model-poll-pr-gate.md`](../.claude/rules/refresh-world-model-poll-pr-gate.md)
pure-git tier rule: PR creation deferred to post-reset tick. The
branch is on origin; the commit is durable; the PR can be opened
later via:

```bash
gh pr create --head otto/b0611-audit-prep-substrate-plus-session-memos-2026-05-17 \
             --base main \
             --title "backlog(081KRSKQ20008QG0R0014PPGZM): file dangling-memory-refs cleanup row + 4 slice recipes + session memos + 3 tick shards" \
             --body-file <prepared-body>
```

(The `--head` flag is required per the zeta-expected-branch rule's
companion-defense section — never rely on implicit current-branch
for PR creation under multi-Otto contention.)

## Empirical anchors from this worked example

| Anchor | Value | Significance |
|---|---|---|
| Worktree-add succeeded first try | Lior at 3 procs, peer-claude at 1 | 081KRMEXM0008QG0R000X1PPGC worktree-prune-race didn't fire at this moment |
| ls-tree count post-commit | 53 (matches origin/main) | No canary corruption — commit-tree integrity preserved |
| Branch-guard passed in same Bash call | branch ✓ before commit | Race window minimized to within one Bash subprocess |
| Push succeeded background-task | Exit 0, branch on origin | No ref-contamination at push time |
| Files copied via explicit cp | 10 individual cp commands | No glob risk, no `-r` sweep |

## Substrate-honest framing

The new rule's mandate (isolated worktree for all commits under
peer activity) was followed despite peer-claude being low (1 proc
— just me) at the moment. The rule is conservative; following it
costs ~30 seconds of extra setup (worktree-add + file copies) and
provides zero-cost insurance against the wrong-branch race.

The 10-file copy pattern is bounded but unwieldy at scale. For
larger commit sets, a more efficient approach would be:

1. Author the substrate directly in the isolated worktree (avoid
   copy entirely)
2. OR use `git stash --include-untracked` in primary + `git stash apply`
   in isolated worktree (but this can carry tracked modifications
   you don't want)
3. OR pipe `git status --short` into a script that selectively
   copies only the desired untracked files

For this session, the explicit-cp pattern was acceptable because
the file count was bounded (10) and the file paths were already
enumerated in the 0728Z session-summary shard.

## What this anchor leaves open

- **The new rule's empirical-anchor sub-case 5** (peer-side
  destructive git operation discards unstaged edits) was NOT
  triggered this session — peer-claude was low. Future-Otto
  operating under multi-instance saturation would face higher
  risk; the worked example here is the lower-bound case
- **The worktree-add 081KRMEXM0008QG0R000X1PPGC race** did not fire this attempt;
  the rule notes "try once; if it fails with `Interrupted system
  call`, fall back to borrow-on-existing-sidetick pattern" — this
  fallback was NOT exercised today
- **PR creation under pure-git tier** is the next bounded wait
  (~9-13 min from this memo's authoring); the explicit `--head`
  flag pattern will be used per zeta-expected-branch companion
  defense

## Composes with

- [`.claude/rules/zeta-expected-branch.md`](../.claude/rules/zeta-expected-branch.md)
  — the rule whose race-window-caveat triggered the pivot to
  isolated worktree
- [`.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`](../.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md)
  — the canary rule whose ls-tree-count check verified commit
  integrity post-commit
- [`.claude/rules/claim-acquire-before-worktree-work.md`](../.claude/rules/claim-acquire-before-worktree-work.md)
  — the saturation-ceiling taxonomy + borrow-on-existing pattern;
  not exercised today but available as fallback
- [`.claude/rules/refresh-world-model-poll-pr-gate.md`](../.claude/rules/refresh-world-model-poll-pr-gate.md)
  — pure-git tier discipline; PR creation deferral
- [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md)
  — the counter discipline that motivated pre-emptive-at-#5 substrate
  production
- [`.claude/rules/dont-ask-permission.md`](../.claude/rules/dont-ask-permission.md)
  — within-authority-scope ship; Aaron's "commit the deferred
  substrate" authorization
- Commit `432d49b` on `otto/b0611-audit-prep-substrate-plus-session-memos-2026-05-17`
  — the empirical anchor

## Pre-empt-at-#5 framing

This memo is pre-empt at brief-ack #5 within the autonomous-loop
counter discipline. Counter resets on concrete artifact (memory
file written + 11-file commit landed earlier in the session +
bus envelope `ac6d2aec` published earlier).

The memo is genuinely load-bearing for future-Otto cold-boot:
the isolated-worktree workflow is the new default per the rule
update, and a worked example accelerates pattern adoption. The
counter discipline is operating as designed.
