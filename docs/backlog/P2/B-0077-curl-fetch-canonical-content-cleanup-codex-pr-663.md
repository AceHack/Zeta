---
id: B-0077
priority: P2
status: open
title: tools/setup/common/curl-fetch.sh canonical-content cleanup — Codex P0/P1 on PR #663
effort: S
ask: address Codex P0 (docstring with `curl ... | sh` examples) + P1 (commentary about install paths is inaccurate) on AceHack first, then forward-sync to LFG
created: 2026-04-28
last_updated: 2026-04-28
tags: [pr-663, codex, deferred, acehack-canonical, curl-fetch, install-hardening]
---

# B-0077 — curl-fetch.sh canonical-content cleanup

## Source

Codex review on PR #663 surfaced two findings on `tools/setup/common/curl-fetch.sh`:

- **P0 (line 86)**: docstring/USAGE includes `curl_fetch_stream … | sh` examples. Repo policy forbids pipe-to-shell pattern; even as commentary it's likely to be copied into real usage. Fix: replace with download-to-temp + verify + exec pattern, OR mark as forbidden/deprecated without showing a runnable form.
- **P1 (line 141)**: commentary claims `tools/setup/macos.sh` uses two-gate command-substitution and that `linux.sh`/`elan.sh` are "streamed callers." Empirical state: `macos.sh` uses direct `bash -c "$(curl …)"`, and `elan.sh`/`linux.sh` already download to temp. Fix: update doc to match actual call sites OR defer naming specific scripts.

## Why deferred (not fixed in PR #663)

PR #663 is a pure-additive forward-sync of AceHack-canonical content to LFG. Modifying content during the forward-sync would invert the source-of-truth direction. The canonical fix lands on AceHack first, then forward-syncs.

## Acceptance

- [ ] P0 docstring updated on AceHack to remove pipe-to-shell examples
- [ ] P1 commentary updated on AceHack to match actual call-site state
- [ ] Forward-sync the cleaned-up file to LFG (next sync round)

## Composes with

- PR #663 (the forward-sync that surfaced these via Codex review)
- B-0063 (streamed-installer download-to-temp checksum pattern from Codex P0 on PR #75)
