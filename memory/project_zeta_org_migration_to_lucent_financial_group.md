---
name: Zeta repo migration to Lucent-Financial-Group org — COMPLETED 2026-04-21; one silent GitHub drift caught + fixed; settings-as-code-by-convention pattern born
description: AceHack/Zeta → Lucent-Financial-Group/Zeta transfer executed 2026-04-21 via `POST /repos/AceHack/Zeta/transfer` (Aaron admin both sides, instant propagation). Post-transfer diff vs pre-transfer scorecard found 2 silent drifts — `secret_scanning` and `secret_scanning_push_protection` both flipped `enabled→disabled` by GitHub's org-transfer code path; re-enabled same session via PATCH. Incident triggered new FACTORY-HYGIENE row #40 (GitHub-settings drift detector with weekly cadence) and two companion memories.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Zeta → Lucent-Financial-Group org transfer

## Status: COMPLETED 2026-04-21

Transfer executed via `gh api --method POST /repos/AceHack/Zeta/transfer -f new_owner=Lucent-Financial-Group`. Propagated instantly (Aaron admin on both sides; no acceptance step required). All settings verified against pre-transfer scorecard; only drift was the silent `secret_scanning` + `secret_scanning_push_protection` flip, re-enabled same session. Local `git remote set-url origin https://github.com/Lucent-Financial-Group/Zeta.git` completed. HB-001 marked Resolved. Settings-as-code-by-convention pattern landed in same PR: `docs/GITHUB-SETTINGS.md` + `tools/hygiene/github-settings.expected.json` + drift detector + weekly CI cadence. Merge queue enable remains a separate opt-in step — not executed yet.

## Original intent capture (preserved)

Aaron's direction 2026-04-21, across three messages:

1. *"we can move tih to https://github.com/Lucent-Financial-Group at some point it's my org for LFG"*
2. *"we need to move it to lucent for contributor at some point anyways, we want to keep all the settings we have now"*
3. *"i think we are going to have to go without merge queue parallelism for now."*

Filed as `HB-001` in `docs/HUMAN-BACKLOG.md` (decision / org-migration category, For: Aaron, State: Open).

**Why:** Two converging drivers, both Aaron's own:

- **Contributor-facing fit.** Aaron's pre-existing `Lucent-Financial-Group` org (LFG umbrella — see `project_lucent_financial_group_external_umbrella.md`) is the stated destination for external contributors. Migrating now aligns the repo home with the contributor-onboarding story.
- **Platform-gated GitHub features.** The 2026-04-21 diagnostic discovered that GitHub merge queue is *only* available for organization-owned repositories — not user-owned, on any plan tier. The `AceHack/Zeta` user-owned repo cannot enable merge queue via the UI, REST API, or any other surface. The `POST /repos/AceHack/Zeta/rulesets` 422 with empty body (`{"errors":["Invalid rule 'merge_queue': "]}`) was the platform gate, not the public-beta wobble it first appeared to be. Org-owned repos also unlock org-level rulesets, team permissions, richer branch-protection patterns, etc.

**How to apply:**

- **Preserve every current setting.** On transfer day, the explicit constraint from Aaron is that every current repo setting must survive: rulesets (Default branch), required checks (gate matrix + CodeQL + semgrep), auto-delete-head-branch, auto-merge, Dependabot, CodeScanning, Copilot Code Review, concurrency groups, every workflow trigger including the `merge_group:` hooks that landed in PR #41. GitHub's native transfer preserves most of these, but the checklist has to be explicit — enumerate and verify post-transfer, don't assume.
- **Public from the start.** Aaron 2026-04-21: *"we can just make it public from the start"*. No private-during-transition staging. The target `Lucent-Financial-Group/Zeta` is public on day one; matches the existing `AceHack/Zeta` public posture and keeps the contributor-discovery story intact across the cutover. Transfer via GitHub's native "Transfer ownership" action (preserves URL redirects, stars, watches, issues, PRs, releases) is preferred over fresh-repo recreation — which is also why settings-preservation is reachable.
- **No deadline — "at some point".** Don't prod. Don't build a forcing function. The migration is the right move; Aaron decides when.
- **Interim policy: skip merge-queue parallelism, accept rebase-tax.** Until the migration, the factory relies on `gh pr merge --auto --squash` alone. Serial PRs that target the same files pay the rebase cost; don't re-propose workflow tricks to dodge it. The structural fix is the org migration, not a workflow tweak.
- **Keep the `merge_group:` workflow triggers landed on `main`** (PR #41). They are no-ops while merge queue is off; harmless to leave in place; ready the day it flips on post-transfer.
- **When filing new work that would benefit from merge queue, don't block on HB-001.** Log the benefit as "will be better post-transfer" and move on; the transfer unlocks that work retroactively.

**Cross-references:**

- `docs/HUMAN-BACKLOG.md` — HB-001 row (authoritative)
- `docs/research/parallel-worktree-safety-2026-04-22.md` §10.3 — technical record of REST API failure + UI gap + platform-gate diagnosis
- `project_lucent_financial_group_external_umbrella.md` — LFG umbrella memory (now actionable, not just contextual)
- `feedback_merge_queue_structural_fix_for_parallel_pr_rebase_cost.md` — original merge-queue-as-structural-fix memory; now superseded on *how* (requires org transfer first) but not *why* (the rebase-tax insight still stands)
