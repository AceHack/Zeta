---
id: 081M1Z1FHDW087G0R00210Z0PG
type: task
state: backlog
priority: P2
slug: overlay-named-argv-takes-bun-json-from-json-null-look-is-mis
title: "Overlay named argv takes bun JSON --from-json; null look is missing-os"
created: 2026-09-07T22:58:02.300Z
depends_on: ["081M1YWR8EB087G0R002X0SFX7"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Overlay named argv takes bun JSON --from-json; null look is missing-os

Aaron 2026-09-06: detect HSM/TPM at setup. Overlay optional
named argv takes `--from-json` (`081M1YWR8EB087G0R002X0SFX7`).
Null look is unmeasured. Overlay NamedArgv still only takes
`--os` / `--effects`, so bun stdout on the required argv join
is `missing-os` even when `--from-json` names OS. Extend
`planSetupFromFrostLookNamedArgv`: `--from-json` uses `look`;
JSON `probe` is ignored even when non-null. Null look is
`missing-os`, not unmeasured. Mixing `--from-json` with `--os`
/ `--effects` / `--from-conf` / env frost-look keys is
`mixed-source`. NamedEnv still requires OS. `/dev/tpmrm0` is
not `real`. Parse is `tools/setup/persona-keys/named-frost-look.ts`,
not the CLI. Do not write ESP. Do not call this from
`full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Do not
change ISO bun `probe: null`. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16979 (`081M1YWR8EB087G0R002X0SFX7`)
  landed overlay optional named argv `--from-json`. NamedArgv
  still uses `consumeFrostLookFromArgv` only. ISO bun `probe`
  stays null.
- Prior-art: CLI `consumeFrostLookFromCliArgv` plus overlay
  optional named argv `--from-json`. `docs/PRIOR-ART-LIST.md`
  scanned; this is factory overlay join, not an external
  PKCS#11 image. `references/prior-art/` not searched
  recursively.
- Depends on overlay optional named argv `--from-json`. Does
  not depend on calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Using JSON `probe` even when non-null.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Defaulting missing OS to `nixos`.
- Defaulting missing effects to `realProbeEffects`.
- Changing NamedEnv missing OS into unmeasured.
- Changing NamedArgv `--from-json` null look into unmeasured.
- Changing ISO bun JSON `probe` away from null.
- Mixing `--from-json` with `--os` / `--effects` /
  `--from-conf` / env frost-look keys.
- Overlay importing `tools/setup/persona-keys/named-frost-look-env.ts`.
- Calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Writing ESP / calling `appendFirstbootBaoElfConf`.
