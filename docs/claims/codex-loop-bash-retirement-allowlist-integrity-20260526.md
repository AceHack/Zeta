# Claim: codex-loop-bash-retirement-allowlist-integrity-20260526

claimed-at: 2026-05-26T23:34:00Z
agent: Codex
session: codex/launchd-loop
surface: codex-background-service
origin: codex-launchd-loop
run-id: 20260526T232949Z
branch: claim/codex-loop-bash-retirement-allowlist-integrity-20260526
worktree: /Users/acehack/.local/share/zeta-codex-loop/Zeta-worktrees/codex-loop-bash-retirement-allowlist-integrity-20260526

## Scope

Trajectory: TypeScript / Bun migration.

Bounded step: harden the bash-retirement inventory guard so the retained shell
allowlist is itself checked for duplicate or unsorted entries before it is used
to classify repo `.sh` drift.

## Paths

- tools/hygiene/check-bash-retirement-inventory.ts
- tools/hygiene/check-bash-retirement-inventory.test.ts
- docs/claims/codex-loop-bash-retirement-allowlist-integrity-20260526.md

## Non-Scope

- No shell-script porting or deletion.
- No changes to the retained shell allowlist membership.
- No edits in the contested root checkout.

## Acceptance Check

- `bun test tools/hygiene/check-bash-retirement-inventory.test.ts`
- `bun run hygiene:check-bash-retirement-inventory`
- `node_modules/.bin/tsc --noEmit -p tsconfig.json`
