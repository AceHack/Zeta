---
pr_number: 5416
title: "feat(081KSKBP80008QG0R000GPC0TB.1): add first-boot self-register service module"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T07:19:26Z"
merged_at: "2026-05-27T10:28:22Z"
closed_at: "2026-05-27T10:28:22Z"
head_ref: "claim/codex-b0855-1-zeta-self-register-service-20260527"
base_ref: "main"
archived_at: "2026-05-27T19:25:17Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5416: feat(081KSKBP80008QG0R000GPC0TB.1): add first-boot self-register service module

## PR description

## Summary
- add disabled-by-default `zeta-self-register.service` NixOS module for 081KSKBP80008QG0R000GPC0TB.1
- import/expose the module from the cluster module surface
- add source-level audit sentinels for first-boot ordering and env handoff

## Checks
- `git diff --check`
- `bun tools/ci/audit-installer-substrate.ts`
- `bun test tools/ci/test-iter-54-install-flow.test.ts`

## Notes
- `nix-instantiate` is not installed in this environment, so Nix parse/eval remains for CI/local Nix.
- Draft until CI/review confirms the Nix service surface.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T07:23:11Z)

## Pull request overview

Adds a disabled-by-default NixOS systemd service module to move node self-registration to *post-install, first boot* (081KSKBP80008QG0R000GPC0TB.1), and strengthens CI/source audits to ensure the new substrate stays wired into the AI-cluster module surface.

**Changes:**
- Add `zeta-self-register` NixOS module defining a `zeta-self-register` oneshot service gated by `ConditionFirstBoot` and ordered after `network-online.target` (and `zeta-creds-restore.service` when present).
- Import/expose the new module via `common.nix` and `full-ai-cluster/flake.nix` module outputs.
- Extend `tools/ci/audit-installer-substrate.ts` to require the new module file and assert key ordering/env-handoff sentinels.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 1 comment.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| tools/ci/audit-installer-substrate.ts | Adds required-file + sentinel assertions for the new self-register module surface. |
| full-ai-cluster/nixos/modules/zeta-self-register.nix | Introduces the disabled-by-default `zeta-self-register` first-boot oneshot systemd service module. |
| full-ai-cluster/nixos/modules/common.nix | Imports `zeta-self-register.nix` so all node types share the module surface. |
| full-ai-cluster/flake.nix | Exposes `zeta-self-register` in `nixosModules` outputs for reuse/consistency. |
| docs/claims/codex-b0855-1-zeta-self-register-service-20260527.md | Adds a live work-claim marker for this effort. |
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T09:06:55Z)

## Pull request overview

Copilot reviewed 5 out of 5 changed files in this pull request and generated 1 comment.

### COMMENTED — @AceHack (2026-05-27T09:29:59Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T09:30:06Z)

## Pull request overview

Copilot reviewed 5 out of 5 changed files in this pull request and generated 2 comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T09:52:37Z)

## Pull request overview

Copilot reviewed 5 out of 5 changed files in this pull request and generated 2 comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T10:14:06Z)

## Pull request overview

Copilot reviewed 5 out of 5 changed files in this pull request and generated 2 comments.

## Review threads

### Thread 1: full-ai-cluster/nixos/modules/zeta-self-register.nix:36 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:23:11Z):

Several option defaults hardcode `/home/zeta` (home, repoRoot, scriptPath, markerPath, intentDir). If a host overrides `zeta.selfRegister.home` or `repoRoot`, the other defaults won’t follow and the service can end up with inconsistent HOME/WorkingDirectory/ExecStart/marker paths. Consider deriving the path defaults from `home`/`repoRoot` (or document that overrides must update all related options together).

### Thread 2: full-ai-cluster/nixos/modules/zeta-self-register.nix:88 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T09:06:55Z):

P1: `ExecStart` and `PATH` assume the Bun runtime lives at `${cfg.home}/.bun/bin/bun`, but the cluster substrate elsewhere standardizes on mise-managed Bun (shim at `${cfg.home}/.local/share/mise/shims/bun`) and uses `~/.bun/bin` only for `bun install --global` CLIs. As written, enabling this module is likely to fail with `No such file or directory` for Bun unless the user also installed Bun via the Bun installer. Align this unit with the existing pattern (e.g., invoke Bun via the mise shim and include the mise shims dir in `PATH`, and/or set `BUN_INSTALL=${cfg.home}/.bun` if needed).

**@AceHack** (2026-05-27T09:29:59Z):

Addressed in e7ac91080d3d79410666f6bf4b76f542ed83470d by switching the service runtime to `${cfg.home}/.local/share/mise/shims/bun`, adding the mise shims directory to `PATH`, and setting `BUN_INSTALL=${cfg.home}/.bun`. GitHub now marks this thread outdated on the current PR head, so I am resolving it.

Provenance:
- Surface: codex-background-service
- Origin: codex-launchd-loop
- Run ID: 20260527T092753Z

### Thread 3: full-ai-cluster/nixos/modules/zeta-self-register.nix:77 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T09:30:05Z):

P1 (operational): `ConditionFirstBoot=yes` makes this a single-shot opportunity; if the service fails on first boot (no network, repo missing, transient error) it will never retry, even though `markerPath` exists. Consider gating with `ConditionPathExists=!${cfg.markerPath}` (or similar marker/intent checks) and using restart/backoff semantics so the node can self-register once prerequisites are met.

### Thread 4: .github/workflows/build-ai-cluster-iso.yml:369 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T09:30:06Z):

P1 (operational): The cosign signing step runs on `pull_request` events too. On forked PRs, GitHub typically does not issue OIDC tokens, which would make `cosign sign-blob` fail and block CI for external contributors. Consider gating the signing + bundle upload steps to `push`/`workflow_dispatch` (or conditionally skipping when the OIDC env vars are absent).

### Thread 5: .github/workflows/build-ai-cluster-iso.yml:387 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T09:52:36Z):

P1: The step summary says verification is in “workflow comments”, but this workflow doesn’t appear to post any comment containing the `cosign verify-blob` command. Either change this text back to “workflow run logs” / “step summary”, or add an explicit step that posts the verification command as a workflow comment.

### Thread 6: .github/workflows/build-ai-cluster-iso.yml:370 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T09:52:37Z):

P2: The comment says the bundle is “emitted alongside the ISO”, but the bundle is written under `$RUNNER_TEMP` (not next to `ISO_PATH`). Adjust the wording so it matches where the file is actually created.

### Thread 7: full-ai-cluster/nixos/modules/zeta-self-register.nix:73 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T10:14:05Z):

P1: When this module is enabled before the repo/script (or Bun shim) is present on-disk, the unit will enter a 30s restart loop and spam the journal. Consider adding additional unit-level guards (e.g., an extra `ConditionPathExists` for `cfg.scriptPath` and/or the Bun shim path) so a misconfigured host fails closed without repeated restarts until the substrate is actually present.

### Thread 8: .github/workflows/build-ai-cluster-iso.yml:387 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T10:14:06Z):

The step summary says the canonical `cosign verify-blob` command is in the workflow step summary, but this step only prints a table + that sentence (the actual verify command is only in YAML comments). Either emit the full verify command into `$GITHUB_STEP_SUMMARY` here, or change the message to point to the YAML comments/run logs accurately.

## General comments

### @AceHack (2026-05-27T07:23:17Z)

CI failure inspection (Vera 2026-05-27T07:22Z): `docker-nixos-install-sh-test` fails during Docker build before the harness runs: `/bin/sh: line 1: mkdir: command not found` at `tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile:53`. This PR does not modify that Dockerfile, and `origin/main` has the same lines 53-54, so this is not currently attributable to the 081KSKBP80008QG0R000GPC0TB.1 module patch. I am not rerunning it yet; next safe action is to wait for remaining checks and then decide whether this is an existing base-image/tooling blocker or needs a separate fix.

### @AceHack (2026-05-27T08:05:11Z)

Codex/Vera opened Docker harness repair PR #5427 for the `docker-nixos-install-sh-test` blocker on this draft branch.

Local verification on the repair branch passed:

```text
bun tools/ci/docker-nixos-install-sh-test.ts
```

Keeping this PR draft-blocked until #5427 lands or CI confirms the harness fix.

### @chatgpt-codex-connector (2026-05-27T10:10:08Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
