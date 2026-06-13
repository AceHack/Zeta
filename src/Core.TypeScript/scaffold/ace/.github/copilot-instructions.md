# GitHub Copilot instructions for ace

ace is the package manager for the Lucent Financial Group software stack.

## Key conventions

- TypeScript / Bun for all tooling (Rule 0 — no `.sh` outside `tools/setup/`)
- Errors as `Result<_, Error>` values — no exceptions on hot paths
- Every AI-authored commit includes a `Co-Authored-By` trailer
- `bun test && bun run lint` must pass before any PR merges

## What this repo is NOT

ace is not Forge (the software factory) and not Zeta (the database).
Questions about factory tooling → Forge repo.
Questions about the database → Zeta repo.

## Pre-v1 caution

ace has no implementation yet. Copilot suggestions for unimplemented
features should be treated as design proposals, not production code.
