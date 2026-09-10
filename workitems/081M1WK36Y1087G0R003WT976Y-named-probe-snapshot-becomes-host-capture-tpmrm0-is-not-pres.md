---
id: 081M1WK36Y1087G0R003WT976Y
type: task
state: backlog
priority: P2
slug: named-probe-snapshot-becomes-host-capture-tpmrm0-is-not-pres
title: "Named probe snapshot becomes host capture; tpmrm0 is not present"
created: 2026-09-07T00:08:09.410Z
depends_on: ["081M1WHKEEQ087G0R0002B3SPG"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Named probe snapshot becomes host capture; tpmrm0 is not present

Aaron 2026-09-06: detect HSM/TPM at setup; integrate only if
accessible on the physical device. Overlay joins now read
`ZETA_UNSEAL_REQUEST` from env. Capture is still invented in
tests via `emptyCapture({ tpm2: "present" })`. Map a **named**
probe snapshot to `HostHardwareCapture`. `/dev/tpmrm0` is not
`present`. A YubiKey CCID reader is not CardContact
SmartCard-HSM. A PKCS#11 driver on disk is not an attached
YubiHSM. A null snapshot is unmeasured (`not-asked`), not
`defaultMetalCapture` absent. Do not run the live probe. Do
not call `integrateAtSetup`. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16889 (`081M1WHKEEQ087G0R0002B3SPG`) closed
  argv/conf TypeScript `IntegrateDecision`. Capture is still
  injected. `frost-hardware-probe.ts` stays in
  `tools/setup/persona-keys/`; cluster must not import it
  (fs/spawn).
- Prior-art: `HostHardwareCapture` plus `HardwareProbeResult`.
  `references/prior-art/` not searched recursively.
- Depends on the overlay joins. Does not depend on calling
  this from `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Inferring `smartcardHsm` from a YubiKey / CCID reader.
- Inferring `yubiHsm2: "attached"` from a `.so` on disk.
- Defaulting a null snapshot to `absent`.
- Importing `tools/setup/persona-keys/frost-hardware-probe.ts`
  into `src/Core.TypeScript/cluster/`. extraContainer.
  `yubihsm.nix`.
- Expanding `ZetaFirstbootRole`. Calling overlay join from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
