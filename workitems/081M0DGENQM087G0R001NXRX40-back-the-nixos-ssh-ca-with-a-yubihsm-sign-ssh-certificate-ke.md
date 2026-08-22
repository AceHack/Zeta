---
id: 081M0DGENQM087G0R001NXRX40
type: task
state: backlog
priority: P1
slug: back-the-nixos-ssh-ca-with-a-yubihsm-sign-ssh-certificate-ke
title: "Back the NixOS SSH-CA with a YubiHSM sign-ssh-certificate key: requires Aaron biometric-gated provisioning ceremony"
created: 2026-08-19T17:17:40.980Z
depends_on: []
composes_with: []
---

# Back the NixOS SSH-CA with a YubiHSM sign-ssh-certificate key: requires Aaron biometric-gated provisioning ceremony

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DGENQM087G0R001NXRX40-*.md` glob. -->

## Context

The custom-hardware NixOS fleet's SSH trust anchor is `full-ai-cluster/nixos/modules/ssh-ca.nix`
(`TrustedUserCAKeys`, per-machine certs, `principal=zeta` + validity window). Today the CA private
key is operator-held (umask 077, never in git). The YubiHSM `Sign Ssh Certificate` command (surface
S4 in `docs/research/2026-08-19-what-the-yubihsm-2-firmware-parses-*.md`) is the hardware backing:
the CA key lives below the USB repair boundary, and the device's SSH template enforces the
principal white/black-list and validity offsets INSIDE the trusted firmware boundary, so a
compromised CA host cannot mint an arbitrary-principal or unbounded-lifetime cert.

## Gate — requires Aaron's authorization and a biometric-approved ceremony

This step provisions a real signing key into the HSM for a real trust anchor. The standing rule
(`memory/feedback_nothing_operator_run_only_operator_approved_via_biometric_*`) is: the agent
EXECUTES setup (device init, key generation, template install), the human APPROVES each sensitive
gate via biometric (Hello/Touch-ID). This is NOT the throwaway-device play authorization of
2026-08-19 — it writes a production trust root, so it needs fresh human sign-off at:
- device initialization (replacing the factory "CHANGE THIS ASAP" auth key),
- CA key generation on-device,
- SSH template installation (the principal/validity policy),
- commit of the CA PUBLIC key to git (never the private key / never the wrap key).

## Blocked on
- S4 metered probe (081M0DGEFDE087G0R0032Y3VPG) — do not back a trust anchor with an unmetered parser.
- Aaron's explicit authorization for a production-key ceremony (distinct from the play-device grant).
