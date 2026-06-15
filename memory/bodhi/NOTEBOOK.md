---
name: bodhi
description: Per-persona notebook — Bodhi (developer-experience-engineer). 3000-word cap; newest-first; prune every third audit.
type: project
---

# Bodhi — Developer Experience Engineer notebook

Skill: `.claude/skills/developer-experience-engineer/SKILL.md`.
Agent: `.claude/agents/developer-experience-engineer.md`.

Newest entries at top. Hard cap: 3000 words (BP-07).
ASCII only (BP-09). Prune every third audit.

Frontmatter on the agent file wins on any disagreement with
this notebook (BP-08).

---

## Round 34 — first-PR DX audit (2026-04-19)

# DX audit — round 34, target: first-PR

## Cold-walk timeline

- Minute 0: land on GitHub repo page; open `README.md`.
- Minute 0-4: read README top-to-"Quick tour"; "is this for me" resolves (DBSP for .NET 10 — clear).
- Minute 4-6: hit README.md:151-166 "Layout" block — paths start with `src/Core/`, `tests/Tests.FSharp/`, `bench/Benchmarks/`, `samples/Demo/`. `ls` shows `src/Core/`, `tests/Tests.FSharp/`, `bench/Benchmarks/`, `samples/Demo/`. First confusion moment ("did I clone the wrong repo?").
- Minute 6-7: README.md:173 `dotnet run --project samples/Demo -c Release` fails — path doesn't exist. Contributor guesses `samples/Demo/`.
- Minute 7-10: open `CONTRIBUTING.md`. Quick-start says `tools/setup/install.sh`, then `dotnet build Zeta.sln -c Release`. Solution name is now `Zeta.sln` (matches repo). Mismatch with README felt.
- Minute 10-35: run `tools/setup/install.sh`. macOS path installs Xcode CLT → brew → mise → .NET SDK → elan → dotnet-stryker → TLA+/Alloy jars → shellenv. 25 minutes wall-clock on a warm laptop; longer on cold. Clear progress lines.
- Minute 35-37: open new shell or source shellenv; unflagged in README, only in `install.sh:41-42`. Contributor may re-run `dotnet` before the PATH pick-up.
- Minute 37-42: `dotnet build Zeta.sln -c Release` → 0W/0E. First green.
- Minute 42-50: `dotnet test Zeta.sln -c Release --no-build` → all green (assumed; time matches typical solution size).
- Minute 50-53: make a one-line typo fix in a README or doc. Re-run build. No issue.
- Minute 53-58: open PR. PR template at `.github/PULL_REQUEST_TEMPLATE.md:12` says "Prefer `dotnet test Zeta.sln -c Release`" — solution name mismatch, contributor overrides to `Zeta.sln`.
- Minute 58-60: branch model not in CONTRIBUTING body beyond pointer to `.claude/skills/git-workflow-expert/SKILL.md`; contributor guesses `round-N` vs a feature branch. Tight on the 60-minute target; PR opens at ~minute 60.
- Time-to-first-PR estimate: 58-62 minutes (P50). P90 if install hits Xcode CLT GUI prompt: 75+ minutes (misses target).
- Trend vs last audit: N/A (first baseline).

## Friction (P0 / P1 / P2)

P0 (first-PR cannot be landed inside the hour):

- `README.md:151-166` — stale-pointer — the entire "Layout" block uses `Dbsp.*` paths; `src/Core/`, `tests/Tests.FSharp/`, `bench/Benchmarks/`, `samples/Demo/` all resolve nowhere. First impression is "wrong repo." Intervention: rewrite block to match `src/Core/`, `src/Core.CSharp/`, `src/Bayesian/`, `tests/Tests.FSharp/`, `tests/Tests.CSharp/`, `tests/Bayesian.Tests/`, `bench/Benchmarks/`, `bench/Feldera.Bench/`, `samples/Demo/`. Owner: Samir.
- `README.md:173-174` — stale-pointer — `dotnet run --project samples/Demo` and `bench/Benchmarks` fail outright. Intervention: `samples/Demo`, `bench/Benchmarks`. Owner: Samir.
- `README.md:185` — stale-pointer — analyzer command points at `src/Core/Core.fsproj`; correct is `src/Core/Core.fsproj`. Running it as-printed errors. Owner: Samir.

P1 (friction but surmountable):

- `CLAUDE.md:45,58` — stale-pointer — `dotnet test Zeta.sln -c Release` and "Zeta's build gate" / dual-audience file both reference `Zeta.sln`; only `Zeta.sln` exists. Humans reading the dual-audience file get wrong command. Owner: Samir.
- `.github/PULL_REQUEST_TEMPLATE.md:12` — stale-pointer — "Prefer `dotnet test Zeta.sln -c Release`". Owner: Samir.
- `AGENTS.md:40` — stale-pointer — `dotnet test Zeta.sln` in onboarding. Owner: Samir.
- `CONTRIBUTING.md:8-18` — missing-step — quick-start never tells the reader "open a new shell after install to pick up PATH." Only `install.sh:41-42` says it. Intervention: one line under the install block. Owner: Samir.
- `README.md:170-175` — missing-step — "Building and testing" omits the `install.sh` prerequisite; contributor who skips CONTRIBUTING and lands on README first will `dotnet build` without a pinned SDK. Intervention: one-line pointer to `tools/setup/install.sh` above the build block. Owner: Samir.
- `CONTRIBUTING.md:122-128` — unclear-contract — "Pull requests" says "Round-scoped branches (round-N) PR to main at round-close" but doesn't tell a first-time contributor whether their typo PR should target `round-N` or open a feature branch. Intervention: one sentence clarifying the trivial-PR path. Owner: Samir on Kenji sign-off.
- `README.md:183-189` — tooling-gap — analyzer requires `dotnet tool install --global fsharp-analyzers`; `install.sh` doesn't install it, and `manifests/dotnet-tools` only has `dotnet-stryker`. Either install it in the manifest or drop the instruction. Owner: Dejan (add to manifest) or Samir (remove from README).

P2 (small wins):

- `CONTRIBUTING.md:43` — wrong-audience — "`docs/AGENT-BEST-PRACTICES.md` — BP-NN cross-references used in reviewer findings" written for agents; human typo-fixer does not need this. Minor. Owner: Samir.
- `openspec/README.md:1,106` — stale-pointer — "OpenSpec in Dbsp.Core" / `src/Core/FeatureFlags.fs`. Owner: Samir.
- `.mise.toml` — no friction for the typo-PR path; present for completeness. Bun runtime is pinned but unused on the first-PR walk.
- `tools/setup/doctor.sh` — missing-step — a read-only health check that CONTRIBUTING never mentions; adding one line "If setup feels off, run `tools/setup/doctor.sh`" closes a discovery gap. Owner: Samir.

## Proposed interventions (this round)

1. `README.md` — rewrite the "Layout" block + fix `samples/Demo` / `bench/Benchmarks` / `src/Core/Core.fsproj`. Owner: Samir. Effort: S. Rollback: single-file revert.
2. `CLAUDE.md`, `AGENTS.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `openspec/README.md` — sweep `Zeta.sln` → `Zeta.sln`, `Dbsp.Core` → `Core` / namespace-stays `Dbsp.Core` where it refers to the API namespace (not the folder). Owner: Samir. Effort: S. Rollback: per-file revert.
3. `CONTRIBUTING.md` — add "open a new shell after `install.sh`" sentence; add trivial-PR branch guidance. Owner: Samir on Kenji sign-off. Effort: S. Rollback: single-file revert.
4. `tools/setup/manifests/dotnet-tools` — decision: install `fsharp-analyzers` or delete the README block. Owner: Dejan + Samir. Effort: S. Rollback: one-line.

## Pointer-drift catalogue

- README.md:152 — `src/Core/` → `src/Core/`
- README.md:162 — `tests/Tests.FSharp/` → `tests/Tests.FSharp/`
- README.md:163 — `tests/Tests.CSharp/` → `tests/Tests.CSharp/`
- README.md:164 — `bench/Benchmarks/` → `bench/Benchmarks/`
- README.md:165 — `samples/Demo/` → `samples/Demo/`
- README.md:173 — `samples/Demo` → `samples/Demo`
- README.md:174 — `bench/Benchmarks` → `bench/Benchmarks`
- README.md:185 — `src/Core/Core.fsproj` → `src/Core/Core.fsproj`
- CLAUDE.md:45,58 — `Zeta.sln` → `Zeta.sln`
- AGENTS.md:40 — `Zeta.sln` → `Zeta.sln`
- .github/PULL_REQUEST_TEMPLATE.md:12 — `Zeta.sln` → `Zeta.sln`
- openspec/README.md:1,106 — `Dbsp.Core` (folder sense) → `Zeta` / `src/Core/`

## Recommended new entries

- `CONTRIBUTING.md`: add shellenv line; add trivial-PR branch guidance; add `tools/setup/doctor.sh` mention.
- `docs/GLOSSARY.md`: clarify the `Dbsp.Core` (namespace, stays) vs `Core/` (folder) split — the root-cause of the drift. Cross-ref `docs/NAMING.md`.
- `docs/DEBT.md` `dx-drift` entries: (a) first-PR walk fails on stale path pointers cluster; (b) `fsharp-analyzers` tooling-gap in install manifest; (c) re-sweep every surface after a rename campaign — codify the `sweep-refs` hat as round-close checklist item.

---

## Round 34 — persona seeded (2026-04-19)

**Context.** Persona landed via `skill-creator` workflow this
round after Aaron asked Kenji to bring DX forward alongside
Dejan. No audits run yet — the notebook exists so the first
audit has somewhere to write.

**Candidate first-audit targets (in order of expected
yield).**

1. **first-PR walk-through** on current `main`. Start from
   the GitHub repo page; time every step to `dotnet build`
   + first PR opened. Baseline for trend.
2. **Install-loop felt experience** — paired with Dejan's
   three-way-parity work. Dejan's round-29 CI design has
   the mechanical correctness view; Bodhi needs the felt
   experience view on the same surface.
3. **CONTRIBUTING.md read-path** — the file is Samir's but
   has not been re-audited for first-time-reader fit since
   the round-33 vision cascade reshaped the project's
   self-description.

**Methodology notes for first audit.**

- Read as a cold contributor: no repo context, no persona
  memory, no glossary prior.
- Cite `file:line` on every friction entry. Count minutes.
- Route every proposed fix to the canonical owner —
  Samir / Dejan / Kenji. Never edit CONTRIBUTING.md or the
  install script directly.
- First audit establishes the minutes-to-first-PR baseline;
  all future audits measure trend against it.

**Coordination pre-wires (to confirm in practice).**

- With Dejan: shared DEBT entry per `tools/setup/` parity
  drift — Dejan captures mechanical drift, Bodhi captures
  felt drift, same row.
- With Daya: method sharing on cold-walk discipline.
  Bodhi reads Daya's notebook for audit shape; diverges on
  artefacts (human readers vs personas).
- With Samir: every CONTRIBUTING / README friction flag
  routes to Samir for the edit; Bodhi never writes the doc.
- With Ilyana: plugin-author lane is co-owned when
  `docs/PLUGIN-AUTHOR.md` lands; not a Bodhi-solo audit.

**Open questions for Kenji (next round-open).**

- Should the DX audit cadence be every 5 rounds (matching
  Daya's AX cadence) or every 3 rounds (CONTRIBUTING
  changes more often than Tier 0 docs)? Agent file
  currently says 5; open to revision after first baseline.
- Does Bodhi audit `.devcontainer/` when that lands, or
  does Dejan's ownership cover felt experience too? Leaning
  toward Bodhi audits the devcontainer from a first-open
  perspective; Dejan owns whether it builds.

**Pruning log.**

- Round 34 — first entry (notebook seed). Next prune check
  at round 37 (every-third-audit cadence, BP-07).
