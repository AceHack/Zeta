---
id: 081M1XYSWV0087G0R000ZFKBTD
type: task
state: backlog
priority: P2
slug: overlay-joins-take-frost-look-with-injected-effects-tpmrm0-i
title: "Overlay joins take frost look with injected effects; tpmrm0 is not present"
created: 2026-09-07T12:52:01.504Z
depends_on: ["081M1WYXT4S087G0R002K1TK4Y"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Overlay joins take frost look with injected effects; tpmrm0 is not present

Aaron 2026-09-06: detect HSM/TPM at setup. The frost look
(`namedProbeFromFrostLook`) maps named effects to a probe.
Overlay frost joins still take a frost *result*, so a caller
can skip the look. Add sibling overlay joins in
`tools/setup/persona-keys/plan-setup-from-frost-look.ts`.
Null effects is unmeasured, not a live look. Do not default
to `realProbeEffects`. `/dev/tpmrm0` is not `present`. A
YubiKey / CCID reader is not CardContact. A PKCS#11 driver
on disk is not an attached YubiHSM. OS family is named, not
inferred. Do not import frost into
`src/Core.TypeScript/cluster/`. Do not call this from
`full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Do
not change ISO bun `probe: null`. Do not land the stanza.
The result joins in `plan-setup-from-frost.ts` stay
result-only and still must not call `probeHardwareSecurity`.

## Pre-start checklist

- Substrate-drift: #16911 on
  `081M1WYXT4S087G0R002K1TK4Y` added
  `named-probe-from-frost-look.ts`. Overlay frost joins in
  `tools/setup/persona-keys/plan-setup-from-frost.ts` still
  take `HardwareProbeResult | null` and do not import the
  look. Cluster must not import
  `frost-hardware-probe.ts` (fs/spawn). ISO bun `probe`
  stays null.
- Prior-art: `namedProbeFromFrostLook` plus
  `planSetupFromFrostEnv` / Argv / Conf. `references/prior-art/`
  not searched recursively.
- Depends on the frost look. Does not depend on calling this
  from `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

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
- Calling `probeHardwareSecurity` from
  `tools/setup/persona-keys/plan-setup-from-frost.ts`.
