# CLAUDE.md — Claude Code session bootstrap for ace

Rules auto-load from `.claude/rules/`; skills load on demand from `.claude/skills/`.

## 1. Orient

Read: [`AGENTS.md`](AGENTS.md) → [`GOVERNANCE.md`](GOVERNANCE.md).
Check [`docs/WONT-DO.md`](docs/WONT-DO.md) before proposing work.

## 2. Refresh

```bash
bun tools/github/refresh-worldview.ts
```

## 3. Pick work

Open `docs/BACKLOG.md`. Complete the backlog-item start gate before
starting any row (prior-art search + dependency check).

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
- **Rule 0 — TS over bash** — `.ts` via `bun`; `.sh` only in `tools/setup/`.
- **Substrate or it didn't happen** — committed git history is substrate.
