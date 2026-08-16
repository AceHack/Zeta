# `src/Core.TypeScript/crypto/better-git-crypt/` — 081KSNY2Z0008QG0R002JKH50A v1 (Phase 2: real crypto)

Post-quantum (Noble + XWing + ML-DSA-65 + CBOR envelope) replacement for legacy git-crypt, per [081KSNY2Z0008QG0R002JKH50A](../../../docs/backlog/P1/081KSNY2Z0008QG0R002JKH50A-better-gitcrypt-post-quantum-lattice-based-retraction-native-diff-readable-bouncy-castle-patterns-aaron-2026-05-28.md) + [v1 design memo](../../../docs/research/2026-05-28-b-0883-v1-design-memo-noble-xwing-mldsa65-cbor-envelope-with-locked-decisions.md).

## Scope

**Phase 1 (scaffold)**: declarative TS type substrate + CLI dispatcher + invariant tests.

- Algorithm registry (`ALG_REGISTRY`) typed per `AlgSpec` with `class` + `status` discriminator
- File envelope (`FileEnvelope`) typed per the v1 design memo's CBOR shape
- Encryption / decryption context types + feedback variants per asymmetric-authorship rule
- Validation invariants (`validateAlgRegistry` + `validateEnvelopeStructure` + `validateEncryptionContext`) enforced at runtime + by unit tests
- CLI scaffold with `--list-algs` / `--validate` / `--dry-run-envelope` modes

**Phase 2 (real crypto — IMPLEMENTED, operator-authorized 2026-05-31, `crypto.ts`)**:

- ✅ Real `@noble/post-quantum` integration — XWing KEM encapsulate/decapsulate + ML-DSA-65 sign/verify
- ✅ Real CBOR envelope encode/decode via `cborg` (canonical/deterministic — the signature is computed over the encoded bytes, so deterministic encoding makes sign/verify agree)
- ✅ Real ChaCha20-Poly1305 content + CEK-wrap AEAD via `@noble/ciphers`
- ✅ HKDF-SHA256 key derivation via `@noble/hashes`
- ✅ `generateRecipientKeyPair` / `encrypt` / `decrypt` / `encodeEnvelope` / `decodeEnvelope` — full round-trip, signature-first fail-closed verification, FIPS-203 implicit-rejection handling
- API shapes empirically verified against installed packages (`crypto.test.ts` — 23 tests: keygen, multi-recipient round-trip, tamper-detection, wrong-recipient, on-disk CBOR codec)

**File CLI (IMPLEMENTED — `files.ts` + `cli/main.ts` file modes)**:

- ✅ `--gen-recipient` — keypair → PUBLIC `.recipient.json` + SECRET `.secret.json` bundle (written `0600`)
- ✅ `--encrypt-file` / `--decrypt-file` — self-encrypt + multi-recipient; canonical CBOR `.zc` envelope; plaintext never enters git
- ✅ base64 key (de)serialization + Result-shaped feedback propagation (asymmetric-authorship)
- `files.test.ts` — serialization round-trip, self-encrypt round-trip, binary/empty payloads, tamper + wrong-key + garbage fail-closed, multi-recipient + dedup

**Still deferred (post-file-CLI)**:

- `git textconv` / clean-smudge filter integration (transparent encrypt-on-commit; diff-readable ciphertext)
- Multi-party recipient registry (`.zeta-crypt/recipients.json` + rotation per 081KSNY2Z0008QG0R0008EJDW1) — v1 file CLI passes recipients by path
- Multi-cipher hedge implementations (Saber / NTRU-Prime / FrodoKEM per 081KSNY2Z0008QG0R002ZAVMEK) — until TS-native impls mature
- Metadata encryption (filenames / commit messages per 081KSNY2Z0008QG0R0020KXAPS) — v1 content-only

## Dependencies (pinned current-latest per dep-pin-search-first-authority, verified 2026-05-31)

`@noble/post-quantum@0.6.1` · `@noble/ciphers@2.2.0` · `@noble/hashes@2.2.0` · `cborg@5.1.1`

## v1 algorithms (per design memo + 081KSNY2Z0008QG0R0037X4DP4 library landscape audit)

| Class     | Algorithm                          | Status                        | Noble module                                                                         |
| --------- | ---------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------ |
| KEM       | ML-KEM-768 + X25519 (XWing hybrid) | ships-v1                      | `@noble/post-quantum/ml-kem`                                                         |
| KEM       | Saber                              | deferred-alternate (081KSNY2Z0008QG0R002ZAVMEK) | —                                                                                    |
| KEM       | NTRU-Prime                         | deferred-alternate (081KSNY2Z0008QG0R002ZAVMEK) | —                                                                                    |
| KEM       | FrodoKEM                           | deferred-alternate (081KSNY2Z0008QG0R002ZAVMEK) | —                                                                                    |
| Signature | ML-DSA-65                          | ships-v1                      | `@noble/post-quantum/ml-dsa`                                                         |
| Signature | SLH-DSA (SPHINCS+)                 | deferred-alternate            | `@noble/post-quantum/slh-dsa` (Noble has it; crypto.ts v1 dispatches ML-DSA-65 only) |
| KDF       | HKDF-SHA256                        | ships-v1                      | `@noble/hashes/hkdf`                                                                 |
| AEAD      | ChaCha20-Poly1305                  | ships-v1                      | `@noble/ciphers/chacha`                                                              |

## On-disk wire format (canonical — authoritative as implemented)

The signed on-disk envelope is **canonical CBOR** (cborg) of a **flat, camelCase** object. This is the authoritative schema — it supersedes the v1 design memo's pre-implementation sketch (which used a nested/snake_case shape). `decodeEnvelope` enforces canonical bytes: it re-encodes the reconstructed envelope and rejects any input that isn't byte-identical (so non-canonical encodings AND unknown fields fail closed — the bytes are bit-locked to the signed content).

Fields: `version` (1), `context` (`"zeta.git-crypt.file.v1"`), `algKem`, `algKdf`, `algWrap`, `algContent`, `algSig`, `recipients[]` (`{ identity, kemCt, wrappedCek, kdfInfo }`), `ciphertext`, `contentNonce` (12 bytes), `signerIdentity`, `signature`. The ML-DSA-65 signature covers every field **except** `signature` itself (the "signed view"), with `context` inside the signed bytes for domain separation.

## CLI

```bash
# List ALG_REGISTRY by class
bun src/Core.TypeScript/crypto/better-git-crypt/cli/main.ts --list-algs

# Validate registry invariants (unique ids; ships-v1 algs present for each class)
bun src/Core.TypeScript/crypto/better-git-crypt/cli/main.ts --validate

# Dry-run envelope construction (synthetic FileEnvelope using ships-v1 primary algorithms)
bun src/Core.TypeScript/crypto/better-git-crypt/cli/main.ts --dry-run-envelope
```

### File encryption (real PQ crypto — `files.ts` wiring `crypto.ts`)

The manual-but-complete encrypt/decrypt path: the committed artifact is the
canonical CBOR envelope (the `.zc` ciphertext); plaintext never enters git. A
transparent git clean/smudge (or `textconv`) filter is the separate, still-
deferred integration.

```bash
# 1. Generate a keypair (you run this; you hold the secret bundle).
#    Writes <id>.recipient.json (PUBLIC, shareable) + <id>.secret.json (SECRET, 0600).
bun src/Core.TypeScript/crypto/better-git-crypt/cli/main.ts --gen-recipient you@zeta --out-dir ~/.zeta-keys

# 2. Self-encrypt a file (sender = sole recipient = you → only you can decrypt).
bun src/Core.TypeScript/crypto/better-git-crypt/cli/main.ts \
  --encrypt-file notes.txt --self-key ~/.zeta-keys/you@zeta.secret.json
#    → notes.txt.zc (commit this; keep notes.txt out of git)

# 3. Decrypt (round-trips byte-for-byte).
bun src/Core.TypeScript/crypto/better-git-crypt/cli/main.ts \
  --decrypt-file notes.txt.zc --key ~/.zeta-keys/you@zeta.secret.json --out notes.txt

# Multi-recipient: add --recipient <other.recipient.json> (repeatable) on encrypt;
# on decrypt, the non-sender recipient passes --sender-sig <sender.recipient.json>.
```

**Key-ownership (load-bearing security):** `encrypt` SIGNS with the sender's
secret key and the sender is a self-recipient — so self-encryption means ONLY
the holder of the secret bundle can read the output. The `.secret.json` is
yours: never commit it (gitignore it or keep it outside the repo). The
`.recipient.json` (public) is shareable/committable. `--gen-recipient` refuses
to overwrite an existing keypair (would destroy the only key for prior `.zc`)
unless `--force`; `--recipient` / `--sender-sig` refuse a `.secret.json` bundle
(you must pass the PUBLIC `.recipient.json`).

### Privacy face of the DynamicValue 4×4 (`dynamic-value.ts` — 081KSNY2Z0008QG0R002JKH50A × 081KT07NV0008QG0R0032MCYER)

`encryptValue` / `decryptValue` are the **privacy fence** over the DynamicValue
4×4 (a *memory-fence*-like barrier the plaintext↔ciphertext boundary crosses).
Privacy is a TRANSFORM, not a fifth byte-locked golden-vector codec: encryption
is nonce-non-deterministic, so `value → canonical CBOR` (the deterministic inner
the golden vectors pin) `→ PQ envelope → .zc`. Guarantee:
`decryptValue(encryptValue(v)) ≡ v` (VALUE identity) even though the `.zc` bytes
differ every call. Dependency direction: this tooling depends on the
`dynamic-value/cbor` library, never the reverse (the library stays crypto-free).

Exit codes:

- `0` — operation successful
- `1` — runtime failure (validation / crypto feedback / file I/O)
- `2` — usage error

### Memory-encrypt loop (`memory-encrypt-loop.ts` — self-encrypt a folder)

The loop over `--encrypt-file` for the "encrypt a folder of private memories" use
case. **Security model is load-bearing**: `encryptBytes(bytes, self, [])` makes
`self` the SENDER (signs) AND sole self-recipient, so pure self-encryption means
*only the holder of `self`'s secret bundle can decrypt*. Therefore
**only-the-owner-decrypts requires the key owner to be the sender** — the owner
runs the real encrypt with their own secret bundle. An agent cannot run it (no
secret bundle; generating one for the owner and holding it would defeat the
only-the-owner-decrypts property). An agent CAN run `--dry-run` (no key, no
writes) to preview.

```bash
# 1. one-time keygen (the agent never sees the secret):
bun src/Core.TypeScript/crypto/better-git-crypt/cli/main.ts --gen-recipient <identity> --out-dir ~/.zeta-keys
#    → ~/.zeta-keys/<identity>.{recipient,secret}.json   (.zeta-keys/ is gitignored)

# 2. self-encrypt (the key owner runs this; keep plaintext in a gitignored dir):
bun src/Core.TypeScript/crypto/better-git-crypt/memory-encrypt-loop.ts \
  --keys ~/.zeta-keys/<identity>.secret.json --in <in-dir> --out <out-dir>

# preview without a key (agent-safe — no writes):
bun src/Core.TypeScript/crypto/better-git-crypt/memory-encrypt-loop.ts --dry-run --in <in-dir> --out <out-dir>
```

`--in <dir>` / `--out <dir>` (required), `--keys <secret-bundle>` (required unless
`--dry-run`), `--in-ext` (default `.txt`), `--force` (overwrite existing `.zc`).
Each `.zc` decrypts to the EXACT input bytes (no edit/summary/redaction). Then the
agent commits the `.zc` (plaintext never leaves the gitignored input dir).

## Tests

```bash
bun test src/Core.TypeScript/crypto/better-git-crypt/
```

Invariants checked: unique alg ids; ships-v1 presence for each class (kem/signature/kdf/aead); registry catches duplicate ids + missing ships-v1; envelope catches wrong version + context mismatch + unknown algs + wrong-class-references + empty recipient set + empty signerIdentity; encryption context catches empty recipient set + sender-not-in-recipients + unsupported algs + invalid keys.

## Phase 2 — as implemented

Phase 2 landed as a single `crypto.ts` against the real primitives (NOT the
split-module / `cbor-x` sketch this section originally proposed — that plan is
superseded by what actually shipped):

- **Deps** (pinned): `@noble/post-quantum` (XWing KEM + `ml_dsa65`),
  `@noble/ciphers` (`chacha20poly1305`), `@noble/hashes` (`hkdf`/`sha256`),
  `cborg` (canonical CBOR). See "On-disk wire format" above for the authoritative
  envelope shape (flat camelCase — supersedes the earlier snake_case sketch).
- **`crypto.ts`** (single module, not split): `generateRecipientKeyPair`,
  `encrypt` / `decrypt` (Result-shaped: `Result<_, EncryptionFeedback>` /
  `Result<_, DecryptionFeedback>`), `encodeEnvelope` / `decodeEnvelope` (canonical
  CBOR with a non-canonical / unknown-field reject), and the signed-view encoder.
- **`crypto.test.ts`**: wiring + tamper-detection suite (round-trip,
  multi-recipient, every typed failure mode). Scope-honest — see that file's
  header: a green run proves the API composes, NOT cryptographic correctness.

Still future (NOT done in this PR): `git textconv` filter wiring, a recipients
registry / storage layer, alternate seed sources (Adinkra-derived per 081KRW63S0008QG0R000QJR08H,
HSM-derived), and optional standalone-npm packaging.

**Before it holds anything real**, the crypto-don't-rush gate below still
applies — KATs against Noble's vectors + formal verification + security-ops
review of the envelope and key-handling. A green wiring suite is necessary, not
sufficient.

## Phase 2 operator decisions (2026-05-29)

Operator-authorized Phase 2, with four decisions settled + a sequencing directive
(*"do what's easy first and expand; all those other opens should be backlogged and
picked up based on our audience"*). Process gate alongside: **KATs against Noble's
vectors, plus formal-verification and security-ops review of the
envelope and key-handling, BEFORE it holds anything real** (crypto-don't-rush).

| Decision                | Choice                             | Notes                                                                                                                                                                          |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Key custody**         | OS keychain                        | Per-machine secure store (macOS Keychain etc.); per-agent keypairs the same way; private keys never touch the repo.                                                            |
| **Key-loss / recovery** | N-of-M social recovery             | Any N of M trusted holders jointly recover; composes 081KRW63S0008QG0R0022SFKPM + the distributed-Guardian; preserve-forever survives a lost key.                                                  |
| **Tiers**               | Tiered lane; weapon-face uncreated | Tiers for agent-private + charged-personal; the working-bystander-harm-payload tier stays **uncreated**, not merely encrypted (don't-rush-something-that-can-hurt-bystanders). |
| **v1 scope**            | Crypto-only first                  | Encrypt/decrypt + KATs + peer-review first; Agora-V6 budget-gating (081KRW63S0008QG0R001Z10PVV / 081KSNY2Z0008QG0R000459FRH) deferred to a later step.                                                              |

### Easy-first slice (do now)

**Slice 1 — core content round-trip:** steps 1–4 and 7 above (deps → `ciphers/registry.ts`
with XWing-KEM, ML-DSA-65, ChaCha20-Poly1305, HKDF → `envelope.ts` CBOR →
`files/encrypt` and `files/decrypt` single-recipient round-trip → KATs against Noble
vectors). OS-keychain key-storage (decision 1) is the easy custody path. This is the
minimal verifiable lane; it does NOT yet hold real material (peer-review gate first).

### Backlog the rest, picked up by audience

Most deferred opens are **already backlogged** as 081KSNY2Z0008QG0R002JKH50A sub-rows — verify before minting:

| Deferred open                               | Existing row       | Audience                                      |
| ------------------------------------------- | ------------------ | --------------------------------------------- |
| Multi-cipher hedge                          | 081KSNY2Z0008QG0R002ZAVMEK           | crypto-resilience                             |
| Recipient rotation / revocation             | 081KSNY2Z0008QG0R0008EJDW1           | multi-agent                                   |
| Metadata (filename / commit-msg) encryption | 081KSNY2Z0008QG0R0020KXAPS           | privacy-completeness                          |
| Budget-gating (encryption-as-earned)        | 081KSNY2Z0008QG0R000459FRH / 081KRW63S0008QG0R001Z10PVV | Agora economy                                 |
| Readable-ciphertext format / textconv       | 081KSNY2Z0008QG0R0034JR61Z          | reviewers / glass-halo                        |
| Agent-private encrypted state               | 081KSNY2Z0008QG0R0030V5ZVS             | factory agents first, then co-maintainer ASAP |
| Encryption thermal-cost                     | 081KSNY2Z0008QG0R001A431CN             | thermodynamic substrate                       |

**Gaps to file** (the two decisions that lack a dedicated row): **N-of-M social recovery
infra** (audience: operator / preserve-forever) and **tier-tagging + weapon-face-uncreated
guard** (audience: safety-floor). These are the only new rows the decisions require.

## Composes-with substrate

- [081KSNY2Z0008QG0R002JKH50A](../../../docs/backlog/P1/081KSNY2Z0008QG0R002JKH50A-better-gitcrypt-post-quantum-lattice-based-retraction-native-diff-readable-bouncy-castle-patterns-aaron-2026-05-28.md) — canonical v1 design
- [081KSNY2Z0008QG0R0037X4DP4](../../../docs/backlog/P3/081KSNY2Z0008QG0R0037X4DP4-better-gitcrypt-library-landscape-audit-bouncy-castle-pqc-patterns-swapple-lattice-naming-clarification-aaron-2026-05-28.md) — library landscape audit (Noble recommendation)
- [081KSNY2Z0008QG0R002ZAVMEK](../../../docs/backlog/P2/081KSNY2Z0008QG0R002ZAVMEK-multi-cipher-pq-substrate-nist-plus-saber-ntru-prime-frodo-hedge-against-nist-monoculture-per-operator-2026-05-28.md) — multi-cipher hedge
- [081KSNY2Z0008QG0R001FN4DDB](../../../docs/backlog/P3/081KSNY2Z0008QG0R001FN4DDB-side-channel-scope-boundary-bound-to-git-at-rest-only-follow-up-tracking-aaron-2026-05-28.md) — side-channel scope boundary (git-at-rest only)
- [081KSNY2Z0008QG0R0020KXAPS](../../../docs/backlog/P3/081KSNY2Z0008QG0R0020KXAPS-metadata-encryption-filename-and-commit-message-follow-up-content-only-for-v1-per-operator-2026-05-28.md) — metadata encryption follow-up (content-only v1)
- [081KSNY2Z0008QG0R000459FRH](../../../docs/backlog/P1/081KSNY2Z0008QG0R000459FRH-glass-halo-open-by-default-encryption-as-earned-via-agora-v6-budget-not-encrypt-everything-aaron-2026-05-28.md) — glass-halo open-by-default
- [081KSNY2Z0008QG0R0034JR61Z](../../../docs/backlog/P2/081KSNY2Z0008QG0R0034JR61Z-plaintext-readable-ciphertext-format-research-base64-cbor-json-per-line-fpe-encrypted-yaml-aaron-2026-05-28.md) — plaintext-readable ciphertext format research
- [081KSNY2Z0008QG0R0030V5ZVS](../../../docs/backlog/P1/081KSNY2Z0008QG0R0030V5ZVS-agent-private-encrypted-state-otto-first-then-other-ais-asap-aaron-2026-05-28.md) — agent private encrypted state (factory-agent + co-maintainer ASAP consumer)
- [081KSNY2Z0008QG0R001A431CN](../../../docs/backlog/P3/081KSNY2Z0008QG0R001A431CN-encryption-thermal-cost-layer-above-landauer-floor-two-axis-substrate-classification-aaron-otto-2026-05-28.md) — encryption-thermal-cost two-axis classification
- [081KSNY2Z0008QG0R002QA720J](../../../docs/backlog/P1/081KSNY2Z0008QG0R002QA720J-three-lanes-concurrent-operating-discipline-encryption-plus-zflash-plus-state-machine-substrate-until-each-lane-backlog-drains-per-operator-2026-05-28.md) — three-lanes-concurrent (this advances the encryption lane)
- [081KRW63S0008QG0R000QJR08H](../../../docs/backlog/P2/) — Adinkras-ECC seed source future
- [v1 design memo](../../../docs/research/2026-05-28-b-0883-v1-design-memo-noble-xwing-mldsa65-cbor-envelope-with-locked-decisions.md)
- [081KSNY2Z0008QG0R002SZZ5Y0 + Amara persist-as-bridge ferry](../../../docs/backlog/P3/) — encryption operation IS one specific Persist-as-bridge instance (encrypted ciphertext flows to substrate for future Observe / decrypt; TFeedback variants below ARE the Persist-bridge's authorial feedback channel)

## Composes-with rules

- `asymmetric-authorship` (per-cipher TFeedback authorship; EncryptionFeedback + DecryptionFeedback variants)
- `monad-propagation-pattern-cross-language-substrate-shape` (Result-shape feedback)
- `ople-primitives-surface-t-and-tfeedback` (encryption IS Persist-as-bridge per 081KSNY2Z0008QG0R002SZZ5Y0)
- `function-is-tiny-control-flow-generator-ocp-applied-to-control-flow` (each cipher operation is a control-flow generator)
- `forgetting-costs-energy-remembering-is-cheap` (axiom-preservation via validateAlgRegistry at init-time)
- `rule-0-no-sh-files` + `zeta-ships-with-skills-immediate-value`
- `verify-existing-substrate-before-authoring` (this scaffold extends the v1 design memo's recommended module layout rather than mints parallel)
- `never-be-idle` + `holding-without-named-dependency-is-standing-by-failure` + `081KSNY2Z0008QG0R002QA720J three-lanes-concurrent` (this advances the encryption lane)

## Safety + scope boundaries (per design memo)

- **Bounded to git-at-rest threat model** (081KSNY2Z0008QG0R001FN4DDB) — no timing-observable deployment; pure-JS Noble side-channel limitation explicit
- **Forward-only revocation v1** (081KSNY2Z0008QG0R0008EJDW1 future) — recipient-set rotation supported; retroactive revocation needs content-addressed-store substrate
- **Content-only encryption v1** (081KSNY2Z0008QG0R0020KXAPS) — filenames + commit messages + .gitattributes leak; metadata protection deferred to v2+
- **Side-channel scope explicit** — Noble is pure-JS; not constant-time-guaranteed at native level; acceptable for git-at-rest, not for timing-observable adversaries
