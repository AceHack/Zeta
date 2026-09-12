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

**Merge `main` FIRST, then test, then push — every time, not just when it looks stale.**

```bash
git fetch origin main && git merge origin/main    # BEFORE testing, every push
bun src/Core.TypeScript/ci/local-checks.ts        # what THIS diff will face in CI
dotnet build -c Release   # 0 warnings, 0 errors — TreatWarningsAsErrors is on
dotnet test Zeta.sln -c Release
```

Two failures this ordering prevents, both measured 2026-09-11:

- **Work silently overwritten.** A fix to `claude-agent.test.ts` merged, and a later PR from
  the same author — cut before that merge — rewrote the file and restored the defect. Nothing
  conflicted, nothing was loud, and the two tests it fixed went red again on every branch.
  A branch cut hours ago is not current, and `git merge` is what makes the overwrite a
  CONFLICT you see instead of a silent revert.
- **Testing the wrong tree.** A local green on a stale base predicts nothing about the merge
  ref CI actually builds. `local-checks.ts` run before the merge is a check that did not run.

`local-checks.ts` is the local form of the gate: `--list` shows what would run and why,
`--only '<name>'` runs one by name, and an unresolvable name exits **2** (nothing ran — not
a finding) rather than 1.

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
- **Holding without a named dependency is the standing-by failure** — "Quiet."/"Holding." with
  no work landed in the prior tick window AND no named dependency IS the failure; the narrative
  self-counter is unreliable, so externalise it against something real (commits on `main`, a
  merged PR, an open work-item). Every commit carries the AgencySignature v1 trailer: ten fields
  plus `Co-authored-by:`. Audit via
  `bun src/Core.TypeScript/hygiene/audit-agencysignature-main-tip.ts`. Full:
  `.claude/rules.bak/holding-without-named-dependency-is-standing-by-failure.md`; spec
  `docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-attribution-convention-validation-and-refinement.md` §10.
