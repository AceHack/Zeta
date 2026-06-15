---
name: dejan
description: Per-persona notebook — Dejan (devops-engineer). 3000-word cap; newest-first; prune every third audit.
type: project
---

# Dejan — DevOps engineer notebook

Skill: `.claude/skills/devops-engineer/SKILL.md`.
Agent: `.claude/agents/devops-engineer.md`.

Newest entries at top. Hard cap: 3000 words (BP-07).
ASCII only (BP-09). Prune every third audit.

---

## Round 29 (anchor: CI + build-machine setup) — 2026-04-18

**Context.** Spawned this round as the persona who owns
`tools/setup/` (three-way parity script per GOVERNANCE §24)
and `.github/workflows/` (hand-crafted from read-only
reference patterns per round-29 discipline).

**Decisions carried forward.**

- Runners pin to specific images (`ubuntu-22.04`,
  `macos-14`) not the moving `-latest` label. Aaron wants
  reproducibility; research-project discipline.
- `.mise.toml` adopts dotnet + python this round; Lean
  stays on the custom elan installer until a mise plugin
  lands (possible upstream contribution target per
  GOVERNANCE §23).
- No verifier SHA ceremony — Aaron chose trust-on-first-
  use.
- `tools/install-verifiers.sh` retires greenfield in the
  same commit that lands `tools/setup/`; no alias, no
  deprecated-shim.
- `actions/setup-dotnet` in the first workflow is a
  **temporary parity-drift flag**; swapping to
  `tools/setup/install.sh` in CI is a backlog entry.
- Concurrency key: `${{ github.workflow }}-${{
  github.event.pull_request.number || github.ref }}`,
  `cancel-in-progress: ${{ github.event_name ==
  'pull_request' }}` — PR pushes cancel stale runs,
  main-branch pushes queue (so every main commit gets a
  green/red record).
- Hard-fail everywhere on red; re-evaluate if something
  feels off.

**Parity-drift log (open).**

- CI's `actions/setup-dotnet@<sha>` vs dev-laptop
  `tools/setup/install.sh`. **Drift severity:** medium.
  **Planned fix:** swap once install script is stable
  across macos-14 + ubuntu-22.04 runners. **Backlog
  entry:** "Parity swap: CI's `actions/setup-dotnet` →
  `tools/setup/install.sh`."
- Devcontainer / Codespaces third leg is unbuilt.
  **Drift severity:** low (no devcontainer consumer
  exists yet). **Planned fix:** `.devcontainer/
  Dockerfile` calls `tools/setup/install.sh` during
  image build. **Backlog entry:** "Devcontainer /
  Codespaces image."

**Upstream PRs open.**

- None yet this round. Prior example (pre-Zeta): Aaron
  landed a mise dotnet-plugin PR during `../SQLSharp`
  work; that plugin's current release carries the fix.
- Candidate future PR: mise plugin for `elan` / lean-
  toolchain, if we decide to author one rather than
  waiting. Tracked under backlog "Full mise migration."

**CI cost observations.** No baseline yet — will measure
the first three runs of `gate.yml` after it lands.

**Watch items (from round-29 CI design).**

- Action SHA ledger in `docs/research/ci-workflow-
  design.md` has empty commit-SHA cells; fill when the
  workflow lands.
- Whether `tools/setup/install.sh` is truly idempotent
  will be proven by the two-run CI contract; if it
  breaks in practice, that's a DEBT entry.
- Stryker's CI shape is unscheduled — per round-29
  design it's manual/scheduled only, never per-PR. Cost
  estimate flagged for the scheduled-workflow PR when
  that lands.
