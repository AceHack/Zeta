---
id: 081M23BTKYK087G0R002J6E297
type: bug
state: in-progress
priority: P1
slug: t5-zeta-creds-to-k8s-retries-when-kubeconfig-is-missing
title: "T5 zeta-creds-to-k8s retries when kubeconfig is missing"
created: 2026-09-09T15:10:00.000Z
depends_on: []
composes_with: ["081M1PWSF56087G0R000FDS3NY"]
---

# T5 zeta-creds-to-k8s retries when kubeconfig is missing

FIRST-METAL T5. `full-ai-cluster/nixos/modules/zeta-creds-to-k8s.nix`
treats a missing kubeconfig as a named skip (`exit 0`) with
`Type=oneshot` + `RemainAfterExit=true`, so `Restart=on-failure` never
fires and the unit stays `active(exited)` after first boot, when k3s
has not yet written `/etc/rancher/k3s/k3s.yaml`. The header already
claims API-not-ready exits 1. Otto 2026-09-09: this is a check that
did not run wearing the shape of one that passed, and it never retries
when k3s later exists.

## Pre-start checklist

- Substrate-drift: projector + unit exist (`081M1PWSF56087G0R000FDS3NY`,
  `#16587`). The skip loop still lumps kubeconfig with bun/script.
  Not drift.
- Prior-art: systemd `Restart=on-failure` on oneshot only retries
  non-zero; `RemainAfterExit=true` keeps a successful run active.
  Restore unit uses named skip `exit 0` for missing blob/bun — keep
  that for bun/script only.
- Depends on shipped projector. Independent of OpenBao unseal (B7).

## Acceptance

- Missing bun/script: named skip, `exit 0` (same as restore).
- Missing kubeconfig: log + `exit 1` so `Restart=on-failure` /
  `RestartSec=30s` retries.
- Do not `requiredBy k3s`.
- Do not drop `RemainAfterExit` (success stays active).
- Header matches the code.
- Guard in `src/Core.TypeScript/cluster/zeta-creds-to-k8s-nix.test.ts`
  and `full-ai-cluster/nixos/tests/zeta-creds-to-k8s-eval-test.nix`.
