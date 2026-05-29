# `tools/crypto/better-git-crypt/` — B-0883 v1 PoC scaffold

PoC scaffold for the better-git-crypt v1 spec — post-quantum (Noble + XWing + ML-DSA-65 + CBOR envelope) replacement for legacy git-crypt, per [B-0883](../../../docs/backlog/P1/B-0883-better-gitcrypt-post-quantum-lattice-based-retraction-native-diff-readable-bouncy-castle-patterns-aaron-2026-05-28.md) + [v1 design memo](../../../docs/research/2026-05-28-b-0883-v1-design-memo-noble-xwing-mldsa65-cbor-envelope-with-locked-decisions.md).

## Scope

**PoC**: declarative TS type substrate + CLI dispatcher + invariant tests. Implements:

- Algorithm registry (`ALG_REGISTRY`) typed per `AlgSpec` with `class` + `status` discriminator
- File envelope (`FileEnvelope`) typed per the v1 design memo's CBOR shape
- Encryption / decryption context types + feedback variants per asymmetric-authorship rule
- Validation invariants (`validateAlgRegistry` + `validateEnvelopeStructure` + `validateEncryptionContext`) enforced at runtime + by unit tests
- CLI scaffold with `--list-algs` / `--validate` / `--dry-run-envelope` modes

**NOT in PoC** (deferred to Phase 2 operator-authorized work):

- Real `@noble/post-quantum` integration (KEM + signature operations)
- Real CBOR encoding (cbor-x or similar)
- Real ChaCha20-Poly1305 content encryption via `@noble/ciphers`
- HKDF-SHA256 key derivation via `@noble/hashes`
- `git textconv` filter integration for diff-readable ciphertext
- Recipient management (`.zeta-crypt/recipients.json` + rotation per B-0883.3)
- Multi-cipher hedge implementations (Saber / NTRU-Prime / FrodoKEM per B-0883.2) — deferred until TS-native impls mature
- Metadata encryption (filenames / commit messages per B-0883.5) — v1 content-only

## v1 algorithms (per design memo + B-0883.1 library landscape audit)

| Class | Algorithm | Status | Noble module |
|---|---|---|---|
| KEM | ML-KEM-768 + X25519 (XWing hybrid) | ships-v1 | `@noble/post-quantum/ml-kem` |
| KEM | Saber | deferred-alternate (B-0883.2) | — |
| KEM | NTRU-Prime | deferred-alternate (B-0883.2) | — |
| KEM | FrodoKEM | deferred-alternate (B-0883.2) | — |
| Signature | ML-DSA-65 | ships-v1 | `@noble/post-quantum/ml-dsa` |
| Signature | SLH-DSA (SPHINCS+) | ships-v1 | `@noble/post-quantum/slh-dsa` |
| KDF | HKDF-SHA256 | ships-v1 | `@noble/hashes/hkdf` |
| AEAD | ChaCha20-Poly1305 | ships-v1 | `@noble/ciphers/chacha` |

## CLI

```bash
# List ALG_REGISTRY by class
bun tools/crypto/better-git-crypt/cli/main.ts --list-algs

# Validate registry invariants (unique ids; ships-v1 algs present for each class)
bun tools/crypto/better-git-crypt/cli/main.ts --validate

# Dry-run envelope construction (synthetic FileEnvelope using ships-v1 primary algorithms)
bun tools/crypto/better-git-crypt/cli/main.ts --dry-run-envelope
```

Exit codes:

- `0` — operation successful
- `1` — runtime validation FAILED (registry invariant OR envelope structure)
- `2` — usage error

## Tests

```bash
bun test tools/crypto/better-git-crypt/
```

Invariants checked: unique alg ids; ships-v1 presence for each class (kem/signature/kdf/aead); registry catches duplicate ids + missing ships-v1; envelope catches wrong version + context mismatch + unknown algs + wrong-class-references + empty recipient set + empty signerIdentity; encryption context catches empty recipient set + sender-not-in-recipients + unsupported algs + invalid keys.

## Phase 2 integration protocol

When operator authorizes Phase 2:

1. Add `@noble/post-quantum`, `@noble/ciphers`, `@noble/hashes`, and a CBOR library (e.g. `cbor-x`) to `package.json`
2. Implement `ciphers/registry.ts` dispatch:
   - `mlKem768Encapsulate(pk: Uint8Array): { ct: Uint8Array; ss: Uint8Array }`
   - `mlKem768Decapsulate(sk: Uint8Array, ct: Uint8Array): Uint8Array`
   - `xwingHybrid` wrapper composing ML-KEM-768 + X25519
   - `mlDsa65Sign(sk: Uint8Array, msg: Uint8Array): Uint8Array`
   - `mlDsa65Verify(pk: Uint8Array, msg: Uint8Array, sig: Uint8Array): boolean`
3. Implement `envelope.ts` CBOR encode/decode
4. Implement `files/encrypt.ts` + `files/decrypt.ts` round-trip
5. Implement `recipients/manage.ts` + `recipients/storage.ts`
6. Implement `seed/sources.ts` with random-bytes ships-v1; Adinkra-derived per B-0623 future
7. Add round-trip integration tests + KAT (Known-Answer Tests) per Noble's KAT vectors
8. Wire `files/textconv.ts` for `git textconv` filter (diff-readable ciphertext)
9. Optional: ship as standalone npm package OR keep internal to tools/

## Phase 2 operator decisions (2026-05-29)

Operator-authorized Phase 2, with four decisions settled + a sequencing directive
(*"do what's easy first and expand; all those other opens should be backlogged and
picked up based on our audience"*). Process gate alongside: **KATs against Noble's
vectors, plus formal-verification and security-ops review of the
envelope and key-handling, BEFORE it holds anything real** (crypto-don't-rush).

| Decision | Choice | Notes |
|---|---|---|
| **Key custody** | OS keychain | Per-machine secure store (macOS Keychain etc.); per-agent keypairs the same way; private keys never touch the repo. |
| **Key-loss / recovery** | N-of-M social recovery | Any N of M trusted holders jointly recover; composes B-0634 + the distributed-Guardian; preserve-forever survives a lost key. |
| **Tiers** | Tiered lane; weapon-face uncreated | Tiers for agent-private + charged-personal; the working-bystander-harm-payload tier stays **uncreated**, not merely encrypted (don't-rush-something-that-can-hurt-bystanders). |
| **v1 scope** | Crypto-only first | Encrypt/decrypt + KATs + peer-review first; Agora-V6 budget-gating (B-0646 / B-0883.16) deferred to a later step. |

### Easy-first slice (do now)

**Slice 1 — core content round-trip:** steps 1–4 and 7 above (deps → `ciphers/registry.ts`
with XWing-KEM, ML-DSA-65, ChaCha20-Poly1305, HKDF → `envelope.ts` CBOR →
`files/encrypt` and `files/decrypt` single-recipient round-trip → KATs against Noble
vectors). OS-keychain key-storage (decision 1) is the easy custody path. This is the
minimal verifiable lane; it does NOT yet hold real material (peer-review gate first).

### Backlog the rest, picked up by audience

Most deferred opens are **already backlogged** as B-0883 sub-rows — verify before minting:

| Deferred open | Existing row | Audience |
|---|---|---|
| Multi-cipher hedge | B-0883.2 | crypto-resilience |
| Recipient rotation / revocation | B-0883.3 | multi-agent |
| Metadata (filename / commit-msg) encryption | B-0883.5 | privacy-completeness |
| Budget-gating (encryption-as-earned) | B-0883.16 / B-0646 | Agora economy |
| Readable-ciphertext format / textconv | B-0883.17 | reviewers / glass-halo |
| Agent-private encrypted state | B-0885 | factory agents first, then co-maintainer ASAP |
| Encryption thermal-cost | B-0906 | thermodynamic substrate |

**Gaps to file** (the two decisions that lack a dedicated row): **N-of-M social recovery
infra** (audience: operator / preserve-forever) and **tier-tagging + weapon-face-uncreated
guard** (audience: safety-floor). These are the only new rows the decisions require.

## Composes-with substrate

- [B-0883](../../../docs/backlog/P1/B-0883-better-gitcrypt-post-quantum-lattice-based-retraction-native-diff-readable-bouncy-castle-patterns-aaron-2026-05-28.md) — canonical v1 design
- [B-0883.1](../../../docs/backlog/P3/B-0883.1-better-gitcrypt-library-landscape-audit-bouncy-castle-pqc-patterns-swapple-lattice-naming-clarification-aaron-2026-05-28.md) — library landscape audit (Noble recommendation)
- [B-0883.2](../../../docs/backlog/P2/B-0883.2-multi-cipher-pq-substrate-nist-plus-saber-ntru-prime-frodo-hedge-against-nist-monoculture-per-operator-2026-05-28.md) — multi-cipher hedge
- [B-0883.4](../../../docs/backlog/P3/B-0883.4-side-channel-scope-boundary-bound-to-git-at-rest-only-follow-up-tracking-aaron-2026-05-28.md) — side-channel scope boundary (git-at-rest only)
- [B-0883.5](../../../docs/backlog/P3/B-0883.5-metadata-encryption-filename-and-commit-message-follow-up-content-only-for-v1-per-operator-2026-05-28.md) — metadata encryption follow-up (content-only v1)
- [B-0883.16](../../../docs/backlog/P1/B-0883.16-glass-halo-open-by-default-encryption-as-earned-via-agora-v6-budget-not-encrypt-everything-aaron-2026-05-28.md) — glass-halo open-by-default
- [B-0883.17](../../../docs/backlog/P2/B-0883.17-plaintext-readable-ciphertext-format-research-base64-cbor-json-per-line-fpe-encrypted-yaml-aaron-2026-05-28.md) — plaintext-readable ciphertext format research
- [B-0885](../../../docs/backlog/P1/B-0885-agent-private-encrypted-state-otto-first-then-other-ais-asap-aaron-2026-05-28.md) — agent private encrypted state (factory-agent + co-maintainer ASAP consumer)
- [B-0906](../../../docs/backlog/P3/B-0906-encryption-thermal-cost-layer-above-landauer-floor-two-axis-substrate-classification-aaron-otto-2026-05-28.md) — encryption-thermal-cost two-axis classification
- [B-0892](../../../docs/backlog/P1/B-0892-three-lanes-concurrent-operating-discipline-encryption-plus-zflash-plus-state-machine-substrate-until-each-lane-backlog-drains-per-operator-2026-05-28.md) — three-lanes-concurrent (this advances the encryption lane)
- [B-0623](../../../docs/backlog/P2/) — Adinkras-ECC seed source future
- [v1 design memo](../../../docs/research/2026-05-28-b-0883-v1-design-memo-noble-xwing-mldsa65-cbor-envelope-with-locked-decisions.md)
- [B-0897 + Amara persist-as-bridge ferry](../../../docs/backlog/P3/) — encryption operation IS one specific Persist-as-bridge instance (encrypted ciphertext flows to substrate for future Observe / decrypt; TFeedback variants below ARE the Persist-bridge's authorial feedback channel)

## Composes-with rules

- `asymmetric-authorship` (per-cipher TFeedback authorship; EncryptionFeedback + DecryptionFeedback variants)
- `monad-propagation-pattern-cross-language-substrate-shape` (Result-shape feedback)
- `ople-primitives-surface-t-and-tfeedback` (encryption IS Persist-as-bridge per B-0897)
- `function-is-tiny-control-flow-generator-ocp-applied-to-control-flow` (each cipher operation is a control-flow generator)
- `forgetting-costs-energy-remembering-is-cheap` (axiom-preservation via validateAlgRegistry at init-time)
- `rule-0-no-sh-files` + `zeta-ships-with-skills-immediate-value`
- `verify-existing-substrate-before-authoring` (this scaffold extends the v1 design memo's recommended module layout rather than mints parallel)
- `never-be-idle` + `holding-without-named-dependency-is-standing-by-failure` + `B-0892 three-lanes-concurrent` (this advances the encryption lane)

## Safety + scope boundaries (per design memo)

- **Bounded to git-at-rest threat model** (B-0883.4) — no timing-observable deployment; pure-JS Noble side-channel limitation explicit
- **Forward-only revocation v1** (B-0883.3 future) — recipient-set rotation supported; retroactive revocation needs content-addressed-store substrate
- **Content-only encryption v1** (B-0883.5) — filenames + commit messages + .gitattributes leak; metadata protection deferred to v2+
- **Side-channel scope explicit** — Noble is pure-JS; not constant-time-guaranteed at native level; acceptable for git-at-rest, not for timing-observable adversaries
