---
name: GitHub `code_scanning` ruleset rule requires CodeQL default-setup config; advanced-setup alone yields "1 configuration not found" NEUTRAL
description: Enabling the "Require code scanning results" repository ruleset rule on a repo that uses CodeQL advanced setup (custom workflow) only — not default setup — causes the CodeQL aggregate check to resolve NEUTRAL with "1 configuration not found". Rule blocks the PR; workflow-level SARIF uploads do not satisfy it. Fix is ruleset-off OR enable default setup alongside advanced (gated on GitHub allowing both, unverified).
type: reference
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# `code_scanning` ruleset rule vs CodeQL advanced setup

## The failure mode

- Repo: `AceHack/Zeta` (user-owned, public, pre-LFG migration).
- CodeQL setup: **advanced only** — `.github/workflows/codeql.yml`
  with `build-mode: manual` for csharp and path-gate + empty-SARIF
  refactor. Default setup is **not-configured** (verified via
  `gh api /repos/AceHack/Zeta/code-scanning/default-setup`:
  `{"state":"not-configured",...}`).
- Aaron toggled ON the Default ruleset's `code_scanning` rule
  ("Require code scanning results"), configured as:
  ```json
  {"parameters":{"code_scanning_tools":[{
    "alerts_threshold":"all",
    "security_alerts_threshold":"all",
    "tool":"CodeQL"
  }]},"type":"code_scanning"}
  ```
- PR #42 ran all CI checks green (11 SUCCESS including
  `Analyze (actions)` + `Analyze (csharp)` + both uploaded
  SARIF with `tool.driver.name = "CodeQL"` + proper
  `category: /language:X`).
- The aggregate `CodeQL` check returned
  **NEUTRAL with "1 configuration not found"** — blocking
  merge under the ruleset rule.

## Root cause

The ruleset rule's `code_scanning_tools[].tool = "CodeQL"` entry
is bound to a CodeQL **configuration** — specifically the
default-setup configuration record. When default setup is
"not-configured", the rule points at a configuration that
doesn't exist. Advanced-setup SARIF uploads do NOT count as
the required configuration, even when they:

1. Carry the right tool name (`CodeQL`).
2. Use correct per-language categories (`/language:actions/`,
   `/language:csharp/`).
3. Upload from `github/codeql-action/analyze` or
   `github/codeql-action/upload-sarif`.

The rule's configuration binding is a separate layer above
SARIF tool/category matching.

## Resolution options

**1. Turn off the ruleset rule** (what happened here).
Simplest unblock; loses the "must have code-scanning results"
gate. OK as interim.

**2. Enable CodeQL default setup alongside advanced** (untested).
GitHub *may* reject this — traditional guidance is default XOR
advanced, not both. If GitHub allows both, you get a
configuration the rule can bind to. Downside: duplicate
CodeQL analyses on every PR (default setup runs its own,
advanced runs yours), doubling compute and alert queue noise.

**3. Migrate to default setup, delete advanced workflow.**
Default setup provides the configuration the rule wants. Lose:
- Path-gate short-circuit for docs-only PRs.
- Three-way-parity install script integration
  (GOVERNANCE §24).
- Query-pack control (schedule/push ternary).
- `build-mode: manual` needed for F#/C# extraction via
  `dotnet build Zeta.sln`.

Not worth it for Zeta.

## How to verify default-setup state

```
gh api /repos/<owner>/<repo>/code-scanning/default-setup \
  --jq '.state'
```

Returns `"configured"` | `"not-configured"` |
`"configuring"` | `"error"`.

## Diagnostic tell

The string **"1 configuration not found"** in the aggregate
`CodeQL` check's UI description is the smoking gun. If you
see that + NEUTRAL + all sub-jobs SUCCESS, this is the
scenario — not a path-gate bug, not a SARIF-upload bug,
not a timing issue.

## Related

- Memory: `project_zeta_org_migration_to_lucent_financial_group.md`
  — the Lucent-FG org migration is orthogonal; this rule
  would have the same issue there unless default setup is
  enabled on transfer.
- `.github/workflows/codeql.yml` — advanced workflow with
  path-gate + empty-SARIF refactor (PR #42).
- GitHub docs link to fetch for deeper research:
  https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#required-deployments
  (and neighbouring `code_scanning` rule page).

## Followup

Research needed (before re-enabling the rule):

- Can default + advanced CodeQL setup coexist on the same
  repo? If yes, what's the duplicate-compute cost?
- Is there a way to make the `code_scanning` rule bind to
  the advanced-setup configuration instead?
- Does ruleset rule evaluation differ between user-owned
  and org-owned repos? (Relevant for post-LFG-migration.)
