---
pr_number: 5105
title: "backlog(081KSGS9H0008QG0R000EDNTY5 P1): role-as-capability composition (NOT baked host) \u2014 single node = control-plane AND gpu AND storage; refactor nixos/hosts/<role>/ \u2192 nixos/modules/role-*.nix capability modules (Aaron 2026-05-26)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T05:45:58Z"
merged_at: "2026-05-26T05:59:27Z"
closed_at: "2026-05-26T05:59:27Z"
head_ref: "otto-cli/b0793-role-as-capability-composition-not-baked-host-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:43:00Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5105: backlog(081KSGS9H0008QG0R000EDNTY5 P1): role-as-capability composition (NOT baked host) — single node = control-plane AND gpu AND storage; refactor nixos/hosts/<role>/ → nixos/modules/role-*.nix capability modules (Aaron 2026-05-26)

## PR description

## Summary

Aaron 2026-05-26 architectural correction during iter-5.2 substrate-engineering:

> *\"since our different roles are multi install you can be control plane AND gpu node AND cpu node these distinctions are not very elegant and host names tied to them are not great either\"*

iter-5.2 (081KSGS9H0008QG0R003V23XNZ PR #5103) addressed the **hostname** side (decoupled via \`injected-hostname.nix\` + \`--host\` flag). This row captures the deeper **role-side** concern: role-stack-as-baked-host-config is the remaining architectural blocker for true multi-role nodes.

## Refactor target

| Today | Target |
|---|---|
| \`nixos/hosts/control-plane/configuration.nix\` | \`nixos/modules/role-control-plane.nix\` (K3S server + Cilium + ArgoCD; NO hostname) |
| \`nixos/hosts/worker-gpu/configuration.nix\` | \`nixos/modules/role-worker-gpu.nix\` (GPU stack + K3S agent; NO hostname) |
| \`nixos/hosts/worker-template/default.nix\` | \`nixos/modules/role-worker-cpu.nix\` (K3S agent; NO hostname) |
| Per-host \`nixosConfigurations\` entries | Single \`node\` config; install-time role-module composition |

## Empirical UX (after refactor lands as iter-5.3)

\`\`\`
zflash --host pikachu --role control-plane
# → Single role

zflash --host charizard --role worker-gpu,control-plane,storage
# → TRIPLE role on one node (homelab persona's typical 1-3 node cluster)

zflash --host bulbasaur --role worker-cpu
# → CPU-only worker
\`\`\`

Default: \`--role control-plane\` (preserves zero-typing single-node UX).

## Composes with

- 081KSGS9H0008QG0R003V23XNZ (depends_on; iter-5.2 hostname-side fix complete; this row picks up role-side)
- 081KSE6WT0008QG0R002275NDE / 081KSGS9H0008QG0R002T3BJ2R / 081KSGS9H0008QG0R00153CQ8B / 081KSE6WT0008QG0R003G0Y62D / 081KSE6WT0008QG0R0004AP0ZA

## Test plan

- [x] Backlog row scoped
- [ ] iter-5.3 implementation PR (next; same session per Aaron's \"land all before next USB flash\")
- [ ] Empirical multi-role install: \`zflash --host X --role control-plane,worker-gpu\` → kubectl shows node with both role-labels

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T05:47:46Z)

## Pull request overview

Adds a new P1 backlog row (081KSGS9H0008QG0R000EDNTY5) describing the next architectural refactor for NixOS role configuration: moving from baked per-host role stacks to composable “role-*” capability modules to support multi-role nodes (e.g., control-plane + GPU + storage on a single machine).

**Changes:**
- Adds `docs/backlog/P1/081KSGS9H0008QG0R000EDNTY5-...md` with the problem statement, target design, sub-targets, and acceptance criteria for role-as-capability composition.
- Updates `docs/BACKLOG.md` to include the new 081KSGS9H0008QG0R000EDNTY5 entry.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/081KSGS9H0008QG0R000EDNTY5-role-as-capability-composition-NOT-baked-host-control-plane-AND-gpu-AND-storage-on-single-node-decouple-roles-from-flake-host-configs-aaron-2026-05-26.md | New backlog row defining the role-module composition refactor scope and acceptance criteria. |
| docs/BACKLOG.md | Adds 081KSGS9H0008QG0R000EDNTY5 to the generated backlog index. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T05:53:08Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

## Review threads

### Thread 1: docs/backlog/P1/081KSGS9H0008QG0R000EDNTY5-role-as-capability-composition-NOT-baked-host-control-plane-AND-gpu-AND-storage-on-single-node-decouple-roles-from-flake-host-configs-aaron-2026-05-26.md:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:47:45Z):

The `<role>` placeholder in this title will be treated as an HTML tag when rendered in markdown (and likely disappears in the generated BACKLOG index). Use an escaped form like `&lt;role&gt;` or a non-angle-bracket placeholder (e.g., `{role}`) to keep the text visible.

### Thread 2: docs/BACKLOG.md:376 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:47:46Z):

`nixos/hosts/<role>/configuration.nix` contains `<role>`, which markdown renders as an HTML tag (so the placeholder can disappear in the rendered BACKLOG). Escape the angle brackets (`&lt;role&gt;`) or use a different placeholder format so it displays correctly.

### Thread 3: docs/backlog/P1/081KSGS9H0008QG0R000EDNTY5-role-as-capability-composition-NOT-baked-host-control-plane-AND-gpu-AND-storage-on-single-node-decouple-roles-from-flake-host-configs-aaron-2026-05-26.md:148 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:53:07Z):

The same quoted sentence is transcribed with two different spellings: earlier it says “not very elegant”, but here it’s “not very eleglant”. Please make the transcription consistent (or mark the typo with “[sic]” if it’s intentional to preserve the original).

### Thread 4: docs/backlog/P1/081KSGS9H0008QG0R000EDNTY5-role-as-capability-composition-NOT-baked-host-control-plane-AND-gpu-AND-storage-on-single-node-decouple-roles-from-flake-host-configs-aaron-2026-05-26.md:56 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:53:08Z):

The markdown table in the “Target” section has an extra leading empty column because each row starts with `|| ...`. Use a single leading `|` so the table renders as intended (`| Today | Target |`, etc.).

## General comments

### @chatgpt-codex-connector (2026-05-26T05:46:03Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
