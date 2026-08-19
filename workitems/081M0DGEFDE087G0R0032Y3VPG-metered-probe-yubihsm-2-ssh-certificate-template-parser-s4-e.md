---
id: 081M0DGEFDE087G0R0032Y3VPG
type: task
state: backlog
priority: P1
slug: metered-probe-yubihsm-2-ssh-certificate-template-parser-s4-e
title: "Metered probe: YubiHSM 2 SSH-certificate template parser (S4) end-to-end + mutation campaign"
created: 2026-08-19T17:17:34.510Z
depends_on: []
composes_with: []
---

# Metered probe: YubiHSM 2 SSH-certificate template parser (S4) end-to-end + mutation campaign

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DGEFDE087G0R0032Y3VPG-*.md` glob. -->

## Context

Surface S4 in `docs/research/2026-08-19-what-the-yubihsm-2-firmware-parses-*.md` — the deepest
parser on the device and currently `unmetered`. `Sign Ssh Certificate` parses TWO nested
structures inside the firmware (SSH Template TLV: tags 0x01-0x06; SSH Certificate Request in
`ssh-rsa-cert-v01@openssh.com` wire format) and then makes an authorization decision on the parsed
caller-supplied data (timestamp-signature verify, CA-key white-list, validity-window offset check,
principal black-list). Two wire-format parsers plus an in-firmware policy engine, below the
(non-existent) firmware-update boundary.

## Falsifier / next step (device access, throwaway device already authorized 2026-08-19)

1. Build a valid signed request end-to-end (`yubihsm-ssh-tool` + a timestamp-signing authority);
   confirm the happy path signs.
2. Structured mutation campaign: mutate template TLV (bad tag lengths, overlong CA white-list,
   empty/oversized principal black-list) and the cert-request (out-of-window timestamps, principals
   on the black-list, malformed cert wire format). Assert the SPECIFIC device response code per
   mutation, with a positive control (a valid request signing) in the same run — a negative test
   with no positive control is the vacuity class (#12178 methodology).
3. Record which mutations the DEVICE rejects vs which the client-side tool rejects first (the
   opaque-x509 finding S7 showed the two-layer split matters).

## Why P1
It is the enforcement point for the NixOS SSH-CA (081M0DGENQM087G0R001NXRX40). Do not back a fleet
trust anchor with an unmetered parser.
