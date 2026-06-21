---
pr_number: 5421
title: "feat(081KSKBP80008QG0R003AX2A69.2a): wire-format envelope serializer + CredBundle plaintext schema (17 unit tests; pure functions)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T07:43:42Z"
merged_at: "2026-05-27T07:47:11Z"
closed_at: "2026-05-27T07:47:11Z"
head_ref: "feat/b-0852-2-persist-restore-clis"
base_ref: "main"
archived_at: "2026-05-27T19:25:11Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5421: feat(081KSKBP80008QG0R003AX2A69.2a): wire-format envelope serializer + CredBundle plaintext schema (17 unit tests; pure functions)

## PR description

## Summary

081KSKBP80008QG0R003AX2A69 sub-row .2 first slice — the on-disk wire format that 081KSKBP80008QG0R003AX2A69.2b persist/restore CLIs will use to read/write \`/esp/zeta-creds.enc\`. Pure functions; no I/O.

## Wire format (binary; v1 magic \`ZCV1\`)

| Field | Type | Notes |
|---|---|---|
| magic | 4 bytes | \"ZCV1\" |
| reserved | 4 bytes | zero (future-version-bump) |
| salt_len + salt | u16 + bytes | from 081KSKBP80008QG0R003AX2A69.1 envelope |
| iv_len + iv | u16 + bytes | |
| tag_len + tag | u16 + bytes | |
| ciphertext_len + ciphertext | u32 + bytes | |

Trailing bytes rejected in v1 (v2 will explicit-version-bump).

## CredBundle plaintext schema (post-decryption)

\`\`\`json
{
  \"schemaVersion\": 1,
  \"globalCreds\": { \"<id>\": \"<base64-bytes>\" },
  \"personaCreds\": { \"<persona>\": { \"<id>\": \"<base64-bytes>\" } }
}
\`\`\`

\`personaScoped:false\` manifest entries (081KSKBP80008QG0R003AX2A69.5) → \`globalCreds\`; \`personaScoped:true\` → \`personaCreds[<persona>]\`. Composes with 081KSKBP80008QG0R003AX2A69.5 semantics.

## Full pipeline (covered by integration test)

\`\`\`
CredBundle → encodeBundle → encrypt (081KSKBP80008QG0R003AX2A69.1) → serializeEnvelope
  → [disk write/read simulation] →
parseEnvelope → decrypt → decodeBundle → CredBundle (byte-identical)
\`\`\`

## Test output

\`\`\`
 17 pass
 0 fail
 29 expect() calls
Ran 17 tests across 1 file. [1.67s]
\`\`\`

scrypt N=2^17 dominates timing per 081KSKBP80008QG0R003AX2A69.1 OWASP-recommended parameters.

## Composes with

- **081KSKBP80008QG0R003AX2A69.1** crypto module (merged PR #5411) — Envelope type producer/consumer
- **081KSKBP80008QG0R003AX2A69.5** cred-manifest schema (merged PR #5414) — \`personaScoped\` semantics drive bundle layout
- **081KSKBP80008QG0R003AX2A69.10** per-cred handlers (merged PR #5418) — value producers feed bundle maps
- **081KSKBP80008QG0R003AX2A69.2b** future — persist/restore CLIs consume this module

## What this is NOT

- NOT the persist CLI (next slice; needs FS + passphrase prompt)
- NOT the restore CLI (next slice; same)
- NOT zflash \`--bake-cred\` integration (081KSKBP80008QG0R003AX2A69.9)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T07:47:33Z)

## Pull request overview

Adds the 081KSKBP80008QG0R003AX2A69.2a “envelope framing” layer for credential persistence by defining (1) a binary on-disk wire format for the encrypted envelope produced by `zeta-creds-crypto.ts`, and (2) a JSON plaintext schema (`CredBundle`) for the decrypted inner payload. This fits into the installer toolchain as the serialization boundary that future persist/restore CLIs will consume.

**Changes:**
- Introduces `serializeEnvelope` / `parseEnvelope` for a length-prefixed binary envelope format with a `ZCV1` header.
- Introduces `CredBundle` + `encodeBundle` / `decodeBundle` for base64-in-JSON plaintext encoding.
- Adds 17 unit tests covering round-trips and several framing/JSON error paths.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 6 comments.

| File | Description |
| ---- | ----------- |
| tools/installer/zeta-creds-envelope.ts | Implements wire-format framing for crypto envelopes plus CredBundle JSON encoding/decoding. |
| tools/installer/zeta-creds-envelope.test.ts | Adds unit tests for envelope framing, bundle encode/decode, and full pipeline round-trip. |

## Review threads

### Thread 1: tools/installer/zeta-creds-envelope.ts:46 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:47:31Z):

MIN_BLOB_LEN (and its comment) assumes ciphertext is at least 1 byte, but AES-GCM encrypt() can legitimately produce a 0-length ciphertext for empty plaintext. This makes parseEnvelope reject a valid serialized envelope. Consider allowing ciphertext_len=0 and adjusting MIN_BLOB_LEN accordingly (and add a test for the empty-plaintext case).

### Thread 2: tools/installer/zeta-creds-envelope.ts:106 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:47:32Z):

parseEnvelope validates the magic but never checks that the 4 reserved header bytes are zero. Since the wire format specifies reserved=0 for v1, consider rejecting blobs with non-zero reserved bytes to avoid silently accepting future/unknown variants.

### Thread 3: tools/installer/zeta-creds-envelope.ts:135 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:47:32Z):

The framing comment/spec says salt/iv/tag lengths are fixed (32/12/16), but parseEnvelope currently accepts any lengths and only fails later in decrypt(). Validating these length prefixes here (and returning a format-specific error) would make the wire format stricter and avoid ambiguous parsing when the blob is corrupted.

### Thread 4: tools/installer/zeta-creds-envelope.ts:222 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:47:32Z):

decodeBundle builds plain objects ({}) and assigns keys from decrypted JSON directly. If a key is "__proto__"/"constructor"/"prototype", this can lead to prototype pollution. Consider using Object.create(null) (or Map) for these dictionaries and/or explicitly rejecting dangerous keys.

### Thread 5: tools/installer/zeta-creds-envelope.ts:220 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:47:33Z):

Buffer.from(value, "base64") does not reliably reject invalid base64 (it may decode garbage/empty bytes). If you want decodeBundle to be strict about the on-disk plaintext schema, consider validating that each string is valid base64 and returning a structured error when it isn't.

### Thread 6: tools/installer/zeta-creds-envelope.test.ts:119 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:47:33Z):

These tests use real persona identifiers (e.g., "otto", "lior") as sample keys. If the project is trying to avoid persona-name attribution in code/tests, consider switching to neutral placeholders (e.g., "persona-a", "persona-b") so the tests stay policy-aligned.

## General comments

### @chatgpt-codex-connector (2026-05-27T07:43:47Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
