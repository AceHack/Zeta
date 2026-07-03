---
pr_number: 5388
title: "feat(iter-5.5.0 081KSGS9H0008QG0R001JNKBFD Phase 2 + 081KSGS9H0008QG0R00120EEHM Bug 8): install-time claude-code + interactive claude login + gh+claude credential persistence + Zeta repo pre-clone \u2014 automatic on boot (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T02:40:47Z"
merged_at: "2026-05-27T02:48:21Z"
closed_at: "2026-05-27T02:48:21Z"
head_ref: "feat-iter550-install-time-claude-code-credential-persistence-2026-05-26-2325z"
base_ref: "main"
archived_at: "2026-05-27T19:27:16Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5388: feat(iter-5.5.0 081KSGS9H0008QG0R001JNKBFD Phase 2 + 081KSGS9H0008QG0R00120EEHM Bug 8): install-time claude-code + interactive claude login + gh+claude credential persistence + Zeta repo pre-clone — automatic on boot (Aaron 2026-05-27)

## PR description

## Summary

Aaron 2026-05-27 (verbatim):

> *\"also wanna make this automatic on boot before i even login and have it save my claude code device login like gh, also make sure they are all on path for me to play with when i log in?\"*

> *\"this will be a hell of a start.\"*

And the follow-up clarification:

> *\"avahi yes the mdns and also wi already save the gh login i think maybe but we want to do it for claude code now too\"*

**Empirical finding**: gh credential persistence Aaron \"thinks maybe\" exists — does NOT actually exist. Zero refs to \`.config/gh\` or \`/mnt/home\` in zeta-install.sh; only SSH pubkey copy (different mechanism). This PR fixes BOTH at once.

## iter-5.5.0 = 4-part install step (Step 6.95, runs AFTER nixos-install)

| Sub-step | What | Surfaces |
|---|---|---|
| 6.95a | \`npm install -g @anthropic-ai/claude-code\` to \`/mnt/home/zeta/.npm-global/\` (writable prefix) | claude on PATH post-reboot |
| 6.95b | Interactive \`claude login\` device-flow (mirror iter-5.4.0 gh auth login) | \`/mnt/home/zeta/.config/claude/\` populated |
| 6.95c | Copy \`/root/.config/gh\` → \`/mnt/home/zeta/.config/gh\` (Bug 8 — Aaron's \"i think maybe\" hedge confirmed wrong) | gh auth survives reboot |
| 6.95d | Pre-clone Zeta repo to \`/mnt/home/zeta/Zeta\` | first login: \`cd ~/Zeta && claude\` |

## common.nix additions

- \`nodejs_22\` (npm available for re-install/update without bootstrap)
- \`samba\` (NetBIOS tooling — nmblookup/smbclient — composes with #5387)
- \`NPM_CONFIG_PREFIX=$HOME/.npm-global\` session var
- \`/etc/profile.d/zeta-user-paths.sh\` prepends \`$HOME/.npm-global/bin\` to PATH

## First-login operator gets (no setup)

**On PATH**: gh + claude + kubectl + helm + k9s + argocd + cilium-cli + hubble + nmblookup + smbclient + git + nodejs/npm + standard tools

**In \$HOME**:

- \`~/Zeta/\` (pre-cloned)
- \`~/.config/gh/\` (iter-5.4.0 gh auth persisted)
- \`~/.config/claude/\` (iter-5.5.0 claude login persisted)
- \`~/.npm-global/bin/\` (on PATH)

## Test plan

- [ ] CI passes
- [ ] Next ISO build picks up iter-5.5.0 cascade
- [ ] Next install: validate \`claude login\` survives reboot AND \`gh auth status\` works on first login

## Composes with

iter-5.4 cascade (081KSGS9H0008QG0R0027HJZYH+081KDWV501008QG0R003PCVDHM+081KSGS9H0008QG0R0037H3W4T+081KSGS9H0008QG0R002K93MWX) · [081KSGS9H0008QG0R00120EEHM](docs/backlog/P1/081KSGS9H0008QG0R00120EEHM-...md) (install bug cluster — Bug 4+5+6+7 + Bug 8 here) · [081KSGS9H0008QG0R002T0XQ50](docs/backlog/P2/081KSGS9H0008QG0R002T0XQ50-each-ai-gets-own-github-identity-with-email-once-cluster-operational-substrate-honest-attribution-end-to-end-closes-enabledby-token-owner-not-actor-algo-wink-aaron-2026-05-26.md) (per-AI GitHub identity — this row uses borrowed gh auth until that ratifies) · [081KSGS9H0008QG0R001JNKBFD](docs/backlog/P2/081KSGS9H0008QG0R001JNKBFD-node-local-claude-agent-stewards-own-registration-pr-then-reports-k8s-cluster-status-operator-interactive-login-pattern-aaron-2026-05-26.md) (node-local Claude agent — this row IS Phase 2 automation) · #5387 (multi-protocol name resolution — samba additions compose for NetBIOS tooling)

Per \`.claude/rules/non-coercion-invariant.md\` HC-8: operator interactive YES/n prompt preserves authority over whether to auth at install time vs post-reboot.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T02:43:57Z)

## Pull request overview

This PR extends the NixOS cluster install flow to install Claude Code at install-time, persist both GitHub + Claude credentials into the installed `zeta` user’s home, and pre-clone the Zeta repo so the first interactive login can start work immediately.

**Changes:**

- Add installer Step 6.95 to `zeta-install.sh`: npm-install `@anthropic-ai/claude-code`, optional interactive `claude login`, copy `/root/.config/gh` into the installed home, and pre-clone the repo to `/mnt/home/zeta/Zeta`.
- Update the shared NixOS `common.nix` baseline to include `nodejs_22`, `samba`, and a PATH hook for `~/.npm-global/bin` (plus an attempted `NPM_CONFIG_PREFIX` session variable).

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 6 comments.

| File | Description |
| ---- | ----------- |
| full-ai-cluster/usb-nixos-installer/zeta-install.sh | Adds Step 6.95 for claude-code install, interactive login, gh credential persistence, and repo pre-clone. |
| full-ai-cluster/nixos/modules/common.nix | Adds nodejs + samba packages and user PATH/session env wiring intended to make `claude` usable on first login. |

### COMMENTED — @AceHack (2026-05-27T02:46:00Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-27T02:46:02Z)

_(no body)_

## Review threads

### Thread 1: full-ai-cluster/usb-nixos-installer/zeta-install.sh:1069 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:43:55Z):

P0 (bug): Step 6.95 hard-codes `ZETA_UID=1000` and `ZETA_GID=100`. If the installed `zeta` user ends up with different IDs (e.g., another user is created first, or GID differs), this will chown files to the wrong owner and `sudo -u "#1000"` will run as a UID that isn’t the `zeta` account post-reboot. Resolve UID/GID from the installed system (e.g., parse `/mnt/etc/passwd`+`/mnt/etc/group` or `chroot /mnt id -u zeta` / `id -g zeta`) before using them.

### Thread 2: full-ai-cluster/usb-nixos-installer/zeta-install.sh:1102 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:43:56Z):

P0 (security): This step locks down `~/.config/gh`, but does not restrict permissions on `~/.config/claude` after `claude login`. If the CLI writes tokens/config with default umask, credentials may remain group/world-readable in the installed home directory. After a successful login, ensure `$ZETA_HOME/.config/claude` is owned by the zeta user and chmod’d similarly (e.g., remove group/other perms).

### Thread 3: full-ai-cluster/usb-nixos-installer/zeta-install.sh:1084 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:43:56Z):

P1 (bug/maintainability): `npm install -g` is executed as root with `HOME="$ZETA_HOME"`. npm commonly creates additional state under `$HOME` (e.g., cache dirs / config files) which may become root-owned and later break npm usage for the `zeta` user post-reboot. Prefer running npm as the target user (`sudo -u "#<zeta_uid>" HOME=... NPM_CONFIG_PREFIX=... npm install -g ...`) so all created files are owned correctly without needing broad `chown -R` repairs.

**@AceHack** (2026-05-27T02:46:00Z):

Stale — Aaron caught the nodejs/npm violation of Rule 0 (`.claude/rules/rule-0-no-sh-files.md`) and commit `7f3e29f1d` migrated to `sudo -u "#$ZETA_UID" bun install --global` (bun is canonical TS/JS runtime in Zeta). Current HEAD already uses target-user sudo + `bun install --global`. Resolving no-op.

### Thread 4: full-ai-cluster/usb-nixos-installer/zeta-install.sh:1041 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:43:56Z):

P2 (documentation): The “Skip conditions” list mentions `GH_AUTH_OK != 1`, but Step 6.95 currently only checks whether `$ZETA_HOME` exists and otherwise proceeds regardless of `GH_AUTH_OK`. Either implement the guard (if intended) or update the comment so it matches the actual skip logic.

### Thread 5: full-ai-cluster/nixos/modules/common.nix:143 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:43:56Z):

P1 (bug): `environment.sessionVariables.NPM_CONFIG_PREFIX = "$HOME/.npm-global"` will be set literally (no `$HOME` expansion), and the comment below already notes this expansion problem. As-is, npm will see a prefix containing the characters `$HOME` rather than an absolute path. Move the `NPM_CONFIG_PREFIX` export into the `/etc/profile.d` snippet (or set an absolute path) so it expands correctly for login shells.

**@AceHack** (2026-05-27T02:46:01Z):

Stale — same bun-migration commit `7f3e29f1d` replaced `NPM_CONFIG_PREFIX = "$HOME/.npm-global"` with `BUN_INSTALL = "$HOME/.bun"`. Per NixOS docs `environment.sessionVariables`: "Values can refer to other environment variables using the $VAR or ${VAR} syntax" — NixOS DOES expand $HOME for sessionVariables (it generates `export VAR="$HOME/..."` in /etc/profile.d snippets where shell expansion fires at source time). Resolving no-op.

### Thread 6: full-ai-cluster/nixos/modules/common.nix:118 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:43:57Z):

P2 (documentation): The comment says this `samba` package “composes with services.samba below”, but this module does not configure `services.samba`. Consider updating the comment to reference the actual module that enables Samba/nmbd (or reword to avoid implying it’s configured here).

## General comments

### @chatgpt-codex-connector (2026-05-27T02:40:53Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
