---
id: 081M1WQNTZ0087G0R002Q8T8RT
type: task
state: backlog
priority: P2
slug: iso-bun-consume-reports-unmeasured-probe-tpmrm0-is-not-a-pro
title: "ISO bun consume reports unmeasured probe; tpmrm0 is not a probe"
created: 2026-09-07T01:28:14.048Z
depends_on: ["081M1WP0C7B087G0R000VK9E0V"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# ISO bun consume reports unmeasured probe; tpmrm0 is not a probe

Aaron 2026-09-06: detect HSM/TPM at setup. Overlay and env
integrate now take `NamedHardwareProbe | null` (#16901). ISO
bun consume in `src/Core.TypeScript/zflash/firstboot-bao-env.ts`
reports `requested` and still omits the probe, so a later join
could treat missing as present. Report `probe: null`. Missing
is unmeasured, not present. A named PathRequest is not a named
probe. `/dev/tpmrm0` is not a probe. Do not invent a look.
Do not call `integrateAtSetupFromEnv`. Do not call overlay join
from `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16901 (`081M1WP0C7B087G0R000VK9E0V`)
  closed env-integrate TypeScript capture. Bun JSON still
  has no probe field. `frost-hardware-probe.ts` stays in
  `tools/setup/persona-keys/`; the bun helper must not import
  it (fs/spawn).
- Prior-art: bun consume JSON (`requested` null) plus
  `NamedHardwareProbe`. `references/prior-art/` not searched
  recursively.
- Depends on env integrate taking a probe. Does not depend
  on calling overlay join from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Defaulting a null probe to `absent` / `defaultMetalCapture`.
- Treating a named PathRequest as a named probe.
- Importing `tools/setup/persona-keys/frost-hardware-probe.ts`
  into `src/Core.TypeScript/zflash/`. extraContainer.
  `yubihsm.nix`.
- Expanding `ZetaFirstbootRole`. Calling overlay join from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Adding the probe to ESP conf / `zeta-first-boot.sh`.
  Exporting a default probe from the installer.
