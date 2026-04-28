---
name: Scripts-layer invariant substrate — low-priority candidate for the INVARIANT-SUBSTRATES.md layer map
description: Aaron floated extending the invariant-substrate posture to the scripts/automation surface itself (.sh + .ps1 + .ts + .fs tools). No rush; backlog candidate. Requires prior-art pass (Bats, ShellCheck, Pester, etc.) and likely a `script-invariants.yaml` or similar declarative substrate.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Round 43 candidate extension of the
`docs/INVARIANT-SUBSTRATES.md` layer map: add a
**scripts-layer** row covering the factory's own
automation surface (`.sh` + `.ps1` + future `.ts` or
`.fs` tools). Aaron's framing (2026-04-20):

> *"i don't know if it's possible to add a
> constraint/invariant system kind of thing to our scripts
> part of the factory too, just an idea, no rush."*

**Why it matters:** the invariant-substrate posture
promises "every layer has a declarative invariant
substrate". Scripts are currently an *unclaimed* layer.
If the factory's own scripts drift (dishonest names,
non-idempotent behavior, prereq assumptions, missing
preambles), nothing today catches it at the substrate
level.

**Candidate substrate fields** (draft, to be validated):

- `idempotent: true|false` — re-running produces the same
  result or gracefully no-ops. Pre-install must be; others
  usually should be.
- `pre-setup: true|false` — constrained into bash/powershell
  per the pre-setup rule. Distinguishes the two regimes.
- `cross-platform: unix-family | windows | both | linux-only`
  — which OS families the script supports.
- `exit-code-contract: 0-on-success, non-zero-on-failure`
  — the contract.
- `preamble-lint: set-euo-pipefail | strict-mode-pwsh`
  — enforced via pre-commit.
- `honest-name: true|false + evidence` — name matches
  behavior per
  `feedback_script_and_artifact_name_honesty_ensure_not_install.md`.
- `invariants.forbid / require` — per-script claims in the
  same shape as skill.yaml.
- `counts.{hypothesis, observed, verified, total}` —
  burn-down discipline.

**Prior art to investigate** (pending):
- **Bats** (Bash Automated Testing System) — assertion
  framework for bash.
- **ShellCheck** — static analyzer for shell.
- **shfmt** — formatter.
- **Pester** — PowerShell test framework.
- **Bashunit**, **shellspec**, **assert.sh** — BDD-style
  shell testing.
- **Semgrep** — rule-based static analysis; has shell
  support.
- **CodeQL** — has shell-flavor support too.
- **set -euo pipefail** — the enforced preamble convention.
- SQLSharp's `tools/automation/validation/test-shell.ts` —
  sibling project has bun-TypeScript shell-test driver.

**Why this is low-priority:**
- The existing `tools/setup/install.sh` idempotence
  invariant is already checked in CI (gate.yml runs
  install twice per GOVERNANCE.md §24). That's an
  `observed`-tier claim de facto.
- The factory already has pre-commit hooks for ASCII
  cleanliness (BP-10) and prompt-injection lints. The
  scripts layer is not *uncovered*, just *unclaimed* as a
  substrate.
- Declaring the substrate costs work; the payoff is
  mostly visibility, not new coverage.

**How to apply:**
- File a BACKLOG P3 entry to track the idea.
- When another layer substrate lands (e.g. the
  code-layer substrate if LiquidF# graduates from
  evaluation), revisit whether the scripts-layer
  substrate has matured as a natural extension.
- Good candidate for a
  `.claude/skills/script-invariant-auditor/` capability
  skill that would own the substrate if/when it lands.
- Path into `docs/INVARIANT-SUBSTRATES.md` layer map
  via one new row: "Scripts — factory automation
  surface | `.sh` + `.ps1` + `script-invariants.yaml` |
  ShellCheck + Bats + Pester + Semgrep | candidate".
