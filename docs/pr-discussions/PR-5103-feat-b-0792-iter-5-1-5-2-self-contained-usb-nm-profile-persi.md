---
pr_number: 5103
title: "feat(081KSGS9H0008QG0R003V23XNZ iter-5.1+5.2): self-contained USB \u2014 NM-profile persist + Avahi mDNS + per-node hostname injection (decouple from role-stack) (Aaron 2026-05-26)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T05:41:38Z"
merged_at: "2026-05-26T05:51:04Z"
closed_at: "2026-05-26T05:51:04Z"
head_ref: "otto-cli/iter51-wifi-creds-injection-mdns-publishing-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:43:01Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5103: feat(081KSGS9H0008QG0R003V23XNZ iter-5.1+5.2): self-contained USB — NM-profile persist + Avahi mDNS + per-node hostname injection (decouple from role-stack) (Aaron 2026-05-26)

## PR description

## Summary

Aaron 2026-05-26 architectural framings during iter-4.2 empirical test:

> *\"we won't have ethernet for most machines it needs to remember the wifi on setup\"*

> *\"completely self contained usb we already try eth for 30 seconds and then ask for wifi we just need to remember it afterwards\"*

> *\"make any multi node changes we need to like think though mdns names when we have two control planes\"*

> *\"since our different roles are multi install you can be control plane AND gpu node AND cpu node these distinctions are not very elegant and host names tied to them are not great either\"*

Ships **iter-5.1** (wifi persistence + mDNS publishing) + **iter-5.2** (per-node hostname decoupling) in one self-contained-USB substrate update.

## iter-5.1 — NM-profile persistence + Avahi mDNS

\`zeta-install.sh\` copies \`/etc/NetworkManager/system-connections/*.nmconnection\` from live installer to \`/mnt\` before \`nixos-install\` runs → wifi credentials persist across reboot. Existing flow (eth-30s → nmtui-once → connect → install) unchanged; iter-5.1 just makes the installed system inherit the connection. \`common.nix\` enables Avahi mDNS publishing so \`ssh zeta@<hostname>.local\` resolves from operator Mac (Bonjour) + Linux peers (nss-mdns) without IP-discovery step.

## iter-5.2 — per-node hostname injection (decoupled from role-stack)

Three changes:

1. **\`nixos/modules/injected-hostname.nix\`** (NEW): reads \`/etc/zeta/cluster-node-id\` at NixOS eval time + overrides \`networking.hostName\`. If file absent/empty/invalid → flake default stays (backward-compatible)
2. **\`common.nix\`**: imports injected-hostname.nix so every host gets the override capability transitively
3. **\`zflash.ts --host <name>\`**: RFC1123-validated hostname flag; writes \`zeta-hostname.txt\` to USB ESP in same mount session (no extra Touch ID)
4. **\`zeta-install.sh\` Step 6.4**: reads ESP hostname → writes \`/mnt/etc/zeta/cluster-node-id\`

Bug fixed: today every \`--flake .#control-plane\` node gets hostname \"control-plane\"; multi-node collision; mDNS auto-renames second to \"control-plane-2.local\" but underlying NixOS hostname stays \"control-plane\" (confusing in logs/journalctl/kubectl/labels).

Empirical UX:

\`\`\`
# Single-node, zero-typing (today's path; UNCHANGED)
zflash
# → hostname stays 'control-plane'; ssh zeta@control-plane.local

# Multi-node, one short flag per USB
zflash --host pikachu      # → ssh zeta@pikachu.local
zflash --host charizard    # → ssh zeta@charizard.local
zflash --host bulbasaur    # → ssh zeta@bulbasaur.local
# All three install from .#control-plane role-stack
# each gets unique hostname + mDNS announcement; zero flake explosion
\`\`\`

## Out of scope (filed separately as 081KSGS9H0008QG0R000EDNTY5)

The deeper architectural concern Aaron raised — \"role-as-capability composition; one node = control-plane AND gpu-worker AND storage simultaneously\" — requires refactoring \`nixos/hosts/<role>/configuration.nix\` → composable \`nixos/modules/role-*.nix\` capability modules. Filed as 081KSGS9H0008QG0R000EDNTY5 follow-on; substantial refactor; landing as separate iteration.

## Composes with

- iter-4.x (#5080 → ... → #5099) substrate
- 081KSGS9H0008QG0R002T3BJ2R / 081KSGS9H0008QG0R00153CQ8B / 081KSGS9H0008QG0R003V23XNZ / 081KSE6WT0008QG0R003G0Y62D / 081KSE6WT0008QG0R0029S1D5Z

## Test plan

- [x] shellcheck clean on \`zeta-install.sh\`
- [x] TS strict compile clean
- [ ] CI green
- [ ] **Empirical iter-5.1**: re-flash USB; PC1 boot; eth-wait-30s; nmtui-once; install; reboot; \`ssh zeta@control-plane.local\` from operator Mac zero-typing zero-console post-reboot
- [ ] **Empirical iter-5.2**: \`zflash --host pikachu\`; install second node; \`ssh zeta@pikachu.local\` works; two nodes coexist on LAN without mDNS collision

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T05:45:10Z)

## Pull request overview

This PR improves first-boot operability for wifi-only cluster installs by persisting NetworkManager connection profiles from the live installer into the installed system, and by enabling Avahi mDNS publishing so hosts are reachable via `<hostname>.local` without manual IP discovery.

**Changes:**

- Copy `*.nmconnection` profiles from the live ISO (`/etc/NetworkManager/system-connections/`) into the target system (`/mnt/etc/NetworkManager/system-connections/`) before `nixos-install`.
- Enable `services.avahi` with firewall opening and publishing settings in the shared NixOS `common.nix` module.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| full-ai-cluster/usb-nixos-installer/zeta-install.sh | Adds a pre-install step to persist NetworkManager wifi profiles into `/mnt` so the installed system can reconnect automatically. |
| full-ai-cluster/nixos/modules/common.nix | Enables Avahi mDNS publishing to support `ssh zeta@<hostname>.local` hostname-based access on the LAN. |

## Review threads

### Thread 1: full-ai-cluster/usb-nixos-installer/zeta-install.sh:351 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:45:09Z):

P1: This introduces a second "Step 6.5" label (there is already a "Step 6.5" for the iter-4.2 SSH pubkey probe earlier in the script). Renumber this section (and any references) to avoid ambiguous step identifiers in logs/docs.

### Thread 2: full-ai-cluster/usb-nixos-installer/zeta-install.sh:365 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:45:09Z):

P1: This comment includes a personal name ("Aaron") in a non-history surface (installer script). Per repo convention, use role-based attribution (e.g., "the maintainer" / "operator feedback") instead of a specific name here.

### Thread 3: full-ai-cluster/usb-nixos-installer/zeta-install.sh:377 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:45:09Z):

P2: The comment about "nullglob" is inaccurate here (this code uses `find`, not globs). Please reword the comment to match the implementation so future edits don’t rely on a non-existent shell option.

### Thread 4: full-ai-cluster/usb-nixos-installer/zeta-install.sh:394 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:45:10Z):

P2: The SSID extraction uses `awk -F=` and prints only field 2, which will truncate SSIDs containing '=' (valid in 802.11 SSIDs). Consider extracting with "everything after the first 'ssid='" so log output stays accurate for all SSIDs.

## General comments

### @chatgpt-codex-connector (2026-05-26T05:41:48Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
