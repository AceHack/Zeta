---
id: 081M1WHKEEQ087G0R0002B3SPG
type: task
state: backlog
priority: P2
slug: argv-and-conf-overlay-joins-read-named-unseal-request-from-e
title: "Argv and conf overlay joins read named unseal request from env"
created: 2026-09-06T23:42:04.247Z
depends_on: ["081M1WG1RJB087G0R001ADMJNK"]
composes_with: ["081M1WE7Z5S087G0R001WT3K6G"]
---

# Argv and conf overlay joins read named unseal request from env

Aaron 2026-09-06: continue after #16886. Overlay env join reads
`ZETA_UNSEAL_REQUEST`. `planSetupFromNamedBaoElfArgv` and
`planSetupFromNamedBaoElfConf` in
`src/Core.TypeScript/installer/bao-elf-capture.ts` still take an
`IntegrateDecision` as a TypeScript argument, so a caller can
pass `pkcs11-tpm` while `ZETA_UNSEAL_REQUEST` is missing.
Read the request from env. Capture stays injected. Missing
request is unmeasured, not `auto`. `/dev/tpmrm0` still refuses.
Do not add the request to ESP conf. Do not invent the capture.
Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16884 (`081M1WE7Z5S087G0R001WT3K6G`) is the
  overlay env join. #16886 (`081M1WG1RJB087G0R001ADMJNK`) is bun
  JSON. Overlay still must not `readFileSync`.
- Prior-art: `integrateAtSetupFromEnv`. `references/prior-art/`
  not searched recursively.
- Depends on the env join. Does not depend on wiring this from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`. Does
  not depend on adding `ZETA_UNSEAL_REQUEST` to
  `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `pkcs11-tpm` from `/dev/tpmrm0`.
- Defaulting a missing request to `auto`.
- Adding `ZETA_UNSEAL_REQUEST` to ESP conf or
  `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh`.
- Inventing a capture from `/dev/tpmrm0`. extraContainer.
  `yubihsm.nix`.
- Expanding `ZetaFirstbootRole`. Invoking bun from
  `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh`.
  Calling these joins from `zeta-install.sh`.
