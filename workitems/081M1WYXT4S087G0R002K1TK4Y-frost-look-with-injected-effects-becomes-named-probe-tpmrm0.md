---
id: 081M1WYXT4S087G0R002K1TK4Y
type: task
state: backlog
priority: P2
slug: frost-look-with-injected-effects-becomes-named-probe-tpmrm0
title: "Frost look with injected effects becomes named probe; tpmrm0 is not present"
created: 2026-09-07T03:34:55.386Z
depends_on: ["081M1WXPCAV087G0R002H1X6VY"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Frost look with injected effects becomes named probe; tpmrm0 is not present

Aaron 2026-09-06: detect HSM/TPM at setup. Overlay joins take
a frost result. Nobody runs frost with named effects into
`namedProbeFromFrostResult`. Add `namedProbeFromFrostLook`
in `tools/setup/persona-keys/named-probe-from-frost-look.ts`.
Null effects is unmeasured, not a live look. Do not default
to `realProbeEffects`. `/dev/tpmrm0` is not `present`. A
YubiKey / CCID reader is not CardContact. A PKCS#11 driver
on disk is not an attached YubiHSM. OS family is named, not
inferred. Do not import frost into
`src/Core.TypeScript/cluster/`. Do not call this from
`full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Do
not change ISO bun `probe: null`. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16909 (`081M1WXPCAV087G0R002H1X6VY`)
  joins frost result at argv/conf overlay. The mapper still
  does not run frost. Cluster must not import
  `frost-hardware-probe.ts` (fs/spawn). ISO bun `probe`
  stays null.
- Prior-art: `probeHardwareSecurity` plus
  `namedProbeFromFrostResult`. `references/prior-art/` not
  searched recursively.
- Depends on the frost overlay joins. Does not depend on
  calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Inferring `smartcardHsm` from a YubiKey / CCID reader.
- Inferring `yubiHsm2: "attached"` from a `.so` on disk.
- Defaulting null effects to `realProbeEffects`.
- Inferring OS family from `/etc/os-release`.
- Importing `tools/setup/persona-keys/frost-hardware-probe.ts`
  into `src/Core.TypeScript/cluster/`. extraContainer.
  `yubihsm.nix`.
- Expanding `ZetaFirstbootRole`. Calling this look from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Changing ISO bun JSON `probe` away from null.
