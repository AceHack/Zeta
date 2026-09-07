---
id: 081M1Y39EJJ087G0R003Z00P0Y
type: task
state: backlog
priority: P2
slug: frost-look-cli-takes-named-effects-tpmrm0-is-not-real
title: "Frost look CLI takes named effects; tpmrm0 is not real"
created: 2026-09-07T14:10:25.490Z
depends_on: ["081M1XYSWV0087G0R000ZFKBTD"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Frost look CLI takes named effects; tpmrm0 is not real

Aaron 2026-09-06: detect HSM/TPM at setup. Overlay look joins
exist. Nobody prints a named look. Add
`tools/setup/persona-keys/named-frost-look-env.ts`. Missing
effects is unmeasured (`probe` null), not a live look. Do
not default to `realProbeEffects`. OS family is named, not
read from `/etc/os-release`. `/dev/tpmrm0` is not `real`
and not an OS. A YubiKey / CCID reader is not CardContact.
Do not import frost into `src/Core.TypeScript/cluster/`. Do
not call this from
`full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Do
not change ISO bun `probe: null`. Do not call overlay join.
Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16911 (`081M1XYSWV0087G0R000ZFKBTD`)
  landed overlay look joins. No CLI prints
  `namedProbeFromFrostLook`. ISO bun `probe` stays null.
  Cluster must not import `frost-hardware-probe.ts`
  (fs/spawn).
- Prior-art: `namedProbeFromFrostLook` plus
  `runFirstbootBaoElfEnvCli` missing-key shape.
  `references/prior-art/` not searched recursively.
- Depends on the overlay look joins. Does not depend on
  calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Inferring `smartcardHsm` from a YubiKey / CCID reader.
- Inferring `yubiHsm2: "attached"` from a `.so` on disk.
- Defaulting missing effects to `realProbeEffects`.
- Inferring OS family from `/etc/os-release`.
- Defaulting missing OS to `nixos`.
- Importing `tools/setup/persona-keys/frost-hardware-probe.ts`
  into `src/Core.TypeScript/cluster/`. extraContainer.
  `yubihsm.nix`.
- Expanding `ZetaFirstbootRole`. Calling this CLI from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Changing ISO bun JSON `probe` away from null.
- Calling overlay join (`planSetupFromFrostLookEnv`) from
  this CLI.
