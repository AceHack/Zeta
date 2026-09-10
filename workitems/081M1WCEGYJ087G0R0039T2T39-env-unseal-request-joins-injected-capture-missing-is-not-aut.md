---
id: 081M1WCEGYJ087G0R0039T2T39
type: task
state: backlog
priority: P2
slug: env-unseal-request-joins-injected-capture-missing-is-not-aut
title: "Env unseal request joins injected capture; missing is not auto"
created: 2026-09-06T22:12:00.083Z
depends_on: ["081M1WBA6RX087G0R002450S9J"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Env unseal request joins injected capture; missing is not auto

Aaron 2026-09-06: continue after #16872. `parsePathRequest` names
the request. `integrateAtSetup` still takes a TypeScript
`SetupRequest`, so a live installer can pass `auto` while env is
missing and pick PKCS#11 from an injected TPM look. Join env
request with an injected capture. Missing request is unmeasured,
not `auto`. `/dev/tpmrm0` still refuses at parse. Do not invent
the capture from the char device. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16872 (`081M1WBA6RX087G0R002450S9J`) names
  `ZETA_UNSEAL_REQUEST`. #16728 (`081M1T9X3ZE087G0R000JNAYE7`)
  is the path picker. Overlay still must not `readFileSync`.
- Prior-art: `consumeUnsealRequestFromEnv` plus injected
  `HostHardwareCapture`. `references/prior-art/` not searched
  recursively.
- Depends on the named request. Does not depend on wiring this
  join from `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `pkcs11-tpm` from `/dev/tpmrm0`.
- Defaulting a missing request to `auto` or `pkcs11-tpm`.
- Inventing a capture from `/dev/tpmrm0`. extraContainer.
  `yubihsm.nix`.
- Expanding `ZetaFirstbootRole`. Invoking bun from
  `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh`.
  Calling the overlay join from `zeta-install.sh`.
