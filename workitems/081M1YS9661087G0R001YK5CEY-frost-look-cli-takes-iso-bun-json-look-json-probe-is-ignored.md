---
id: 081M1YS9661087G0R001YK5CEY
type: task
state: backlog
priority: P2
slug: frost-look-cli-takes-iso-bun-json-look-json-probe-is-ignored
title: "Frost look CLI takes ISO bun JSON look; JSON probe is ignored"
created: 2026-09-07T20:34:45.569Z
depends_on: ["081M1YQKYXQ087G0R000NXN8JN"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Frost look CLI takes ISO bun JSON look; JSON probe is ignored

Aaron 2026-09-06: detect HSM/TPM at setup. Overlay optional named
join takes ISO bun JSON look (`081M1YQKYXQ087G0R000NXN8JN`).
Frost look CLI takes env / argv / `--from-conf`. Nobody prints
that same bun JSON `look` from the CLI, so an operator would
re-read env keys the installer does not export. Add
`--from-json`: null look is unmeasured; JSON `probe` is ignored
even when non-null. Mixing `--from-json` with `--os` /
`--effects` / `--from-conf` / env frost-look keys is
`mixed-source`. NamedEnv still requires OS. `/dev/tpmrm0` is
not `real`. Do not call overlay join. Do not write ESP. Do not
call this from `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
Do not change ISO bun `probe: null`. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16971 (`081M1YQKYXQ087G0R000NXN8JN`)
  landed overlay bun JSON look join. CLI still has no
  `--from-json`. ISO bun `probe` stays null.
- Prior-art: `consumeOptionalFrostLookFromBunJson` plus
  CLI `--from-conf`. `references/prior-art/` not searched
  recursively.
- Depends on overlay bun JSON join. Does not depend on
  calling this from
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
