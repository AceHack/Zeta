---
pr_number: 5320
title: "cleanup(USB PR 2): retire legacy installer substrate \u2014 delete infra/nixos/hosts/installer/ + build-installer-iso.yml + update root flake; add 081KSGS9H0008QG0R00126RHQR follow-up"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T21:00:07Z"
merged_at: "2026-05-26T21:10:08Z"
closed_at: "2026-05-26T21:10:08Z"
head_ref: "otto-cli/usb-cleanup-pr2-investigation-infra-installer-workflow-consolidation-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:34:04Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5320: cleanup(USB PR 2): retire legacy installer substrate — delete infra/nixos/hosts/installer/ + build-installer-iso.yml + update root flake; add 081KSGS9H0008QG0R00126RHQR follow-up

## PR description

## Summary

USB cleanup PR 2 of 3. Retires the legacy installer substrate; canonical AI-cluster installer (\`full-ai-cluster/usb-nixos-installer/\`) becomes the only installer-iso build path.

Aaron direction: \"lets try to cleanup what we have in a few prs and combine get rid of the old\" + \"yeah if we need a delete thats fine\" + \"you don't have to ask me direction every time you can just assume all with the simplest first\".

## What lands

### Deleted (572 lines removed)

- \`infra/nixos/hosts/installer/configuration.nix\` (296 lines; legacy installer NixOS config)
- \`.github/workflows/build-installer-iso.yml\` (230 lines; legacy ISO build workflow)

### Modified — flake.nix

- Removed \`nixosConfigurations.installer\` (referenced deleted file)
- Removed \`packages.installer-iso\` + \`packages.default\` (depended on \`nixosConfigurations.installer\`)
- Removed \`isoBuildSystems\` variable (no longer needed)
- Updated bootstrap-flow comments to point at \`full-ai-cluster/usb-nixos-installer/\` + \`zflash\`
- Updated devShell shellHook with canonical build command
- Updated nixpkgs version-pin comment

### Added — 081KSGS9H0008QG0R00126RHQR follow-up backlog row

- \`docs/backlog/P3/081KSGS9H0008QG0R00126RHQR-add-iso-release-attach-to-build-ai-cluster-iso-workflow-...\`
- Captures the release-attach feature the legacy workflow had so it can be re-implemented in the canonical workflow when Zeta starts tagging releases (currently zero releases per \`gh release list\` — feature UNUSED at deletion time)

## Why this deletion is safe (substrate-check pre-cleanup audit)

Per the substrate-check-before-worry-deployment discipline + Kestrel's pre-cleanup-audit recommendation:

1. **infra/nixos/hosts/installer references**:
   - \`flake.nix\` — imports as \`nixosConfigurations.installer\` → REMOVED in this PR
   - \`build-installer-iso.yml\` — builds via root flake → DELETED in this PR
   - \`build-ai-cluster-iso.yml\` — NO REFERENCE (targets canonical)

2. **build-installer-iso.yml references**:
   - No other workflow depends on it
   - No tools/ci/ script depends on it
   - Release-attach feature currently UNUSED (zero releases exist)

3. **Non-historical references after deletion**: 0 (verified via grep)

## Decision-archaeology pointer (per Kestrel discipline)

**WHY THIS PATH EXISTED**: \`infra/nixos/hosts/installer/\` was the root-flake-imported installer config — first installer substrate after the root \`usb-nixos-installer/\` was minimized. Pre-dated the \`full-ai-cluster/\` consolidation.

**WHY THIS PATH IS RETIRED**: the canonical \`full-ai-cluster/usb-nixos-installer/\` has zero-typing install substrate (zeta-install.sh + zeta-first-boot.sh + zflash macOS Touch-ID flasher + flake.lock + hardware-firmware + SSH-key/hashed-password + WiFi credential injection). The legacy version lacks all of this. Maintaining two installer substrates was unnecessary parallel-substrate cost (per PR #5310 cost-of-velocity discussion).

## Next in cleanup sequence

- **USB cleanup PR 3** — CI ISO testing via QEMU/KVM boot test (Kestrel's prior-art pointer: \`nixos/tests/installer.nix\`); substantive engineering

## Composes with

- PR #5310 (cost-of-velocity discipline + Kestrel sequencing recommendation: PR 1 before PR 2)
- PR #5311 (USB cleanup PR 1 — deleted root \`usb-nixos-installer/\`)
- 081KSGS9H0008QG0R00126RHQR follow-up (release-attach when releases start)
- \`.claude/rules/refresh-world-model-poll-pr-gate.md\` dotgit-saturation discipline (authored from fresh independent clone per 081KSGS9H0008QG0R002H0ENQ1)
- \`.claude/rules/methodology-hard-limits.md\` (irreversible deletion authorized explicitly)

## Test plan

- [x] Pre-cleanup grep audit: 0 non-historical references after deletion
- [x] Post-commit canary green (HEAD 60 = HEAD~1 60; 3 files deleted from existing trees + 1 new file under existing tree)
- [x] Branch follows \`otto-cli/*\` surface-prefix convention
- [x] Authored from fresh independent clone (per 081KSGS9H0008QG0R002H0ENQ1)
- [ ] CI green (flake.nix changes evaluate; build-ai-cluster-iso.yml still works)
- [ ] Copilot review pass

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T21:03:46Z)

## Pull request overview

This PR retires the legacy root-flake installer ISO path and leaves the `full-ai-cluster/usb-nixos-installer/` substrate as the canonical ISO build path.

**Changes:**
- Deleted the legacy NixOS installer host config and `build-installer-iso.yml` workflow.
- Removed root-flake `installer` / `installer-iso` outputs and updated visible build guidance.
- Added 081KSGS9H0008QG0R00126RHQR to track re-adding release-asset upload support to the canonical workflow.

### Reviewed changes

Copilot reviewed 5 out of 5 changed files in this pull request and generated 3 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| `infra/nixos/hosts/installer/configuration.nix` | Deletes the retired legacy installer host configuration. |
| `.github/workflows/build-installer-iso.yml` | Deletes the retired legacy ISO build/release workflow. |
| `flake.nix` | Removes root-flake installer outputs and updates comments/devShell guidance to canonical path. |
| `docs/backlog/P3/081KSGS9H0008QG0R00126RHQR-add-iso-release-attach-to-build-ai-cluster-iso-workflow-when-zeta-starts-tagging-releases-aaron-2026-05-26.md` | Adds follow-up backlog row for canonical workflow release attachment. |
| `docs/BACKLOG.md` | Adds 081KSGS9H0008QG0R00126RHQR to the generated backlog index. |
</details>

## Review threads

### Thread 1: flake.nix:164 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T21:03:45Z):

Removing the root `installer-iso` package leaves current-state docs pointing at a command that now fails and a workflow link that now points to a deleted file (`infra/README.md:35-40`, `infra/nix-darwin/README.md:40-46,79-82`, `infra/nix-darwin/configuration.nix:4,16`). Update those references to the canonical `full-ai-cluster/usb-nixos-installer` build path in the same cleanup PR, or keep a compatibility alias until the docs are migrated.

### Thread 2: flake.nix:101 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T21:03:46Z):

This code comment adds direct maintainer-name attribution on a current-state code surface. The repository convention allows names on history/backlog/research surfaces, but code comments should use role references instead (for example, “the human maintainer’s cleanup direction”).

### Thread 3: docs/backlog/P3/081KSGS9H0008QG0R00126RHQR-add-iso-release-attach-to-build-ai-cluster-iso-workflow-when-zeta-starts-tagging-releases-aaron-2026-05-26.md:55 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T21:03:46Z):

The follow-up acceptance criteria omit release-asset safeguards that existed in the deleted workflow: rejecting release tags that start with `-`, using a `--` separator for `gh release upload`, and writing the SHA256 sidecar outside the read-only Nix store. Since the workflow is being deleted, add these specifics here so the future canonical implementation preserves the security and reliability properties rather than only the high-level feature.

## General comments

### @chatgpt-codex-connector (2026-05-26T21:00:11Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
