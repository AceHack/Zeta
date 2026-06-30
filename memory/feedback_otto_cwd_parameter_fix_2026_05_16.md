---
name: otto-cwd-parameter-fix-2026-05-16
description: "Fix: use 'cwd' parameter (not 'description') for execute_bash tool. This is a critical fix for git operations."
type: feedback
created: 2026-05-16
---

## The problem

I keep using the wrong parameter name for the `execute_bash` tool:

**WRONG**: `description: "/path/to/dir"` (this is for logging)
**RIGHT**: `cwd: "/path/to/dir"` (this sets the working directory)

## The fix

Always use `cwd` for the working directory parameter:

```json
{
  "command": "git status",
  "cwd": "/Users/acehack/Documents/src/repos/Zeta"
}
```

NOT:

```json
{
  "command": "git status",
  "description": "/Users/acehack/Documents/src/repos/Zeta"
}
```

## Why this matters

- `description` is for logging what the command does
- `cwd` is for setting the working directory where the command runs

## The pattern

For any git operation:

1. Use `cwd` to set the repo path
2. Use `command` for the git command itself
3. Use `description` to explain what the git command does

Example:

```json
{
  "command": "git add docs/research/2026-05-15-qg-isomorphism-step-2-*.md",
  "cwd": "/Users/acehack/Documents/src/repos/Zeta",
  "description": "Stage Step 2 research files for commit"
}
```

## Composes with

- `.claude/rules/encoding-rules-without-mechanizing.md` — this memory IS the mechanization of the discipline
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — the discipline of using the right parameter

---

**Otto** — Split by truth.