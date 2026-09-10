---
id: 081M1YGP8BF087G0R002Z1YH8R
type: task
state: backlog
priority: P2
slug: iso-bun-consume-reports-named-frost-look-keys-probe-stays-nu
title: "ISO bun consume reports named frost-look keys; probe stays null"
created: 2026-09-07T18:04:36.591Z
depends_on: ["081M1YCFES8087G0R000R3MV6Y"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# ISO bun consume reports named frost-look keys; probe stays null

Aaron 2026-09-06: detect HSM/TPM at setup. Overlay named-key
joins landed (`081M1YCFES8087G0R000R3MV6Y`). ISO bun consume
in `src/Core.TypeScript/zflash/firstboot-bao-env.ts` still
omits frost-look keys, so a later join could treat missing
as a live look. Report `look` from `ZETA_FROST_LOOK_OS` /
`ZETA_FROST_LOOK_EFFECTS`. Missing both keys is unmeasured
(`look` null), not `missing-os`. Named `"real"` still
leaves `probe: null`. `/dev/tpmrm0` is not `real`. Parse
does not load `frost-hardware-probe.ts`. Do not import the
frost-look CLI. Do not call overlay join from
`full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Do
not export frost-look keys from the installer. Do not land
the stanza.

## Pre-start checklist

- Substrate-drift: #16957 (`081M1YCFES8087G0R000R3MV6Y`)
  closed overlay named-key joins. Bun JSON still has no
  `look` field. `probe` stays null. `frost-hardware-probe.ts`
  stays in `tools/setup/persona-keys/`; the bun helper must
  not import it (fs/spawn).
- Prior-art: bun consume JSON (`requested` / `probe` null)
  plus `consumeFrostLookFromEnv`. `references/prior-art/`
  not searched recursively.
- Depends on overlay named-key joins. Does not depend on
  calling overlay join from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Defaulting missing OS to `nixos`.
- Defaulting missing effects to `realProbeEffects`.
- Changing ISO bun JSON `probe` away from null.
- Importing `tools/setup/persona-keys/named-frost-look-env.ts`
  or `frost-hardware-probe.ts` into
  `src/Core.TypeScript/zflash/firstboot-bao-env.ts`.
- Calling overlay join / `namedProbeFromFrostLook` from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Exporting frost-look keys from the installer.
  Adding frost-look keys to ESP conf / `zeta-first-boot.sh`.
