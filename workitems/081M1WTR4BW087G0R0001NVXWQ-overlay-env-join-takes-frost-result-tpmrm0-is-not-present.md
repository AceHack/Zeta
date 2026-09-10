---
id: 081M1WTR4BW087G0R0001NVXWQ
type: task
state: backlog
priority: P2
slug: overlay-env-join-takes-frost-result-tpmrm0-is-not-present
title: "Overlay env join takes frost result; tpmrm0 is not present"
created: 2026-09-07T02:21:54.941Z
depends_on: ["081M1WS6HV4087G0R001K1YWMN"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Overlay env join takes frost result; tpmrm0 is not present

Aaron 2026-09-06: detect HSM/TPM at setup. Overlay env join
takes `NamedHardwareProbe | null`. Frost maps to that probe
(`081M1WS6HV4087G0R001K1YWMN`) but nobody joins a frost
result into `planSetupFromNamedBaoElfEnv`. Add
`planSetupFromFrostEnv` in
`tools/setup/persona-keys/plan-setup-from-frost.ts`.
`/dev/tpmrm0` is not `present`. A YubiKey / CCID reader is
not CardContact. A PKCS#11 driver on disk is not an
attached YubiHSM. Null frost result is unmeasured, not
absent. OS family is named, not inferred. Do not run the
live probe. Do not import frost into
`src/Core.TypeScript/cluster/`. Do not call this from
`full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Do
not change ISO bun `probe: null`. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16905 (`081M1WS6HV4087G0R001K1YWMN`)
  maps frost result to `NamedHardwareProbe`. Overlay env
  join still takes a named probe, not a frost result.
  Cluster must not import `frost-hardware-probe.ts`
  (fs/spawn). ISO bun `probe` stays null.
- Prior-art: `namedProbeFromFrostResult` plus
  `planSetupFromNamedBaoElfEnv`. `references/prior-art/`
  not searched recursively.
- Depends on the frost mapper. Does not depend on calling
  this from
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
  Changing ISO bun JSON `probe` away from null.
