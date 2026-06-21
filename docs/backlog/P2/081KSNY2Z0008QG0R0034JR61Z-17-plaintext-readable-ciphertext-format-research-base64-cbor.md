---
id: 081KSNY2Z0008QG0R0034JR61Z
priority: P2
status: open
title: Plaintext-readable ciphertext format research — base64-CBOR vs JSON vs per-line vs FPE vs encrypted-YAML; git-friendly diff/review (operator 2026-05-28 sharpening)
effort: S
ask: aaron 2026-05-28 sharpening
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R002JKH50A
composes_with:
  - 081KSNY2Z0008QG0R002JKH50A
  - 081KSNY2Z0008QG0R000459FRH
  - 081KSNY2Z0008QG0R0030V5ZVS
tags:
  - plaintext-readable-ciphertext
  - git-friendly-format
  - addresses-rejection-reason-2-of-git-crypt-deep-dive
  - base64-encoded-cbor-recommended
  - json-encoded-envelope-alternative
  - per-line-encryption-with-line-prefix-nonce
  - format-preserving-encryption-research-grade
  - encrypted-yaml-partial-readability
  - operator-sharpening-research-row-2026-05-28
---

## Operator framing 2026-05-28

> *"if we can do plane text encryption somehow instead of binary that would be best for git, if not we can discuss"*

Addresses git-crypt-deep-dive-2026-04-21 rejection reason #2 ("binary diffs break code review"). Operator wants HUMAN-READABLE encrypted content, not opaque binary blobs that break git's diff/review.

## What this row tracks

Research spike (1-2 days) evaluating candidate ciphertext formats for git-friendliness + selecting one for 081KSNY2Z0008QG0R002JKH50A v1.

## Candidates

### Option A — Base64-encoded CBOR envelope (RECOMMENDED for v1)

CBOR envelope (per design memo's structure) wrapped in base64; line-broken for git-friendly diffs.

```text
-----ZETA-CRYPT v1-----
alg: ML-KEM-768+X25519 / ML-DSA-65 / ChaCha20-Poly1305
signer: otto-cli@zeta
recipients: 2 (otto-cli@zeta, addison@home)
ctx: zeta.git-crypt.file.v1
-----BEGIN CIPHERTEXT-----
oWVoZWxsb29HUmYxYTJiM2M0ZDVlNmY3ZzhoOWkwajFrMmwzbTRuNW82cDdxOHI5
czB0MXUydjN3NHg1eTZ6N0EyQjNDNEQ1RTZGN0c4SDlJMEoxSzJMM000TjVPNlA3
... (line-broken at 76 chars per RFC 7468 PEM convention) ...
-----END CIPHERTEXT-----
-----ZETA-SIG-----
ML-DSA-65 signature: 3293 bytes (base64)
... (line-broken) ...
-----END ZETA-SIG-----
```

**Pros:** text-safe (no binary); line-broken aligns with git's line-diff algorithm so each commit's per-line change is visible; structurally inspectable (header reveals alg + recipients + context without decryption); composes with PEM convention reviewers already understand.

**Cons:** ~33% size inflation vs raw binary CBOR; line-prefix doesn't survive content-edit (whole ciphertext changes when plaintext changes, so per-line diff still shows "everything changed"); doesn't solve the reviewer-can't-read-content problem (textconv filter still needed for that).

**Verdict: best v1 default.** Smallest delta from binary CBOR design memo's recommendation; addresses git-line-alignment; text-safe; preserves the envelope's structural transparency at the header level.

### Option B — JSON-encoded envelope

Full JSON instead of CBOR; fully text + structurally inspectable.

```json
{
  "v": 1,
  "ctx": "zeta.git-crypt.file.v1",
  "alg": { "kem": "ML-KEM-768+X25519", "kdf": "HKDF-SHA256", "wrap": "ChaCha20-Poly1305", "content": "ChaCha20-Poly1305" },
  "recipients": [
    { "id": "otto-cli@zeta", "kem_ct": "...base64...", "wrapped_cek": "...base64...", "kdf_info": "...base64..." }
  ],
  "content_nonce": "...base64...",
  "content_ct": "...base64...",
  "sig": { "alg": "ML-DSA-65", "signer": "otto-cli@zeta", "context": "zeta.git-crypt.file.v1", "value": "...base64..." }
}
```

**Pros:** Fully human-inspectable; JSON-LD-style structure familiar to reviewers; jq-queryable for header fields.

**Cons:** Larger size inflation than base64-CBOR (~50-70% vs ~33%); newline placement variable across JSON formatters (potential whitespace churn); slightly more parser complexity.

**Verdict: viable alternative.** If operator prefers JSON's reviewability over CBOR's compactness, ship Option B instead. Tradeoff: size for transparency.

### Option C — Per-line encryption with line-prefix nonce

Each plaintext line encrypted independently; output preserves line count + per-line independence.

```text
ZE1:<nonce>:<ciphertext>:<mac>
ZE1:<nonce>:<ciphertext>:<mac>
ZE1:<nonce>:<ciphertext>:<mac>
```

**Pros:** Per-line diff works exactly; changing one line of plaintext changes only one line of ciphertext; reviewer can see "lines 23-25 changed" even encrypted.

**Cons:** Encryption-per-line is wasteful (one nonce + one MAC per line); leaks LINE COUNT + LINE LENGTH; deterministic per-line encryption breaks if same plaintext line repeats (need stronger scheme); KEM-per-recipient still happens at file level not per-line, so envelope-header still needed.

**Verdict: structurally clever but wasteful.** Worth research for v2 specifically for files where per-line diff visibility matters most (e.g., line-oriented config files). Not v1.

### Option D — Format-preserving encryption (FPE)

Encrypted output structurally resembles plaintext.

**Pros:** Encrypted text "looks like" prose; encrypted numbers stay as numbers; preserves semantic shape.

**Cons:** Cryptographically expensive; complex API; small mature TS implementation ecosystem; defeats the purpose for general-content encryption.

**Verdict: research-grade only.** Defer indefinitely.

### Option E — Encrypted YAML (per-value encryption; keys + structure visible)

Document is YAML; values are encrypted but keys + structure visible.

```yaml
title: ENC[v1:base64-ciphertext]
author: ENC[v1:base64-ciphertext]
private_notes:
  - ENC[v1:base64-ciphertext]
  - ENC[v1:base64-ciphertext]
metadata:
  created: 2026-05-28          # not encrypted; structural metadata
  tags: [private, draft]       # not encrypted; structural metadata
```

**Pros:** YAML-aware reviewer can see structure + which values are encrypted; per-value diff shows precisely which values changed; selective per-field encryption.

**Cons:** YAML-specific; doesn't work for arbitrary file content; requires per-document YAML parsing on encrypt/decrypt; field-level encryption complicates rotation (each value has its own ciphertext-context).

**Verdict: niche-perfect for YAML/JSON files; not general-purpose.** Could ship as ALTERNATE for YAML-class files; not v1 default.

## Recommendation matrix

| Format | v1 default? | Future use case |
|---|---|---|
| **A. Base64-encoded CBOR** | **YES** | General-purpose; smallest delta from binary CBOR; line-safe + text-safe |
| B. JSON-encoded | Alternate if operator prefers full transparency over compactness | Always-available toggle via `--format=json` |
| C. Per-line encryption | NO (v2 research) | Line-oriented config files where per-line diff matters |
| D. FPE | NO | Research-grade only; defer |
| E. Encrypted YAML | NO (v1 default) | Optional for YAML-class files; sibling cipher in 081KSNY2Z0008QG0R002ZAVMEK multi-cipher registry |

## Acceptance criteria

- Memo at `docs/research/2026-XX-XX-plaintext-readable-ciphertext-format-decision.md` confirms Option A (base64-encoded CBOR) as v1 default
- 081KSNY2Z0008QG0R002JKH50A.6 (skeleton implementation) uses base64-CBOR envelope per the memo
- `--format=json` alternate switch implemented as Option B fallback (small effort; same envelope, different encoding)
- README documents the format choice + why (per operator sharpening + git-friendliness research)

## Composition

- **081KSNY2Z0008QG0R002JKH50A** (parent crypto substrate)
- **081KSNY2Z0008QG0R000459FRH** (glass-halo-open-by-default; encryption opt-in; plaintext-readable format supports the opt-in-with-transparency posture)
- **081KSNY2Z0008QG0R002JKH50A.6** (future skeleton implementation row; consumes this decision)

## Substrate-honest framing

P2 — small research spike; deliverable is the format decision; implementation follows in 081KSNY2Z0008QG0R002JKH50A.6 skeleton row.

## Full reasoning

Operator 2026-05-28 sharpening: *"if we can do plane text encryption somehow instead of binary that would be best for git, if not we can discuss."*

Addresses the 2026-04-21 git-crypt rejection reason #2 ("binary diffs break code review") that 081KSNY2Z0008QG0R002JKH50A was filed to fix; this row makes the format decision explicit + provides candidate evaluation.
