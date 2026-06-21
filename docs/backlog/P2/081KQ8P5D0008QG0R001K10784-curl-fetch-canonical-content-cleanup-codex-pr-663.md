---
id: 081KQ8P5D0008QG0R001K10784
priority: P2
status: closed
title: tools/setup/common/curl-fetch.sh canonical-content cleanup — Codex P0/P1 on PR #663
effort: S
ask: address Codex P0 (docstring with `curl ... | sh` examples) + P1 (commentary about install paths is inaccurate) on AceHack first, then forward-sync to LFG
created: 2026-04-28
last_updated: 2026-05-10
depends_on: []
tags: [pr-663, codex, deferred, acehack-canonical, curl-fetch, install-hardening]
type: friction-reducer
---

# 081KQ8P5D0008QG0R001K10784 — curl-fetch.sh canonical-content cleanup

## Source

Codex review on PR #663 surfaced two findings on `tools/setup/common/curl-fetch.sh`:

- **P0 (line 86)**: docstring/USAGE includes `curl_fetch_stream … | sh` examples. Repo policy forbids pipe-to-shell pattern; even as commentary it's likely to be copied into real usage. Fix: replace with download-to-temp + verify + exec pattern, OR mark as forbidden/deprecated without showing a runnable form.
- **P1 (line 141)**: commentary claims `tools/setup/macos.sh` uses two-gate command-substitution and that `linux.sh`/`elan.sh` are "streamed callers." Empirical state: `macos.sh` uses direct `bash -c "$(curl …)"`, and `elan.sh`/`linux.sh` already download to temp. Fix: update doc to match actual call sites OR defer naming specific scripts.

## Why deferred (not fixed in PR #663)

PR #663 is a pure-additive forward-sync of AceHack-canonical content to LFG. Modifying content during the forward-sync would invert the source-of-truth direction. The canonical fix lands on AceHack first, then forward-syncs.

## Acceptance

- [x] P0 docstring updated to remove pipe-to-shell examples — resolved by
  081KQ8P5D0008QG0R001DMK8JD (PR #2114, 2026-05-08): `curl_fetch_stream` removed entirely;
  USAGE section replaced with download-to-temp + verify + exec pattern.
- [x] P1 commentary updated to match actual call-site state — resolved by
  081KQ8P5D0008QG0R001DMK8JD (PR #2114, 2026-05-08): "two-gate command-substitution" and
  "streamed callers" language removed; COMMAND-SUBSTITUTION + SET-E
  section now accurately describes download-to-temp + exec for all three
  call sites (macos.sh, linux.sh, elan.sh).
- [x] LFG carries the cleaned-up file — PR #2114 landed directly on LFG
  (AceHack-first workflow was abandoned 2026-05-02; double-hop not required).

## Resolution

Both Codex findings were resolved as a side-effect of 081KQ8P5D0008QG0R001DMK8JD (PR #2114,
merged 2026-05-08). Verified 2026-05-10:

- `curl_fetch_stream` and all pipe-to-shell USAGE examples are gone from
  `tools/setup/common/curl-fetch.sh`.
- All three upstream-installer call sites (macos.sh line 56, linux.sh line 98,
  elan.sh line 44) use `curl_fetch --output` (download-to-temp). No `| sh` or
  `bash -c "$(curl …)"` patterns remain in these files.
- The inaccurate "two-gate command-substitution" commentary at the original
  line 141 is gone; the file now contains one helper (`curl_fetch`) and
  accurate per-section prose.

## Composes with

- PR #663 (the forward-sync that surfaced these via Codex review)
- 081KQ8P5D0008QG0R001DMK8JD (streamed-installer download-to-temp checksum pattern — the PR that
  resolved both findings; PR #2114)
