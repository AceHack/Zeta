---
pr_number: 5423
title: "feat(B-0857 P2 deferred): install.sh becomes universal Unix-like-OS entry \u2014 routes by environment; SHORTER path than B-0854 Ace migration (Aaron 2026-05-27)"
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

# PR #5423: feat(B-0857 P2 deferred): install.sh becomes universal Unix-like-OS entry — routes by environment; SHORTER path than B-0854 Ace migration (Aaron 2026-05-27)

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

## Shorter than B-0854 (Ace migration)

| | B-0857 | B-0854 |
|---|---|---|
| Scope | Routing + factor zeta-install.sh | Declarative manifest + Ace CLI |
| Dependencies | None | B-0288 + manifest design |
| Timeline | 1-2 ISO test cycles | Multi-phase long horizon |

B-0857 ships operator-facing unification at imperative-bash scope. B-0854 builds declarative substrate on top. Both compose; B-0857 doesn't block B-0854 + can ship faster.

## 10 sub-rows enumerated

B-0857.1 audit PR #5389 integration claim → B-0857.2 env-detection → B-0857.3 factor body → B-0857.4 route → B-0857.5-7 compose with adjacent stacks → B-0857.8 thin-wrapper back-compat → B-0857.9 retire wrapper → B-0857.10 empirical validation.

## Composes with

- **B-0854** (Ace migration; Phase 4 builds on top)
- **B-0852** (cred-persistence; OS-agnostic)
- **B-0855** (self-register fix; OS-agnostic)
- **B-0853** (cosign verify; OS-agnostic)
- **B-0833** (installer creds discipline)

## Rule 0 preserved

Install-graph carve-out stays at \`tools/setup/\`; new \`nixos-install-from-usb.sh\` joins it as Linux-NixOS-USB-mode sibling.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T07:52:29Z)

## Pull request overview

Docs-only PR that files a new P2 backlog row (B-0857) capturing the operator's direction to make `tools/setup/install.sh` the universal Unix-like-OS install entry, routing by environment (macOS / Linux-non-NixOS / NixOS-live-USB / installed-NixOS), and shrinking `zeta-install.sh` to a thin wrapper on a shorter path than the broader B-0854 Ace migration. Implementation is deferred; only the row and its index entry land here.

**Changes:**
- Adds `docs/backlog/P2/B-0857-...md` with framing, current state, migration target, 10 enumerated sub-rows, composition with adjacent rows (B-0854/0852/0855/0853/0833), and P2 justification.
- Adds the corresponding open-row entry to `docs/BACKLOG.md` under the P2 section.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/B-0857-...md | New backlog row defining install.sh universal-entry consolidation and 10 sub-rows |
| docs/BACKLOG.md | Index entry pointing at the new B-0857 row |

## General comments

### @chatgpt-codex-connector (2026-05-27T07:49:32Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
