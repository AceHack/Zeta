---
pr_number: 5423
title: "feat(081KSKBP80008QG0R002J03WGA P2 deferred): install.sh becomes universal Unix-like-OS entry \u2014 routes by environment; SHORTER path than 081KSKBP80008QG0R002VRN56K Ace migration (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T07:49:27Z"
merged_at: "2026-05-27T07:53:40Z"
closed_at: "2026-05-27T07:53:40Z"
head_ref: "backlog/b-0857-install-sh-universal-unix-entry-consolidation-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:25:11Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5423: feat(081KSKBP80008QG0R002J03WGA P2 deferred): install.sh becomes universal Unix-like-OS entry — routes by environment; SHORTER path than 081KSKBP80008QG0R002VRN56K Ace migration (Aaron 2026-05-27)

## PR description

## Summary

Operator-named direction: *"when are we moving to install.sh over zeta-install.sh? the universall install surface for unix like oses?"*

Filed immediately per Aaron 2026-05-27 separation-of-concerns discipline. Implementation defers until current cred-persistence + cosign + self-register stack lands + next USB test validates.

## Migration target

\`tools/setup/install.sh\` becomes universal Unix-like-OS entry that ROUTES by environment:

| Detect | Routes to |
|---|---|
| macOS (Darwin) | \`setup/macos.sh\` (dev env) |
| Linux non-NixOS | \`setup/linux.sh\` (dev env) |
| Linux NixOS live-USB | \`setup/nixos-install-from-usb.sh\` (factored zeta-install.sh body) |
| Installed NixOS | runtime verify / update |

## Shorter than 081KSKBP80008QG0R002VRN56K (Ace migration)

| | 081KSKBP80008QG0R002J03WGA | 081KSKBP80008QG0R002VRN56K |
|---|---|---|
| Scope | Routing + factor zeta-install.sh | Declarative manifest + Ace CLI |
| Dependencies | None | 081KR2E4K0008QG0R002YE3MMD + manifest design |
| Timeline | 1-2 ISO test cycles | Multi-phase long horizon |

081KSKBP80008QG0R002J03WGA ships operator-facing unification at imperative-bash scope. 081KSKBP80008QG0R002VRN56K builds declarative substrate on top. Both compose; 081KSKBP80008QG0R002J03WGA doesn't block 081KSKBP80008QG0R002VRN56K + can ship faster.

## 10 sub-rows enumerated

081KSKBP80008QG0R002EKF67B audit PR #5389 integration claim → 081KSKBP80008QG0R002J03WGA.2 env-detection → 081KSKBP80008QG0R002J03WGA.3 factor body → 081KSKBP80008QG0R002J03WGA.4 route → 081KSKBP80008QG0R002J03WGA.5-7 compose with adjacent stacks → 081KSKBP80008QG0R002J03WGA.8 thin-wrapper back-compat → 081KSKBP80008QG0R002J03WGA.9 retire wrapper → 081KSKBP80008QG0R002J03WGA.10 empirical validation.

## Composes with

- **081KSKBP80008QG0R002VRN56K** (Ace migration; Phase 4 builds on top)
- **081KSKBP80008QG0R003AX2A69** (cred-persistence; OS-agnostic)
- **081KSKBP80008QG0R000GPC0TB** (self-register fix; OS-agnostic)
- **081KSKBP80008QG0R000Y2B7HC** (cosign verify; OS-agnostic)
- **081KSGS9H0008QG0R003JNSVR5** (installer creds discipline)

## Rule 0 preserved

Install-graph carve-out stays at \`tools/setup/\`; new \`nixos-install-from-usb.sh\` joins it as Linux-NixOS-USB-mode sibling.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T07:52:29Z)

## Pull request overview

Docs-only PR that files a new P2 backlog row (081KSKBP80008QG0R002J03WGA) capturing the operator's direction to make `tools/setup/install.sh` the universal Unix-like-OS install entry, routing by environment (macOS / Linux-non-NixOS / NixOS-live-USB / installed-NixOS), and shrinking `zeta-install.sh` to a thin wrapper on a shorter path than the broader 081KSKBP80008QG0R002VRN56K Ace migration. Implementation is deferred; only the row and its index entry land here.

**Changes:**

- Adds `docs/backlog/P2/081KSKBP80008QG0R002J03WGA-...md` with framing, current state, migration target, 10 enumerated sub-rows, composition with adjacent rows (081KSKBP80008QG0R002VRN56K/0852/0855/0853/0833), and P2 justification.
- Adds the corresponding open-row entry to `docs/BACKLOG.md` under the P2 section.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KSKBP80008QG0R002J03WGA-...md | New backlog row defining install.sh universal-entry consolidation and 10 sub-rows |
| docs/BACKLOG.md | Index entry pointing at the new 081KSKBP80008QG0R002J03WGA row |

## General comments

### @chatgpt-codex-connector (2026-05-27T07:49:32Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
