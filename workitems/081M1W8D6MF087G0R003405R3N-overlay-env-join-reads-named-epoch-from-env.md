---
id: 081M1W8D6MF087G0R003405R3N
type: task
state: backlog
priority: P2
slug: overlay-env-join-reads-named-epoch-from-env
title: "Overlay env join reads named epoch from env"
created: 2026-09-06T21:01:22.447Z
depends_on: ["081M1W6J9MH087G0R003VNMDDR"]
composes_with: ["081M1W3BPCN087G0R001R97E45"]
---

# Overlay env join reads named epoch from env

Aaron 2026-09-06: continue after #16856. ISO bun consume names
`ZETA_BAO_ELF_EPOCH='installer-iso'`. `planSetupFromNamedBaoElfEnv`
in `src/Core.TypeScript/installer/bao-elf-capture.ts` still takes
epoch as a TypeScript argument and parses site+path via
`consumeFirstbootBaoElfProcessEnv`. A caller can pass
`installed-host` while ISO env says `installer-iso` (or is
missing) and open the ISO's `/run/current-system/sw/bin/bao` as
option D. Read epoch from env. Do not invent an integrate
decision. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16856 (`081M1W6J9MH087G0R003VNMDDR`)
  names the epoch at ISO bun consume. #16839
  (`081M1W3BPCN087G0R001R97E45`) is the env join. Overlay still
  must not `readFileSync`.
- Prior-art: `consumeFirstbootBaoElfEnvWithEpoch` already
  parses site+path+epoch. `references/prior-art/` not searched
  recursively.
- Depends on the named epoch key. Does not depend on wiring
  this join from `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

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
  Calling this join from `zeta-install.sh`.
