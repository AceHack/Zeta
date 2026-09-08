---
id: 081M1YWR8EB087G0R002X0SFX7
type: task
state: backlog
priority: P2
slug: overlay-optional-named-argv-takes-bun-json-from-json-json-pr
title: "Overlay optional named argv takes bun JSON --from-json; JSON probe is ignored"
created: 2026-09-07T21:35:25.132Z
depends_on: ["081M1YS9661087G0R001YK5CEY"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Overlay optional named argv takes bun JSON --from-json; JSON probe is ignored

Aaron 2026-09-06: detect HSM/TPM at setup. Frost look CLI takes
`--from-json` (`081M1YS9661087G0R001YK5CEY`). Overlay optional
named join takes a bun JSON string
(`081M1YQKYXQ087G0R000NXN8JN`) with bao from env. Overlay
optional named argv still only takes `--os` / `--effects`, so
an operator with bun stdout on argv `--from-json` plus bao
flags cannot join. Extend
`planSetupFromFrostLookOptionalNamedArgv`: `--from-json` uses
`look`; JSON `probe` is ignored even when non-null. Null look
is unmeasured. Mixing `--from-json` with `--os` / `--effects`
/ `--from-conf` / env frost-look keys is `mixed-source`.
NamedEnv still requires OS. `/dev/tpmrm0` is not `real`.
Parse is `tools/setup/persona-keys/named-frost-look.ts`, not
the CLI. Do not write ESP. Do not call this from
`full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Do not
change ISO bun `probe: null`. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16973 (`081M1YS9661087G0R001YK5CEY`)
  landed CLI `--from-json`. Overlay
  `planSetupFromFrostLookOptionalNamedArgv` still uses
  `consumeOptionalFrostLookFromArgv` only. ISO bun `probe`
  stays null.
- Prior-art: overlay bun JSON join
  (`planSetupFromFrostLookOptionalNamedBunJson`) plus CLI
  `--from-json`. `docs/PRIOR-ART-LIST.md` scanned; this is
  factory overlay join, not an external PKCS#11 image.
  `references/prior-art/` not searched recursively.
- Depends on CLI `--from-json`. Does not depend on calling
  this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Using JSON `probe` even when non-null.
- Inferring `tpm2: "present"` from `/dev/tpmrm0`.
- Defaulting missing OS to `nixos`.
- Defaulting missing effects to `realProbeEffects`.
- Changing NamedEnv missing OS into unmeasured.
- Changing ISO bun JSON `probe` away from null.
- Mixing `--from-json` with `--os` / `--effects` /
  `--from-conf` / env frost-look keys.
- Overlay importing `tools/setup/persona-keys/named-frost-look-env.ts`.
- Calling this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
  Writing ESP / calling `appendFirstbootBaoElfConf`.
