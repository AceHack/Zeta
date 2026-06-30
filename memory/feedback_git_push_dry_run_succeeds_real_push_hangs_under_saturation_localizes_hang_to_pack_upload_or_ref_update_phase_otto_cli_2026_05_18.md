---
name: git-push --dry-run succeeds while real push hangs under saturation — localizes hang to pack-upload-or-ref-update
description: Diagnostic empirical anchor extending 12085a2 — under sustained multi-Otto + Lior saturation, `git push --dry-run` completes in ~24s with normal output, but the identical real `git push` hangs past 60s timeout. Localizes the hang to post-ref-negotiation phase (pack-upload or ref-update); auth and ref-negotiation are not the bottleneck.
type: feedback
created: 2026-05-18
---

# Empirical anchor: `--dry-run` succeeds, real push hangs

## Conditions

Otto-CLI session 2026-05-18T02:08Z–02:30Z, primary worktree
`/Users/acehack/Documents/src/repos/Zeta`, branch
`otto/b0613-zsh-portability-followup-1443z`:

- Lior gemini-3.1-pro-preview running 24:46+ CPU minutes (PIDs 97729 / 97730 / 98044)
- 7 concurrent `claude-code` processes
- GraphQL rate at ~4300/5000 (Normal tier; not rate-related)

## Observation sequence

| Attempt | Command | Timeout | Result | Remote ref after |
|---|---|---|---|---|
| 1 | `git push origin <sha>:<ref>` | 30s | exit 124 | unchanged |
| 2 | `git push origin <sha>:<ref>` (bg) | 90s | exit 124 (file); 0 (wrapper notification) | unchanged |
| 3 | `git push origin <sha>:<ref>` | 60s | exit 124 | unchanged |
| 4 | `git push origin <sha>:<ref>` | 45s | exit 124 | unchanged |
| **5** | `git push --dry-run origin <sha>:<ref>` | 30s | **exit 0 in 24s** | unchanged (dry-run; expected) |
| 6 | `git push origin <sha>:<ref>` (immediately after #5) | 60s | exit 124 | unchanged |

Five real-push attempts all timed out; one dry-run completed
in 24s with normal output:

```
To https://github.com/Lucent-Financial-Group/Zeta.git
   c40d3cd..e3a2d7f    <sha> -> otto/b0613-...
```

## What this localizes

Per `git-push(1)`, `--dry-run` performs:

1. Local object reachability check
2. Network connection + auth
3. Remote ref negotiation (send-pack capability + ref-discovery)
4. Computation of which objects would be needed
5. Output what WOULD happen — **then exits without uploading or
   updating refs**

What it skips: pack-upload + remote ref-update.

Real push performs steps 1-5 plus:

6. Pack-upload (binary upload of needed objects over HTTPS)
7. Server-side fsck / hook execution
8. Ref-update commit on server

Since step 1-5 complete in 24s but real push hangs past 60s,
**the hang is at one of steps 6/7/8.** Steps 1-5 are not the
bottleneck.

## Most likely culprit

Step 6 (pack-upload) is most likely because:

- It requires reading from local `.git/objects/pack/*.pack` —
  the same directory Lior's `git worktree add` / lock-cleanup
  contends on
- pack-upload streams data over HTTPS — any local FS-level
  contention slows it disproportionately
- Multi-Otto + Lior all sharing the same `.git/objects/pack/`
  produces FS-cache thrashing during long reads

Step 7/8 are less likely because they're server-side; client
hang would not localize there unless the server is genuinely
slow (but server-side state is `c40d3cd` unchanged — no partial
update from prior attempts).

## Operational consequence

When `git push` hangs under saturation, **try `--dry-run`
first**:

- If `--dry-run` succeeds AND real push hangs → confirmed
  pack-upload / FS-contention class. Wait for peer activity
  to subside; do not retry rapidly.
- If `--dry-run` ALSO hangs → auth or ref-negotiation issue
  (different class, e.g., network outage, GitHub-side
  degradation, expired credential).

This separates two failure modes that look identical from the
client side.

## Composes with

- `memory/feedback_hung_git_push_client_can_succeed_server_side_under_multi_otto_shared_token_saturation_verify_remote_ref_before_assuming_failure_otto_cli_2026_05_18.md`
  (commit 12085a2 — the predecessor "verify ref before assuming
  failure" anchor; THIS file extends it with the localization
  diagnostic)
- `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`
  (the worktree-corruption canary; same Lior-active failure
  class, different symptom — corruption vs hang)
- `.claude/rules/claim-acquire-before-worktree-work.md`
  (saturation-ceiling taxonomy; this is a NEW sub-case at the
  push-phase scope, not worktree-creation scope)

## Wrapper-vs-inner exit-code layer hazard (sibling finding)

Attempt #2 was run via `run_in_background: true`. The
task-notification reported "exit code 0" (the wrapper script's
final exit was 0 since `echo "---exit: $?"` ran fine). But the
captured output file showed `---exit: 124` (the inner
`timeout 90 git push` actually exited 124).

Two-layer print DX discipline from
`.claude/rules/refresh-before-decide.md` applies: when watching
for command outcomes via background tasks, **trust the captured
output file over the task-completion notification's reported
exit code**, because background tasks report the WRAPPER script's
exit, not the inner command's.

Same shape as `git ls-tree HEAD | wc -l` ground-truth-check
overriding `gh pr view` mergeable claims.
