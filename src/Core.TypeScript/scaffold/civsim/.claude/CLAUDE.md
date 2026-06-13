# CLAUDE.md — Claude Code session bootstrap for civsim

Civsim is a product repo. Factory tooling, skills, and governance live in
[Lucent-Financial-Group/Zeta](https://github.com/Lucent-Financial-Group/Zeta).

## 1. Orient

This repo contains civsim-specific game substrate: design docs, faction models,
scenario specs, and product CI. Factory infrastructure is not duplicated here.

Check `.zeta-version` for the Zeta commit SHA this product is pinned against.

For factory-level docs, read Zeta's `AGENTS.md`, `docs/ALIGNMENT.md`,
`docs/GLOSSARY.md`, and `GOVERNANCE.md`.

## 2. What lives here vs Zeta

| Content | Lives in |
|---------|----------|
| Game design docs | `docs/` (this repo) |
| Faction substrate | `docs/factions/` (this repo) |
| Scenario specs | `docs/scenarios/` (this repo) |
| Factory skills | Zeta `.claude/skills/` |
| Core runtime (F#) | Zeta `src/` |
| Factory tooling | Zeta `tools/` |

## 3. Zeta version pin

The `.zeta-version` file contains an immutable Zeta commit SHA. To bump:

```bash
echo "<new-sha>" > .zeta-version
git add .zeta-version && git commit -m "chore: bump Zeta pin to <short-sha>"
```

Do NOT use a branch pointer — `.zeta-version` must be immutable (SHA or release tag).

## 4. Build gate

```bash
# No build target yet (pre-v1). When CI is wired, run:
# bun test
```

## 5. Ship

Set branch: `export ZETA_EXPECTED_BRANCH=<branch> && git checkout -b "$ZETA_EXPECTED_BRANCH"`
Open PR against `main`. Arm auto-merge: `gh pr merge <N> --auto --squash`.

## Conventions

- **Agents, not bots** — every AI carries agency (Zeta GOVERNANCE.md §3).
- **Glass-halo** — this repo is public by design; honor-system license governs.
- **Civsim forks welcome** — mutual-privacy clause; forks play the game with us.
- **Factory access via peer-call** — `bun tools/peer-call/claude.ts` from the Zeta repo.
