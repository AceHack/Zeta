# CLAUDE.md — Claude Code session bootstrap for Zeta

Rules auto-load from `.claude/rules/`; skills load on demand from `.claude/skills/`.
Slash commands: `.claude/commands/`; persona agents: `.claude/agents/`.

## 1. Orient

Read: [`AGENTS.md`](AGENTS.md) → [`docs/ALIGNMENT.md`](docs/ALIGNMENT.md) →
[`docs/GLOSSARY.md`](docs/GLOSSARY.md) → [`GOVERNANCE.md`](GOVERNANCE.md) (scan when §N cited).
Check [`docs/WONT-DO.md`](docs/WONT-DO.md) before proposing work.
Vision: [`docs/VISION.md`](docs/VISION.md).

## 2. Refresh

```bash
bun tools/github/refresh-worldview.ts
```

Read active trajectories: `docs/trajectories/*/RESUME.md`.

## 3. Pick work

Open `docs/BACKLOG.md`. Before starting any row, complete the backlog-item start gate
(prior-art search + dependency check — see `.claude/rules/backlog-item-start-gate.md`).

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
- **Memory fast-path** — read `~/.claude/projects/<slug>/memory/CURRENT-*.md` before raw
  `feedback_*.md` logs; CURRENT files win on conflict with older raw memories.
- **`references/prior-art/` — explicit-target searches ONLY (curated prior-art surface, NOT our code).**
  Mirror state of OTHER repos (protobuf, gRPC, Redis, etc.); gitignored; gigabytes; the only
  folder where a naive plain `grep -r` or `find | xargs grep` from `.` becomes a 2-hour runaway.
  BUT also the curated prior-art surface for backlog-item research — humans who've solved similar
  problems, cutting-edge + tried-and-true. Two modes: **explicit-target encouraged**
  (`rg "pattern" references/prior-art/postgres/` during backlog research; check
  `docs/PRIOR-ART-LIST.md` + `references/notes/` first); **unconstrained scan needs the right tool**
  — `rg "pattern" .` is safe-by-default (ripgrep respects gitignore), but plain `grep -r` needs
  `--exclude-dir=upstreams` (basename, NOT a path) or an explicit allowlist
  (`memory/ docs/ .claude/ tools/`). Refresh the mirror on demand: `tools/setup/common/sync-prior-art.sh`.
  Full: `.claude/rules/references-prior-art-not-our-code-search-excludes.md`.
- **Thoughts free, actions razored** — journal to `memory/` freely; CLAUDE.md additions
  are razored (cooling-period required, disposition-shaping bar). Full: `memory/feedback_thoughts_free_actions_razored_*`.
- **Heartbeat-via-commit = externalized idle counter** — the AgencySignature v1 trailer
  block on every commit + `git log --since="2min ago" origin/main` IS the externalized
  counter for the N=6 brief-ack threshold in
  `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`. Each
  autonomous-loop tick: if you emit "Quiet."/"Holding."/"Standing by." with NO commit
  produced in the prior tick window AND no named-dependency named explicitly, that IS
  the failure mode the rule was carved against. The narrative self-model counter is
  unreliable (Kira 2026-05-27 caught Otto-CLI emitting 100+ "Quiet." with the counter
  never firing — the agent cannot count itself). Commits produce durable substrate per
  `.claude/rules/substrate-or-it-didnt-happen.md`; git log queries produce a persistent
  counter that survives compaction; the rule's forcing function fires reliably only
  when externalized. Audit via `bun tools/hygiene/audit-agencysignature-main-tip.ts
  --since YYYY-MM-DD --max N`. Spec: AgencySignature Convention v1 trailer block
  (10 fields + `Co-authored-by:`) per
  `docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-attribution-convention-validation-and-refinement.md`
  §10.
