---
pr_number: 5345
title: "docs(backlog): 081KSGS9H0008QG0R001Q2DH2H \u2014 installer nmtui WiFi rescan/refresh (empirical from physical hardware-support test 2026-05-26; 20+ overlapping networks)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T22:58:25Z"
merged_at: "2026-05-26T23:00:21Z"
closed_at: "2026-05-26T23:00:21Z"
head_ref: "otto/b-0832-nmtui-wifi-refresh-rescan-overlapping-networks-installer-first-boot-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:30:34Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5345: docs(backlog): 081KSGS9H0008QG0R001Q2DH2H — installer nmtui WiFi rescan/refresh (empirical from physical hardware-support test 2026-05-26; 20+ overlapping networks)

## PR description

## Summary

First empirical UX feedback from operator's physical hardware-support test 2026-05-26 — validates 081KSGS9H0008QG0R0011BC7T2's reframing of physical-test as first-class hardware-compatibility-matrix substrate.

## Issue

Operator framing: \"in the network manager i can refresh wifi connections if i don't see mine initially i have like 20 overlapping networks in my location so i was unable to select the one i wanted but moving foward but we need some sort of way to refresh thoughs?\"

The installer's zeta-first-boot service auto-launches nmtui when no ethernet is detected. In dense-WiFi environments the initial scan may miss the target SSID; nmtui has no obvious rescan path.

## 3-layer mitigation (smallest first)

| Approach | Scope | Code change |
|---|---|---|
| A | Documentation banner before nmtui launch (F5 rescan + Esc re-launch paths) | Banner text in zeta-first-boot.sh |
| B | Pre-scan + post-nmtui re-launch loop in zeta-first-boot.sh | Small loop addition |
| C | Bypass nmtui entirely; prompt-driven nmcli flow | Larger refactor; 0-human-typing-aligned |

P2 priority — UX friction, not hard blocker (operator continued the test via \"moving forward\" workaround).

## Empirical anchor — 081KSGS9H0008QG0R0011BC7T2 validation

This row IS what 081KSGS9H0008QG0R0011BC7T2 predicted: physical hardware-support test surfaces real-world issues that CI emulation cannot reproduce. QEMU has no concept of dense-WiFi channel-contention. The substrate-engineering value of physical-as-hardware-support-test is now empirically validated within one tick of 081KSGS9H0008QG0R0011BC7T2 landing.

## Test plan

- [x] markdownlint clean
- [x] BACKLOG.md regenerated
- [x] Composes_with 081KSGS9H0008QG0R002T3BJ2R (zero-typing first-boot scope) + 081KSGS9H0008QG0R0011BC7T2 (CI cascade #6 + physical-as-hardware-support-test substrate)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T23:01:01Z)

## Pull request overview

Adds a new backlog row (081KSGS9H0008QG0R001Q2DH2H) capturing empirical operator feedback from a physical hardware-support test: dense WiFi environments can cause `nmtui` to miss the target SSID on initial scan, and the installer needs a visible rescan/refresh path.

**Changes:**
- Adds `docs/backlog/P2/081KSGS9H0008QG0R001Q2DH2H...md` describing the issue and outlining three mitigation approaches (A banner, B rescan/relaunch loop, C `nmcli` flow).
- Regenerates/updates `docs/BACKLOG.md` to include the new 081KSGS9H0008QG0R001Q2DH2H entry.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KSGS9H0008QG0R001Q2DH2H-installer-nmtui-wifi-rescan-refresh-button-overlapping-networks-empirical-aaron-2026-05-26-physical-hardware-support-test.md | New P2 backlog row documenting the dense-WiFi `nmtui` rescan UX gap and candidate mitigations. |
| docs/BACKLOG.md | Adds the generated index entry for 081KSGS9H0008QG0R001Q2DH2H under P2. |

## Review threads

### Thread 1: docs/backlog/P2/081KSGS9H0008QG0R001Q2DH2H-installer-nmtui-wifi-rescan-refresh-button-overlapping-networks-empirical-aaron-2026-05-26-physical-hardware-support-test.md:20 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T23:01:00Z):

P1 (xref): This row references `081KSGS9H0008QG0R0011BC7T2` in `composes_with`, but there is no `081KSGS9H0008QG0R0011BC7T2` row/file anywhere in the repo (search across `docs/backlog/**` and `docs/BACKLOG.md` finds none). Either add the missing `081KSGS9H0008QG0R0011BC7T2` row in this PR, or change/remove the reference to the correct existing backlog ID to avoid broken cross-links.

### Thread 2: docs/backlog/P2/081KSGS9H0008QG0R001Q2DH2H-installer-nmtui-wifi-rescan-refresh-button-overlapping-networks-empirical-aaron-2026-05-26-physical-hardware-support-test.md:119 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T23:01:00Z):

P1 (xref): This bullet points to `081KSGS9H0008QG0R0011BC7T2`, but `081KSGS9H0008QG0R0011BC7T2` does not exist in the current repo (no per-row file and not present in `docs/BACKLOG.md`). Update this to the correct existing backlog ID or add the missing row so the "Composes with" section stays linkable/accurate.

## General comments

### @chatgpt-codex-connector (2026-05-26T22:58:31Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T23:02:02Z)

Both threads resolved no-op as stale-false-positives. 081KSGS9H0008QG0R0011BC7T2 row landed via PR #5343 (merge commit `1072f569`) which Copilot reviewed PR #5345 before #5343 merged. Cross-refs are valid on current `main`:

```
$ git ls-tree -r origin/main -- docs/backlog/ | grep 081KSGS9H0008QG0R0011BC7T2
100644 blob 38ea4ac78fdc...	docs/backlog/P1/081KSGS9H0008QG0R0011BC7T2-ci-cascade-6-full-install-plus-cluster-auto-join-eliminate-routine-human-physical-usb-test-aaron-2026-05-26.md
```

Per `.claude/rules/blocked-green-ci-investigate-threads.md` stale-but-fresh-looking-findings subsection: these were TRUE at thread-filing time but became STALE by review-resolution time. No-op resolution.
