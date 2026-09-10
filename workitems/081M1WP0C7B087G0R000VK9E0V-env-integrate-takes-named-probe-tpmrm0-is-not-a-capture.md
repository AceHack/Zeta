---
id: 081M1WP0C7B087G0R000VK9E0V
type: task
state: backlog
priority: P2
slug: env-integrate-takes-named-probe-tpmrm0-is-not-a-capture
title: "Env integrate takes named probe; tpmrm0 is not a capture"
created: 2026-09-07T00:59:02.251Z
depends_on: ["081M1WMR8KD087G0R003HZYY14"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Env integrate takes named probe; tpmrm0 is not a capture

Aaron 2026-09-06: detect HSM/TPM at setup; integrate only if
accessible on the physical device. Overlay joins now take
`NamedHardwareProbe | null` (#16898) and map in
`src/Core.TypeScript/installer/bao-elf-capture.ts`.
`integrateAtSetupFromEnv` in
`src/Core.TypeScript/cluster/unseal-path.ts` still takes
`HostHardwareCapture`, so a TypeScript caller can pass
`emptyCapture({ tpm2: "present" })` without naming a probe.
Take `NamedHardwareProbe | null`. Map through
`hostCaptureFromNamedProbe`. Null is unmeasured, not present.
`/dev/tpmrm0` on `tpmDeviceNode` is not `present`. Overlay
passes the probe through. Inner `integrateAtSetup` still
takes a capture. Do not run the live probe. Do not land the
stanza.

## Pre-start checklist

- Substrate-drift: #16898 (`081M1WMR8KD087G0R003HZYY14`)
  closed overlay TypeScript `HostHardwareCapture`. Env
  integrate still takes a capture. `frost-hardware-probe.ts`
  stays in `tools/setup/persona-keys/`; cluster must not
  import it (fs/spawn).
- Prior-art: `integrateAtSetupFromEnv` plus
  `NamedHardwareProbe`. `references/prior-art/` not searched
  recursively.
- Depends on the overlay join. Does not depend on calling
  this from `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Defaulting a null probe to `absent` / `defaultMetalCapture`.
- Importing `tools/setup/persona-keys/frost-hardware-probe.ts`
  into `src/Core.TypeScript/cluster/`. extraContainer.
  `yubihsm.nix`.
- Expanding `ZetaFirstbootRole`. Calling overlay join from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Adding the probe to ESP conf / `zeta-first-boot.sh`.
