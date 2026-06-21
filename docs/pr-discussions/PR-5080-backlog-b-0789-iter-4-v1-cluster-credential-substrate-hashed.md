---
pr_number: 5080
title: "backlog(081KSGS9H0008QG0R002T3BJ2R): iter-4 v1 cluster credential substrate \u2014 hashedPassword + operator-ssh-keys scaffold (iter-4.2 ships zero-typing auto-inject)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T04:02:20Z"
merged_at: "2026-05-26T04:05:08Z"
closed_at: "2026-05-26T04:05:08Z"
head_ref: "otto-cli/iter4-ssh-password-substrate-b0789-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:44:47Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5080: backlog(081KSGS9H0008QG0R002T3BJ2R): iter-4 v1 cluster credential substrate — hashedPassword + operator-ssh-keys scaffold (iter-4.2 ships zero-typing auto-inject)

## PR description

## Summary

The maintainer 2026-05-26 two-step authorization:

1. *"we can do what's going to make cluster setup eaiser for me and not users if that's ssh lets do that first cause we want to get ai running the cluster asap"* — authorized iter-4 SSH+password work
2. *"i can wait for 4.2 or whatever version before we try again"* — downgraded v1 from "test via re-flash" to "substrate scaffolding for iter-4.2 to build on"

iter-4 v1 ships the Nix-module + per-host-import scaffolding so iter-4.2 (zflash auto-inject + zeta-install.sh USB probe — the maintainer's actually-usable test target) is a tightly-scoped tooling PR rather than a substrate-shape PR.

## Files

- `full-ai-cluster/nixos/modules/initial-password.nix` (new): sha512crypt hash for `zeta-change-me`; operator rotates on first tty1 login via `passwd zeta`. Simplest-first; promote to yescrypt / agenix / sops-nix when repo goes public OR multi-operator isolation becomes load-bearing
- `full-ai-cluster/nixos/modules/operator-ssh-keys.nix` (new): empty stub with edit-and-rebuild workflow documented in the comment header. iter-4.2 OVERWRITES this file at install time from the boot USB
- `full-ai-cluster/nixos/hosts/control-plane/configuration.nix`: imports the two new modules; removes the prior inline empty `authorizedKeys.keys` declaration
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh`: prints initial credentials + post-install workflow block before exit (same echo block works for both v1 manual-edit fallback path and iter-4.2 zero-typing path)
- `docs/backlog/P1/081KSGS9H0008QG0R002T3BJ2R-*.md` (new): captures iter-4 v1 acceptance (scaffolding-only) + iter-4.2 acceptance (zflash auto-inject) + iter-4.3 multi-key extension + iter-5 per-node deploy-key + iter-5+ secret-management substrate promotion paths
- `docs/BACKLOG.md`: regenerated via `BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts`

## Initial password is `zeta-change-me`

Rotate immediately on first tty1 login via `passwd zeta`. Hash format: sha512crypt (`$6$...`). Generated via `openssl passwd -6 'zeta-change-me'`. NixOS reads via `users.users.zeta.hashedPassword`.

## Composes with

- 081KSGS9H0008QG0R002T3BJ2R (iter-3 zero-typing USB install — iter-4 is the credential-substrate follow-on)
- 081KSE6WT0008QG0R003G0Y62D (first-time-CLI-user persona)
- 081KSE6WT0008QG0R0029S1D5Z (Comet Pro IP-KVM — local-console-with-password becomes load-bearing for the IP-KVM substrate)
- 081KSE6WT0008QG0R002275NDE / 081KSE6WT0008QG0R000C18G5D (simplest-first discipline)
- 081KSE6WT0008QG0R000RH1526 (Local Loop tier-3 substrate needs reachable clusters)
- 081KSE6WT0008QG0R0004AP0ZA (commodity hardware reference)
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` Shape A (hashedPassword-in-per-host-module)

## Out of scope (deferred to iter-4.2+)

- zflash auto-inject of SSH key to boot USB
- `zeta-install.sh` USB probe + injection into `operator-ssh-keys.nix`
- Multi-key per-context support (iter-4.3)
- Per-node SSH keypair + GitHub deploy-key registration (iter-5)
- agenix / sops-nix secret-management substrate (iter-5+)
- Worker-template + worker-gpu module imports (v1.1 within this row)

## Test plan

- [x] markdownlint clean
- [x] No tooling change (Nix module structure only); zeta-install.sh print block is the only operator-facing behavioral change
- [x] BACKLOG.md regenerated to pick up 081KSGS9H0008QG0R002T3BJ2R
- [ ] CI passes (gate workflow + CodeQL)

The maintainer will NOT re-flash for v1 (per *"i can wait for 4.2"*); v1 is substrate-engineering housekeeping for the iter-4.2 PR to land cleanly on.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T04:02:26Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
