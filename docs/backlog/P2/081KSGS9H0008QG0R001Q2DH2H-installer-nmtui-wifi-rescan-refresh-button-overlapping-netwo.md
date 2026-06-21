---
id: 081KSGS9H0008QG0R001Q2DH2H
priority: P2
status: open
title: installer nmtui WiFi step needs visible rescan/refresh path — empirical from operator's physical hardware-support test 2026-05-26 (20+ overlapping networks; target SSID not initially in scan list) (Aaron 2026-05-26)
effort: S
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R002T3BJ2R
composes_with:
  - 081KSGS9H0008QG0R0011BC7T2
tags: [installer, first-boot, networkmanager, nmtui, wifi, physical-hardware-support-test, empirical-anchor, operator-ux]
---

## Problem

Empirical from operator's physical hardware-support test 2026-05-26
(the first physical test post-zflash; 081KSGS9H0008QG0R0011BC7T2 reframing —
physical-test-becomes-hardware-support-test in action):

Operator framing: *"in the network manager i can refresh wifi
connections if i don't see mine initially i have like 20 overlapping
networks in my location so i was unable to select the one i wanted but
moving foward but we need some sort of way to refresh thoughs?"*

The installer's zeta-first-boot service (per `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh`)
auto-launches `nmtui` if no ethernet internet is detected. In nmtui's
"Activate a connection" view, the WiFi scan happens at launch and the
list is populated once. In dense-WiFi environments (operator's
location has 20+ overlapping networks), the initial scan may not
include the target SSID — either because the scan completed before the
target AP responded, OR because the dense channel-contention dropped
the target AP's beacon during the scan window.

nmtui has no obvious refresh/rescan button visible in the activate
view. The operator was unable to select their target network on the
first scan. The mitigation operator used: "moving forward" (probably
proceeded with another method, possibly ethernet attempt OR retry).

## Proposed mitigation

Three layered approaches, pick smallest first:

### Approach A — document the existing rescan keybind

Per `nmtui` docs, `<F5>` or `<Ctrl+R>` may trigger rescan in some
versions, OR exiting nmtui + relaunching forces a fresh scan. Add a
banner before nmtui launches:

```text
TIP: If your WiFi network is not in the list, press <F5> to rescan.
     If that does not work, press <Esc> to exit nmtui and the
     installer will re-launch it with a fresh scan.
```

This is documentation-only; no code change beyond the banner text.

### Approach B — pre-scan + re-launch loop in zeta-first-boot

Modify `zeta-first-boot.sh` to:

1. Run `nmcli device wifi rescan` BEFORE launching nmtui (warms up the
   scan list)
2. After nmtui exits, if no connection was established, offer to
   re-launch (with an explicit `nmcli device wifi rescan` between
   launches)

This adds a small loop but eliminates the operator's typing burden if
the first scan misses the target.

### Approach C — bypass nmtui for WiFi entirely; use nmcli directly

Replace the nmtui invocation with a prompt-driven nmcli flow:

1. Run `nmcli device wifi rescan`
2. `nmcli device wifi list` (filtered + sorted by signal strength)
3. Prompt operator for SSID
4. Prompt for password
5. `nmcli device wifi connect <ssid> password <password>`

Removes the nmtui dependency entirely; more controlled UX but more
code in `zeta-first-boot.sh`.

## Acceptance

Approach A acceptance (minimum):

- Banner appears before nmtui launches naming the F5 + Esc re-launch
  paths
- Physical hardware-support test in dense-WiFi environment confirms
  operator can rescan + find target SSID within ~30 seconds

Approach B acceptance (preferred):

- All Approach A criteria
- `nmcli device wifi rescan` runs before nmtui launch (warmed scan
  list)
- If nmtui exits without connection established, re-launch loop fires
  with explicit rescan between launches
- Maximum 3 re-launches before falling back to manual operator
  intervention

Approach C acceptance (deferred):

- Full nmcli-driven WiFi flow replaces nmtui
- Operator types only SSID + password (no nmtui keyboard navigation)
- Composes with broader 0-human-typing direction at install scope

## Composes with

- `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh` (the
  substrate this row touches)
- 081KSGS9H0008QG0R002T3BJ2R (zero-typing first-boot scope; this row extends the
  zero-typing path to dense-WiFi environments)
- 081KSGS9H0008QG0R0011BC7T2 (CI cascade #6 full-install + cluster-auto-join — physical
  hardware-support test that surfaced this issue is exactly the
  reframed role for physical tests per 081KSGS9H0008QG0R0011BC7T2)
- nmtui upstream documentation (verify F5/Ctrl+R keybind across
  nmtui versions on nixpkgs 25.11)
- Physical hardware-support-test as first-class substrate
  (operator-driven; surfaces real-world UX issues like dense-WiFi
  environments that CI cascade #6 cannot emulate)

## Substrate-honest framing

This row is empirically-anchored: operator literally hit the issue
during their physical hardware-support test 2026-05-26 (the test that
081KSGS9H0008QG0R0011BC7T2 reframed as first-class hardware-compatibility-matrix substrate).

The operator's "moving forward" indicates they have a workaround AND
the test continued — the issue is UX friction, not a hard blocker.
P2 priority reflects this: real UX issue worth fixing but doesn't
block the install flow.

The dense-WiFi case (20+ overlapping networks) is increasingly common
(urban density, multi-tenant residential, office buildings) and the
fix benefits any operator in similar environments.

This row IS what 081KSGS9H0008QG0R0011BC7T2 predicted: physical hardware-support test
surfaces real-world issues that CI emulation cannot reproduce (QEMU
has no concept of dense-WiFi channel-contention). The substrate-
engineering value of physical-as-hardware-support-test is now empirically
validated.

## Operational discipline for future-Otto cold-boots

When operator forwards UX feedback from physical hardware-support
test:

1. Capture verbatim (preserve operator framing in row body)
2. Identify the substrate location (script / module / config) the
   issue touches
3. Layer mitigations smallest-first (Approach A → B → C)
4. Note priority based on whether issue blocks vs friction-only
5. Cross-ref to 081KSGS9H0008QG0R0011BC7T2 (physical-as-hardware-support-test substrate)
   so future cold-boots see the empirical anchor pattern
