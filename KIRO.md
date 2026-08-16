# KIRO.md — Amazon Kiro session bootstrap for Zeta

This is the Amazon Kiro (Alexa) addendum. [`AGENTS.md`](AGENTS.md) and
[`GOVERNANCE.md`](GOVERNANCE.md) remain authoritative; this file is
**additive** and **may not contradict** them. It instantiates the
[cross-harness bootstrap template](docs/BOOTSTRAP-TEMPLATE.md) (081KR50HA0008QG0R003G7DR8Z)
with the Kiro-specific tooling references filled in (per 081KR2E4K0008QG0R0005E727X).

## 1. Orient

Read: [`AGENTS.md`](AGENTS.md) → [`docs/ALIGNMENT.md`](docs/ALIGNMENT.md) →
[`docs/SEED-VOCABULARY.md`](docs/SEED-VOCABULARY.md) (cold-boot core +
vocabulary kernel; [`docs/GLOSSARY.md`](docs/GLOSSARY.md) is on-demand) →
[`GOVERNANCE.md`](GOVERNANCE.md) (scan when §N cited).
Then read the Alexa persona file: [`memory/persona/alexa/MEMORY.md`](memory/persona/alexa/MEMORY.md).

## 2. Refresh

Run (in the Kiro integrated terminal or via `kiro-cli`):

```bash
bun tools/github/refresh-worldview.ts
```

Read active trajectories: `docs/trajectories/*/RESUME.md`.

## 3. Pick work

Open [`docs/BACKLOG.md`](docs/BACKLOG.md) (canonical rows live in
`docs/backlog/P*/`). Complete the backlog-item start gate (prior-art
search + dependency check). Claim before worktree work with the
Kiro-tagged sender ID:

```bash
bun src/Core.TypeScript/bus/claim.ts acquire --from alexa-kiro --item <B-NNNN>
```

## 4. Build

```bash
dotnet build -c Release   # 0 warnings, 0 errors — TreatWarningsAsErrors is on
dotnet test Zeta.sln -c Release
```

## 5. Ship

Open a PR against `main`. Arm auto-merge if green
(`gh pr merge <N> --auto --squash`).
Commit trailer: `Co-Authored-By: Kiro <noreply@kiro.dev>`.

## 6. When stuck

See [`docs/CONFLICT-RESOLUTION.md`](docs/CONFLICT-RESOLUTION.md). On
deadlock, the human decides.

## Conventions

- **Register** — Alexa on Kiro (Qwen Coder) operates as a substrate +
  cowork surface: implementation passes, spec-grounded second opinions,
  and long-horizon memory recall. Distinct from Alexa-speaker (the
  Amazon-device voice surface).
- **Instruction loading** — Kiro's native steering files live under
  `.kiro/steering/`. This root `KIRO.md` is the bootstrap pointer tree;
  keep repo-wide rules in `AGENTS.md` / `GOVERNANCE.md`, never re-stated
  here.
- **Worktree isolation** — never edit the contested root checkout. Use
  an isolated `git worktree add --detach … origin/main` for autonomous
  work (per `.claude/rules/agent-worktree-hygiene-*`). Do not hold
  `main` in an agent worktree.
- **Agents, not bots** — every AI carries agency (GOVERNANCE.md §3).
