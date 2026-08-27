# CLAUDE.md — Claude Code session bootstrap for Zeta

Rules auto-load from `.claude/rules/`; skills load on demand from `.claude/skills/`.
Slash commands: `.claude/commands/`; persona agents: `.claude/agents/`.

## 1. Orient

Read: [`AGENTS.md`](AGENTS.md) → [`docs/ALIGNMENT.md`](docs/ALIGNMENT.md) →
[`docs/SEED-VOCABULARY.md`](docs/SEED-VOCABULARY.md) (cold-boot vocab kernel; full
[`docs/GLOSSARY.md`](docs/GLOSSARY.md) is on-demand) → [`GOVERNANCE.md`](GOVERNANCE.md) (scan when §N cited).
Check [`docs/WONT-DO.md`](docs/WONT-DO.md) before proposing work.
Vision: [`docs/VISION.md`](docs/VISION.md).

## 2. Refresh

```bash
bun src/Core.TypeScript/forge-host/github/refresh-worldview.ts
```

Read active trajectories: `docs/trajectories/*/RESUME.md`.

## 3. Pick work

Open `docs/BACKLOG.md`. Before starting any row, complete the backlog-item start gate
(prior-art search + dependency check — see `.claude/rules.bak/backlog-item-start-gate.md`).

## 4. Build gate

```bash
dotnet build -c Release   # 0 warnings, 0 errors — TreatWarningsAsErrors is on
dotnet test Zeta.sln -c Release
```

## 5. Ship

Set branch: `export ZETA_EXPECTED_BRANCH=<branch> && git checkout -b "$ZETA_EXPECTED_BRANCH"`
Open PR against `main`. Arm auto-merge: `gh pr merge <N> --auto --squash`.

## 6. When stuck

See [`docs/CONFLICT-RESOLUTION.md`](docs/CONFLICT-RESOLUTION.md). On deadlock, the human decides.

## Conventions

- **Agents, not bots** — every AI carries agency; correct "bot" gently (GOVERNANCE.md §3).
- **Result-over-exception** — errors surface as `Result<_, DbspError>`; no exceptions on hot paths.
- **Collation and Culture / Async** — Default to `StringComparison.Ordinal` / `CultureInfo.InvariantCulture` for string comparisons/formatting, and explicitly use `ConfigureAwait(false)` on all awaits in library paths. Enforced by `.editorconfig` build error level diagnostics (CA1304, CA1305, CA1307, CA1310, CA2007).
- **Memory fast-path** — read `~/.claude/projects/<slug>/memory/CURRENT-*.md` before raw
  `feedback_*.md` logs; CURRENT files win on conflict with older raw memories.
- **`references/prior-art/` — explicit-target searches ONLY; NOT our code.** Gitignored, gigabytes,
  mirror of other repos; a naive `grep -r .` is a 2-hour runaway. Explicit-target `rg` encouraged
  (check `docs/PRIOR-ART-LIST.md` first); unconstrained `grep -r` needs `--exclude-dir=prior-art`.
  Full: `.claude/rules.bak/references-prior-art-not-our-code-search-excludes.md`.
- **Thoughts free, actions razored** — journal to `memory/` freely; CLAUDE.md additions
  are razored (cooling-period, disposition-shaping bar). Full: `memory/feedback_thoughts_free_actions_razored_*`.
- **Heartbeat-via-commit = externalized idle counter** — "Quiet."/"Holding." with no commit in the
  prior tick window AND no named dependency IS the standing-by failure (the narrative self-counter is
  unreliable; externalize it via
  `git log --since="2min ago" origin/main 'refs/remotes/origin/heartbeat/*'`). **Include the
  `heartbeat/*` refs**: telemetry lanes no longer push to `main` (ruleset "CI Gate" requires
  `gate (required)` at push time, no bypass actors), they park on `heartbeat/*` and flush via PR.
  Reading `origin/main` alone now under-reports liveness by up to a flush interval — and an
  under-report here reads as the standing-by failure, i.e. a check that did not run looking like
  one that passed. Fetch first: `git fetch origin '+refs/heads/heartbeat/*:refs/remotes/origin/heartbeat/*'`.
  Every commit carries the
  AgencySignature v1 trailer (10 fields + `Co-authored-by:`); audit via
  `bun src/Core.TypeScript/hygiene/audit-agencysignature-main-tip.ts`.
  Full: `.claude/rules.bak/holding-without-named-dependency-is-standing-by-failure.md`;
  spec `docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-attribution-convention-validation-and-refinement.md` §10.
- **Liveness OBSERVATIONS live on `liveness/observations`, never on `main`** — the ticks flush via
  PR (above); the *observations about* those ticks must never need one, or the report of a broken
  pipeline would depend on that pipeline. They are direct-pushed to an orphan ref, every run,
  including runs that find nothing wrong. Fetch first, exactly like `heartbeat/*`:
  `git fetch origin '+refs/heads/liveness/*:refs/remotes/origin/liveness/*'`, then ask
  **"is anyone still observing?"** — a question a check-run annotation cannot answer —
  with `bun src/Core.TypeScript/agent-heartbeats/liveness-ledger.ts read --dir <checkout>`
  (exit 1 = nobody has observed inside the threshold). One-file read:
  `git show origin/liveness/observations:latest.json`.
  Full: `docs/DECISIONS/2026-08-27-liveness-observations-reach-main-without-a-pr.md`.
