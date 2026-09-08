---
id: 081M1YCFES8087G0R000R3MV6Y
type: task
state: backlog
priority: P2
slug: overlay-joins-take-frost-look-keys-from-env-argv-conf-tpmrm0
title: "Overlay joins take frost-look keys from env argv conf; tpmrm0 is not real"
created: 2026-09-07T16:49:00.000Z
depends_on: ["081M1YAHFVV087G0R001G2TXRE"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Overlay joins take frost-look keys from env argv conf; tpmrm0 is not real

Aaron 2026-09-06: detect HSM/TPM at setup. CLI conf consume
landed (`081M1YAHFVV087G0R001G2TXRE`). Overlay look joins
still took a separate OS / effects argument, so a conf body
that already named those keys could be skipped. Lift parse
into `tools/setup/persona-keys/named-frost-look.ts` (no CLI,
no `realProbeEffects`). Overlay
`planSetupFromFrostLookNamedEnv` / Argv / Conf consume the
same keys. Missing OS is `missing-os`, not default `nixos`.
Missing effects is unmeasured. `/dev/tpmrm0` is not `real`.
Do not import the frost-look CLI into overlay. Do not write
ESP. Do not call this from
`full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Do
not change ISO bun `probe: null`. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16954 (`081M1YAHFVV087G0R001G2TXRE`)
  landed CLI `--from-conf`. Overlay Conf join still took
  injected `os` / `fx`. ISO bun `probe` stays null.
- Prior-art: `consumeFrostLookFromConf` plus
  `planSetupFromFrostLookConf`. `references/prior-art/` not
  searched recursively.
- Depends on CLI conf consume. Does not depend on calling
  this from `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Defaulting missing OS to `nixos`.
- Defaulting missing effects to `realProbeEffects`.
- Overlay importing `tools/setup/persona-keys/named-frost-look-env.ts`.
- Writing ESP / calling `appendFirstbootBaoElfConf`.
- Calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Changing ISO bun JSON `probe` away from null.
