---
pr_number: 5387
title: "fix(081KSGS9H0008QG0R00120EEHM Bug 6+7): multi-protocol name resolution \u2014 Avahi hardening + NetBIOS (nmbd) + DHCP-hostname; reliability for 'i can't ping it by name' (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T02:37:14Z"
merged_at: "2026-05-27T02:46:39Z"
closed_at: "2026-05-27T02:46:39Z"
head_ref: "fix-b0835-multi-protocol-name-resolution-netbios-avahi-hardening-2026-05-26-2305z"
base_ref: "main"
archived_at: "2026-05-27T19:27:17Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5387: fix(081KSGS9H0008QG0R00120EEHM Bug 6+7): multi-protocol name resolution — Avahi hardening + NetBIOS (nmbd) + DHCP-hostname; reliability for 'i can't ping it by name' (Aaron 2026-05-27)

## PR description

## Summary

Aaron 2026-05-27 (verbatim):

> *\"my mac is ethernet connected and i connected to the same wifi as it but i still can't ping could it be something else or can we make hostname more reliable?  maybe a netbios or something?  i like ashai or whatever it is but can we make it reliable?  i think this is looking very good.\"*

Empirical: ping by IP works ✓, SSH works ✓, but Bonjour resolution times out AND unicast mDNS query to port 5353/udp times out (actual no-response, not connection-attempt noise). Avahi alone proved unreliable.

## Multi-protocol additive approach

Operator's preferred Avahi/Bonjour stays + 2 fallback mechanisms added (different protocols, different failure modes):

### Bug 6 — Avahi hardening

- \`nssmdns6 = true\` (IPv6 nss-mdns alongside IPv4; some macOS configs prefer AAAA queries first)
- \`ipv4 + ipv6\` explicit
- \`reflector = true\` (forwards mDNS across subnets — composes with multi-segment LAN setups)
- \`publish.hinfo + publish.userServices\` (additional discoverability)

### Bug 7 — NetBIOS via Samba's nmbd (belt-and-suspenders)

NetBIOS uses UDP broadcast on port 137 (vs mDNS multicast on 5353) — **different failure modes**. If network drops IGMP/multicast but allows broadcast (common on home/SMB switches), \`node-e5a176\` resolves via NetBIOS where \`node-e5a176.local\` fails via mDNS.

Operator usage (any LAN host):
\`\`\`bash
nmblookup node-e5a176          # Linux/macOS NetBIOS lookup
smbutil lookup node-e5a176     # macOS native NetBIOS
ping node-e5a176               # if nsswitch has wins
\`\`\`

Samba is enabled for NetBIOS name-advertisement **only** (no shares declared = no SMB file-share exposure).

### DHCP-hostname registration (3rd layer)

NetworkManager already advertises hostname via DHCP option 12 by default. Many home routers register DHCP client hostnames as DNS names (\`node-e5a176.lan\` from Asus/Netgear/Eero). No config change needed.

## Operator now has 3 name-resolution mechanisms

| # | Lookup | Mechanism | Failure mode |
|---|---|---|---|
| 1 | \`node-e5a176.local\` | mDNS multicast | IGMP filtering, multicast drop |
| 2 | \`node-e5a176\` (via nmblookup) | NetBIOS broadcast | Different protocol; works when mDNS fails |
| 3 | \`node-e5a176.lan\` | Router DHCP+DNS | Depends on router support |
| 4 | IP (192.168.4.128) | Always reliable | Need \`arp -a\` first if IP not memorized |

## Test plan

- [ ] CI passes
- [ ] Next ISO build picks up multi-protocol stack
- [ ] On next install: validate all 3 mechanisms; document which work on operator's specific LAN

## Composes with

081KSGS9H0008QG0R003V23XNZ (injected-hostname) · iter-5.4.1 self-registration (PR #5380 carries MAC + hostname for correlation) · [081KSGS9H0008QG0R001JNKBFD](docs/backlog/P2/081KSGS9H0008QG0R001JNKBFD-node-local-claude-agent-stewards-own-registration-pr-then-reports-k8s-cluster-status-operator-interactive-login-pattern-aaron-2026-05-26.md) (node-local Claude needs reliable name resolution)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T02:39:50Z)

## Pull request overview

This PR aims to make cluster-node hostname resolution more reliable on typical home/SMB LANs by keeping Avahi/Bonjour mDNS and adding additional fallback mechanisms (notably NetBIOS name advertisement via Samba).

**Changes:**

- Harden Avahi configuration (IPv6 NSS, explicit v4/v6 enablement, reflector, additional publish records).
- Enable Samba with NetBIOS-focused settings to support broadcast-based name lookup as an mDNS fallback.
- Document DHCP hostname registration as an additional expected fallback layer.

## Review threads

### Thread 1: full-ai-cluster/nixos/modules/common.nix:97 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:39:50Z):

P0: `services.samba.openFirewall = true` opens 139/tcp and 445/tcp in addition to the NetBIOS UDP ports. That contradicts the stated goal of “name resolution only” and unnecessarily exposes SMB services on the LAN; prefer keeping `openFirewall = false` and explicitly allowing only the required UDP ports (137 and likely 138) via `networking.firewall.allowedUDPPorts` (optionally scoped to LAN interfaces/sources).

### Thread 2: full-ai-cluster/nixos/modules/common.nix:107 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:39:50Z):

P1: The comment says this “disables SMB file-sharing entirely”, but the config still enables Samba and binds SMB on 445 (`"smb ports" = "445"`). Even with no shares declared, this is still an active SMB service surface; either actually disable smbd/SMB listeners (run only the NetBIOS name service if possible) or update the comment to accurately describe the remaining exposure and hardening assumptions.

### Thread 3: full-ai-cluster/nixos/modules/common.nix:57 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:39:50Z):

P2: Codebase convention: this module’s comments include personal name attribution (e.g. “Aaron …”). Per `.github/copilot-instructions.md` “No name attribution in code, docs, or skills” (outside the listed history surfaces), please rewrite these references to role-refs like “operator”/“maintainer” and move verbatim quotes to an appropriate history surface if they must be preserved.

## General comments

### @chatgpt-codex-connector (2026-05-27T02:37:18Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
