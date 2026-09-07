---
id: 081M1YQKYXQ087G0R000NXN8JN
type: task
state: backlog
priority: P2
slug: overlay-optional-named-join-takes-iso-bun-json-look-json-pro
title: "Overlay optional named join takes ISO bun JSON look; JSON probe is ignored"
created: 2026-09-07T20:05:41.431Z
depends_on: ["081M1YNNVFQ087G0R001J5SEPD"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Overlay optional named join takes ISO bun JSON look; JSON probe is ignored

Aaron 2026-09-06: detect HSM/TPM at setup. ISO bun consume
prints `look` (`081M1YGP8BF087G0R002Z1YH8R`). Overlay
optional named joins take env / argv / conf
(`081M1YNNVFQ087G0R001J5SEPD`). Nobody joins the bun JSON
`look` field, so a later ISO step would have to re-read env
keys the installer does not export. Add a bun-JSON optional
join: `look` null is unmeasured; JSON `probe` is ignored
even when non-null. NamedEnv still requires OS. `/dev/tpmrm0`
is not `real`. Do not import the frost-look CLI. Do not
write ESP. Do not call this from
`full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Do
not change ISO bun `probe: null`. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16968 (`081M1YNNVFQ087G0R001J5SEPD`)
  landed optional named env/argv/conf joins. Overlay still
  has no bun-JSON look join. ISO bun `probe` stays null.
- Prior-art: `consumeOptionalFrostLookFromEnv` plus
  `planSetupFromFrostLookOptionalNamedEnv`.
  `references/prior-art/` not searched recursively.
- Depends on optional named joins. Does not depend on
  calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Using JSON `probe` even when non-null.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Defaulting missing OS to `nixos`.
- Defaulting missing effects to `realProbeEffects`.
- Changing NamedEnv missing OS into unmeasured.
- Changing ISO bun JSON `probe` away from null.
- Mixing bun JSON look with env frost-look keys.
- Overlay importing `tools/setup/persona-keys/named-frost-look-env.ts`.
- Calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Writing ESP / calling `appendFirstbootBaoElfConf`.
