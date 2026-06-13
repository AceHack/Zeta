# docs/GITHUB-SETTINGS.md — declarative GitHub settings for Forge

This file is the source of truth for Forge's GitHub repository configuration.
Drift between this file and actual GitHub settings is a factory-hygiene
finding (cadenced diff via `gh api`).

Origin: ADR 2026-04-22 §"Repo best practices — applied at creation".
Pattern: declarative settings-as-code (see Zeta repo's `memory/` for full rationale).

---

## Visibility

- Upstream `Lucent-Financial-Group/Forge`: **public**
- Fork `AceHack/Forge`: public (fork of a public repo is necessarily public)

## Merge settings

| Setting | Value |
|---------|-------|
| Allow merge commits | **disabled** |
| Allow squash merging | **enabled** (squash-merge only) |
| Allow rebase merging | **disabled** |
| Squash merge commit message | PR title + PR number |
| Delete head branches on merge | **enabled** |
| Allow auto-merge | **enabled** |

## Merge queue

Merge queue: **enabled** (LFG org feature; requires GitHub Team or above).

## Branch protection — `main`

| Rule | Value |
|------|-------|
| Require pull request before merging | **enabled** |
| Required approving reviews | 1 (bump to 2 when multi-contributor) |
| Dismiss stale reviews on push | **enabled** |
| Require review from code owners | disabled (no CODEOWNERS yet) |
| Require status checks to pass | **enabled** |
| Required status checks | `bun-test`, `bun-lint`, `codeql`, `scorecard` _(added in Stage 2 after CI workflows are wired — empty at day-one to avoid deadlocking bootstrap)_ |
| Require branches up to date | **enabled** (merge queue handles) |
| Require conversation resolution | **enabled** |
| Restrict pushes that create files | disabled |
| Require signed commits | **enabled** |
| Require linear history | **enabled** |
| Include administrators | **enabled** |
| Allow force pushes | **disabled** |
| Allow deletions | **disabled** |

## Security

| Setting | Value |
|---------|-------|
| Secret scanning | **enabled** |
| Push protection | **enabled** |
| Dependency graph | **enabled** |
| Dependabot alerts | **enabled** |
| Dependabot security updates | **enabled** |
| Code scanning (CodeQL) | **default-setup** (NOT advanced-only) |
| Private vulnerability reporting | **enabled** |

> Note: CodeQL **default-setup** is required; advanced-only fails the
> `code_scanning` ruleset rule (see
> [Zeta memory](https://github.com/Lucent-Financial-Group/Zeta/blob/main/memory/reference_github_code_scanning_ruleset_rule_requires_default_setup.md)
> for background).

## OpenSSF Scorecard

Scorecard workflow: **enabled** via `.github/workflows/scorecard.yml`
(SHA-pinned, minimal permissions, weekly schedule).

## Budget caps (LFG org — set at org level, not per-repo)

| Surface | Spending limit |
|---------|---------------|
| Copilot | $0 |
| Actions | $0 |
| Packages | $0 |

Caps are designed cost-stops; see the
[Zeta memory file](https://github.com/Lucent-Financial-Group/Zeta/blob/main/memory/feedback_lfg_budgets_set_permits_free_experimentation.md)
for background.
Free-tier consumption is still tracked via
`tools/budget/snapshot-burn.ts`.

## CI safe-patterns (applied at workflow authoring time)

- Shared GitHub-hosted runners only (no self-hosted on public repos)
- Action SHA pinning (never floating tags)
- Minimal `permissions:` per workflow (default `contents: read`)
- Concurrency groups on every workflow (one run per branch)
- `GITHUB_TOKEN` read-only by default; escalate per-job as needed
- Semgrep rule for GHA inline-untrusted-in-run injection

## Cadence check

Run monthly or before any major merge-queue change:

```bash
gh api repos/Lucent-Financial-Group/Forge | jq '{
  visibility: .visibility,
  allow_squash_merge: .allow_squash_merge,
  allow_merge_commit: .allow_merge_commit,
  allow_rebase_merge: .allow_rebase_merge,
  delete_branch_on_merge: .delete_branch_on_merge,
  allow_auto_merge: .allow_auto_merge
}'
```

Diff output against this file. Deviations are FACTORY-HYGIENE findings.
