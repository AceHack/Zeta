---
pr_number: 5123
title: "backlog(iter-6): 6-row cluster-update substrate \u2014 nixpkgs 24.11\u219225.11 + autoUpgrade + kured + deploy-rs + runbook + ALL-deps capstone"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T07:37:24Z"
merged_at: "2026-05-26T07:45:58Z"
closed_at: "2026-05-26T07:45:58Z"
head_ref: "otto-cli/iter6-cluster-update-backlog-cluster-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:41:15Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5123: backlog(iter-6): 6-row cluster-update substrate — nixpkgs 24.11→25.11 + autoUpgrade + kured + deploy-rs + runbook + ALL-deps capstone

## PR description

## Summary

Backlog cluster for iter-6 cluster-update substrate, per maintainer directives:

- *"is there a 25 we should go ahead and distro upgrade ... don't start behind from the beginning"*
- *"lets backlog all that we need to be able to upgrade without ... manual operator"*
- *"we need to do that same thing to all our nix installed deps and argocd deps casue you are not good at getting current version"*

WebSearch confirmed: **NixOS 25.11 \"Xantusia\"** is current stable (released 2025-11-30; EOL 2026-06-30). Our current pin `nixos-24.11` is **past EOL** as of 2025-06-30 — substantively behind + supply-chain-security exposure.

## Rows filed

| ID | Tier | Title |
|---|---|---|
| **081KSGS9H0008QG0R001EKTS5A** | P1 | iter-6.0 — bump nixpkgs 24.11→25.11 (urgent EOL recovery) |
| **081KSGS9H0008QG0R002T6J6FS** | P2 | iter-6.1 — `system.autoUpgrade` in `nixos/modules/common.nix` |
| **081KSGS9H0008QG0R003GM7TYN** | P2 | iter-6.2 — kured ArgoCD app (K8s-aware drain+reboot) |
| **081KSGS9H0008QG0R00280HHA7** | P2 | iter-6.3 — deploy-rs from CI (GitOps alt to autoUpgrade) |
| **081KSGS9H0008QG0R0034ZYYR8** | P2 | iter-6.4 — distro-upgrade runbook + orchestrator |
| **081KSGS9H0008QG0R002BC2ZR7** | P1 | iter-6.5 (CAPSTONE) — ALL deps current-version sweep + `.claude/rules/dep-pin-search-first-authority.md` |

## Key design decisions captured

- **autoUpgrade XOR deploy-rs** (081KSGS9H0008QG0R002T6J6FS + 081KSGS9H0008QG0R00280HHA7 both note: pick one, not both — they race)
- **kured composes with either shape** (081KSGS9H0008QG0R003GM7TYN handles K8s-aware reboot orchestration regardless)
- **081KSGS9H0008QG0R002BC2ZR7 is the substrate-honest catch**: Otto's training-data defaults skew stale; without agent-discipline encoding the gap re-opens every PR

## Test plan

- [x] All 6 row files validated against backlog frontmatter shape
- [x] `BACKLOG.md` regenerated via `bun tools/backlog/generate-index.ts`
- [x] composes_with cross-references back-filled across all 6 rows
- [x] Sources cited (NixOS 25.11 release + kured + deploy-rs)
- [x] No code changes; backlog rows + index only

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T07:41:58Z)

## Pull request overview

Files a six-row iter-6 backlog cluster (081KSGS9H0008QG0R001EKTS5A–081KSGS9H0008QG0R002BC2ZR7) for `full-ai-cluster` OS lifecycle: an urgent nixpkgs/nix-darwin 24.11→25.11 EOL-recovery bump, `system.autoUpgrade` enablement, kured ArgoCD app for drain-aware reboots, deploy-rs-from-CI as an alternative push-shape, a cross-channel distro-upgrade runbook + orchestrator, and a capstone all-deps currency audit + agent search-first-authority rule. Pure docs change — six new per-row markdown files plus the auto-regenerated `docs/BACKLOG.md` index entries.

**Changes:**
- Add six new backlog rows under `docs/backlog/P1/` and `docs/backlog/P2/` covering the iter-6 cluster-update substrate with `depends_on` / `composes_with` edges wired across the cluster.
- Regenerate `docs/BACKLOG.md` to surface the new entries under P1 and P2.
- Encode an autoUpgrade-XOR-deploy-rs design constraint and a capstone agent-discipline rule (`.claude/rules/dep-pin-search-first-authority.md`) to land later.

### Reviewed changes

Copilot reviewed 7 out of 7 changed files in this pull request and generated 5 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/081KSGS9H0008QG0R001EKTS5A-…md | P1 row: bump nixpkgs/nix-darwin pin 24.11→25.11 (EOL recovery) |
| docs/backlog/P1/081KSGS9H0008QG0R002BC2ZR7-…md | P1 capstone row: all-deps currency audit tool + agent search-first-authority rule |
| docs/backlog/P2/081KSGS9H0008QG0R002T6J6FS-…md | P2 row: enable `system.autoUpgrade` in `common.nix` |
| docs/backlog/P2/081KSGS9H0008QG0R003GM7TYN-…md | P2 row: kured ArgoCD app for K8s-aware drain+reboot |
| docs/backlog/P2/081KSGS9H0008QG0R00280HHA7-…md | P2 row: deploy-rs from CI as alternative push-shape |
| docs/backlog/P2/081KSGS9H0008QG0R0034ZYYR8-…md | P2 row: distro-upgrade runbook + Bun orchestrator |
| docs/BACKLOG.md | Regenerated index entries for the six new rows |
</details>

## Review threads

### Thread 1: docs/backlog/P2/081KSGS9H0008QG0R00280HHA7-iter-6-3-deploy-rs-from-ci-gitops-flake-lock-pull-with-auto-rollback-aaron-2026-05-26.md:127 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T07:41:56Z):

The link target `../P2/081KSGS9H0008QG0R0027HJZYH-iter-5-4-homelab-gh-auth-login-device-flow-zeta-cluster-node-registration-into-github-no-shipped-keys-aaron-mika-2026-05-26.md` does not exist in the repo. The actual 081KSGS9H0008QG0R0027HJZYH file lives under `docs/backlog/P1/` and has the slug `081KSGS9H0008QG0R0027HJZYH-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md`. Update both the directory (`../P1/`) and the filename slug to match the real row, otherwise `tools/backlog/lint-frontmatter.ts` cross-reference validation and any markdown link checker will fail.

### Thread 2: docs/backlog/P2/081KSGS9H0008QG0R003GM7TYN-iter-6-2-kured-argocd-app-kubernetes-aware-drain-reboot-aaron-2026-05-26.md:70 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T07:41:57Z):

The example Helm `values` block has two `configuration:` keys at the same level (line 63 and line 70). YAML will silently keep only the second mapping, dropping `rebootDays`, `startTime`, `endTime`, `timeZone`, and `rebootSentinel`. Since this snippet is the implementation reference future Otto will copy into `kured.yaml`, merge the two blocks into a single `configuration:` mapping so the row doesn't seed a broken config.

### Thread 3: docs/backlog/P2/081KSGS9H0008QG0R002T6J6FS-iter-6-1-system-autoupgrade-nixos-modules-common-weekly-schedule-no-auto-reboot-aaron-2026-05-26.md:40 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T07:41:57Z):

The flags list combines `--commit-lock-file` and `--no-write-lock-file`, which is contradictory: `--no-write-lock-file` tells `nix flake update` not to write `flake.lock` at all, while `--commit-lock-file` instructs it to commit the (now-not-written) lock. The intent described in the note ("don't push lock changes back to git") is actually achieved by simply omitting `--commit-lock-file` (and the autoUpgrade unit doesn't have repo write credentials anyway). Recommend dropping both flags from this example, or keeping only `--no-write-lock-file` if a transient in-memory lock update is wanted, so the snippet doesn't get copied into `common.nix` as-is.

### Thread 4: docs/backlog/P2/081KSGS9H0008QG0R003GM7TYN-iter-6-2-kured-argocd-app-kubernetes-aware-drain-reboot-aaron-2026-05-26.md:68 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T07:41:57Z):

Sub-target 2 line 86 says NixOS's autoUpgrade writes `/run/reboot-required` (note `/run` vs `/var/run`), but the example values block on line 68 still configures `rebootSentinel: "/var/run/reboot-required"`. These should match (and per the surrounding note, the verified-correct path is `/run/reboot-required`). Either fix the example to use `/run/reboot-required` or call out explicitly that the path must be verified before merge; right now the snippet contradicts its own sub-target note.

### Thread 5: docs/backlog/P2/081KSGS9H0008QG0R0034ZYYR8-iter-6-4-distro-upgrade-automation-runbook-canary-rollout-coordinated-cluster-bump-aaron-2026-05-26.md:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T07:41:58Z):

The title text on line 5 ends without a closing quotation mark for the maintainer quote (`"if we reformat every time it's handled by the cluster not a manual operator`). The row file opens the quote with `"` but never closes it, which both reads as an unfinished sentence and propagates into `docs/BACKLOG.md` verbatim (see `docs/BACKLOG.md:741`). Close the quote.

## General comments

### @chatgpt-codex-connector (2026-05-26T07:37:29Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
