---
id: 081M1WXPCAV087G0R002H1X6VY
type: task
state: backlog
priority: P2
slug: overlay-argv-conf-joins-take-frost-result-tpmrm0-is-not-pres
title: "Overlay argv/conf joins take frost result; tpmrm0 is not present"
created: 2026-09-07T03:13:23.292Z
depends_on: ["081M1WTR4BW087G0R0001NVXWQ"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Overlay argv/conf joins take frost result; tpmrm0 is not present

Aaron 2026-09-06: detect HSM/TPM at setup. Overlay env join
takes a frost result (`081M1WTR4BW087G0R0001NVXWQ`). Argv
and conf overlay joins still take
`NamedHardwareProbe | null`, so a caller could skip the
mapper. Add `planSetupFromFrostArgv` and
`planSetupFromFrostConf` in
`tools/setup/persona-keys/plan-setup-from-frost.ts`.
`/dev/tpmrm0` is not `present`. A YubiKey / CCID reader is
not CardContact. A PKCS#11 driver on disk is not an
attached YubiHSM. Null frost result is unmeasured, not
present. OS family is named, not inferred. Do not run the
live probe. Do not import frost into
`src/Core.TypeScript/cluster/`. Do not call this from
`full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Do
not add the request to ESP conf. Do not change ISO bun
`probe: null`. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16907 (`081M1WTR4BW087G0R0001NVXWQ`)
  joins frost result at the overlay env join. Argv/conf
  siblings still take a named probe. Cluster must not
  import `frost-hardware-probe.ts` (fs/spawn). ISO bun
  `probe` stays null.
- Prior-art: `planSetupFromFrostEnv` plus
  `planSetupFromNamedBaoElfArgv` /
  `planSetupFromNamedBaoElfConf`. `references/prior-art/`
  not searched recursively.
- Depends on the frost env join. Does not depend on
  calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Inferring `smartcardHsm` from a YubiKey / CCID reader.
- Inferring `yubiHsm2: "attached"` from a `.so` on disk.
- Defaulting a null frost result to `absent`.
- Inferring OS family from `/etc/os-release`.
- Importing `tools/setup/persona-keys/frost-hardware-probe.ts`
  into `src/Core.TypeScript/cluster/`. extraContainer.
  `yubihsm.nix`.
- Expanding `ZetaFirstbootRole`. Calling overlay join from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Calling `probeHardwareSecurity` from this join.
  Adding the unseal request to ESP conf.
  Changing ISO bun JSON `probe` away from null.
