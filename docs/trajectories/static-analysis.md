# Trajectory — Static Analysis

## Scope

Every static-analysis tool that runs against Zeta's source +
config + workflows. Open-ended because new tools emerge (latest
2026: ast-grep, ruff, biome, etc.) and existing tools add new
rules continuously. Bar: catch defects before they ship; don't
go stale on industry-current tools.

## Cadence

- **Per-PR**: tools fire on every PR (gate.yml + codeql.yml).
- **Per-tool research**: weekly — check for new versions, new
  rule packs, new entrants in the static-analysis space.
- **Gap audit**: monthly — what classes of bugs aren't being
  caught by any current tool?

## Current state (2026-04-28)

| Tool | Surface | State | Coverage |
|---|---|---|---|
| **CodeQL** (advanced workflow) | F#/C# IL via `tools/setup/install.sh` + `dotnet build`; actions; python; javascript-typescript | active (codeql.yml re-enabled 2026-04-28) | `security-extended` on PR + push; `security-extended,security-and-quality` on schedule |
| **Semgrep** | F#/C#/YAML via `.semgrep.yml` (14 custom rules) | active (`lint (semgrep)`) | rules: pool-rent-unguarded-multiply, plain-tick-increment, path-combine-without-canonicalize, file-read-without-size-cap, process-start-in-core, system-random-in-security-context, invisible-unicode-in-text, unsafe-deserialisation, gha-action-mutable-tag, notimplementedexception-in-library-interface |
| **Roslyn analyzers** | C# (limited; Zeta is F#-first) | bundled with `dotnet build` | default + `Microsoft.CodeAnalysis.NetAnalyzers` |
| **F# analyzers** | F# via FSharpAnalyzers | configured but light | TODO: enumerate active rules |
| **actionlint** | `.github/workflows/*.yml` | active (`lint (actionlint)`) | full rule set |
| **shellcheck** | `tools/**/*.sh` | active (`lint (shellcheck)`) | full rule set + repo-pinned exclusions |
| **markdownlint-cli2** | `**/*.md` | active (`lint (markdownlint)`) | full rule set + per-file overrides |
| **Stryker.NET** | mutation testing | configured; cadence not yet active | F# + C# mutation suite |
| **Sonatype** | dependency vulnerabilities | active via MCP | runs on dependency add/upgrade |
| **Dependabot** | dependency security updates | enabled (org-level) | weekly cadence |
| **Secret scanning** | repo-wide secret detection | enabled (org-level) | + push-protection |

## Target state

- Every category of defect Zeta cares about has at least one
  static-analysis tool catching it.
- Tools are within 1 minor version of current upstream
  (verified per Otto-247).
- Custom rules grow as new defect classes land (each one teaches
  the static-analysis layer).
- Mutation-testing (Stryker) ships with quality-bar threshold.

## What's left

In leverage order:

1. **Enumerate F# analyzer rule set** — current state has
   "configured but light"; need to know what's actually
   enforcing.
2. **Activate Stryker.NET cadence** — mutation testing is
   configured; needs scheduled run + quality-bar gate.
3. **Adopt newer entrants** — `ast-grep` (multi-language
   pattern matching, faster than Semgrep on large repos),
   `biome` (JS/TS/CSS, faster than ESLint+Prettier).
4. **CodeQL custom queries** — the Zeta operator algebra +
   retraction-native discipline have property classes that
   GitHub's default queries don't cover. Author Zeta-specific
   CodeQL queries.
5. **Coverage report** — quantify what fraction of files are
   touched by which tool; identify dead-zones.

## Recent activity + forecast

- 2026-04-28: codeql.yml re-enabled (was disabled 2026-04-26
  for cadence concerns; verified < 5 min runtime; restored
  with default-setup disabled to resolve advanced-vs-default
  conflict).
- 2026-04-28: Semgrep rule `gha-action-mutable-tag` caught
  PR #25 `actions/checkout@v4` mutable-tag violation.
- 2026-04-27: Semgrep routed through `tools/setup/install.sh`
  for three-way-parity (PR #653).

**Forecast (next 1-3 months):**

- Watch for CodeQL `security-and-quality` query-pack updates.
- ast-grep evaluation candidate (faster Semgrep-equivalent).
- Mutation testing activation (currently configured but idle).
- New CVE class emerging from x402 / EIP-7702 wallet substrate
  may need custom Semgrep rules.

## Pointers

- Skill: `.claude/skills/static-analysis-expert/SKILL.md` (umbrella)
- Skill: `.claude/skills/codeql-expert/SKILL.md`
- Skill: `.claude/skills/semgrep-expert/SKILL.md`
- Skill: `.claude/skills/semgrep-rule-authoring/SKILL.md`
- Skill: `.claude/skills/stryker-expert/SKILL.md`
- Skill: `.claude/skills/sonar-issue-fixer/SKILL.md`
- Workflow: `.github/workflows/codeql.yml`
- Workflow: `.github/workflows/gate.yml` (lint legs)
- Config: `.semgrep.yml`
- Custom CodeQL config: `.github/codeql/codeql-config.yml`
