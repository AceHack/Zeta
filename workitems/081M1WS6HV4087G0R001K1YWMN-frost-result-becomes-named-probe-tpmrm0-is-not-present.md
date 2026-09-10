---
id: 081M1WS6HV4087G0R001K1YWMN
type: task
state: backlog
priority: P2
slug: frost-result-becomes-named-probe-tpmrm0-is-not-present
title: "Frost result becomes named probe; tpmrm0 is not present"
created: 2026-09-07T01:54:50.341Z
depends_on: ["081M1WQNTZ0087G0R002Q8T8RT"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Frost result becomes named probe; tpmrm0 is not present

Aaron 2026-09-06: detect HSM/TPM at setup. Overlay and env
integrate take `NamedHardwareProbe | null`. ISO bun reports
`probe: null`. `HardwareProbeResult` in
`tools/setup/persona-keys/frost-hardware-probe.ts` is still
not a named probe. Map a frost result to
`NamedHardwareProbe`. `/dev/tpmrm0` is not `present`. A
YubiKey / CCID reader is not CardContact. A PKCS#11 driver
on disk is not an attached YubiHSM. Null frost result is
unmeasured, not absent. OS family is named, not inferred.
Do not run the live probe. Do not import frost into
`src/Core.TypeScript/cluster/`. Do not call this from
`full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Do
not land the stanza.

## Pre-start checklist

- Substrate-drift: #16903 (`081M1WQNTZ0087G0R002Q8T8RT`)
  reports `probe: null` at ISO bun consume. Frost still has
  no mapper into `NamedHardwareProbe`. Cluster must not
  import `frost-hardware-probe.ts` (fs/spawn).
- Prior-art: `HardwareProbeResult` plus `NamedHardwareProbe`.
  `references/prior-art/` not searched recursively.
- Depends on bun reporting an unmeasured probe. Does not
  depend on calling this from
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
  Calling `probeHardwareSecurity` from this mapper.
