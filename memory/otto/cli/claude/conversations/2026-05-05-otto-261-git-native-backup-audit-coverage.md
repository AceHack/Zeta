---
Scope: Audit-only snapshot of Otto-261 trajectory coverage on `Lucent-Financial-Group/Zeta` as of 2026-05-05. Read-only, no edits/commits. Surfaces 8-class catalog state vs git-native mirrors; recommends Phase-2 prototype scope.
Attribution: Aaron (human maintainer) named the Otto-261 trajectory 2026-04-24 (memory `feedback_gitnative_store_all_github_artifacts_lfg_only_branches_prs_issues_discussions_wiki_otto_261_2026_04_24.md`). This audit performed by Otto autonomous-loop session 2026-05-05 (Opus 4.7).
Operational status: Research-grade audit. No mirror creation, no policy changes, no CI changes. Pure surfacing of state. Recommendations are advisory; the trajectory itself stays BACKLOG-class per Aaron's framing ("backlog-owed, sized") until prioritized.
Non-fusion disclaimer: This document does not introduce a new policy or supersede prior memory. It reports current coverage against the existing Otto-261 catalog.
---

# Otto-261 Git-Native Backup Audit — Coverage State 2026-05-05

## Summary table — 8-class Otto-261 catalog vs git-native mirrors

| # | Class | GitHub state (LFG) | Git-native mirror | Coverage % | Gap | Risk |
|---|---|---|---|---|---|---|
| 1 | **Branches** | 159 active branches via `gh api repos/L/Z/branches` | Local clone tracks 418 remote refs (origin = LFG); no committed `docs/branches/` snapshot. Branch metadata + per-branch protection rules NOT mirrored. | ~50% (commit graph mirrored by clone; metadata not) | Branch metadata snapshot (name, HEAD SHA, protection rules, last-pushed-at) not in `docs/`. | Low — git itself mirrors branch HEADs. Risk is metadata loss only (protection rules + push timestamps). |
| 2 | **PRs** | 1,673 PRs all states (`gh pr list ... --state all`) | `docs/pr-discussions/` has 14 PR archive files (`PR-NNNN-*.md`). Tool exists at `tools/pr-preservation/archive-pr.sh` but is one-shot manual. `docs/pr-preservation/` (55 files) is **drain-logs**, NOT per-PR conversation mirrors. | **~0.8%** (14 / 1673) | 99% of PRs unarchived. No GHA workflow auto-runs the tool on merge. No historical backfill. | **HIGH** — per Otto-250/251 + 2026-04-23 dual-use memo, PR review threads are highest-signal training data for reviewer tuning. Loss = corpus loss. |
| 3 | **Issues** | 29 issues all states | `docs/ISSUES-INDEX.md` (section + bullet keyword mapping back to BACKLOG.md). No per-issue body/comments archive at `docs/issues/`. | **~30%** (index exists; bodies not preserved) | Issue bodies, comments, label history, state transitions, assignees not mirrored. | Medium — most issue content already lives in BACKLOG.md (the authoritative source per ISSUES-INDEX.md), but threaded discussion content is not preserved. |
| 4 | **Discussions** | 0 discussions (feature enabled, none created) | None — `docs/discussions/` does not exist. | N/A (nothing to mirror) | No mirror infrastructure exists, but no content gap today. | **Low today, latent**. Risk emerges when discussions are first used and no mirror tool catches the first one. |
| 5 | **Wiki** | Wiki feature enabled (`hasWikiEnabled: true`); wiki repo `Zeta.wiki.git` returns "Repository not found" — wiki has zero pages. | None — `docs/wiki/` does not exist. | N/A (nothing to mirror) | No mirror infrastructure. Same shape as discussions. | Low today, latent. |
| 6 | **Projects** | Could not enumerate — `read:project` scope missing on current `gh` token. Repo-level `has_projects: true`. | None — `docs/projects/` does not exist. | Unknown | Cannot audit without scope refresh. | Unknown — likely 0 active projects given factory uses BACKLOG.md as project board. |
| 7 | **Releases / tags** | 0 releases (`gh release list`); 0 tags (`gh api .../tags`). | None — `docs/releases/` does not exist; no annotated tags. | N/A (nothing to mirror) | Pre-v1 / pre-deploy per Otto-266 — no releases yet. | Low today, latent. Risk emerges at first release. |
| 8 | **Repo metadata + settings** | Live via `gh api repos/L/Z` + rulesets + environments + secret-names + workflows + branch-protection. 1 ruleset (Default), 2 environments (copilot, github-pages), 0 secrets, 2 vars (COPILOT_AGENT_FIREWALL_*), 0 webhooks, 0 deploy keys, 18 labels, 0 milestones, 0 topics. | `tools/hygiene/github-settings.expected.json` (286 lines, 14 top-level sections including `repo`, `topics`, `rulesets`, `default_branch_protection`, `actions_permissions`, `actions_variables`, `workflows`, `environments`, `pages`, `codeql_default_setup`, `security`, `interaction_limits`, `autolinks`, `counts`). Drift detection via `tools/hygiene/check-github-settings-drift.sh`. Plus `docs/operations/branch-protection-{lfg,acehack}-main{,-classic}.json` (4 files). | **~85%** | Secret NAMES not snapshotted (currently zero exist; tool gap if any added). Label set + milestones not in expected.json. Webhook/deploy-key NAMES not snapshotted. CI history (workflow runs past retention) not preserved (`docs/ci-history/` absent). Billing-history snapshots not in catalog scope (Otto-261 item 10 — separate `docs/budget-history/` exists with `snapshots.jsonl`). | **Low** for current scope — best-mirrored class. Higher when secrets/webhooks/deploy keys arrive. |

## Five-line summary

- **Overall coverage: ~25%** weighted by class weight (settings ~85%, branches ~50%, issues ~30%, PRs ~0.8%, three classes empty-but-uncovered, projects unknown). Aaron's framing ("we probably won't get this 100% full coverage area first go") is honored — the trajectory is intentionally incremental.
- **Highest-signal gap is PRs**: 1,659 of 1,673 PRs have no git-native conversation mirror. The tool exists (`tools/pr-preservation/archive-pr.sh`) but lacks (a) GHA auto-run on merge, (b) historical backfill of the existing 1,673 PRs.
- **Best-covered class is settings** via `github-settings.expected.json` + drift checker; gap is label set, milestones, and zero-count items (secrets/webhooks/deploy-keys) where future arrivals must trigger snapshot updates.
- **Latent-risk classes** (discussions, wiki, releases) are zero-content today but have zero mirror infrastructure — first content created without prior tooling = silent miss; recommend infrastructure stubs before content arrives.
- **Recommended Phase-2 prototype**: GHA workflow `pr-archive-on-merge.yml` invoking the existing `tools/pr-preservation/archive-pr.sh` on `pull_request: closed` (where `merged == true`), plus a one-shot backfill script that pages `gh pr list --state all` and archives all 1,659 missing PRs. This is the single highest-value coverage gain (small effort, very high signal preserved per Otto-251 training-corpus value).

## Top-3 highest-risk gaps

1. **PR conversation archive at <1% coverage** — 1,659 unarchived PRs; substrate-loss risk = full reviewer-tuning training corpus is host-dependent. (HIGH)
2. **Branch metadata snapshot missing** — git clone preserves HEADs but not protection rules per branch (only main is captured in `docs/operations/branch-protection-lfg-main.json`); host-rule-loss risk. (MEDIUM)
3. **Latent-class infrastructure absent** — no mirror tooling for discussions, wiki, releases means the first content created in any of these surfaces will be silently un-mirrored until someone notices. (LATENT-MEDIUM)

## Recommended Phase-2 prototype scope

Single deliverable: `.github/workflows/pr-archive-on-merge.yml` that runs `tools/pr-preservation/archive-pr.sh ${{ github.event.pull_request.number }}` and commits the resulting `docs/pr-discussions/PR-NNNN-*.md` back to main on every merged PR; plus `tools/pr-preservation/backfill-all.sh` that iterates `gh pr list --state all --json number` and archives each missing PR-number, batched in groups of 50 PRs per commit to keep the backfill PR reviewable. Effort: M. Coverage gain on Class-2 from 0.8% to ~100% in one round. Composes with existing `archive-pr.sh` (no rewrite). Risk: backfill PR is large (≥1,659 files); mitigate via batched commits + draft PR for review.

## Provenance

- Otto-261 trajectory memory: `memory/feedback_gitnative_store_all_github_artifacts_lfg_only_branches_prs_issues_discussions_wiki_otto_261_2026_04_24.md`
- Otto-250 PR-review preservation precursor: `memory/project_git_native_pr_review_archive_high_signal_training_data_for_reviewer_tuning_2026_04_23.md`
- Otto-54 git-native + first-host positioning: `memory/project_factory_is_git_native_github_first_host_hygiene_cadences_for_frictionless_operation_2026_04_23.md`
- Existing tool: `tools/pr-preservation/archive-pr.sh` (Phase-0 minimal, Otto-207)
- Settings snapshot: `tools/hygiene/github-settings.expected.json` (286 lines, 14 sections)
- Issue-tracker mapping: `docs/ISSUES-INDEX.md`
