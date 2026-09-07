---
id: 081M1YAHFVV087G0R001G2TXRE
type: task
state: backlog
priority: P2
slug: frost-look-cli-conf-takes-named-effects-tpmrm0-is-not-real
title: "Frost look CLI conf takes named effects; tpmrm0 is not real"
created: 2026-09-07T16:17:08.987Z
depends_on: ["081M1Y5WKS2087G0R002Q7ZKS7"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Frost look CLI conf takes named effects; tpmrm0 is not real

Aaron 2026-09-06: detect HSM/TPM at setup. Env and argv CLIs
print a named look. A conf body still had no parse, so a
caller could skip the named-env / argv keys. Add
`consumeFrostLookFromConf` / `runFrostLookConfCli` in
`tools/setup/persona-keys/named-frost-look-env.ts`.
Missing OS is `missing-os`, not default `nixos`. Missing
effects is unmeasured, not a live look. Do not default to
`realProbeEffects`. `/dev/tpmrm0` is not `real` and not an
OS. Do not write ESP. Do not call
`appendFirstbootBaoElfConf`. Do not expand
`ZetaFirstbootRole`. Do not import frost into
`src/Core.TypeScript/cluster/`. Do not call this from
`full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Do
not change ISO bun `probe: null`. Do not call overlay join.
Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16948 (`081M1Y5WKS2087G0R002Q7ZKS7`)
  landed argv `--os` / `--effects`. Conf body is not
  parsed. ISO bun `probe` stays null. Cluster must not
  import `frost-hardware-probe.ts` (fs/spawn).
- Prior-art: `consumeFrostLookFromEnv` /
  `consumeFrostLookFromArgv` plus
  `parseFirstbootBaoElfConf` line-split / unquote shape
  in `src/Core.TypeScript/zflash/firstboot-bao-elf.ts`.
  Duplicate a local unquote; do not import zflash
  conf-write. `references/prior-art/` not searched
  recursively.
- Depends on the argv CLI. Does not depend on calling this
  from `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Does not depend on writing frost-look keys via
  `appendFirstbootBaoElfConf`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Inferring OS from `/etc/os-release`.
- Defaulting missing OS to `nixos`.
- Defaulting missing effects to `realProbeEffects`.
- Mixing `--from-conf` with `--os` / `--effects` or env.
- Writing ESP / calling `appendFirstbootBaoElfConf`.
- Expanding `ZetaFirstbootRole` / `ZetaFirstbootConfig`.
- Calling overlay join. extraContainer. `yubihsm.nix`.
- Calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Changing ISO bun JSON `probe` away from null.
