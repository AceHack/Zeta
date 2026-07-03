---
pr_number: 4905
title: "ci(infra): build installer ISO on PRs + main + release publish"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T03:23:24Z"
merged_at: "2026-05-25T04:25:01Z"
closed_at: "2026-05-25T04:25:01Z"
head_ref: "feat/ci-build-installer-iso-workflow-2026-05-24"
base_ref: "main"
archived_at: "2026-05-27T19:51:47Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4905: ci(infra): build installer ISO on PRs + main + release publish

## PR description

## Summary

Adds \`.github/workflows/build-installer-iso.yml\` — Linux runner builds the \`.#installer-iso\` flake output on every PR touching the flake/infra, every push to main, manual dispatch, and release publish. Removes the local-Nix-required dependency for testing changes to the ISO.

## Why a CI build path

The installer ISO target is \`x86_64-linux\`. On Apple Silicon Macs (most maintainers' workstations), building it requires the nix-darwin \`linux-builder\` VM setup. CI on ubuntu-24.04 builds it directly — no cross-compile, no local Nix install, no APFS-volume gymnastics.

Anyone reviewing a flake-touching PR can now grab the rebuilt ISO from the workflow artifact and \`dd\` it to a USB stick without any local toolchain.

## Pipeline

| Step | What |
|---|---|
| Checkout | Full history (reproducible flake.lock pinning) |
| Install Nix | \`DeterminateSystems/nix-installer-action@v22\` |
| Cache | \`magic-nix-cache-action@v13\` for /nix/store reuse |
| Eval check | \`nix flake check --no-build\` fail-fast |
| Build | \`nix build .#installer-iso --print-build-logs\` |
| Metadata | path/name/size/sha256 → step summary |
| Upload | Workflow artifact, 90d retention, no re-compression |

A second job (\`attach-to-release\`) fires only on release-publish events: rebuilds the ISO at the tag and uploads it + its SHA256 to the release assets.

## Security

- Runner pinned to \`ubuntu-24.04\` (not \`-latest\`); matches \`gate.yml\` convention
- Third-party actions SHA-pinned with trailing \`# vX.Y.Z\` comments
- Workflow-level \`permissions: contents: read\`; only \`attach-to-release\` elevates to \`contents: write\` and only for the upload step
- \`github.event.release.tag_name\` (attacker-controllable) passed via \`env: RELEASE_TAG\` not interpolated into shell — per the GH Actions injection guide flagged by the security-reminder PreToolUse hook

## Test plan

- [ ] Workflow triggers on this PR (flake.nix isn't touched, but the workflow file path is)
- [ ] First green run produces a downloadable \`zeta-installer-24.11.iso\` artifact
- [ ] SHA256 in the step summary matches the artifact

## Composes with

- #4897 (installer config)
- #4898 (flake.nix + modules + per-host configs + k8s applications)
- #4903 (runbook fix)
- #4904 (brew/nix permissions)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T03:26:11Z)

## Pull request overview

Adds a dedicated GitHub Actions workflow to build the Nix flake `.#installer-iso` output on Ubuntu CI for PRs/pushes, with an additional release-only path intended to attach the built ISO to GitHub Releases.

**Changes:**

- Introduces `.github/workflows/build-installer-iso.yml` to build the installer ISO on PRs (path-filtered), pushes to `main`, manual dispatch, and release publish.
- Uploads the ISO as a workflow artifact for PR/main runs.
- Adds a release-only job intended to rebuild and upload the ISO + SHA256 as release assets.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T03:33:30Z)

## Pull request overview

Copilot reviewed 3 out of 3 changed files in this pull request and generated 3 comments.

### COMMENTED — @chatgpt-codex-connector (2026-05-25T03:47:00Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `920b691fb8`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T03:50:10Z)

## Pull request overview

Copilot reviewed 3 out of 3 changed files in this pull request and generated 3 comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T04:12:40Z)

## Pull request overview

Copilot reviewed 3 out of 3 changed files in this pull request and generated 3 comments.

## Review threads

### Thread 1: .github/workflows/build-installer-iso.yml:159 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:26:10Z):

P0: This step writes the SHA256 sidecar to "${iso_path}.sha256". Since iso_path is under the Nix build output (typically a /nix/store path via the result symlink), that location is read-only on GitHub runners and the step will fail. Write the .sha256 file into the workspace (e.g., using the ISO basename) and upload that file instead.

### Thread 2: .github/workflows/build-installer-iso.yml:162 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:26:11Z):

P1: The job intent is to rebuild "for the tagged release", but Checkout doesn’t pin `ref` to the release tag (or otherwise make the source explicit). Consider checking out `github.event.release.tag_name` (or `github.ref`) and ensuring tags/history are available so tag-based versioning (e.g., `git describe`) can’t silently drift.

### Thread 3: .github/workflows/build-installer-iso.yml:7 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:26:11Z):

P2: The header comment says this runs "on tag push" and refers to a "tag-push job", but the actual trigger is `on: release: types: [published]`. Update the prose to match the real trigger (release published) to avoid future drift.

### Thread 4: .github/workflows/build-installer-iso.yml:92 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:26:11Z):

P2: ISO discovery uses `find ... | head -1`, which is non-deterministic if multiple matching ISOs exist and gives a less clear failure mode when no match is found. Prefer a deterministic selection (`-print -quit` or sorting) and add an explicit check with a helpful error message before computing basename/stat/sha256.

### Thread 5: .github/workflows/build-installer-iso.yml:162 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:33:29Z):

`attach-to-release` checks out with the default `fetch-depth` (1). Earlier in this workflow you explicitly require full history for reproducible builds / `git describe`-style versioning; release/tag builds are the most likely to need tags/history. Set `fetch-depth: 0` (and, if needed, ensure tags are fetched) for the release job checkout as well so the tag build can’t fail due to shallow history.

### Thread 6: .github/workflows/build-installer-iso.yml:156 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:33:30Z):

On `release` events this workflow will run the `build` job (because it has no event filter) and then `attach-to-release` (because `if: github.event_name == 'release'`), and `attach-to-release` rebuilds the ISO again. That’s two full ISO builds per release publish; consider either skipping the `build` job on release events, or reusing the ISO from the `build` job via artifact download instead of rebuilding.

### Thread 7: .github/workflows/build-installer-iso.yml:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:33:30Z):

Header comment says the workflow runs “on tag push” to attach the ISO to a release, but the actual trigger is `on: release: types: [published]`. Update the comment to match the real trigger to avoid future confusion when debugging why this doesn’t run on tag-only pushes.

### Thread 8: .github/workflows/build-installer-iso.yml:140 (resolved)

**@chatgpt-codex-connector** (2026-05-25T03:47:00Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Remove skipped dependency from release upload job**

On `release` events, `build` is explicitly skipped (`if: github.event_name != 'release'`), but `attach-to-release` still declares `needs: build`. In GitHub Actions, a job whose dependency is skipped is skipped as well unless you override with an `always()`-style condition, so the release-upload path never runs and no ISO/SHA assets are attached to published releases.

Useful? React with 👍 / 👎.

### Thread 9: .github/workflows/build-installer-iso.yml:202 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:50:09Z):

P0 (security): `gh release upload "$RELEASE_TAG" ...` treats the tag as a positional arg, but git tag names can legally start with `-`. If a release is created with a tag like `--repo=...`, `gh` may parse it as flags rather than a tag. Add an explicit `--` end-of-options marker (or validate `RELEASE_TAG` doesn’t start with `-`) so attacker-controlled tag names can’t be interpreted as CLI options.

### Thread 10: .github/workflows/build-installer-iso.yml:198 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:50:10Z):

The release-uploaded `.sha256` file currently contains only the hash (`awk '{print $1}'`). Consider writing the standard `sha256sum` format (`<hash>  <filename>`) so consumers can run `sha256sum -c <file>.sha256` directly after downloading the assets.

### Thread 11: .github/workflows/build-installer-iso.yml:19 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:50:10Z):

Header comment says "tag-push job elevates to contents: write" but this workflow triggers on `release: published` and the job is `attach-to-release`. Update the comment to match the actual trigger/job name to avoid drift.

### Thread 12: infra/nixos/modules/gpu.nix:29 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T04:12:39Z):

P1: The comment says "`cuda_*` covers …" but the predicate is `lib.hasPrefix "cuda" name` (no underscore). Either tighten the predicate to match the documented intent (`cuda_…`) or update the comment so the allowed scope is accurately described.

### Thread 13: .github/workflows/build-installer-iso.yml:107 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T04:12:40Z):

P1: `find … -print -quit` will silently pick the first match if multiple `zeta-installer-*.iso` files exist (e.g., if the build output layout changes). Since this value is used for artifact upload, it would be safer to assert there is exactly one match and fail otherwise.

### Thread 14: .github/workflows/build-installer-iso.yml:193 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T04:12:40Z):

P1: Same as the build job: `find … -print -quit` will pick an arbitrary first match if multiple ISOs exist. For release assets in particular, it’s safer to enforce a single match (fail on 0 or >1) so the wrong file can’t be attached to a release.
