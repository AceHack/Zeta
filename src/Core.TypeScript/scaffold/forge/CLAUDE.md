# CLAUDE.md — Claude Code session bootstrap for Forge

Rules auto-load from `.claude/rules/`; skills load on demand from `.claude/skills/`.
Slash commands: `.claude/commands/`; persona agents: `.claude/agents/`.

## 1. Orient

Read: [`AGENTS.md`](AGENTS.md) → [`docs/ALIGNMENT.md`](docs/ALIGNMENT.md) →
[`docs/GLOSSARY.md`](docs/GLOSSARY.md) → [`GOVERNANCE.md`](GOVERNANCE.md).
Check [`docs/WONT-DO.md`](docs/WONT-DO.md) before proposing work.

> **Day-one note**: `docs/ALIGNMENT.md`, `docs/GLOSSARY.md`, and
> `docs/WONT-DO.md` are populated during Stage 2 migration from Zeta.
> Until then, read the equivalents in
> [Lucent-Financial-Group/Zeta](https://github.com/Lucent-Financial-Group/Zeta).

## 2. Refresh

```bash
bun tools/github/refresh-worldview.ts
```

Read active trajectories: `docs/trajectories/*/RESUME.md`.

## 3. Pick work

Open `docs/BACKLOG.md`. Before starting any row, complete the backlog-item
start gate (prior-art search + dependency check —
see `.claude/rules/backlog-item-start-gate.md`).

## 4. Build gate

```bash
bun test        # 0 failures
bun run lint    # 0 warnings
```

## 5. Ship

Set branch: `export ZETA_EXPECTED_BRANCH=<branch> && git checkout -b "$ZETA_EXPECTED_BRANCH"`
Open PR against `main`. Arm auto-merge: `gh pr merge <N> --auto --squash`.

## Conventions

- **Agents, not bots** — every AI carries agency; correct "bot" gently.
- **Result-over-exception** — errors surface as values; no exceptions on hot paths.
- **Rule 0 — TS over bash** — everything `.ts` via `bun`; `.sh` only in `tools/setup/`.
- **Memory fast-path** — read `~/.claude/projects/<slug>/memory/CURRENT-*.md` first.
