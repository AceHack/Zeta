---
id: 081KSNY2Z0008QG0R0008EJDW1
priority: P3
status: open
title: Content-addressed-store substrate for retroactive revocation (research; future-state when threat model requires multi-recipient + retroactive)
effort: XL
ask: aaron 2026-05-28 (Q4 explanation deferred)
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R002JKH50A
composes_with:
  - 081KSNY2Z0008QG0R002JKH50A
  - 081KSNY2Z0008QG0R0030V5ZVS
  - 081KSNY2Z0008QG0R0011XCT94
  - 081KSKBP80008QG0R003AX2A69
  - 081KSNY2Z0008QG0R0037X4DP4
tags:
  - content-addressed-store
  - retroactive-revocation
  - separate-from-git-history
  - multi-recipient-substrate
  - future-state-research
  - kv-store-options-s3-ceph-garage-ipfs
  - deferred-until-threat-model-expands
  - operator-explanation-locked-2026-05-28
---

## Operator framing 2026-05-28 (Q4 explanation requested + decision implicit)

Operator asked for explanation of retroactive revocation options. The substrate-honest disposition per the explanation:

- **081KSNY2Z0008QG0R0030V5ZVS v1 ships with forward-only revocation** — sufficient for Otto's private state (single-recipient; "if Otto retires, burn the key" = effective retroactive revocation)
- **Multi-recipient substrate with real retroactive revocation requirements** = THIS row tracks the future-state path

## What retroactive revocation requires

Git history is append-only by design. Once encrypted blob is committed, it lives in git forever (modulo BFG / filter-branch / force-push which break every clone + fork). To achieve true retroactive revocation, encrypted content must live OUTSIDE git's append-only model.

Three architectural options for retroactive revocation:

### Option A — Content-addressed store (separate from git) [PRIMARY CANDIDATE]

- Encrypted content lives in KV store (S3 / Ceph / Garage / IPFS / etc.)
- Git holds only a manifest: `{filename → content_hash → KV-store URL}`
- On revoke:
  - Re-encrypt all affected content with new key (new content_hashes)
  - Update manifest commit
  - DELETE old content-hashed blobs from KV store
- Revoked recipients have old ciphertext in their git clones BUT new git state references different content URLs they can't fetch (the old URLs return 404)
- Forward AND retroactive revocation achieved

### Option B — Lazy-fetch with server-enforced ACLs

- Encrypted content fetched on-demand from server enforcing ACLs
- Revoke = server refuses to serve revoked recipient new ciphertext
- Old ciphertext they already fetched stays decryptable; they don't get new
- Weakens offline-decryption property significantly

### Option C — Hardware-bound key (TPM / YubiKey / Touch-ID-derived)

- Decryption capability in hardware, not storable form
- Revoke = invalidate hardware token
- This is identity-revocation, not content-revocation per se
- 081KSKBP80008QG0R003AX2A69 USB-bound creds + Touch ID is closest existing Zeta substrate

## What this row tracks

When/if Zeta needs true retroactive revocation for multi-recipient encrypted substrate, the implementation path is Option A (content-addressed store + manifest in git).

This row tracks:

- Decision memo: when does the threat model warrant Option A? (Probably: external-recipient revocation requirements; compliance/legal-driven; multi-party substrate where one party's departure must not leave them with historical access)
- KV-store choice: S3 vs Ceph vs Garage vs IPFS (different operational properties; different vendor-lockin profiles; different cost models)
- Manifest format on the git side: `{filename, content_hash, kv_url, alg, recipients_at_that_time}`
- Re-encrypt + delete-old-blobs sweep procedure
- Migration path from 081KSNY2Z0008QG0R002JKH50A in-git encrypted substrate → content-addressed-store substrate
- Compose with 081KSNY2Z0008QG0R0011XCT94 zflash credential substrate (USB-bound credentials become the key-material for the new envelope; KV-store fetch happens after USB unlock)

## Composition

- **081KSNY2Z0008QG0R002JKH50A** (parent crypto substrate; v1 forward-only-revocation; this row is the v2+ path)
- **081KSNY2Z0008QG0R0030V5ZVS** (agent private encrypted state; benefits when scaled to multi-recipient)
- **081KSNY2Z0008QG0R0011XCT94** (zflash USB-bound credential substrate; key-material source for the new envelope)
- **081KSKBP80008QG0R003AX2A69** USB-bound credential substrate (composes at credential storage scope)

## Substrate-honest framing

P3 — research-grade; deferred until threat model expands. 081KSNY2Z0008QG0R002JKH50A v1 with forward-only-revocation is acceptable for 081KSNY2Z0008QG0R0030V5ZVS (single-recipient Otto state).

The path is OPEN if/when needed; substrate not built today. File ensures future-Otto sees this option when threat model expands rather than re-derive.

## Full reasoning

Operator 2026-05-28 requested deeper explanation of retroactive revocation in response to 081KSNY2Z0008QG0R0037X4DP4 Q4. Explanation provided in agent-loop conversation; this row codifies the deferred-but-tracked architectural option so it's not lost.

Threat-model triggers for activation: multi-party substrate; departing-party-must-not-retain-access; compliance/legal retroactive-deletion requirements; cross-cluster federation (per 081KSKBP80008QG0R003AX2A69 Phase 5 substrate).
