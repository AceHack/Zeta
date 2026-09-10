---
id: 081M1WBA6RX087G0R002450S9J
type: task
state: backlog
priority: P2
slug: named-unseal-request-from-env-is-not-inferred-from-tpmrm0
title: "Named unseal request from env is not inferred from tpmrm0"
created: 2026-09-06T21:52:10.013Z
depends_on: ["081M1W9VW7P087G0R0026A9J6Z"]
composes_with: ["081M1T9X3ZE087G0R000JNAYE7"]
---

# Named unseal request from env is not inferred from tpmrm0

Aaron 2026-09-06: continue after #16865. Overlay join still takes
an `IntegrateDecision` a live installer would invent.
`src/Core.TypeScript/cluster/unseal-path.ts` already classifies
when a capture is injected. Name the request from env first.
Missing is unmeasured, not `auto`, not `pkcs11-tpm`.
`/dev/tpmrm0` is not a request. Do not call `integrateAtSetup`
from `/dev/tpmrm0`. Do not land the stanza.

## Pre-start checklist

- Substrate-drift: #16865 (`081M1W9VW7P087G0R0026A9J6Z`) filters
  ISO current-system bao at bun consume. #16728
  (`081M1T9X3ZE087G0R000JNAYE7`) is the path picker. Overlay still
  must not `readFileSync`.
- Prior-art: `PathRequest` already lives on this classifier.
  `references/prior-art/` not searched recursively.
- Depends on the named request type. Does not depend on wiring
  `planSetupFromNamedBaoElfEnv` from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Inferring `pkcs11-tpm` from `/dev/tpmrm0`.
- Defaulting a missing request to `auto` or `pkcs11-tpm`.
- Inferring epoch from `/mnt`.
- Inventing `integrateAtSetup`. extraContainer. `yubihsm.nix`.
- Expanding `ZetaFirstbootRole`. Invoking bun from
  `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh`.
  Calling the overlay join from `zeta-install.sh`.
