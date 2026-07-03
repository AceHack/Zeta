---
pr_number: 5392
title: "feat(081KSKBP80008QG0R003Z4C0D0 Phase 1): zeta-otto systemd unit NixOS module + control-plane enable \u2014 claude service auto-starts on reboot using persisted iter-5.5.0 device-code creds (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T03:04:52Z"
merged_at: "2026-05-27T03:07:59Z"
closed_at: "2026-05-27T03:07:59Z"
head_ref: "feat-b0850-1-zeta-otto-systemd-unit-nixos-module-autostart-on-reboot-2026-05-27-0050z"
base_ref: "main"
archived_at: "2026-05-27T19:27:13Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5392: feat(081KSKBP80008QG0R003Z4C0D0 Phase 1): zeta-otto systemd unit NixOS module + control-plane enable — claude service auto-starts on reboot using persisted iter-5.5.0 device-code creds (Aaron 2026-05-27)

## PR description

## Summary

Aaron 2026-05-27 (verbatim):

> *\"so our usb after gh and claude device code login it should reboot with a claude service using my gh login\"*

Direct composition with iter-5.5.0 substrate (PR #5388 + #5389) which persists creds + pre-clones repo + installs claude. This PR adds the systemd unit so claude auto-starts on reboot AS A SERVICE.

## 3 files

1. **`full-ai-cluster/nixos/modules/zeta-otto.nix`** (NEW) — systemd unit (User=zeta, Restart=always, MemoryMax=4G, CPUQuota=200%); loops claude per tickIntervalSec; deliberately NOT After=k3s.service (Otto must run regardless of k3s state per the \"control plane outside the control plane\" pattern)
2. **`common.nix`** — import the new module (disabled by default)
3. **control-plane/configuration.nix** — \`zeta.otto.enable = true\` opt-in

## Operator usage

\`\`\`bash
systemctl status zeta-otto      # current state
journalctl -u zeta-otto -f      # live logs
systemctl restart zeta-otto     # restart
systemctl disable zeta-otto     # stop auto-start (NCI HC-8 revocable)
\`\`\`

## Operator-tunable options

- \`zeta.otto.enable\` — opt-in per node
- \`zeta.otto.tickIntervalSec\` (default 60) — autonomous-loop cadence
- \`zeta.otto.memoryMax\` (default 4G) — resource bound
- \`zeta.otto.cpuQuota\` (default 200%) — CPU quota
- \`zeta.otto.restartSec\` (default 30) — restart backoff

## Composes with

[081KSGS9H0008QG0R001JNKBFD](docs/backlog/P2/081KSGS9H0008QG0R001JNKBFD-...) (node-local Claude — this PR IS systemd deployment shape) · [081KSGS9H0008QG0R002T0XQ50](docs/backlog/P2/081KSGS9H0008QG0R002T0XQ50-...) (per-AI GitHub identity — Phase 4 aligns) · [081KSGS9H0008QG0R002F04ECB](docs/backlog/P2/081KSGS9H0008QG0R002F04ECB-...) (Twilio out-of-band sibling) · PRs #5388 + #5389 (iter-5.5.0 credential persistence layer this consumes) · [081KSKBP80008QG0R003Z4C0D0](docs/backlog/P2/081KSKBP80008QG0R003Z4C0D0-...) (this PR is the row's Phase 1)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T03:08:31Z)

## Pull request overview

Adds a NixOS module to run “zeta-otto” as a persistent systemd service (outside Kubernetes) and enables it on the control-plane host, relying on the iter-5.5.0 install substrate for persisted `gh`/`claude` credentials and a pre-cloned repo.

**Changes:**

- Introduces `zeta.otto.*` NixOS module options and a `zeta-otto` systemd unit that loops `claude --print` on a tick interval.
- Imports the new module into the shared cluster baseline.
- Opts the control-plane host into running the service at boot.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 7 comments.

| File | Description |
| ---- | ----------- |
| full-ai-cluster/nixos/modules/zeta-otto.nix | New NixOS module defining `zeta-otto` systemd service + options + an operator hint file. |
| full-ai-cluster/nixos/modules/common.nix | Imports the new `zeta-otto` module into the baseline module set. |
| full-ai-cluster/nixos/hosts/control-plane/configuration.nix | Enables `zeta.otto.enable = true` on the control-plane node. |

## Review threads

### Thread 1: full-ai-cluster/nixos/modules/zeta-otto.nix:9 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:08:29Z):

P1 (codebase convention): This comment uses a direct human name ("Aaron"). Per the repo's "No name attribution in code, docs, or skills" rule, current-state code/config should use role references (e.g., "the operator" / "the human maintainer") instead of personal names.

### Thread 2: full-ai-cluster/nixos/modules/zeta-otto.nix:77 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:08:29Z):

P2 (spelling/typo): The comment has a duplicated '#': "# #5389". Consider correcting to a single reference to avoid confusion/markdown-ish rendering issues.

### Thread 3: full-ai-cluster/nixos/modules/zeta-otto.nix:107 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:08:30Z):

P1 (operational): The service PATH omits `/run/wrappers/bin`, which is where NixOS exposes important setuid wrappers like `sudo`. If Otto is expected to perform repair tasks that involve sudo/privileged wrappers, include `/run/wrappers/bin` (and typically `/run/current-system/sw/sbin`) to avoid "command not found" failures.

### Thread 4: full-ai-cluster/nixos/modules/zeta-otto.nix:156 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:08:30Z):

P1 (documentation/ops): The status hint suggests `systemctl disable zeta-otto` to stop auto-start. On NixOS, systemd unit enablement is declarative and may be re-applied on the next `nixos-rebuild switch`; for a durable disable, instruct operators to set `zeta.otto.enable = false;` and rebuild (and optionally mention `systemctl stop zeta-otto` for a temporary stop until rebuild).

### Thread 5: full-ai-cluster/nixos/hosts/control-plane/configuration.nix:24 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:08:30Z):

P1 (codebase convention): This comment block uses a direct human name ("Aaron"). Per the repo's "No name attribution in code, docs, or skills" rule, current-state configuration should use role references instead (e.g., "the operator" / "the human maintainer").

### Thread 6: full-ai-cluster/nixos/hosts/control-plane/configuration.nix:29 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:08:30Z):

P1 (documentation/ops): `systemctl disable zeta-otto` is not a durable opt-out on NixOS because `zeta.otto.enable = true` will be re-applied on rebuild. Prefer documenting the declarative disable path (`zeta.otto.enable = false; nixos-rebuild switch`) and optionally `systemctl stop` for temporary stopping.

### Thread 7: full-ai-cluster/nixos/modules/zeta-otto.nix:128 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:08:31Z):

P1 (operational): The loop suppresses all `claude` failures (`... || true`), which means systemd will consider the service healthy even if every tick fails (e.g., missing binary/creds/network) and `RestartSec` backoff never engages. Consider letting failures terminate the service (or at least exiting after N consecutive failures) so systemd restart/backoff provides a clearer fault signal and avoids endless log spam.

## General comments

### @chatgpt-codex-connector (2026-05-27T03:04:57Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
