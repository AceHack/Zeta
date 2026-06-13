# docs/GITHUB-SETTINGS.md — declarative GitHub settings for ace

Source of truth for ace's GitHub repository configuration. Drift is a
factory-hygiene finding. Cadenced diff via `gh api`.

Origin: ADR 2026-04-22 §"Repo best practices — applied at creation".

---

## Visibility

- Upstream `Lucent-Financial-Group/ace`: **public**
- Fork `AceHack/ace`: public

## Merge settings

| Setting | Value |
|---------|-------|
| Allow merge commits | **disabled** |
| Allow squash merging | **enabled** |
| Allow rebase merging | **disabled** |
| Delete head branches on merge | **enabled** |
| Allow auto-merge | **enabled** |

## Merge queue

Merge queue: **enabled** (LFG org feature).

## Branch protection — `main`

| Rule | Value |
|------|-------|
| Require pull request before merging | **enabled** |
| Required approving reviews | 1 |
| Dismiss stale reviews on push | **enabled** |
| Require status checks to pass | **enabled** |
| Required status checks | `bun-test`, `bun-lint`, `codeql`, `scorecard` _(added in Stage 2 after CI workflows are wired — empty at day-one to avoid deadlocking bootstrap)_ |
| Require branches up to date | **enabled** |
| Require conversation resolution | **enabled** |
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
| Code scanning (CodeQL) | **default-setup** |
| Private vulnerability reporting | **enabled** |

## Budget caps (LFG org level)

| Surface | Spending limit |
|---------|---------------|
| Copilot | $0 |
| Actions | $0 |
| Packages | $0 |

## Cadence check

```bash
gh api repos/Lucent-Financial-Group/ace | jq '{
  visibility: .visibility,
  allow_squash_merge: .allow_squash_merge,
  allow_merge_commit: .allow_merge_commit,
  allow_rebase_merge: .allow_rebase_merge,
  delete_branch_on_merge: .delete_branch_on_merge,
  allow_auto_merge: .allow_auto_merge
}'
```

Diff against this file monthly or before major merge-queue changes.
