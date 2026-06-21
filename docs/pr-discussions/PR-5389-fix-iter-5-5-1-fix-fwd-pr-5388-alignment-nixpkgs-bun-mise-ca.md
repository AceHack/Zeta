---
pr_number: 5389
title: "fix(iter-5.5.1 fix-fwd PR #5388 ALIGNMENT): nixpkgs bun \u2192 mise (canonical .mise.toml SSoT); linux.sh NixOS detection; zeta-install.sh invokes tools/setup/install.sh (operator default per 'this is our default')"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T02:50:23Z"
merged_at: "2026-05-27T02:52:53Z"
closed_at: "2026-05-27T02:52:54Z"
head_ref: "fix-iter551-alignment-bun-to-mise-canonical-install-sh-fixfwd-pr-5388-2026-05-26-2353z"
base_ref: "main"
archived_at: "2026-05-27T19:27:16Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5389: fix(iter-5.5.1 fix-fwd PR #5388 ALIGNMENT): nixpkgs bun → mise (canonical .mise.toml SSoT); linux.sh NixOS detection; zeta-install.sh invokes tools/setup/install.sh (operator default per 'this is our default')

## PR description

## Summary

Fix-forward for PR #5388 which merged BEFORE the alignment fix landed. Operator caught the drift:

> *\"future mise we already do this we've drifed for nixos for some reason for bun\"*

> *\"our install.sh for mac and linux this is our default\"*

PR #5388 added \`bun\` via nixpkgs systemPackages on cluster nodes — DRIFTED from the canonical \`.mise.toml\` (line 33: \`bun = \"1.3\"\`) used everywhere else (dev laptops + CI runners + devcontainers per GOVERNANCE §24 three-way-parity).

## 3-surface alignment

1. **common.nix** — \`bun\` removed; replaced with \`mise\` (canonical runtime version manager). mise then installs bun + all other .mise.toml-pinned runtimes for the zeta user.

2. **tools/setup/linux.sh** — added NixOS detection via \`/etc/NIXOS\` marker file. Skips apt step (NixOS handles system packages via common.nix systemPackages declaratively); proceeds to mise + downstream runtime setup. Three-way-parity extended to NixOS per operator framing.

3. **zeta-install.sh Step 6.95a** — replaces inline \`bun install --global\` with invocation of \`tools/setup/install.sh\` from the pre-cloned Zeta repo. Order rearranged: repo clone (was 6.95d) moved into 6.95a-bootstrap so .mise.toml is readable when install.sh fires. Then claude-code install uses mise-managed bun via shim PATH from \`mise activate bash\`.

## Composes with

- [081KSGS9H0008QG0R0031PBNGA](docs/backlog/P1/081KSGS9H0008QG0R0031PBNGA-package-manager-of-package-managers-n-dimensional-dependency-space-holographic-projection-ai-rate-continuous-upstream-negotiation-aaron-2026-05-26.md) (Ace package-manager-of-package-managers — extending install.sh's three-way-parity to NixOS IS Ace at today's bash-glue layer)
- PR #5388 (iter-5.5.0 substrate this fix-fwds)
- \`.mise.toml\` (canonical runtime pins at repo root)
- GOVERNANCE §24 (three-way parity — dev/CI/devcontainer; now extended to NixOS cluster)

## Test plan

- [ ] CI passes
- [ ] Next install on NixOS node validates: \`tools/setup/install.sh\` runs cleanly + installs bun = 1.3 + claude-code lands at ~/.bun/bin/claude

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T02:50:28Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
