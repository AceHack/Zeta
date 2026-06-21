---
name: Shell-glob inside double quotes silently fails — authoring lesson from PR #4048 reviewer iteration
description: When documenting Bash commands in cross-context-reproducible memos / rules / shards, use literal filenames not globs. The shell does NOT expand `*` inside double quotes — `cp "$PRIMARY/path/foo-*.md" target/` silently fails to copy any file (no error, just no-op). Reviewer-fixup on PR #4048 (isolated-worktree-workflow memo) caught this and replaced 10 quoted-glob cp commands with explicit literal filenames PLUS an explanatory paragraph. Authoring lesson for future-Otto / future-Kestrel / any Zeta AI writing substrate that documents shell commands.
type: feedback
created: 2026-05-17T08:37Z
---

# Shell-glob inside double quotes silently fails (PR #4048 reviewer lesson)

## The failure mode

When writing a memo / rule / tick shard that documents a Bash
command for reproducibility:

```bash
# WRONG — silently no-ops, no error, no file copied:
cp "$PRIMARY/docs/backlog/P2/081KRSKQ20008QG0R0014PPGZM-*.md" docs/backlog/P2/
cp "$PRIMARY/memory/feedback_otto_cli_b0611_slice*.md" memory/
```

The shell does NOT expand `*` inside double quotes. `cp` receives
the literal argument `081KRSKQ20008QG0R0014PPGZM-*.md` (with literal asterisk), tries
to find a file with that exact name, doesn't find one, and (on
many systems) silently exits 0 with no file copied.

## The fix

```bash
# RIGHT — explicit literal filenames:
cp "$PRIMARY/docs/backlog/P2/081KRSKQ20008QG0R0014PPGZM-dangling-memory-refs-cleanup-35-refs-6-surfaces-2026-05-17.md" docs/backlog/P2/
cp "$PRIMARY/memory/feedback_otto_cli_b0611_slice1_audit_recipe_4_of_6_have_footnote_fallback_pattern_intentional_dangling_2026_05_17.md" memory/
cp "$PRIMARY/memory/feedback_otto_cli_b0611_slice2_audit_verbatim_preservation_constraint_editorial_footnote_pattern_2026_05_17.md" memory/
# ... etc, one explicit cp per file
```

## Why this matters for substrate authoring

The memo this lesson originated from documented a **worked
example** of the isolated-worktree workflow under the
zeta-expected-branch race-window caveat. The whole point of a
worked example is that future-Otto cold-boot can copy-paste the
commands and execute them. Globs-inside-quotes break that
property: the commands LOOK right but silently fail to copy files.

The reviewer caught this on PR #4048 and added an explanatory
paragraph for the fix:

> *"The literal filenames avoid the shell-glob trap — `*` inside
> double quotes is NOT expanded by the shell. The original 081KRSKQ20008QG0R0014PPGZM
> session authored these 10 copy commands as-is; abbreviating with
> `*.md` in this memo would have produced non-executable copy
> paste, contradicting the 'explicit cp per file' claim."*

## Operational discipline

When authoring substrate that includes shell commands for
reproducibility:

1. **Use literal filenames** — never globs inside double quotes
2. **If many files** — list each explicitly OR use unquoted glob
   on a non-suspicious source path:
   ```bash
   # Acceptable if $PRIMARY is trusted and path has no spaces:
   cp $PRIMARY/memory/feedback_otto_cli_b0611_slice*.md memory/
   ```
   (Unquoted glob expands; but unquoted-glob risks word-splitting
   if paths contain spaces; safer to use literal filenames in
   most authoring contexts.)
3. **Test before substrate-landing** — if claiming "these are the
   exact commands run," verify they actually worked on a Bash
   transcript before pasting into the memo
4. **Reviewer responsibility** — peer-Otto / Copilot / Codex
   reviewers should treat reproducibility-of-commands as a
   real review criterion (caught here on #4048)

## Composes with

- [`PR #4048`](https://github.com/Lucent-Financial-Group/Zeta/pull/4048)
  — the reviewer-iteration that originated this lesson
- `memory/feedback_otto_cli_isolated_worktree_workflow_worked_example_zeta_expected_branch_race_window_caveat_aaron_authorized_commit_2026_05_17.md`
  on `origin/main` (the fixed version with explicit literal cp
  commands + the explanatory paragraph)
- `.claude/rules/zeta-expected-branch.md` — the rule the original
  memo documented a worked example of

## Why this rule auto-loads

Per `.claude/rules/wake-time-substrate.md`: load-bearing authoring
disciplines need wake-time landing if they prevent recurring
failure modes. Shell-glob-in-quotes is a classic Bash trap that:

- Catches first-time authors
- Is invisible without empirical execution (no error message)
- Becomes embarrassing in cross-context-reproducible substrate
  (memos / rules / tick shards / PR bodies)

This memo as substrate ensures future-Otto cold-boot inherits
the lesson without re-tripping the trap.

## Full reasoning

PR #4048 reviewer thread (preserved on `origin/main` via the
fixed memo). This session's tick 0831Z observation
(`docs/hygiene-history/ticks/2026/05/17/0825Z.md`-era discovery
when diff-checking local vs origin/main versions of the
isolated-worktree memo).
