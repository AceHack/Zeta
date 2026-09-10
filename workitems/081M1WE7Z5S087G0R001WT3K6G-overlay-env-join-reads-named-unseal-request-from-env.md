---
id: 081M1WE7Z5S087G0R001WT3K6G
type: task
state: backlog
priority: P2
slug: overlay-env-join-reads-named-unseal-request-from-env
title: "Overlay env join reads named unseal request from env"
created: 2026-09-06T22:43:22.426Z
depends_on: ["081M1WCEGYJ087G0R0039T2T39"]
composes_with: ["081M1W8D6MF087G0R003405R3N"]
---

# Overlay env join reads named unseal request from env

Aaron 2026-09-06: continue after #16879. `integrateAtSetupFromEnv`
joins env request with an injected capture.
`planSetupFromNamedBaoElfEnv` in
`src/Core.TypeScript/installer/bao-elf-capture.ts` still takes
an `IntegrateDecision` as a TypeScript argument, so a caller can
pass `pkcs11-tpm` while `ZETA_UNSEAL_REQUEST` is missing.
Read the request from env. Capture stays injected. Missing
request is unmeasured, not `auto`. `/dev/tpmrm0` still refuses.
Do not invent the capture. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16879 (`081M1WCEGYJ087G0R0039T2T39`) is the
  env integrate join. #16860 (`081M1W8D6MF087G0R003405R3N`)
  already reads epoch from env. Overlay still must not
  `readFileSync`.
- Prior-art: `integrateAtSetupFromEnv` plus
  `consumeFirstbootBaoElfEnvWithEpoch`. `references/prior-art/`
  not searched recursively.
- Depends on the env integrate join. Does not depend on wiring
  this from `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `pkcs11-tpm` from `/dev/tpmrm0`.
- Defaulting a missing request to `auto`.
- Inventing a capture from `/dev/tpmrm0`. extraContainer.
  `yubihsm.nix`.
- Expanding `ZetaFirstbootRole`. Invoking bun from
  `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh`.
  Calling this join from `zeta-install.sh`.
