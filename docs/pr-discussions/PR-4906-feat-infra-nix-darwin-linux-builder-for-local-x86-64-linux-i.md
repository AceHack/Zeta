---
pr_number: 4906
title: "feat(infra): nix-darwin linux-builder for local x86_64-linux ISO builds on Apple Silicon"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T03:25:05Z"
merged_at: "2026-05-25T03:42:32Z"
closed_at: "2026-05-25T03:42:32Z"
head_ref: "feat/nix-darwin-linux-builder-config-2026-05-24"
base_ref: "main"
archived_at: "2026-05-27T19:51:46Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4906: feat(infra): nix-darwin linux-builder for local x86_64-linux ISO builds on Apple Silicon

## PR description

## Summary

Adds \`infra/nix-darwin/\` + wires \`darwinConfigurations.zeta-mac\` into \`flake.nix\`. After this lands, any maintainer with Nix installed on an Apple Silicon Mac runs **one command**:

\`\`\`bash
nix run nix-darwin/master#darwin-rebuild -- switch \\
  --flake /path/to/Zeta#zeta-mac
\`\`\`

…and gets a working linux-builder VM. From then on \`nix build .#installer-iso\` from the repo root builds the x86_64-linux ISO locally via Apple's Virtualization.framework + Rosetta 2 — no Parallels, Lima, Docker, or remote builders.

## Why this exists

The installer ISO target is \`x86_64-linux\`. Apple Silicon is \`aarch64-darwin\`. Nix can't cross-compile a NixOS system natively — it needs a real Linux build environment. Three local-Mac paths exist (Lima, Colima, OrbStack, nix-darwin linux-builder); **nix-darwin's linux-builder is the most Mac-native** (Apple's own VM framework, Rosetta-accelerated, tightly integrated with Nix).

## Files

| File | Purpose |
|---|---|
| \`infra/nix-darwin/configuration.nix\` | The actual config: \`nix.linux-builder.enable = true\`, sizing (8GB RAM, 40GB disk, 6 cores), \`extra-platforms = [ "x86_64-linux" ]\`, trusted-users = @admin, baseline package set |
| \`infra/nix-darwin/README.md\` | Prerequisites, setup command, troubleshooting, "what this is NOT" |
| \`flake.nix\` | Adds \`inputs.nix-darwin\` pinned to master + \`darwinConfigurations.zeta-mac\` |

## Composes with

- #4905 — CI workflow that builds the ISO without needing local Nix. **Local linux-builder is the iteration path; CI is the source-of-truth path.** Both exist intentionally.
- Future: PRs that bump nix-darwin master via \`nix flake update\`

## Test plan

- [ ] \`nix flake check\` passes (CI #4905 will run this)
- [ ] Post-merge, maintainer with Nix installed runs the setup command and confirms \`nix build .#installer-iso\` succeeds locally
- [ ] linux-builder VM uses Rosetta for x86_64-linux derivations (verify via \`nix log\` showing build host arch)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T03:28:02Z)

## Pull request overview

Adds a nix-darwin configuration under `infra/nix-darwin/` and wires it into `flake.nix` as `darwinConfigurations.zeta-mac`, enabling maintainers on Apple Silicon macOS to use nix-darwin’s `linux-builder` VM to build the repo’s `x86_64-linux` installer ISO locally.

**Changes:**

- Add nix-darwin workstation configuration enabling `nix.linux-builder` + Rosetta-backed `extra-platforms = [ "x86_64-linux" ]`.
- Document the intended maintainer workflow (one-command setup, ISO build, troubleshooting) in `infra/nix-darwin/README.md`.
- Extend `flake.nix` with a `nix-darwin` input and a `darwinConfigurations.zeta-mac` output.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 5 comments.

| File | Description |
| ---- | ----------- |
| infra/nix-darwin/README.md | Documents prerequisites and setup/build workflow for nix-darwin linux-builder on Apple Silicon. |
| infra/nix-darwin/configuration.nix | Implements the nix-darwin config enabling linux-builder, caches, trusted users, and baseline tools. |
| flake.nix | Adds `nix-darwin` flake input and exports `darwinConfigurations.zeta-mac` to apply the workstation config. |

### COMMENTED — @chatgpt-codex-connector (2026-05-25T03:28:09Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `980db14858`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T03:36:42Z)

## Pull request overview

Copilot reviewed 3 out of 3 changed files in this pull request and generated 5 comments.

### COMMENTED — @chatgpt-codex-connector (2026-05-25T03:39:03Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `776fb373cb`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: infra/nix-darwin/README.md:50 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:28:01Z):

Line starts with a literal `+` (`+ compiles the Linux closure)`), which Markdown parses as a `+`-style list item and will also trip the repo’s markdownlint rule that forbids wrapped continuation lines starting with `+`. Reword to avoid a line-leading `+` (e.g., join the sentence or start the line with “and”).

### Thread 2: infra/nix-darwin/README.md:70 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:28:01Z):

Troubleshooting row says “You’re not in the `wheel` group”, but the configuration sets `nix.settings.trusted-users = [ "@admin" ]`. On macOS, the relevant group here is `admin` (or `@admin` in nix.conf), so this guidance is misleading; update the text to match the actual trusted-users setting.

### Thread 3: infra/nix-darwin/README.md:82 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:28:01Z):

This README links to `../../.github/workflows/build-installer-iso.yml`, but that file does not exist in the repository (no workflow mentions `installer-iso` currently). Either add the referenced workflow in this PR or update the link to the actual CI workflow/path so readers don’t hit a 404.

### Thread 4: infra/nix-darwin/configuration.nix:9 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:28:02Z):

Comment claims the Determinate Nix install command is in `/etc/zeta-install.md` or `infra/README.md`, but `/etc/zeta-install.md` is the installer runbook on the ISO and `infra/README.md` documents cluster bootstrap; neither provides a macOS Nix installation command. Point this reference to the actual Determinate installer URL (or `infra/nix-darwin/README.md`) to avoid sending maintainers to unrelated docs.

### Thread 5: infra/nix-darwin/configuration.nix:51 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:28:02Z):

The resource-sizing comment says “Default 8GB RAM / 8 cores”, but the config sets `virtualisation.cores = 6`. Please align the comment with the actual value (or adjust the value) so the sizing guidance stays accurate.

### Thread 6: infra/nix-darwin/README.md:45 (resolved)

**@chatgpt-codex-connector** (2026-05-25T03:28:09Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Publish installer-iso for Darwin hosts**

The new workflow instructs Apple Silicon users to run `nix build .#installer-iso`, but this flake still exposes `installer-iso` only under `packages.x86_64-linux` (the package set is gated by `system == "x86_64-linux"`), so on `aarch64-darwin` the attribute lookup fails before the linux-builder can be used. This means the headline feature introduced here is not actually runnable on the target platform unless users manually build an explicit Linux attribute path.

Useful? React with 👍 / 👎.

### Thread 7: flake.nix:60 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:36:41Z):

The comment here implies both aarch64-darwin and x86_64-darwin builds use Rosetta 2, but Rosetta 2 is Apple-Silicon-only. Please adjust the wording (or the supported system list) so x86_64-darwin isn’t described as Rosetta-backed unless you’re explicitly supporting that path some other way.

### Thread 8: flake.nix:76 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:36:41Z):

`isoBuildSystems` includes `x86_64-darwin`, but this flake only defines `darwinConfigurations.zeta-mac` for `aarch64-darwin`. As a result, an Intel Mac will see `.#installer-iso` exposed but there’s no corresponding nix-darwin configuration to set up a Linux builder for it. Either add an explicit `darwinConfigurations` entry for `x86_64-darwin` (and document it) or drop `x86_64-darwin` from `supportedSystems`/`isoBuildSystems` to avoid a broken/misleading output.

### Thread 9: infra/nix-darwin/README.md:38 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:36:41Z):

This section says it “Trusts the wheel/admin group”, but the actual configuration uses `trusted-users = [ "@admin" ];` (not wheel), and later the README uses `trusted-users = ["@admin"]` which isn’t the nix.conf syntax. Recommend consistently referring to the macOS `admin` group and showing the exact nix-darwin/Nix syntax to avoid confusion when troubleshooting permissions.

### Thread 10: infra/nix-darwin/configuration.nix:29 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:36:41Z):

The comment says “wheel group (admin users on macOS)”, but the config actually trusts `@admin` and wheel is a different group on macOS. Suggest updating the comment to refer to the `admin` group explicitly so it matches the setting being applied.

### Thread 11: infra/nix-darwin/configuration.nix:18 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:36:42Z):

Minor doc clarity: this breaks “Virtualization.framework” across lines as “Virtualization\n.framework”, leaving a stray leading dot. Suggest keeping “Virtualization.framework” on one line here (and in the later linux-builder comment) so the sentence reads cleanly.

### Thread 12: infra/nix-darwin/README.md:80 (resolved)

**@chatgpt-codex-connector** (2026-05-25T03:39:04Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Update README to reference an existing CI workflow**

The new documentation points readers to `../../.github/workflows/build-installer-iso.yml` as the source-of-truth CI path, but that workflow file is not present in this repository (I checked the current `.github/workflows/` tree). This leaves maintainers following the new nix-darwin guide without a valid CI reference and makes the “source of truth” claim unverifiable; point this link at the actual workflow file (or remove the specific filename) to avoid stale guidance.

Useful? React with 👍 / 👎.
