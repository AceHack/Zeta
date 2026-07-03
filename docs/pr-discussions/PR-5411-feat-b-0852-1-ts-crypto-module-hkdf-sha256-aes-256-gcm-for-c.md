---
pr_number: 5411
title: "feat(081KSKBP80008QG0R003AX2A69.1): TS crypto module \u2014 HKDF-SHA256 + AES-256-GCM for credential persistence (pure functions; 18 unit tests; smallest concrete substrate slice)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T06:53:21Z"
merged_at: "2026-05-27T07:05:08Z"
closed_at: "2026-05-27T07:05:08Z"
head_ref: "feat/b-0852-1-crypto-module-aes-gcm-hkdf"
base_ref: "main"
archived_at: "2026-05-27T19:25:21Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5411: feat(081KSKBP80008QG0R003AX2A69.1): TS crypto module — HKDF-SHA256 + AES-256-GCM for credential persistence (pure functions; 18 unit tests; smallest concrete substrate slice)

## PR description

## Summary

Smallest concrete substrate slice of 081KSKBP80008QG0R003AX2A69 cred-persistence. Pure crypto functions; no I/O; 18 unit tests covering the threat model.

## Threat model (Phase 1 scope per 081KSKBP80008QG0R003AX2A69 row body)

- HKDF-SHA256 binds key to `(USB-UUID || passphrase)` — copying ESP contents to a different-UUID USB cannot decrypt (defeats "copy to uuid" attack named by Aaron 2026-05-27)
- AES-256-GCM authenticated encryption rejects tampered ciphertext/tag/salt
- Wrong passphrase → different derived key → GCM auth tag fails → returns `{ error }` (NOT garbled plaintext)
- Phase 3 (NOT this row): hardware-bound keys defer the "stole USB + knows pass + knows UUID" case

## Files

| File | Lines | Purpose |
|---|---|---|
| `tools/installer/zeta-creds-crypto.ts` | ~135 | `deriveKey` + `encrypt` + `decrypt` pure module |
| `tools/installer/zeta-creds-crypto.test.ts` | ~190 | 18 acceptance tests |

## Test output

```
 18 pass
 0 fail
 23 expect() calls
Ran 18 tests across 1 file. [103.00ms]
```

Tests cover: round-trip (small/empty/1MiB), wrong passphrase, wrong UUID (copy-to-different-USB attack), tampered ciphertext (byte flip), tampered tag, tampered salt, malformed IV/tag sizes, HKDF determinism, HKDF independence (UUID/passphrase/salt sensitivity), salt + IV freshness across calls.

## Composes with

- **081KSKBP80008QG0R003AX2A69** (parent row) — credential persistence on USB ESP + boot-sequence auth-method picker
- **081KSKBP80008QG0R003AX2A69.2** (next sub-row) — TS persist/restore CLIs consuming this module's `encrypt`/`decrypt`
- **081KSKBP80008QG0R003AX2A69.5** (sibling sub-row) — declarative cred-manifest schema (this module is the cipher layer; manifest is the data-shape layer)
- node:crypto `hkdfSync` + `createCipheriv("aes-256-gcm", ...)` — standard primitives; no third-party dep

## What this is NOT

- NOT the persist/restore CLI (081KSKBP80008QG0R003AX2A69.2)
- NOT the cred-manifest schema (081KSKBP80008QG0R003AX2A69.5)
- NOT the NixOS module (081KSKBP80008QG0R002XBRGN8)
- NOT serialization of the envelope (081KSKBP80008QG0R003AX2A69.2 will length-prefix-pack salt+iv+tag+ciphertext)
- NOT hardware-bound keys (Phase 3; explicit deferral)

## Test plan

- [x] `bun test tools/installer/zeta-creds-crypto.test.ts` → 18 pass
- [x] `prettier --check` clean
- [ ] CI passes typecheck + format + test gates
- [ ] No third-party dep added (verified: node:crypto + bun:test only)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T06:56:32Z)

## Pull request overview

Adds a small, pure TypeScript crypto substrate for 081KSKBP80008QG0R003AX2A69 credential persistence, implementing key derivation + authenticated encryption and validating the Phase-1 threat model via Bun unit tests.

**Changes:**

- Introduces `deriveKey` (HKDF-SHA256) and `encrypt`/`decrypt` (AES-256-GCM) as pure functions with a structured envelope shape.
- Adds 18 Bun acceptance tests covering round-trips, wrong passphrase/UUID, and tamper rejection cases.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 5 comments.

| File | Description |
| ---- | ----------- |
| tools/installer/zeta-creds-crypto.ts | New pure crypto module: HKDF-based key derivation and AES-256-GCM encrypt/decrypt with envelope output. |
| tools/installer/zeta-creds-crypto.test.ts | New Bun test suite validating round-trip behavior and tamper/wrong-key rejection properties. |

## Review threads

### Thread 1: tools/installer/zeta-creds-crypto.ts:123 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T06:56:31Z):

decrypt() calls deriveKey(envelope.salt) without validating salt length. Since deriveKey throws on wrong-length salt, decrypt can throw instead of returning the advertised { error } value, defeating the no-try/catch contract for callers. Suggest: validate envelope.salt.length === SALT_LEN up front (and/or wrap deriveKey in the existing try/catch) and return a structured error on mismatch.

### Thread 2: tools/installer/zeta-creds-crypto.ts:77 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T06:56:31Z):

Using HKDF with (UUID || passphrase) as the IKM provides key separation but does not add any work factor against offline passphrase guessing if an attacker can read the encrypted blob. If the passphrase is human-memorable, consider switching to a password-based KDF (e.g., scrypt/pbkdf2 with an explicit cost) before/alongside HKDF so Phase 1 also resists offline brute force in the “USB stolen” scenario.

### Thread 3: tools/installer/zeta-creds-crypto.ts:60 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T06:56:31Z):

Typo in the doc comment quote: "wnated" → "wanted".

### Thread 4: tools/installer/zeta-creds-crypto.test.ts:29 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T06:56:32Z):

Test fixture uses a token-like string starting with "ghp_". Even if fake, this can trip secret-scanning / regex-based detectors and create noisy alerts. Suggest using a clearly-non-token placeholder (avoid real token prefixes) for the sample JSON payload.

### Thread 5: tools/installer/zeta-creds-crypto.test.ts:172 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T06:56:32Z):

Coverage gap: decrypt() has explicit validation for IV and tag lengths, but there is no test asserting behavior for malformed salt length in the envelope. Once decrypt validates salt length (and returns { error } rather than throwing), add a test case for wrong-length salt to lock in the non-throwing contract.

## General comments

### @chatgpt-codex-connector (2026-05-27T06:53:26Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
