---
pr_number: 5385
title: "fix(081KSGS9H0008QG0R00120EEHM Bug 4+5 \u2014 Aaron 2026-05-27 control-plane install): storage probe filters 0B devices + gh CLI in installed system PATH"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T02:30:40Z"
merged_at: "2026-05-27T02:33:34Z"
closed_at: "2026-05-27T02:33:34Z"
head_ref: "fix-b0835-storage-probe-filter-zero-size-block-devices-2026-05-26-2233z"
base_ref: "main"
archived_at: "2026-05-27T19:27:19Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5385: fix(081KSGS9H0008QG0R00120EEHM Bug 4+5 — Aaron 2026-05-27 control-plane install): storage probe filters 0B devices + gh CLI in installed system PATH

## PR description

## Summary

Two empirical anchors from Aaron's iter-5.4 install of \`node-e5a176\` (PR #5380 self-registered cleanly) where post-reboot login surfaced two distinct gaps:

### Bug 4 — \`/dev/sda 0B\` zero-size device in node.yaml

Storage probe at zeta-install.sh:781 emitted every block device, including 0-byte placeholders (empty SD card readers, optical bays). Aaron's Intel Core Ultra 9 185H node registered \`/dev/sda 0B\` → Copilot P1 on [PR #5380](https://github.com/Lucent-Financial-Group/Zeta/pull/5380).

Fix: \`awk '\$3==\"disk\" && \$2!=\"0B\"{...}'\` filter excludes zero-size devices.

### Bug 5 — \`gh: command not found\` on first login

Operator: *\"when i log in gh command is not found\"*. Installer ISO had gh (iter-5.4.0 used it for \`gh auth login\` during install) but \`common.nix\` systemPackages didn't include it — auth tokens in \`~/.config/gh\` were stranded without the binary.

Fix: add \`gh\` to \`common.nix\` \`environment.systemPackages\` so the installed system has it for re-auth + ssh-key sync + future register/deregister tooling.

## Test plan

- [ ] CI passes
- [ ] Next ISO build picks up both fixes
- [ ] Future installs register without 0B entries; \`gh\` available on first login

## Composes with

- 081KSGS9H0008QG0R002K93MWX (cluster-node schema), 081KSGS9H0008QG0R002QQNA79 (register-node tool), iter-5.4 install cascade
- PR #5380 (the registration where these gaps surfaced)
- Aaron's empirical observations 2026-05-27: \"i can't ping it by name\" (mitigated via IP lookup; found at 192.168.4.128) → \"when i log in gh command is not found and i don't think it registered\" (registration DID happen — PR #5380 — but no \`gh\` to check it)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T02:30:46Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
