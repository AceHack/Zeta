---
id: 081M1YNNVFQ087G0R001J5SEPD
type: task
state: backlog
priority: P2
slug: overlay-optional-named-joins-match-iso-bun-missing-frost-loo
title: "Overlay optional named joins match ISO bun missing frost-look keys; probe stays null"
created: 2026-09-07T19:31:46.295Z
depends_on: ["081M1YGP8BF087G0R002Z1YH8R"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Overlay optional named joins match ISO bun missing frost-look keys; probe stays null

Aaron 2026-09-06: detect HSM/TPM at setup. ISO bun consume
reports `look` (`081M1YGP8BF087G0R002Z1YH8R`). Overlay
`planSetupFromFrostLookNamedEnv` still refuses missing OS,
so the same env ISO bun treats as unmeasured cannot join.
Add optional named joins: missing both frost-look keys is
unmeasured (`probe` null), not `missing-os`. NamedEnv still
requires OS. `/dev/tpmrm0` is not `real`. Do not import the
frost-look CLI. Do not write ESP. Do not call this from
`full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Do
not change ISO bun `probe: null`. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16963 (`081M1YGP8BF087G0R002Z1YH8R`)
  landed ISO bun `look`. Overlay NamedEnv still
  `missing-os` when frost-look keys are absent.
- Prior-art: `consumeOptionalFrostLookFromEnv` plus
  `planSetupFromFrostLookNamedEnv`. `references/prior-art/`
  not searched recursively.
- Depends on ISO bun look report. Does not depend on
  calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Defaulting missing OS to `nixos`.
- Defaulting missing effects to `realProbeEffects`.
- Changing NamedEnv missing OS into unmeasured.
- Changing ISO bun JSON `probe` away from null.
- Overlay importing `tools/setup/persona-keys/named-frost-look-env.ts`.
- Calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Writing ESP / calling `appendFirstbootBaoElfConf`.
