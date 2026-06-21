---
pr_number: 5383
title: "fix(081KSGS9H0008QG0R00120EEHM)+feat(081KSGS9H0008QG0R003X5Y2A5): zeta-install --fallback + nix-timeout tuning (WiFi cache.nixos.org timeout resilience; empirical 5-files-timeout-twice over WiFi)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T02:20:53Z"
merged_at: "2026-05-27T02:30:15Z"
closed_at: "2026-05-27T02:30:15Z"
head_ref: "feat-wifi-fallback-zeta-install-2026-05-26-2150z"
base_ref: "main"
archived_at: "2026-05-27T19:28:46Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5383: fix(081KSGS9H0008QG0R00120EEHM)+feat(081KSGS9H0008QG0R003X5Y2A5): zeta-install --fallback + nix-timeout tuning (WiFi cache.nixos.org timeout resilience; empirical 5-files-timeout-twice over WiFi)

## PR description

## Summary

Aaron's USB install hit \`cache.nixos.org\` timeouts on **same 5 derivations TWICE IN A ROW after 300s each** over WiFi. Default nix invocation loops indefinitely; bounded-fix here adds \`--fallback\` so install switches to local build when substitute download stalls.

Two commits in one PR:

1. **Bounded fix** to \`full-ai-cluster/usb-nixos-installer/zeta-install.sh\`:

   \`\`\`bash
   sudo nixos-install --impure --fallback \\
     --option connect-timeout 10 \\
     --option stalled-download-timeout 60 \\
     --option download-attempts 3 \\
     --flake ... --no-root-password
   \`\`\`

   - \`--fallback\`: build-from-source when substitute download fails
   - \`connect-timeout 10\`: drop dead connections fast (default 0 = infinity)
   - \`stalled-download-timeout 60\`: cut 300s retry burn by 5×
   - \`download-attempts 3\`: cap retries (default 5) so loop progresses to fallback

   Tradeoff: slower for the few stalled derivations (compile vs download) but **UNBLOCKS** the install instead of looping forever.

2. **Substrate-engineering work** tracked at [081KSGS9H0008QG0R003X5Y2A5](docs/backlog/P2/081KSGS9H0008QG0R003X5Y2A5-installer-wifi-reproducibility-cache-nixos-org-timeouts-closure-baking-extra-substituters-cachix-mirror-aaron-2026-05-26.md):
   - Phase 1: closure-baking the canonical full-ai-cluster node closure INTO the ISO at build time (offline-install capability)
   - Phase 2: extra-substituters in nix.conf (nix-community.cachix.org + future self-hosted mirror)
   - Phase 3: home-lab attic/harmonia mirror (cluster self-serves its own derivations over LAN)

## Operator framing

> *"yeah i want to make it reproducable over wifi"*
> *"i got timeouts on the same 5 files"*
> *"twices in a row"*
> *"after 300 seconds"*

The "same 5 files twice in 300s" empirical anchor is what makes this a **structural** problem rather than transient flake.

## Test plan

- [x] Edit applied + commits clean
- [ ] CI build-iso passes (ISO build itself doesn't exercise the install-time \`--fallback\` flag, but should not regress)
- [ ] **Operator validation on next USB flash**: nixos-install no longer loops on the same 5 files; either downloads succeed faster (connect-timeout drops dead connections sooner) or fallback-build kicks in within 60s instead of 300s

## Composes with

- 081KSGS9H0008QG0R001Q2DH2H (nmtui WiFi rescan), 081KSGS9H0008QG0R003JNSVR5 (gh auth), 081KSGS9H0008QG0R001RR3ZXQ (preserve install log), 081KSGS9H0008QG0R00120EEHM (iter-5.4 Bug 1+3b), 081KSGS9H0008QG0R0011BC7T2 cascade #6 (CI testing infrastructure)

Per \`.claude/rules/dep-pin-search-first-authority.md\`: 081KSGS9H0008QG0R003X5Y2A5 Phase 2 substituter URLs + pubkeys MUST WebSearch + verify current values at implementation time.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T02:23:35Z)

## Pull request overview

This PR hardens the USB NixOS installer’s `nixos-install` step against flaky `cache.nixos.org` WiFi downloads by enabling fallback-to-local-build and tightening Nix download timeouts, and it adds a P2 backlog row tracking longer-horizon “WiFi-reproducible install” substrate work.

**Changes:**
- Update `zeta-install.sh` to run `nixos-install` with `--fallback` plus tuned `connect-timeout`, `stalled-download-timeout`, and `download-attempts`.
- Add backlog row **081KSGS9H0008QG0R003X5Y2A5** documenting the observed timeout behavior and a phased mitigation plan (closure baking + extra substituters + mirror).
- Add **081KSGS9H0008QG0R003X5Y2A5** entry to `docs/BACKLOG.md`.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| full-ai-cluster/usb-nixos-installer/zeta-install.sh | Adds bounded Nix download resilience flags to prevent repeated cache timeouts from stalling installs. |
| docs/backlog/P2/081KSGS9H0008QG0R003X5Y2A5-installer-wifi-reproducibility-cache-nixos-org-timeouts-closure-baking-extra-substituters-cachix-mirror-aaron-2026-05-26.md | New P2 row capturing the empirical WiFi timeout issue and outlining phased mitigation work. |
| docs/BACKLOG.md | Adds the 081KSGS9H0008QG0R003X5Y2A5 index entry under P2. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T02:29:57Z)

## Pull request overview

Copilot reviewed 3 out of 3 changed files in this pull request and generated no new comments.

## Review threads

### Thread 1: full-ai-cluster/usb-nixos-installer/zeta-install.sh:995 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:23:34Z):

Comment says the 081KSGS9H0008QG0R003X5Y2A5 backlog row is “to be filed in this PR”, but the row is already present in this PR. This will become stale/incorrect documentation; update wording to just reference 081KSGS9H0008QG0R003X5Y2A5 (no “to be filed”).

### Thread 2: docs/backlog/P2/081KSGS9H0008QG0R003X5Y2A5-installer-wifi-reproducibility-cache-nixos-org-timeouts-closure-baking-extra-substituters-cachix-mirror-aaron-2026-05-26.md:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:23:34Z):

Frontmatter title uses the misspelling “reproducable”. Unless this is meant to be a verbatim quote, use “reproducible” in the backlog title (keeping the original spelling only inside the quoted operator text blocks).

### Thread 3: docs/BACKLOG.md:783 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:23:34Z):

This new BACKLOG index entry includes the misspelling “reproducable”. Prefer “reproducible” in the index/title text (reserve verbatim misspellings for quoted operator excerpts).

### Thread 4: docs/backlog/P2/081KSGS9H0008QG0R003X5Y2A5-installer-wifi-reproducibility-cache-nixos-org-timeouts-closure-baking-extra-substituters-cachix-mirror-aaron-2026-05-26.md:75 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:23:35Z):

The Phase 2 example includes concrete substituter public keys; since this is a backlog/proposal doc and keys/URLs can drift, it’s safer to label these as placeholders that must be verified at implementation time (to avoid copy/paste of potentially stale keys).

## General comments

### @chatgpt-codex-connector (2026-05-27T02:20:56Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
