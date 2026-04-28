# Trajectory — CI/CD Infrastructure

## Scope

Every CI workflow under `.github/workflows/`, branch protection
rules + rulesets, required-status-check configuration, runner
pinning, cache strategy, secret handling, concurrency groups,
and the org-level Code Security configuration that scopes the
repo-level surfaces. Open-ended because GitHub's runners,
actions, and security primitives evolve continuously. Bar: CI
catches regressions before merge; runner versions stay current
(per Otto-247); cost stays at zero on public repos; structural
incompatibilities (default × advanced CodeQL etc.) get caught
fast.

## Cadence

- **Per-workflow-edit**: actionlint + shellcheck on every PR
  that touches `.github/workflows/*` or `tools/**/*.sh`.
- **Per-version**: WebSearch + API-verify when adding/changing a
  pin (Otto-247 + version-currency-inherit-pins discipline).
- **Weekly**: review CI cost/duration trends (free for public
  repos; signal is duration creep).
- **Per-incident**: when CI breaks, document the root cause +
  fix in commit message + tick-history.

## Current state (2026-04-28)

| Workflow | State | Cadence |
|---|---|---|
| `gate.yml` | active; build-and-test matrix (ubuntu-24.04, ubuntu-24.04-arm, macos-26 on PR + Windows on push-to-main); lint legs (actionlint, markdownlint, semgrep, shellcheck, archive-header §33, no-conflict-markers, no-empty-dirs, tick-history-order) | per-PR + per-merge + manual |
| `codeql.yml` | active (re-enabled 2026-04-28 after default-setup disabled to resolve advanced-vs-default conflict); path-gate empty-SARIF emit for doc-only PRs; analyze matrix (actions, csharp, python, javascript-typescript) | per-PR + per-merge + weekly schedule |
| `low-memory.yml` | active; ubuntu-slim leg moved here from gate.yml | push-to-main + 06:00 UTC nightly |
| `scorecard.yml` | active; Open Source Security Scorecard | scheduled |
| `memory-index-integrity.yml` | active | per-PR |
| `memory-reference-existence-lint.yml` | active | per-PR |
| `backlog-index-integrity.yml` | active | per-PR |
| `resume-diff.yml` | active | per-PR |
| `github-settings-drift.yml` | active; flags `tools/hygiene/github-settings.expected.json` vs live config | per-PR + per-push |
| `budget-snapshot-cadence.yml` | pending merge (AceHack PR #25); weekly cadence |  |

Branch protection (LFG main):
- required_status_checks: build-and-test (macos-26, ubuntu-24.04, ubuntu-24.04-arm), lint (actionlint, markdownlint, semgrep, shellcheck) — strict
- required_pull_request_reviews: 0 approving, dismiss_stale, no code-owner-required
- required_linear_history: true
- required_conversation_resolution: true (in Default ruleset)
- code_quality severity:all (in Default ruleset)
- copilot_code_review (in Default ruleset)

Org-level (LFG):
- Code Security configurations: 6 configs (id 17 GitHub recommended + 244997 + 244998 dup + 244999 + 245000 dup + 245012 dup); 244997 attached to 7 sibling repos; Zeta unattached
- Default code-scanning: not-configured (disabled 2026-04-28)

## Target state

- Every workflow has its rationale documented in the file's
  header comment.
- All third-party action pins are full-SHA + commented vN.N.N.
- All version pins are current (per Otto-247 verification).
- The github-settings-drift workflow shows zero gap between
  expected.json and live config.
- Org-level Code Security configurations are clean (duplicates
  retired); Zeta either attached to canonical config or clearly
  documented as standalone-with-reasoning.
- Required status checks include every must-pass check; nothing
  optional masquerading as required.
- CI durations stay sub-5min on PR cadence (verified 2026-04-28
  for codeql.yml).

## What's left

In leverage order:

1. **Org-config duplicate cleanup** (LFG-only) — 3 duplicate
   Code Security configs (244998, 245000, 245012); pending
   per-ID authorization due to action-layer denial on mass-
   delete.
2. **github-settings-drift workflow** — currently flags
   build-and-test (macos-26) gap (PR #657 closes it); other
   gaps may surface.
3. **codeql.yml + branch-protection alignment** — code_quality
   rule expects per-language Analyze checks; Analyze legs only
   fire when `code_changed=true` per path-gate. Doc-only PRs
   still hit the dead-end. Fix candidates: (a) make Analyze
   always run; (b) update path-gate's empty-SARIF emit to
   produce check-runs with the right names.
4. **Required-status-check completeness audit** — current set
   may miss new lint legs.
5. **Workflow-level secret-handling audit** — every workflow
   uses `secrets.GITHUB_TOKEN` correctly; double-check after
   every workflow change.
6. **Stage 2 install.ps1** (task #305) — Windows leg currently
   `continue-on-error: true` because no PowerShell installer;
   peer-mode-agent milestone before serious Windows polish.

## Recent activity + forecast

- 2026-04-28: codeql.yml re-enabled; default Code Scanning
  disabled at repo level (LFG-org-scope; Zeta unattached to
  org-config so the disable sticks).
- 2026-04-28: gate.yml macOS back to PR cadence (LFG #657).
- 2026-04-28: PR #25 budget-cadence workflow approaching merge
  (semgrep gha-action-mutable-tag fixed + 3 P1 threads).
- 2026-04-27: gate.yml CI cadence split (per-PR fast / per-merge
  slow); Windows experimental seed.
- 2026-04-27: code_quality rule re-armed within agent-authority
  delegation.

**Forecast (next 1-3 months):**

- Org-config duplicates retire (pending Aaron's per-ID auth).
- Stage 2 install.ps1 (task #305) when peer-mode-agent comes
  online.
- Additional CI-cadence adjustments as macOS / Windows / Linux
  duration data accumulates.
- Possible CodeQL workflow refinement to make Analyze always
  fire (resolve the doc-only-PR dead-end structurally).
- Migration to newer entrants (ast-grep candidate per
  static-analysis trajectory).

## Pointers

- Skill: `.claude/skills/devops-engineer/SKILL.md` (Dejan)
- Skill: `.claude/skills/github-actions-expert/SKILL.md`
- Skill: `.claude/skills/codeql-expert/SKILL.md`
- Skill: `.claude/skills/semgrep-expert/SKILL.md`
- Workflow: `.github/workflows/gate.yml`
- Workflow: `.github/workflows/codeql.yml`
- Config: `tools/hygiene/github-settings.expected.json`
- Hygiene: `tools/hygiene/check-archive-header-section33.sh`
- BACKLOG: task #287 cost-monitoring (in_progress, deadline window)
- BACKLOG: task #305 install.ps1
- BACKLOG: task #306 cadence-fast revisit
