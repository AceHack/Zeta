---
id: 081M1Z36ZJ4087G0R003HFMT2K
type: task
state: backlog
priority: P2
slug: overlay-named-bun-json-join-takes-look-null-look-is-missing
title: "Overlay named bun JSON join takes look; null look is missing-os"
created: 2026-09-07T23:28:19.013Z
depends_on: ["081M1Z1FHDW087G0R00210Z0PG"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Overlay named bun JSON join takes look; null look is missing-os

Aaron 2026-09-06: detect HSM/TPM at setup. Overlay optional
named bun JSON join (`081M1YQKYXQ087G0R000NXN8JN`) treats
null look as unmeasured. Overlay NamedArgv `--from-json`
(`081M1Z1FHDW087G0R00210Z0PG`) treats null look as
`missing-os`. The required bun JSON string join is missing,
so a caller with bun stdout as a string plus bao from env
cannot require OS. Add `planSetupFromFrostLookNamedBunJson`:
uses `look`; JSON `probe` is ignored even when non-null.
Null look is `missing-os`, not unmeasured. Mixing env
frost-look keys with JSON look is `mixed-source`. NamedEnv
still requires OS. `/dev/tpmrm0` is not `real`. Parse is
`tools/setup/persona-keys/named-frost-look.ts`, not the CLI.
Do not write ESP. Do not call this from
`full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Do not
change ISO bun `probe: null`. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16984 (`081M1Z1FHDW087G0R00210Z0PG`)
  landed overlay NamedArgv `--from-json`. Optional bun JSON
  join still treats null look as unmeasured. No required
  bun JSON string join. ISO bun `probe` stays null.
- Prior-art: `planSetupFromFrostLookOptionalNamedBunJson`
  plus NamedArgv `--from-json`. `docs/PRIOR-ART-LIST.md`
  scanned; this is factory overlay join, not an external
  PKCS#11 image. `references/prior-art/` not searched
  recursively.
- Depends on overlay NamedArgv `--from-json`. Does not
  depend on calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Using JSON `probe` even when non-null.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Defaulting missing OS to `nixos`.
- Defaulting missing effects to `realProbeEffects`.
- Changing NamedEnv missing OS into unmeasured.
- Changing NamedBunJson null look into unmeasured.
- Changing ISO bun JSON `probe` away from null.
- Mixing bun JSON look with env frost-look keys.
- Overlay importing `tools/setup/persona-keys/named-frost-look-env.ts`.
- Calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Writing ESP / calling `appendFirstbootBaoElfConf`.
