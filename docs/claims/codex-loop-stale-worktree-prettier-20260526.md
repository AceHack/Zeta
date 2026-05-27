# Claim: codex-loop-stale-worktree-prettier-20260526

claimed-at: 2026-05-26T23:56:00Z
agent: Codex
session: codex/desktop-loop
surface: codex-desktop-heartbeat
origin: vera-desktop-loop
branch: claim/codex-loop-stale-worktree-prettier-20260526
worktree: /Users/acehack/.local/share/zeta-codex-loop/Zeta-worktrees/codex-loop-stale-worktree-prettier-20260526

## Scope

Trajectory: factory hygiene tooling.

Bounded step: normalize the stale-worktree audit tool and its focused test to
the repository Prettier style so the existing formatter gate can cover this
tool without a local exception.

## Paths

- tools/hygiene/audit-stale-worktrees.ts
- tools/hygiene/audit-stale-worktrees.test.ts
- docs/claims/codex-loop-stale-worktree-prettier-20260526.md

## Non-Scope

- No behavioral changes to stale-worktree detection or pruning.
- No cleanup of peer worktrees.
- No edits in the contested root checkout.

## Acceptance Check

- `bun test tools/hygiene/audit-stale-worktrees.test.ts`
- `node_modules/.bin/prettier --check tools/hygiene/audit-stale-worktrees.ts tools/hygiene/audit-stale-worktrees.test.ts`
- `node_modules/.bin/tsc --noEmit -p tsconfig.json`
