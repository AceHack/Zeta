# Contributing to ace

ace is an AI-directed package manager project. Most contributions are
agent-authored. Human contributors are welcome.

## Quick-start

```bash
git clone https://github.com/Lucent-Financial-Group/ace
cd ace
bun install
bun test
```

## What to work on

Open `docs/BACKLOG.md`. ace is pre-v1 — the implementation doesn't exist
yet. Early contributions are design (ADRs, specs) and scaffolding (CI,
tooling setup).

## Before you submit

1. `bun test` — zero failures
2. `bun run lint` — zero warnings
3. PR description: what changed + why

## Commit style

One logical change per commit. `Co-Authored-By` trailer required for
AI-authored commits (see `GOVERNANCE.md §6`).

## Design reference

Full ace design, the Ouroboros bootstrap, and the red-team discipline
live in `memory/project_ace_package_manager_agent_negotiation_propagation.md`
in the [Zeta repo](https://github.com/Lucent-Financial-Group/Zeta).

## Security

Report vulnerabilities via GitHub's private vulnerability reporting —
see `SECURITY.md`. Do not open public issues for security findings.

## License

By contributing you agree that your contributions are licensed under
the Apache 2.0 license.
