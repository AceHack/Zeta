---
pr_number: 5102
title: "backlog(081KSGS9H0008QG0R003V23XNZ P1): iter-5 wifi-credentials injection via USB ESP \u2014 homelab persona has NO ethernet; cluster must remember wifi on setup (Aaron 2026-05-26)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T05:38:45Z"
merged_at: "2026-05-26T05:40:43Z"
closed_at: "2026-05-26T05:40:43Z"
head_ref: "otto-cli/b0792-iter5-multi-node-substrate-per-usb-hostname-mdns-cluster-join-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:43:02Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5102: backlog(081KSGS9H0008QG0R003V23XNZ P1): iter-5 wifi-credentials injection via USB ESP — homelab persona has NO ethernet; cluster must remember wifi on setup (Aaron 2026-05-26)

## PR description

## Summary

Aaron 2026-05-26 surfaced the load-bearing substrate gap during iter-4.2 PC1 empirical test:

> *\"we won't have ethernet for most machines it needs to remember the wifi on setup\"*

Today's NixOS install enables NetworkManager but bakes ZERO wifi credentials → first boot has no network on wifi-only mini-PCs (the homelab persona's default hardware). Defeats zero-typing discipline.

## Five sub-targets

1. **zflash extension** — write \`zeta-wifi-credentials.json\` to ESP from operator's \`~/.zeta/wifi-credentials.json\` (or CLI flags / env vars)
2. **zeta-install.sh extension** — read ESP creds + write NetworkManager profile to \`/etc/NetworkManager/system-connections/zeta-wifi.nmconnection\` (chmod 0600)
3. **NixOS config** — NetworkManager wireless backend verify + Avahi mDNS publishing (so \`ssh zeta@control-plane.local\` resolves from operator Mac)
4. **Multi-node hostname selection** — \`--host\` flag → \`zeta-hostname.txt\` on ESP → install picks per-host config
5. **Worker cluster join token** (deferred; downstream of 081KSE6WT0008QG0R002275NDE)

## Empirical anchor

Aaron's PC1 booted iter-4.2-flashed USB; installed; rebooted; came up on console with no wifi configured (NetworkManager + zero creds = no network). \`ssh zeta@control-plane.local\` from operator Mac failed to resolve (no mDNS publishing). Cluster-side workaround would be \`nmtui\` on console (defeats zero-typing). Aaron's call: *\"lets just create another usb we are having cascading failures no need to continue\"* — fix substrate, re-flash with iter-5, retry.

## Composes with

- 081KSGS9H0008QG0R002T3BJ2R (iter-4 SSH+password substrate; depends_on; iter-5 extends ESP-injection pattern)
- 081KSGS9H0008QG0R002T3BJ2R / 081KSE6WT0008QG0R003G0Y62D / 081KSE6WT0008QG0R0029S1D5Z / 081KSE6WT0008QG0R0004AP0ZA / 081KSGS9H0008QG0R00153CQ8B
- \`.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md\` (potential \`_wifi_credentials_acceptance\` block if cluster goes beyond personal homelab)

## Security framing

Wifi password on ESP = plaintext to anyone who can read the partition. Acceptance: homelab + maintainer persona under physical-USB-control assumption. NOT acceptable for shared infrastructure / multi-tenant. Future hardening (encrypted creds + Touch ID gate at boot) out-of-scope this row.

## Out of scope

- Cluster orchestration substrate (k3s vs Talos vs whatever) — 081KSE6WT0008QG0R002275NDE
- Worker join token / control-plane discovery — sub-target 5; deferred
- Encrypted credentials / Touch ID gate — future hardening
- WPA-Enterprise / 802.1X / corporate wifi — not homelab scope

## Test plan

- [x] Backlog row scoped + filed
- [ ] iter-5.1 PR: Avahi mDNS publishing + zflash wifi-creds injection + zeta-install.sh wifi-creds read (next; same session)
- [ ] Empirical: wifi-only mini-PC boots → joins wifi via injected creds → ssh-able via \`<hostname>.local\` with NO console intervention

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T05:38:51Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
