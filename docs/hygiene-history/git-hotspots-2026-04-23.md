# Git hotspots report

- **Window:** last 30 days
- **Generated:** 2026-04-23T23:03:31Z
- **Top:** 25 files by touch count
- **Excluded prefixes:** docs/hygiene-history/ openspec/changes/ references/upstreams/

## Ranking

| file | touches | unique authors | PR count |
|---|---:|---:|---:|
| docs/BACKLOG.md | 34 | 1 | 26 |
| docs/ROUND-HISTORY.md | 18 | 1 | 12 |
| docs/VISION.md | 14 | 1 | 3 |
| docs/CURRENT-ROUND.md | 13 | 1 | 5 |
| docs/WINS.md | 11 | 1 | 7 |
| memory/MEMORY.md | 10 | 1 | 10 |
| docs/DEBT.md | 10 | 1 | 6 |
| .github/workflows/gate.yml | 9 | 2 | 6 |
| docs/security/THREAT-MODEL.md | 8 | 1 | 5 |
| .gitignore | 8 | 1 | 6 |
| .claude/skills/round-management/SKILL.md | 8 | 1 | 5 |
| GOVERNANCE.md | 7 | 1 | 5 |
| docs/WONT-DO.md | 7 | 1 | 5 |
| docs/TECH-RADAR.md | 7 | 1 | 5 |
| docs/GLOSSARY.md | 7 | 1 | 5 |
| docs/FACTORY-HYGIENE.md | 7 | 1 | 10 |
| AGENTS.md | 7 | 1 | 6 |
| .claude/skills/security-researcher/SKILL.md | 7 | 1 | 4 |
| memory/persona/best-practices-scratch.md | 6 | 1 | 6 |
| docs/research/proof-tool-coverage.md | 6 | 1 | 4 |
| .claude/skills/skill-improver/SKILL.md | 6 | 1 | 3 |
| .claude/skills/skill-creator/SKILL.md | 6 | 1 | 4 |
| .claude/skills/prompt-protector/SKILL.md | 6 | 1 | 4 |
| .claude/skills/backlog-scrum-master/SKILL.md | 6 | 1 | 4 |
| .claude/skills/algebra-owner/SKILL.md | 6 | 1 | 4 |

## Suggested actions

Detection-first. The action below is a prompt for human
or Architect judgment, not an enforcement.

- **split** — file has become a shared bottleneck; consider
  per-swim-lane / per-subsystem decomposition
- **freeze** — historical content is append-only; freeze
  older rows to an archive and keep recent rows hot
- **audit** — hotness may reflect real work; investigate
  whether churn is healthy or pathological
- **watch** — hot but not yet a problem; leave for next
  audit cadence

## What this report is NOT

- Not an enforcement. The audit exits 0 regardless of
  findings.
- Not a blame tool. Author counts are descriptive of
  collaboration shape, not performance.
- Not a complete merge-conflict predictor. Two PRs can
  conflict on a rarely-touched file; conversely, a
  very hot file with careful coordination (append-only
  rows) may see zero conflicts.

## Otto observations (first-run baseline — 2026-04-23)

This is the first run of the hotspot audit. The ranking
validates the human maintainer's Otto-54 intuition that
`docs/BACKLOG.md` is the factory's top friction surface
(34 touches / 26 PRs in a 30-day window — effectively one
BACKLOG touch per PR opened).

### Per-file suggested action

| file | action | rationale |
|---|---|---|
| `docs/BACKLOG.md` | **split** | Matches the Otto-54 BACKLOG-per-swim-lane row. 26 PRs in 30 days touching one file is the paradigmatic serialization bottleneck. |
| `docs/ROUND-HISTORY.md` | **freeze-then-watch** | Historical narrative by design; candidate for "freeze older rounds to archive" pattern per GOVERNANCE.md §2. |
| `docs/VISION.md` | **audit** | 14 touches but only 3 PRs — high commit-density per PR is unusual; likely legitimate iteration during pre-v1 scope shaping, not pathological. |
| `docs/CURRENT-ROUND.md` | **watch** | Per-round update is normal; current touches match cadence. |
| `docs/WINS.md` | **watch** | Append-only; touches track round cadence. |
| `memory/MEMORY.md` | **cadence** | Matches the Otto-54 CURRENT-maintainer-freshness row. 10 touches / 10 PRs = one index update per absorb. Directly addressed by the freshness audit row already backlogged. |
| `docs/DEBT.md` | **watch** | Per-round update; normal cadence. |
| `.github/workflows/gate.yml` | **audit** | 2 unique authors suggests this is where CI changes get proposed by contributors beyond Otto — the only entry with >1 author. Healthy signal, not a split candidate. |
| `docs/security/THREAT-MODEL.md` | **watch** | Security scaffolding is still maturing. |
| `.gitignore` | **watch** | Routine updates as tools + artifacts accumulate. |
| `.claude/skills/round-management/SKILL.md` | **audit** | High touch for a skill file; candidate for skill-tune-up review. |
| `GOVERNANCE.md` | **watch** | Governance rule additions; append-with-context is correct. |
| `docs/WONT-DO.md` | **watch** | Declined-features log grows monotonically; expected. |
| `docs/TECH-RADAR.md` | **watch** | Quarterly radar; touches track band graduations. |
| `docs/GLOSSARY.md` | **watch** | Vocabulary expansion with each new research arc. |
| `docs/FACTORY-HYGIENE.md` | **watch** | Meta-hygiene file; self-reference is OK. This very audit adds one row. |
| `AGENTS.md` | **watch** | Universal onboarding handbook; occasional updates. |
| `.claude/skills/security-researcher/SKILL.md` | **audit** | High touch for a single skill; candidate for skill-tune-up. |
| `memory/persona/best-practices-scratch.md` | **watch** | Scratchpad by design. |
| `.claude/skills/backlog-scrum-master/SKILL.md` | **audit** | Skill touches suggest tune-up cycle underway. |
| `.claude/skills/algebra-owner/SKILL.md` | **audit** | Same as above. |

### Synthesis

- **1 split candidate** (`BACKLOG.md`) — the Otto-54 row exists; this run confirms the row is load-bearing.
- **1 freeze-then-watch candidate** (`ROUND-HISTORY.md`) — existing append-only discipline is doing its job; no immediate action.
- **1 cadence candidate** (`memory/MEMORY.md`) — the Otto-54 CURRENT-freshness row is the right remediation.
- **5 audit candidates** (VISION, gate.yml, 4 skill files) — surface these to Kenji / Aarav for skill-tune-up review.
- **11 watch candidates** — normal churn; next audit cadence decides.

### What the first run reveals about "git-native frictionless"

The ranking shows the factory has exactly **one file** causing
most of its routine merge friction (`BACKLOG.md` with 26 PRs in
30 days). Splitting that file addresses the bulk of the problem
Aaron named. The rest of the top-20 is either append-only-by-
design (WINS, ROUND-HISTORY, DEBT), well-structured-update
surfaces (governance, glossary, threat model), or skill files
in active tune-up. **Shipping the BACKLOG split is the highest-
leverage move available under Aaron's Otto-54 directive.**
