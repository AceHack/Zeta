---
id: 081KSGS9H0008QG0R001RR3ZXQ
priority: P2
status: open
title: installer must preserve install log to file — failures + warnings scroll past faster than operator can read (empirical from 2026-05-26 physical hardware-support test; gh login not reached) (Aaron 2026-05-26)
effort: S
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R002T3BJ2R
composes_with:
  - 081KSGS9H0008QG0R0011BC7T2
  - 081KSGS9H0008QG0R001Q2DH2H
  - 081KSGS9H0008QG0R003JNSVR5
tags: [installer, first-boot, logging, operator-ux, physical-hardware-support-test, empirical-anchor, scrollback]
---

## Problem

Empirical from operator's 2026-05-26 physical hardware-support test
(third empirical-anchor in the same test session after 081KSGS9H0008QG0R001Q2DH2H nmtui
WiFi rescan + 081KSGS9H0008QG0R003JNSVR5 interactive-vs-baked-keys auth tension):

Operator framing: *"i got some failures and warings on install of
nixos not sure if it matters it scrolled by to faster have gh login
this is exactly what i'm hoping you can log and test in ci"*

Two observations packed into one report:

1. **Install failures + warnings scrolled past too fast for operator
   to read** — `zeta-install` / `nixos-install` / underlying
   nix-build output flows directly to the terminal; under load
   (parallel derivation builds + parallel disko operations + parallel
   nixpkgs evaluation), output rate exceeds human reading speed; ANY
   warnings or recoverable failures get lost in the scroll
2. **gh login not reached** — install presumably stalled OR failed
   before reaching the `gh auth login` step in `zeta-install.sh`; the
   scroll-past-too-fast issue blocks operator's ability to diagnose

The operator's correct framing: *"this is exactly what i'm hoping
you can log and test in ci"* — 081KSGS9H0008QG0R0011BC7T2 cascade #6 phase 1 already
plans to capture full serial console as workflow-artifact. This row
is the OPERATOR-SIDE analog: preserve the log on the install target
so operator can review after the fact, BEFORE 081KSGS9H0008QG0R0011BC7T2 cascade #6
lands.

## Proposed mitigation

Two layered approaches:

### Approach A — `tee` install output to log file (smallest fix)

Modify `zeta-install.sh` to `tee` all output to a log file in /mnt
(install target) AND to a log file in /tmp (live ISO):

```bash
# At top of zeta-install.sh:
LOG_FILE="${LOG_FILE:-/tmp/zeta-install-$(date -u +%Y%m%dT%H%M%SZ).log}"
exec > >(tee -a "$LOG_FILE") 2>&1
```

After install completes (success OR failure), copy the log to:

- `/mnt/var/log/zeta-install.log` (preserved on installed system; available
  after first boot of installed system)
- `/tmp/zeta-install-<timestamp>.log` (available on live ISO until
  reboot; operator can `cat` after `Ctrl-C` to abort + diagnose)

Operator can then:

- During install: `Ctrl-Z` install → background → `tail -f
  /tmp/zeta-install-*.log | less` (scrollable)
- After failure: `cat /tmp/zeta-install-*.log | less`
- After successful install + boot: `journalctl -u zeta-first-boot
  --boot=-1` OR `cat /var/log/zeta-install.log`

### Approach B — `script` command wraps zeta-install entirely

Use `script(1)` to record the full session (input + output + timing):

```bash
# Wrapper that records everything:
script -q /tmp/zeta-install-session.typescript -c '/run/current-system/sw/bin/zeta-install <host>'
```

This captures even ANSI escape sequences + timing data (replayable
via `scriptreplay`). Heavier than `tee` but captures more (TUI
interactions like nmtui screen states).

Approach A is preferred (simpler; smaller code change; sufficient
for the immediate diagnostic need); Approach B is the upgrade path
if Approach A misses anything.

## Acceptance

- Install output is `tee`'d to `/tmp/zeta-install-<timestamp>.log` on
  the live ISO from the moment `zeta-first-boot` fires
- On install completion (success OR failure), log is copied to
  `/mnt/var/log/zeta-install.log` (if `/mnt` is mounted at that point)
- Pre-failure scroll-past failures + warnings are now PRESERVED IN THE
  LOG FILE; operator can review via `less /tmp/zeta-install-*.log`
- Log location named in the existing install-banner text so operator
  sees WHERE the log is BEFORE it scrolls past
- Empirical re-validation: rerun the physical hardware-support test;
  if failures recur, operator can `cat` the log and surface specifics

## Composes with

- `full-ai-cluster/usb-nixos-installer/zeta-install.sh` (the script
  this row modifies)
- `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh` (wrapper
  that calls zeta-install; could set `LOG_FILE` env var)
- 081KSGS9H0008QG0R002T3BJ2R (zero-typing first-boot scope; this row extends with
  preserved-log substrate)
- 081KSGS9H0008QG0R0011BC7T2 (CI cascade #6 phase 1 captures full serial console; this row
  is the OPERATOR-SIDE analog — log preserved on disk so operator can
  review post-failure, BEFORE 081KSGS9H0008QG0R0011BC7T2 cascade #6 lands)
- 081KSGS9H0008QG0R001Q2DH2H (sibling empirical anchor: nmtui WiFi rescan; same physical
  test session)
- 081KSGS9H0008QG0R003JNSVR5 (sibling empirical anchor: interactive-login vs baked-in-keys
  CI-test tension; same physical test session — this row's failure
  blocked reaching the gh-login phase)
- The 2026-05-26 physical hardware-support test (3rd empirical anchor
  in the same test session; validates 081KSGS9H0008QG0R0011BC7T2 reframing of
  physical-as-hardware-support-test producing empirically-anchored
  substrate-engineering targets within minutes)

## Substrate-honest framing

Three empirical anchors in one physical hardware-support test session
(081KSGS9H0008QG0R001Q2DH2H + 081KSGS9H0008QG0R003JNSVR5 + this row 081KSGS9H0008QG0R001RR3ZXQ) is STRONG validation of 081KSGS9H0008QG0R0011BC7T2's
reframing: physical-test-as-first-class-hardware-compatibility-matrix-
substrate produces real-world substrate-engineering targets that CI
emulation cannot reproduce.

The fix is small (tee output to log file) and immediate-value
(operator can diagnose the install failure that prompted this row,
once Approach A lands). P2 priority because it's a diagnostic
enabler, not a hard install blocker.

This row also demonstrates the **operator-side analog** pattern to
the CI-side 081KSGS9H0008QG0R0011BC7T2 cascade #6: both substrate-engineering targets
solve the same fundamental problem (preserve install output for
later review) at different surfaces (operator-physical-test on real
hardware vs CI-automated-test in QEMU). Both are valuable; both
land separately; both compose.
