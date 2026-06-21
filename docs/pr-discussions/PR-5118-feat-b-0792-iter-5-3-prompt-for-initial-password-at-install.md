---
pr_number: 5118
title: "feat(081KSGS9H0008QG0R003V23XNZ iter-5.3): prompt-for-initial-password at install-time (not default zeta-change-me); injected-hashedpassword.nix substrate (Aaron 2026-05-26)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T06:59:10Z"
merged_at: "2026-05-26T07:02:41Z"
closed_at: "2026-05-26T07:02:41Z"
head_ref: "otto-cli/iter53-prompt-password-instead-of-default-zeta-change-me-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:41:19Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5118: feat(081KSGS9H0008QG0R003V23XNZ iter-5.3): prompt-for-initial-password at install-time (not default zeta-change-me); injected-hashedpassword.nix substrate (Aaron 2026-05-26)

## PR description

Aaron 2026-05-26: 'also on startup can it ask for me to type a password instead of having a default'. Three changes: (1) zeta-install.sh NEW Step 6.55 prompts via `read -s` + hashes via `mkpasswd -m sha-512 -s` + writes /mnt/etc/zeta/initial-hashedpassword (chmod 0600); (2) initial-password.nix reads injected hash if present, falls back to iter-4.x default hash if absent (CI eval / nixos-rebuild without prior install); (3) installer ISO adds `mkpasswd` to systemPackages. Operator can press Enter to skip + keep default. Composes with iter-5.1+5.2+5.2.2. One type-on-console exception (same as wifi nmtui).

## General comments

### @chatgpt-codex-connector (2026-05-26T06:59:16Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
