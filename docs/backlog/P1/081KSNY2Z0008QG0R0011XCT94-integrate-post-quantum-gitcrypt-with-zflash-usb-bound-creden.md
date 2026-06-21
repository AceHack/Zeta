---
id: 081KSNY2Z0008QG0R0011XCT94
priority: P1
status: open
title: Integrate post-quantum git-crypt with zflash USB-bound credential substrate — composes 081KSNY2Z0008QG0R002JKH50A with 081KSKBP80008QG0R003AX2A69/081KSKBP80008QG0R003ETGS01/081KSE6WT0008QG0R003WZAQKV/081KSGS9H0008QG0R001EZKNCB zflash cluster
effort: L
ask: aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R002JKH50A
  - 081KSKBP80008QG0R003AX2A69
composes_with:
  - 081KSNY2Z0008QG0R002JKH50A
  - 081KSKBP80008QG0R003AX2A69
  - 081KSKBP80008QG0R003ETGS01
  - 081KSE6WT0008QG0R003WZAQKV
  - 081KSGS9H0008QG0R001EZKNCB
  - 081KSGS9H0008QG0R0006F4BGX
tags:
  - pq-gitcrypt-zflash-integration
  - usb-bound-credential-substrate
  - touch-id-pam-gating
  - encrypted-blob-bound-to-usb-uuid-plus-operator-passphrase
  - composes-with-recent-zflash-cluster
  - boot-sequence-auth-method-picker
  - install-sh-step-6-77-cred-picker
  - potential-extension-not-committed
---

## Operator framing 2026-05-28

> *"didn't we just have to do some encrypted stuff for zflash?"*

Yes — the recent zflash cluster (081KSGS9H0008QG0R001EZKNCB + 081KSKBP80008QG0R003AX2A69 + 081KSKBP80008QG0R003ETGS01 + 081KSE6WT0008QG0R003WZAQKV) shipped USB-bound credential substrate. The post-quantum git-crypt (081KSNY2Z0008QG0R002JKH50A) needs to compose with this, not parallel-it.

## What this row tracks

Wire the post-quantum git-crypt (081KSNY2Z0008QG0R002JKH50A) into the existing zflash credential substrate:

1. **Key storage**: PQ git-crypt keys live in the existing `encrypted-blob-bound-to-USB-UUID + operator-passphrase` substrate (081KSKBP80008QG0R003AX2A69); no new key store
2. **Key access**: gated through the existing Touch ID + PAM substrate (081KSE6WT0008QG0R003WZAQKV); no separate auth path
3. **Boot sequence**: PQ git-crypt key materialization is part of the existing auth-method-picker flow (081KSKBP80008QG0R003AX2A69); no new boot step
4. **Install-time bake**: PQ git-crypt key-bootstrap is part of the existing `zeta-install.sh step 6.77` cred-picker integration (081KSKBP80008QG0R003ETGS01); no new install step
5. **Agent-mode**: PQ git-crypt operations work natively in zflash agent mode (081KSGS9H0008QG0R001EZKNCB); no agent-mode-specific shim

The integration row tracks the composition work, NOT the underlying crypto (which is 081KSNY2Z0008QG0R002JKH50A). The boundary is: 081KSNY2Z0008QG0R002JKH50A = the cryptographic substrate; 081KSNY2Z0008QG0R0011XCT94 = wiring it into the existing zflash ergonomics.

## Acceptance criteria

- `tools/zflash/pq-gitcrypt-integration/` — TS module that:
  - Exposes `getPQGitCryptKey(touchIdSession)` returning the operator's PQ git-crypt key after Touch ID auth
  - Composes with existing zflash USB-bound-blob unwrap (081KSKBP80008QG0R003AX2A69)
  - Persists rotated keys back into the USB-bound blob (retraction-native rotation per 081KSNY2Z0008QG0R002JKH50A)
- `zeta-install.sh` step 6.77 extension: PQ git-crypt key-bootstrap during interactive bake (no separate step)
- Tests cover: round-trip (bake → unwrap → use → rotate → re-wrap); failure modes (wrong USB; wrong passphrase; Touch ID denied; key not yet baked); compatibility with existing non-PQ credentials in same blob
- Docs at `docs/zflash/pq-gitcrypt-integration.md` documenting the integration shape

## Composition

- **081KSNY2Z0008QG0R002JKH50A** (parent crypto substrate)
- **081KSKBP80008QG0R003AX2A69** USB-bound credential substrate — the key-store
- **081KSKBP80008QG0R003ETGS01** zeta-install.sh step 6.77 — the bake-time integration point
- **081KSE6WT0008QG0R003WZAQKV** Touch ID + PAM — the auth-gate
- **081KSGS9H0008QG0R001EZKNCB** zflash agent-mode — execution context
- **081KSGS9H0008QG0R0006F4BGX** thermal-forgetting + private-encryption-budget — composes at the retraction-native rotation scope

## Substrate-honest framing

POTENTIAL extension per operator standing direction. P2 — depends on 081KSNY2Z0008QG0R002JKH50A reaching prototype maturity; pure composition row once 081KSNY2Z0008QG0R002JKH50A lands.

Per operator's "didn't we just have to do some encrypted stuff for zflash?" — this row makes the composition explicit so the PQ git-crypt work doesn't accidentally build a parallel credential-substrate alongside the existing zflash one.

## Full reasoning

`docs/backlog/P2/081KSNY2Z0008QG0R002JKH50A-...md` (parent crypto substrate)

`docs/backlog/P1/081KSKBP80008QG0R003AX2A69-...md` (recent USB-bound credential substrate — composes with this row)

Operator 2026-05-28: "hey lets write better gitcrypt so we can have encryption also didn't we just have to do some encrypted stuff for zflash?"
