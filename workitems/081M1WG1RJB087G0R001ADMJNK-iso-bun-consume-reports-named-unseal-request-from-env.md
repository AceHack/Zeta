---
id: 081M1WG1RJB087G0R001ADMJNK
type: task
state: backlog
priority: P2
slug: iso-bun-consume-reports-named-unseal-request-from-env
title: "ISO bun consume reports named unseal request from env"
created: 2026-09-06T23:14:56.203Z
depends_on: ["081M1WE7Z5S087G0R001WT3K6G"]
composes_with: ["081M1W9VW7P087G0R0026A9J6Z"]
---

# ISO bun consume reports named unseal request from env

Aaron 2026-09-06: continue after #16884. Overlay env join reads
`ZETA_UNSEAL_REQUEST`. Bun JSON from
`src/Core.TypeScript/zflash/firstboot-bao-env.ts` still reports
only `ask` and `epoch`, so a missing request is invisible and
can be misread as `auto`. Report the named request. Missing is
unmeasured (`requested` null), not `auto`. `/dev/tpmrm0` still
refuses. Do not call `integrateAtSetup`. Do not invent a
capture. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16884 (`081M1WE7Z5S087G0R001WT3K6G`) is the
  overlay env join. #16865 (`081M1W9VW7P087G0R0026A9J6Z`) is the
  bun JSON ask filter. Overlay still must not `readFileSync`.
- Prior-art: `consumeUnsealRequestFromEnv` plus
  `consumeFirstbootBaoElfEnvWithEpoch`. `references/prior-art/`
  not searched recursively.
- Depends on the overlay env join. Does not depend on calling
  `planSetupFromNamedBaoElfEnv` from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `pkcs11-tpm` from `/dev/tpmrm0`.
- Defaulting a missing request to `auto`.
- Exporting `ZETA_UNSEAL_REQUEST` from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
- Inventing a capture from `/dev/tpmrm0`. extraContainer.
  `yubihsm.nix`.
- Expanding `ZetaFirstbootRole`. Invoking bun from
  `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh`.
  Calling the overlay join from `zeta-install.sh`.
