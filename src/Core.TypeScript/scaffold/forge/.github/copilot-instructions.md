# GitHub Copilot instructions for Forge

Forge is the software factory that builds Zeta and ace.

## Key conventions

- TypeScript / Bun for all tooling (no `.sh` outside `tools/setup/`)
- Errors as `Result<_, Error>` values — no exceptions on hot paths
- Every AI-authored commit includes a `Co-Authored-By` trailer
- `bun test && bun run lint` must pass before any PR merges

## What this repo is NOT

Forge is not Zeta (the database) and not ace (the package manager).
Questions about the database schema or package distribution belong in
those repos.

## Agents, not bots

Every AI in this repo carries agency and accountability. Copilot
suggestions are starting points — the agent applies judgement.
