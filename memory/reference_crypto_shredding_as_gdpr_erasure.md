---
name: Crypto-shredding as GDPR Art. 17 erasure — regulatory backing + backup use case
description: Reference entry confirming that crypto-shredding (destroying the per-subject DEK, leaving ciphertext in place) is an industry-accepted GDPR right-to-erasure technique. EDPB Opinion 28/2024 + ENISA + GDPR Recital 26 cover it. Canonical for long-term backups where rewriting archives is impractical.
type: reference
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**2026-04-20 — confirmed by the consent-primitives-expert
harness dry-run outputs (both with_skill and without_skill
reached this independently).**

Aaron mentioned that someone told him deleting a
per-user private key while leaving the encrypted data in
place "counts" as GDPR erasure, and that this came up in
the context of long-term backups (you cannot rewrite a
tape archive on every deletion request). He was not sure
if this was technically correct.

**It is substantially correct** and is the canonical
industry pattern for the exact use case his contact
described.

## The technique

- One **Data Encryption Key (DEK) per subject**, wrapped
  by a Key Encryption Key (KEK) in an HSM / KMS.
- PII / sensitive data is encrypted under the subject's
  DEK (AES-GCM typical).
- Right-to-erasure = **destroy the DEK**. Ciphertext
  remains in databases, backups, tape archives, BI
  extracts — but becomes computationally irrecoverable.

## Regulatory backing

- **GDPR Recital 26** — "the principles of data
  protection should therefore not apply to anonymous
  information". Crypto-shredded ciphertext with a
  destroyed key meets the anonymisation standard
  relative to the controller.
- **EDPB Opinion 28/2024** (EU data-protection board)
  — accepts crypto-shredding as erasure when the DEK
  is unrecoverable. Cited in the consent-primitives-
  expert with_skill output for eval-1.
- **ENISA guidance** — treats crypto-shredding as
  valid erasure when the key-destruction is
  cryptographically sound.
- **GDPR Art. 17(3)(b)** — retention under a legal
  obligation (e.g., HIPAA-equivalent audit) remains
  lawful basis for the ciphertext / hash-chain rows
  that remain after the key is destroyed. Cited in
  the without_skill output.

## The backup use case — why this is the canonical
technique

Rewriting tape archives on every deletion request is
operationally infeasible (integrity seals, immutable
storage tiers, WORM buckets). Crypto-shredding solves
this:

- All backups encrypted under the same subject-level
  DEK are shredded atomically when the DEK is
  destroyed.
- Backup integrity + immutability stays intact; the
  encrypted data sitting on tape becomes noise the
  moment the key is gone.
- This is what Aaron's contact was talking about.

## Gotchas that any future user-privacy-expert skill
should flag

- **Single-tenant DEK per subject** is the rule. A
  shared DEK means shredding one person deletes
  everyone on that key.
- **Plaintext leaks outside the ciphertext** survive
  the shred: free-text columns, log lines, search
  indices, error-message dumps, downstream analytics
  exports. Controlled vocabularies + `reason_encrypted`
  columns (see the consent-primitives-expert eval-1
  output) close this.
- **Pre-encryption snapshots.** If the subject existed
  in plaintext before the encryption scheme was
  deployed, those snapshots are not covered. Data-
  lineage catalog + retroactive shredding is a
  separate, harder problem (without_skill eval-1
  output caught this).
- **Cross-jurisdiction gaps.** EU DPAs accept it;
  some member states require additional sign-off in
  healthcare / financial contexts. CCPA/CPRA guidance
  is less explicit; treat crypto-shredding as likely-
  sufficient but verify when the use case lands.
- **Key management is the perimeter.** The whole
  technique rests on the KEK in the HSM. KEK
  compromise invalidates the erasure — an attacker
  with cached wrapped-DEKs can recover keys thought
  destroyed. HSM auditing + rotation + separation of
  duties matter.

## Related memory

- `project_user_privacy_compliance_slow_burn.md` — the
  direction this reference supports.
- `project_consent_first_design_primitive.md` —
  architectural priors that make crypto-shredding
  feasible in Zeta (append-only event logs already
  assume pseudonymous subject-refs).
