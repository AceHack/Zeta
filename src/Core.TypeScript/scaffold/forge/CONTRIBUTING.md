# Contributing to Forge

Forge is an AI-directed software factory. Most contributions are
agent-authored. Human contributors are welcome; read this file before
opening a PR.

## Quick-start

```bash
git clone https://github.com/Lucent-Financial-Group/Forge
cd Forge
bun install
bun test
```

All tests must pass before submitting a PR.

## What to work on

Open `docs/BACKLOG.md`. Before starting any row, complete the
backlog-item start gate (prior-art search + dependency check —
see `.claude/rules/backlog-item-start-gate.md`).

## Before you submit

1. `bun test` — zero failures
2. `bun run lint` — zero warnings
3. PR description answers: what changed + why

## Commit style

One logical change per commit. `Co-Authored-By` trailer required for
AI-authored commits (see `GOVERNANCE.md §6`).

## Code style

- TypeScript / Bun for all factory tooling (Rule 0)
- No `.sh` files outside `tools/setup/`
- Retraction-native: every action has a bounded undo path
- Result-over-exception: errors as values, not exceptions

## Security

Report vulnerabilities via GitHub's private vulnerability reporting —
see `SECURITY.md`. Do not open public issues for security findings.

## License

By contributing you agree that your contributions are licensed under
the Apache 2.0 license.
