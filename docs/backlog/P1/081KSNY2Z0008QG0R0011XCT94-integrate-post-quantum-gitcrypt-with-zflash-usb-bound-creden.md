---
id: B-0884
zetaid: 081KSNY2Z0008QG0R0011XCT94
priority: P1
status: open
title: Integrate post-quantum git-crypt with zflash USB-bound credential substrate — composes B-0883 with B-0852/B-0852.3/B-0737/B-0844 zflash cluster
effort: L
ask: aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - B-0883
  - B-0852
composes_with:
  - B-0883
  - B-0852
  - B-0852.3
  - B-0737
  - B-0844
  - B-0840
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

Yes — the recent zflash cluster (B-0844 + B-0852 + B-0852.3 + B-0737) shipped USB-bound credential substrate. The post-quantum git-crypt (B-0883) needs to compose with this, not parallel-it.

## What this row tracks

Wire the post-quantum git-crypt (B-0883) into the existing zflash credential substrate:

1. **Key storage**: PQ git-crypt keys live in the existing `encrypted-blob-bound-to-USB-UUID + operator-passphrase` substrate (B-0852); no new key store
2. **Key access**: gated through the existing Touch ID + PAM substrate (B-0737); no separate auth path
3. **Boot sequence**: PQ git-crypt key materialization is part of the existing auth-method-picker flow (B-0852); no new boot step
4. **Install-time bake**: PQ git-crypt key-bootstrap is part of the existing `zeta-install.sh step 6.77` cred-picker integration (B-0852.3); no new install step
5. **Agent-mode**: PQ git-crypt operations work natively in zflash agent mode (B-0844); no agent-mode-specific shim

The integration row tracks the composition work, NOT the underlying crypto (which is B-0883). The boundary is: B-0883 = the cryptographic substrate; B-0884 = wiring it into the existing zflash ergonomics.

## Acceptance criteria

- `tools/zflash/pq-gitcrypt-integration/` — TS module that:
  - Exposes `getPQGitCryptKey(touchIdSession)` returning the operator's PQ git-crypt key after Touch ID auth
  - Composes with existing zflash USB-bound-blob unwrap (B-0852)
  - Persists rotated keys back into the USB-bound blob (retraction-native rotation per B-0883)
- `zeta-install.sh` step 6.77 extension: PQ git-crypt key-bootstrap during interactive bake (no separate step)
- Tests cover: round-trip (bake → unwrap → use → rotate → re-wrap); failure modes (wrong USB; wrong passphrase; Touch ID denied; key not yet baked); compatibility with existing non-PQ credentials in same blob
- Docs at `docs/zflash/pq-gitcrypt-integration.md` documenting the integration shape

## Composition

- **B-0883** (parent crypto substrate)
- **B-0852** USB-bound credential substrate — the key-store
- **B-0852.3** zeta-install.sh step 6.77 — the bake-time integration point
- **B-0737** Touch ID + PAM — the auth-gate
- **B-0844** zflash agent-mode — execution context
- **B-0840** thermal-forgetting + private-encryption-budget — composes at the retraction-native rotation scope

## Substrate-honest framing

POTENTIAL extension per operator standing direction. P2 — depends on B-0883 reaching prototype maturity; pure composition row once B-0883 lands.

Per operator's "didn't we just have to do some encrypted stuff for zflash?" — this row makes the composition explicit so the PQ git-crypt work doesn't accidentally build a parallel credential-substrate alongside the existing zflash one.

## Full reasoning

`docs/backlog/P2/B-0883-...md` (parent crypto substrate)

`docs/backlog/P1/B-0852-...md` (recent USB-bound credential substrate — composes with this row)

Operator 2026-05-28: "hey lets write better gitcrypt so we can have encryption also didn't we just have to do some encrypted stuff for zflash?"
