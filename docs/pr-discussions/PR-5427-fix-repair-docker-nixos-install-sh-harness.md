---
pr_number: 5427
title: "fix: repair Docker NixOS install-sh harness"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T08:04:10Z"
merged_at: "2026-05-27T08:40:15Z"
closed_at: "2026-05-27T08:40:15Z"
head_ref: "claim/codex-docker-nixos-install-sh-test-path-20260527"
base_ref: "main"
archived_at: "2026-05-27T19:23:55Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5427: fix: repair Docker NixOS install-sh harness

## PR description

## Summary

- preserves the nixos/nix base image PATH so core tools remain visible after PATH pre-staging
- adds the Nix userspace commands and runtime libraries needed by install.sh and .mise.toml tool downloads
- exposes compatible glibc loader/library paths for dynamically linked Linux binaries inside the Nix image

## Verification

- git diff --check
- bun tools/ci/docker-nixos-install-sh-test.ts

Blocks/unblocks: fixes the docker-nixos-install-sh-test failure currently blocking PR #5416.

Claim protocol note: this PR will include a release commit deleting docs/claims/codex-docker-nixos-install-sh-test-path-20260527.md.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T08:07:22Z)

## Pull request overview

This PR repairs the NixOS Docker harness used by `docker-nixos-install-sh-test` by ensuring the Nix base image’s core tooling and required runtime libraries remain discoverable during `tools/setup/install.sh` execution, including support for dynamically linked tool downloads under `.mise.toml`.

**Changes:**

- Extend the Docker build `PATH` to include the Nix default profile binaries so base tools remain available across layers.
- Install explicit Nix userspace command/runtime dependencies via `nix-env`, and add compatibility symlinks for compiler and shared libraries.
- Expose a conventional glibc loader path and set `LD_LIBRARY_PATH` so dynamically linked binaries can run inside the Nix container.

### Reviewed changes

Copilot reviewed 1 out of 1 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile | Updates PATH, installs required Nix packages, and wires up loader/library paths for the install.sh test harness. |
| docs/claims/codex-docker-nixos-install-sh-test-path-20260527.md | Adds a claim file describing the harness repair work and verification plan. |

## Review threads

### Thread 1: tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile:77 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T08:07:21Z):

P1: `find ... -name '*gcc' | head -n 1` can pick wrappers like `c89-gcc`/`c99-gcc` depending on filesystem order, making `/usr/local/bin/cc` non-deterministic. Prefer resolving the actual `gcc` on PATH after `nix-env` installs it.

### Thread 2: tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile:92 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T08:07:22Z):

P1: `find /nix/store ...` can traverse a large store and slow Docker builds unnecessarily. Since the loader path is always `.../lib/ld-linux-*.so.*`, bounding the search depth avoids walking deep package trees while keeping the same behavior.

## General comments

### @chatgpt-codex-connector (2026-05-27T08:04:15Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-27T08:09:12Z)

Vera CI inspection: `docker-nixos-install-sh-test` passed on this PR, and the PR diff is only `tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile`. The blocking check is `lint (tsc tools)` on run 26498932520/job 78034067323, failing in unrelated installer TS files: `tools/installer/zeta-cred-handlers.test.ts` lines 71/77/85/124, `tools/installer/zeta-cred-handlers.ts` line 249, and `tools/installer/zeta-creds-envelope.ts` lines 129/132/135/138. No rerun taken; next safe action is to wait for or land the owner fix for the installer TS baseline, then re-check/merge this Docker repair PR.
