# `.claude/hooks/` -- harness pre-tool-use hooks

Claude Code reads project-level hooks from `.claude/settings.json`. Hook scripts live here. Wiring a hook into the harness requires editing `.claude/settings.json`; the script existing on disk does NOT make it active by itself (opt-in is explicit).

Canonical Anthropic reference: <https://code.claude.com/docs/en/hooks>.

## Tests live in `src/Core.TypeScript/claude-hooks/`, NOT here

Do not add a `*.test.ts` to this directory: nothing would run it. **Measured, bun 1.3.14** — a
test file under a dot-prefixed directory is not discovered by a bare `bun test`, and no
positional filter reaches it either (bun answers *"the following filters did not match any test
files"*); only an explicit `./`-prefixed path argument does. `tsc` is blind to it for the same
reason — TypeScript's wildcard `include` skips dot-prefixed segments, so nothing here is
type-checked either.

Two test files sat here from 2026-06-21 and executed nowhere in that whole time, while their
names promised a check ran (081KZZ1RK6A087G0R003C773WC). They now live at
`src/Core.TypeScript/claude-hooks/` and import back across the boundary. Adjacency is a
convenience; execution is the point.

`src/Core.TypeScript/hygiene/unexecuted-test-files.ts` fails the build on any tracked
`*.test.ts` under a dot-prefixed path, so a new one here is caught rather than counted.

## Shared harness module — `harness.ts`

All Otto-discipline hook scripts (`*-hook.ts`) import from `harness.ts` for common types and utilities:

| Export | Purpose |
|--------|---------|
| `HookInput` | Typed stdin payload (tool name + input fields) |
| `HookDecision` | Typed deny-decision JSON output |
| `readHookInput()` | Parses stdin; returns `{}` on failure (safe default) |
| `deny(event, reason)` | Emits deny JSON to stdout, exits 0 |
| `allow()` | Exits 0 with no output (the default allow path) |

Hook contract summary: exit 0 always (non-zero = hook error, not deny). Deny is signalled via JSON stdout. Allow is silence + exit 0.

## Otto-discipline hooks (081KQ3HBZ0008QG0R0008RYCSX series)

These hooks convert recurring failure-mode disciplines from language-layer substrate into harness-layer mechanism (Otto-341). Each is a separate script; each adds one entry to `settings.json` when wired.

| Script | Matcher | Status | Backlog row |
|--------|---------|--------|-------------|
| `pre-edit-recent-read.ts` | `Edit` | planned | 081KR50HA0008QG0R0005ABWPH |
| `pre-bash-inline-python.ts` | `Bash` | planned | 081KQ3HBZ0008QG0R0008RYCSX.3 |
| `pre-commit-directive-vocab.ts` | `Bash` | planned | 081KQ3HBZ0008QG0R0008RYCSX.4 |
| `pre-commit-dst-exempt.ts` | `Bash` | planned | 081KQ3HBZ0008QG0R0008RYCSX.5 |
| `pre-commit-magic-number.ts` | `Bash` | planned | 081KQ3HBZ0008QG0R0008RYCSX.6 |
| `pre-action-bulk-resolve.ts` | `mcp__*` | planned | 081KQ3HBZ0008QG0R0008RYCSX.7 |
| `pre-commit-heartbeat-repeat.ts` | `Bash` | planned | 081KQ3HBZ0008QG0R0008RYCSX.8 |
| `pre-commit-table-cellcount.ts` | `Bash` | planned | 081KQ3HBZ0008QG0R0008RYCSX.9 |
| `session-start-cron-verify.ts` | `SessionStart` | **wired** | catch 43 mitigation |
| `stop-detect-response-rut.ts` | `Stop` | **wired** | repeated-token-rut guard (response layer) |

Settings wiring pattern for a discipline hook (PreToolUse, Edit matcher):

```json
{
  "matcher": "Edit",
  "hooks": [
    {
      "type": "command",
      "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/pre-edit-recent-read.ts"
    }
  ]
}
```

## Available hooks

### `verify-branch-pretooluse.ts`

Wraps `tools/orchestrator-checks/verify-branch.ts` (PR #1585) into the Claude Code PreToolUse JSON contract. Mechanizes the orchestrator branch-verify rule (per 081KQR4HQ0008QG0R002YNV361) -- when `ZETA_EXPECTED_BRANCH` is set in the session env and `git branch --show-current` doesn't match, the hook blocks the `git commit` Bash invocation with `permissionDecision: "deny"` and the script's stderr as the reason.

If `ZETA_EXPECTED_BRANCH` is unset, the hook is a no-op (exits 0, allow). The default-off behavior means wiring this hook does not change any commit flow unless an agent (or maintainer) explicitly sets the env var for a task.

#### Configuration

The hook is wired in `.claude/settings.json` under `hooks.PreToolUse` with `"matcher": "Bash"`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/verify-branch-pretooluse.ts"
          }
        ]
      }
    ]
  }
}
```

The `matcher` fires on all Bash tool calls, but the script itself reads stdin JSON and filters to `git commit` commands only. When `ZETA_EXPECTED_BRANCH` is unset, the script exits 0 before reading stdin -- zero overhead.

#### How to use after wiring

1. Before starting a task on a specific branch, set the env var:
   ```bash
   export ZETA_EXPECTED_BRANCH=feature/my-task-2026-05-05
   git checkout -b "$ZETA_EXPECTED_BRANCH"
   ```
2. Subsequent `git commit` invocations verify the branch matches before proceeding.
3. If the branch silently shifts (e.g. the orchestrator-CWD-bleed-over hazard documented in `memory/feedback_parallel_subagent_concurrency_lessons_cluster_aaron_2026_05_04.md`), the next commit attempt is blocked with a clear error rather than landing on the wrong branch.
4. To unset for a session that needs to operate on multiple branches, just `unset ZETA_EXPECTED_BRANCH`.

#### Composes with

- `tools/orchestrator-checks/verify-branch.ts` (PR #1585) -- the underlying check.
- `memory/feedback_orchestrator_pre_commit_verify_branch_rule_aaron_2026_05_04.md` (PR #1568) -- the manual discipline this mechanizes.
- `memory/feedback_dst_justifies_ts_quality_over_bash_and_harness_hooks_suffice_no_git_hooks_aaron_2026_05_03.md` -- the harness-hooks-suffice rule.
- `docs/backlog/P1/081KQR4HQ0008QG0R002YNV361-orchestrator-branch-verify-mechanization-design-aaron-2026-05-04.md` (PR #1571) -- the design.
