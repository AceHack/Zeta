---
pr_number: 5091
title: "feat(081KSGS9H0008QG0R002T3BJ2R iter-4.3): zflash stale-checkout detection + auto-download fresh ISO from CI"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T04:51:40Z"
merged_at: "2026-05-26T04:54:30Z"
closed_at: "2026-05-26T04:54:30Z"
head_ref: "otto-cli/iter43-stale-checkout-and-iso-auto-download-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:44:38Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5091: feat(081KSGS9H0008QG0R002T3BJ2R iter-4.3): zflash stale-checkout detection + auto-download fresh ISO from CI

## PR description

## Summary

Closes 2 gaps surfaced by the 2026-05-26 empirical iter-4.2 test run. Per maintainer signals:

- *"any fixes lets make sure they make it in main"*
- *"does the script not auto download the latest?"*
- *"we want to run what a contributor will run"*
- *"no rush we can wait on main we are going for right not fast"*

## Two gaps closed

### Gap 1 — stale-checkout silent failure

When zflash runs from a checkout that's behind `origin/main` on install-substrate files, it executes the OLD code (which doesn't have the iter-4.2 inject step). USB comes out bootable but silently WITHOUT `operator-ssh-keys.txt` populated. Zero-typing target fails for non-obvious reason.

**Fix**: `checkLocalCheckoutFreshness()` — at zflash start:

- `git fetch origin main --quiet` (offline → warn + skip)
- For each `INSTALL_SUBSTRATE_FILES` entry (zflash.ts, flash-usb.ts, zeta-install.sh, flake.nix, 3 nix modules + .txt), run `git diff --quiet HEAD origin/main -- <file>`
- If any file stale → **bail loudly** with specific remediation (`git pull --rebase origin main` or `--skip-freshness-check` escape hatch)

### Gap 2 — stale local ISO

Contributor has to manually `gh run download` fresh CI ISO when the workflow regenerates. Today nobody does this until something breaks.

**Fix**: `autoDownloadFreshIsoIfNeeded()` — after ISO discovery, before flash:

- Queries `gh api .../workflows/build-ai-cluster-iso.yml/runs?branch=main&status=success&per_page=1`
- If latest run's `updated_at` > local newest ISO's mtime, pulls via `gh run download` → walks artifact dir → copies to `~/Downloads/zeta-installer-24.11-ci<run-id>-<date>.iso`
- Skipped when explicit ISO path passed OR `--skip-iso-pull` set
- Offline / gh failure → falls back to local newest with warning

## New flags

- `--skip-freshness-check`: bypass stale-checkout detection (escape hatch; warn)
- `--skip-iso-pull`: bypass CI-ISO auto-download (use local newest)

## Composes with

- iter-4.2 substrate (PRs #5083 / #5086 / #5088) — this is the lessons-learned follow-on from the maintainer's first actual test of that flow
- 081KSE6WT0008QG0R003G0Y62D first-time-CLI-user persona — contributor onboarding flow ("just run zflash") now works without manual ISO-download dance
- 081KSE6WT0008QG0R000RH1526 tier-2 dev experience — Max + Addison onboarding benefits

## Test plan

- [x] zflash --help parses + shows new flags
- [x] Unknown-flag allowlist still bails ([test: `--bogus` → "unknown flag(s): --bogus"])
- [ ] Stale-check end-to-end test: maintainer runs zflash from a checkout behind main → expect loud bail
- [ ] Auto-pull end-to-end test: maintainer deletes local ~/Downloads/zeta-installer-*.iso → expect pull from CI
- [ ] CI passes (gate workflow + CodeQL)

After this lands, the iter-4.2 maintainer test gets a second attempt with auto-protections in place.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T04:54:52Z)

## Pull request overview

Adds iter-4.3 safeguards to the `zflash` macOS USB flasher to prevent two common “stale inputs” failure modes: running an outdated checkout (missing installer-substrate behavior) and flashing an outdated local ISO when CI has produced a newer one.

**Changes:**

- Add a local-checkout freshness gate that fetches `origin/main` and refuses to proceed if install-substrate files differ (with an escape-hatch flag).
- Add CI-backed ISO freshness logic that queries the latest successful workflow run and auto-downloads a newer ISO artifact when needed (with an opt-out flag).
- Extend CLI flag allowlist + `--help` output to include `--skip-freshness-check` and `--skip-iso-pull`.

## Review threads

### Thread 1: full-ai-cluster/tools/zflash.ts:173 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:54:51Z):

P1: `git fetch` failures are treated as “offline” and the real error is discarded. This can mask other causes (e.g., `git` missing, no `origin`, auth failure) and silently skips the safety check. Capture the error message in the warning (or only treat known network failures as “offline”; otherwise bail unless `--skip-freshness-check` is set).

### Thread 2: full-ai-cluster/tools/zflash.ts:192 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:54:51Z):

P0: In the per-file loop, `git diff` errors (exit codes other than 0/1) are skipped silently. That can produce a false “up-to-date” result if a path is wrong, the repo is in a bad state, or `origin/main` isn’t available, which defeats the purpose of the freshness guard. Treat these as a hard failure (or at least warn loudly and include the file in the failure list).

### Thread 3: full-ai-cluster/tools/zflash.ts:205 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:54:52Z):

P1: The error text says the checkout is “behind origin/main”, but the check is a content diff between `HEAD` and `origin/main` and will also fail when the local branch is ahead/diverged. Reword this message (and remediation) to reflect “differs from origin/main” to avoid sending operators down the wrong fix path.

### Thread 4: full-ai-cluster/tools/zflash.ts:247 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:54:52Z):

P2: `dlDir` is a stable `/tmp/zflash-ci-iso-<runId>` path and is never cleaned up. Over time this can clutter `/tmp` and can also reuse a partially-downloaded directory if a previous run was interrupted. Consider using a unique temp dir (e.g., mkdtemp) and removing it in a `finally` block after the ISO is copied (or on any failure).

## General comments

### @chatgpt-codex-connector (2026-05-26T04:51:45Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
