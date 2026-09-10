---
id: 081M1W9VW7P087G0R0026A9J6Z
type: task
state: backlog
priority: P2
slug: iso-bun-consume-filters-current-system-bao-at-named-epoch
title: "ISO bun consume filters current-system bao at named epoch"
created: 2026-09-06T21:26:51.894Z
depends_on: ["081M1W8D6MF087G0R003405R3N"]
composes_with: ["081M1W6J9MH087G0R003VNMDDR"]
---

# ISO bun consume filters current-system bao at named epoch

Aaron 2026-09-06: continue after #16860. Overlay env join filters
`NIXOS_HOST_BAO` at `installer-iso`. `consumeFirstbootBaoElfEnvWithEpoch`
in `src/Core.TypeScript/zflash/firstboot-bao-elf.ts` still reports the
sourced ask. ISO bun consume in
`full-ai-cluster/usb-nixos-installer/zeta-install.sh` logs that ask as
named option D. Apply `namedBaoElfAskAtEpoch` when epoch is named so
the JSON ask is null for ISO current-system bao. Missing epoch still
reports the sourced ask (join refuses `empty-epoch`). Do not invent
an integrate decision. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16860 (`081M1W8D6MF087G0R003405R3N`) reads epoch
  from env at overlay join. #16856 (`081M1W6J9MH087G0R003VNMDDR`)
  names `ZETA_BAO_ELF_EPOCH='installer-iso'` at bun consume. Overlay
  still must not `readFileSync`.
- Prior-art: `namedBaoElfAskAtEpoch` already filters the ISO path.
  `references/prior-art/` not searched recursively.
- Depends on the named epoch at consume. Does not depend on wiring
  `planSetupFromNamedBaoElfEnv` from `zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring epoch from `/mnt` or `/dev/tpmrm0`.
- Defaulting a missing epoch to `installed-host`.
- Filling `NIXOS_HOST_BAO` or a `/mnt/run/current-system/...`
  path.
- Opening the ISO current-system bao as option D.
- Inventing `integrateAtSetup`. extraContainer. `yubihsm.nix`.
- Expanding `ZetaFirstbootRole`. Invoking bun from
  `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh`.
  Calling the overlay join from `zeta-install.sh`.
