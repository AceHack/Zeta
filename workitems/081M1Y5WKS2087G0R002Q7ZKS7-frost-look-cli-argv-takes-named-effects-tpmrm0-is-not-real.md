---
id: 081M1Y5WKS2087G0R002Q7ZKS7
type: task
state: backlog
priority: P2
slug: frost-look-cli-argv-takes-named-effects-tpmrm0-is-not-real
title: "Frost look CLI argv takes named effects; tpmrm0 is not real"
created: 2026-09-07T14:55:50.563Z
depends_on: ["081M1Y39EJJ087G0R003Z00P0Y"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Frost look CLI argv takes named effects; tpmrm0 is not real

Aaron 2026-09-06: detect HSM/TPM at setup. Env CLI prints a
named look. Argv still had no parse, so a caller could skip
the named-env keys. Add `consumeFrostLookFromArgv` /
`runFrostLookArgvCli` in
`tools/setup/persona-keys/named-frost-look-env.ts`.
`--os` is required. Missing `--effects` is unmeasured, not a
live look. Do not default to `realProbeEffects`. `/dev/tpmrm0`
is not `real` and not an OS. Do not read `/etc/os-release`.
Do not import frost into `src/Core.TypeScript/cluster/`.
Do not call this from
`full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Do
not change ISO bun `probe: null`. Do not call overlay join.
Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16943 (`081M1Y39EJJ087G0R003Z00P0Y`)
  landed the env CLI. Argv is not parsed. ISO bun `probe`
  stays null. Cluster must not import
  `frost-hardware-probe.ts` (fs/spawn).
- Prior-art: `consumeFrostLookFromEnv` plus
  `parseNamedBaoElfArgs` flag shape. `references/prior-art/`
  not searched recursively.
- Depends on the env CLI. Does not depend on calling this
  from `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Inferring OS from `/etc/os-release`.
- Defaulting missing `--os` to `nixos`.
- Defaulting missing `--effects` to `realProbeEffects`.
- Mixing argv OS with env effects.
- Calling overlay join. extraContainer. `yubihsm.nix`.
- Calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Changing ISO bun JSON `probe` away from null.
