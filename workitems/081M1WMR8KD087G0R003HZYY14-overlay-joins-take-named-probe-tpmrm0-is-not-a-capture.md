---
id: 081M1WMR8KD087G0R003HZYY14
type: task
state: backlog
priority: P2
slug: overlay-joins-take-named-probe-tpmrm0-is-not-a-capture
title: "Overlay joins take named probe; tpmrm0 is not a capture"
created: 2026-09-07T00:37:07.821Z
depends_on: ["081M1WK36Y1087G0R003WT976Y"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Overlay joins take named probe; tpmrm0 is not a capture

Aaron 2026-09-06: detect HSM/TPM at setup; integrate only if
accessible on the physical device. `hostCaptureFromNamedProbe`
landed (#16895). Overlay argv/conf/env joins still take a
`HostHardwareCapture`, so a TypeScript caller can pass
`emptyCapture({ tpm2: "present" })` without naming a probe.
Take `NamedHardwareProbe | null`. Map through
`hostCaptureFromNamedProbe`. Null is unmeasured, not present.
`/dev/tpmrm0` on `tpmDeviceNode` is not `present`. Do not run
the live probe. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16895 (`081M1WK36Y1087G0R003WT976Y`)
  mapped named probe to capture. Overlay joins in
  `src/Core.TypeScript/installer/bao-elf-capture.ts` still
  take `HostHardwareCapture`. `frost-hardware-probe.ts` stays
  in `tools/setup/persona-keys/`; installer overlay must not
  import it (fs/spawn).
- Prior-art: `NamedHardwareProbe` plus overlay env join.
  `references/prior-art/` not searched recursively.
- Depends on the mapper. Does not depend on calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Defaulting a null probe to `absent` / `defaultMetalCapture`.
- Importing `tools/setup/persona-keys/frost-hardware-probe.ts`
  into `src/Core.TypeScript/installer/` or
  `src/Core.TypeScript/cluster/`. extraContainer.
  `yubihsm.nix`.
- Expanding `ZetaFirstbootRole`. Calling overlay join from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Adding the probe to ESP conf / `zeta-first-boot.sh`.
