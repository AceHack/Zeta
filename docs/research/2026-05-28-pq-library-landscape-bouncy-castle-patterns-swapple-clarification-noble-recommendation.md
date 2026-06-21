# Library landscape audit — better-git-crypt PQ substrate (081KSNY2Z0008QG0R0037X4DP4 spike)

**Author:** Otto-CLI (audit pass via background research agent; not a decision)
**Date:** 2026-05-28
**Parent rows:** 081KSNY2Z0008QG0R002JKH50A (better-git-crypt parent), 081KSNY2Z0008QG0R0030V5ZVS (agent private encrypted state ASAP for Otto + Addison), 081KRW63S0008QG0R000QJR08H (Adinkras-ECC substrate)
**Triggering ask:** Operator 2026-05-28 — *"post quantium lattice based with swapple lattice we can do in ts if it's easie enough or we can pull in libraries"* + *"look at bouncy castle or someting or some other libaries and copy patterns"*
**Prior decision context:** [git-crypt deep-dive 2026-04-21](./git-crypt-deep-dive-2026-04-21.md) — git-crypt REJECTED for 3 reasons (no revocation, binary diffs break review, metadata leak). The better-git-crypt must add those 3 properties + PQ posture.
**Status:** Research-grade audit; recommendation included; no commits / no code.

---

## TL;DR

- **"Swapple lattice" is not a standard scheme name.** Most-likely interpretation: operator was reaching for **SWOOSH** (Gajland et al. 2023, USENIX Sec 2024) — Module-LWE-based lattice non-interactive key exchange. Secondary candidates: SWIFFT (hash, 2008), Saber (Module-LWR KEM, NIST Round 3 eliminated). Don't collapse — surface to operator. **Most-likely:** operator coined "swapple" as phonetic blend of SWOOSH + lattice marker; alternatively coinage for "any TS-friendly lattice KEM."
- **Bouncy Castle PQC patterns are mature + worth adapting.** Their pattern is `Provider → KeyPairGenerator → ParameterSpec → KEMGenerator/KEMExtractor`. PKCS8/SPKI encoded formats standardized. CMS+KEM per RFC 9629 is right pattern for wrapping symmetric content keys. **Adapt the shapes; don't adopt Java surface (Zeta is TS-first per Rule 0).**
- **Recommendation for 081KSNY2Z0008QG0R002JKH50A prototype: `@noble/post-quantum`** (TS-native, MIT, audit-by-author 2026-04, ~16KB gzipped, hybrid XWing built-in, used by Protonmail/Tutanota/MetaMask/Phantom). Use **XWing (ML-KEM-768 + X25519 hybrid)** for KEM, **ML-DSA-65** for signatures. Wrap CMS+KEM-style pattern around it. Sonatype invocation attempted (auth required; deferred to PR-time gate).
- **Strong alternative path:** skip building from scratch; adopt **age 1.3.0+ with `-pq` flag** (native ML-KEM-768+X25519 hybrid recipients) + `git-agecrypt` (MPL-2.0; textconv-filter readable diffs; recipient-rotation revocation). "Buy not build" answer.
- **Adinkras-ECC (081KRW63S0008QG0R000QJR08H) composes but is upstream research.** Don't gate 081KSNY2Z0008QG0R0030V5ZVS's ASAP delivery on it. Ship with NIST-standardized ML-KEM/ML-DSA today; Adinkras-ECC swaps in later via parameterized seed source.

---

## Section 1 — Bouncy Castle PQC patterns

Bouncy Castle 1.78+ ships Kyber + Dilithium + Falcon + SPHINCS+ + NTRU + NTRU Prime + Saber + FrodoKEM + HQC + BIKE + Classic McEliece + Picnic. 1.79+ added CMS+KEM-in-CMS support per RFC 9629 + signature-context-strings for ML-DSA.

### 1.1 KEM family pattern (Kyber/ML-KEM)

```java
KeyPairGenerator kpg = KeyPairGenerator.getInstance("Kyber", "BCPQC");
kpg.initialize(KyberParameterSpec.kyber768);
KeyPair keyPair = kpg.generateKeyPair();

KEMGenerator kemGen = new KyberKEMGenerator(new SecureRandom());
SecretKeyWithEncapsulation senderSecret = kemGen.generateEncapsulated(keyPair.getPublic());
byte[] sharedSecret = senderSecret.getEncoded();
byte[] cipherText = senderSecret.getEncapsulation();

KEMExtractor kemExt = new KyberKEMExtractor(keyPair.getPrivate());
byte[] receiverSharedSecret = kemExt.extractSecret(cipherText);
```

**TS-side adapt:** preserve role separation (`KemSender` vs `KemReceiver` types) to catch role-confusion bugs at compile time. `{cipherText, sharedSecret}` envelope record matches noble's shape. **Adopt RFC 9629 CMS+KEM pattern** (KEM-derived shared secret wraps symmetric CEK; CEK encrypts content) with CBOR encoding instead of ASN.1.

### 1.2 Signature family pattern (Dilithium/ML-DSA)

JCE update-then-sign streaming pattern. TS libraries collapse to stateless `sign`/`verify` — fine for file-sized content. **Adopt signature context strings** (BC 1.79+) — use `"zeta.git-crypt.cek-wrap.v1"` to bind signatures to their domain; prevents cross-protocol replay.

### 1.3 Encoded-format conventions

BC uses PKCS8 for private keys + SubjectPublicKeyInfo (SPKI/X.509) for public keys. Standard OIDs: ML-KEM-768 = `2.16.840.1.101.3.4.4.2`, ML-DSA-65 = `2.16.840.1.101.3.4.3.18`, SLH-DSA-SHA2-128s = `2.16.840.1.101.3.4.3.20`.

**Adapt:** provide TWO key encodings — raw bytes (default; small) + PKCS8/SPKI (optional interop layer). Don't reinvent ASN.1.

### 1.4 Error handling

BC's KEM extractor returns rejection symmetric key on bad ciphertext — **FIPS 203 mandatory behavior (implicit rejection)** preventing timing oracles.

**Critical adapt:** the KEM call itself MUST NOT throw on bad ciphertext — that creates timing oracle. Use separate MAC tag (timing-safe-compare) to detect garbled ciphertext after KEM produces (possibly-pseudo-random) shared secret. Wrap in `Result<SharedSecret, KemStructuralError>` per Zeta's Result-over-exception convention.

### 1.5 Side-channel mitigations

BC inherits from CRYSTALS-Kyber + CRYSTALS-Dilithium reference. **Affected by KyberSlash 2024** (secret-dependent division timings); patched December 2023. **Clangover May 2024** showed Clang versions could reintroduce timing variance via codegen — fundamental challenge for JS/TS (V8 may emit branches our source code doesn't have).

**For 081KSNY2Z0008QG0R0030V5ZVS threat model** (Otto+Addison private state encrypted at rest in git; adversary obtains commit blobs but not key material or timing): **timing channels aren't the primary worry**. Side-channels matter when adversary observes wall-clock decapsulation across many runs (TLS handshakes, smartcard probing). For agent private state, adversary sees ciphertext only. **Document clearly in 081KSNY2Z0008QG0R002JKH50A design; revisit if threat model changes.**

### 1.6 What to adapt vs avoid (summary table)

| BC pattern | Adapt? | Reason |
|---|---|---|
| `Provider → KeyPairGenerator → ParameterSpec` dispatch | Adapt **shape** | Named-variant TS factories |
| `KEMGenerator` / `KEMExtractor` role separation | **Adapt** | Compile-time role-confusion catch |
| `SecretKeyWithEncapsulation` envelope | **Adapt** as record | Standard noble shape |
| RFC 9629 CMS+KEM wrap | **Adapt** with CBOR/JSON | Core "wrap symmetric CEK per recipient via KEM" pattern correct |
| PKCS8 / SPKI encoded keys | **Optional interop layer** | Default raw bytes; encoder for non-JS interop |
| Signature context strings (1.79+) | **Adapt** | Prevents cross-protocol signature reuse |
| Implicit rejection in decaps | **Adapt** + enforce in tests | FIPS 203 mandatory; timing-safe |
| Streaming `Signature.update()` API | Avoid | Not needed for file-sized content |
| JCE Provider registration | Avoid | Java-specific |
| ASN.1 wire formats throughout | Avoid by default | CBOR/JSON; ASN.1 only for explicit interop |
| Exception-based errors | Avoid | Result-over-exception per Zeta convention |

---

## Section 2 — "Swapple lattice" naming clarification

Operator named "swapple lattice" — **not a standard scheme name.** Zero hits in academic/industry search corpora. Don't collapse on a guess; surface candidates per `god-tier-claims-high-signal-high-suspicion-dont-collapse.md` PERSONAL INVARIANT.

### 2.1 Candidate 1: SWOOSH (most-likely)

**SWOOSH** — Gajland, de Kock, Quaresma, Malavolta, Schwabe (2023) — USENIX Security 2024. Lattice-based non-interactive key exchange (NIKE) over Module-LWE.

- **Phonetic similarity:** "swoosh" → "swapple" (operator speaking; "swoosh" + "apple" could blur)
- **Substrate fit:** NIKE shape is exactly what git-crypt-style workflows want — each contributor publishes public key once; senders derive shared secrets without per-message handshakes
- **Maturity:** Academic 2023; reference impl in Rust+Jasmin; **no production library yet**
- **Trade-offs:** Public keys ~5-10× ML-KEM-768 size; acceptable for git-stored keys (one-time-publish)
- **Why likely:** SWOOSH's NIKE property is what makes "do in TS" feasible (no protocol state)

### 2.2 Candidate 2: SWIFFT (low probability)

**SWIFFT** — Lyubashevsky et al. 2008 — lattice-based hash function. Wrong primitive class (hash, not encryption/KEM). Could be sub-component but doesn't carry encryption load.

### 2.3 Candidate 3: Saber (eliminated NIST Round 3)

**Saber** — KU Leuven — Module-LWR KEM. NIST Round 3 finalist; eliminated when ML-KEM won. Adopting today is contrarian bet against NIST consensus — defensible only if operator has specific reason to distrust ML-KEM (none named).

### 2.4 Candidate 4: operator coinage / shadow-autocomplete artifact

Operator's substrate-honest disclosure history includes coined terms ("Dinkris" / "Jane's gate" for Adinkras per 081KRW63S0008QG0R000QJR08H). "Swapple" could be private coinage gesturing at "any TS-friendly lattice KEM."

### 2.5 Most-likely interpretation

**Default-to-both:**

1. **Reading A (most likely):** SWOOSH — operator absorbed name from recent reading
2. **Reading B (plausible):** operator coinage for "any TS-friendly lattice KEM"

**Operational disposition:** Even if operator meant SWOOSH specifically, the practical answer is **ML-KEM-768 (same Module-LWE family; production-ready; NIST-standardized)** since SWOOSH itself isn't production-ready. Both readings converge.

---

## Section 3 — TypeScript PQ library survey

### 3.1 `@noble/post-quantum` (primary recommendation)

| Field | Value |
|---|---|
| Maintainer | Paul Miller (paulmillr); Noble crypto ecosystem |
| License | MIT |
| Latest version | 0.6.1 (2026-04-12) |
| Algorithms | ML-KEM (512/768/1024), ML-DSA (44/65/87), SLH-DSA (12 variants), Falcon (512/1024), XWing hybrid |
| Dependencies | `@noble/hashes` + `@noble/curves` (pinned) |
| Bundle size | ~16KB gzipped (entire library) |
| Node / Browser / Bun / Deno | All supported (pure JS) |
| TypeScript | First-class |
| Audit | Self-audited 2026-04; no independent third-party audit |
| Side-channel | None (pure JS cannot guarantee constant-time) |
| Production users | Protonmail, Tutanota, MetaMask, Phantom, Kraken, Polymarket, Keycloak |
| KyberSlash | Fixed; current version unaffected |

**API:**

```ts
import { ml_kem768 } from '@noble/post-quantum/ml-kem';
const alice = ml_kem768.keygen();
const { cipherText, sharedSecret: bobShared } = ml_kem768.encapsulate(alice.publicKey);
const aliceShared = ml_kem768.decapsulate(cipherText, alice.secretKey);

import { ml_dsa65 } from '@noble/post-quantum/ml-dsa';
const signer = ml_dsa65.keygen();
const signature = ml_dsa65.sign(message, signer.secretKey);
const valid = ml_dsa65.verify(signature, message, signer.publicKey);

import { xwing } from '@noble/post-quantum/hybrid';
// xwing = ml_kem768 + X25519
```

**Strengths:** 16KB gzipped order-of-magnitude smaller than WASM alternatives; pure JS no supply-chain attack surface beyond npm registry; idiomatic TS; XWing built-in matches IETF draft + age 1.3.0 default + Chrome/Firefox; production users; active maintenance; operator-aligned with broader Noble ecosystem.

**Weaknesses:** No third-party audit yet; no side-channel protection; pre-1.0 (0.6.1) API could shift; narrower algorithm coverage than liboqs (but sufficient for 081KSNY2Z0008QG0R0030V5ZVS).

### 3.2 `@oqs/liboqs-js`

103 algorithms via WASM (Emscripten from upstream liboqs C). **Upstream OQS team's explicit production warning: "WE DO NOT CURRENTLY RECOMMEND RELYING ON THIS LIBRARY IN A PRODUCTION ENVIRONMENT OR TO PROTECT ANY SENSITIVE DATA."** Manual memory management (`.destroy()`); 80-500KB per algorithm WASM; async-only API.

**Verdict:** algorithm hedging only; production warning blocks 081KSNY2Z0008QG0R0030V5ZVS use.

### 3.3 `libsodium-PQ` extensions

Not available. Roadmap-only as of 2026-05. **Eliminate.**

### 3.4 BoringSSL PQ branch

Production-deployed in Chrome but explicitly not for third-party use. FFI breaks Rule 0. **Eliminate.**

### 3.5 Web Crypto API

ML-KEM/ML-DSA not yet in any shipping browser/Node. **Eliminate for 081KSNY2Z0008QG0R002JKH50A; future-proof revisit 2027+.**

### 3.6 age (with `-pq` flag) + git-agecrypt (strong alternative)

**Buy-not-build alternative path.** age 1.3.0+ native `-pq` produces hybrid X25519 + ML-KEM-768 key pairs. git-agecrypt (MPL-2.0) implements textconv filter for readable diffs + recipient-rotation revocation.

**Solves git-crypt's 3 rejected properties:** (1) forward-revocation via recipient rotation; (2) readable diffs via textconv; (3) **NOT** metadata (same gap as git-crypt).

**Strengths:** zero crypto code in Zeta; age has Cure53 audit 2019 + ongoing; textconv pattern proven; production at Cloudflare/Google/FreeBSD.

**Weaknesses:** doesn't solve metadata leak; doesn't solve retroactive revocation (same as primary path); external `age` binary; less algorithm flexibility for future Adinkras-ECC integration.

### 3.7 Comparison table

| Library | License | Audit | Algorithms | Bundle | TS ergonomics | Side-channel | Production? | Recommendation |
|---|---|---|---|---|---|---|---|---|
| **`@noble/post-quantum`** | MIT | Self (2026-04) | ML-KEM+ML-DSA+SLH-DSA+Falcon+XWing | ~16KB gz | **Excellent** | None | **Yes for 081KSNY2Z0008QG0R0030V5ZVS threat model** | **Primary** |
| `@oqs/liboqs-js` | MIT | None | 103 algorithms | 80-500KB/alg WASM | OK | Partial (WASM JIT erodes) | **Upstream says NO** | Algorithm hedge only |
| `libsodium-PQ` | ISC | N/A | None shipping | — | — | — | No | Eliminate |
| BoringSSL PQ | BSD-3 (disclaimer) | Internal Google | ML-KEM | N/A | Requires FFI | Strong | **Not for third parties** | Eliminate |
| Web Crypto PQ | N/A | N/A | None shipping | — | — | — | No | Future-proof revisit 2027+ |
| **age 1.3.0+ + git-agecrypt** | BSD-3 + MPL-2.0 | Cure53 2019 + ongoing | ML-KEM-768 + X25519 | N/A (external CLI) | Subprocess via Bun | Inherits age | **Yes, audited** | **Strong alternative — surface to operator** |

---

## Section 4 — Recommendation for 081KSNY2Z0008QG0R002JKH50A prototype

### 4.1 Primary recommendation: `@noble/post-quantum` + XWing + ML-DSA-65 + CMS+KEM-style envelope

**Rationale:**

1. TS-first per Rule 0; no WASM/FFI/native deps; works under Bun + Node 22+ + browser
2. NIST-standardized primitives (ML-KEM-768 FIPS 203 + ML-DSA-65 FIPS 204); defensibility for external review
3. XWing hybrid by default — adversary must break BOTH X25519 (classical) AND ML-KEM-768 (PQ); belt-and-braces for harvest-now-decrypt-later
4. Active maintenance + clean side-channel-fix history (KyberSlash, Clangover patched promptly); 16KB gzipped is small enough to audit line-by-line if needed
5. Production users (Protonmail/Tutanota/MetaMask/Phantom/Kraken)
6. Algorithm-set sufficient; less surface = less to audit = less to patch

**Concrete shape (sketch; not for commit):**

```ts
// tools/crypto/better-git-crypt/kem.ts
import { xwing } from '@noble/post-quantum/hybrid';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa';
import { sha256 } from '@noble/hashes/sha256';
import { chacha20poly1305 } from '@noble/ciphers/chacha';

export type RecipientKey = {
  identity: string;
  pqKemPublic: Uint8Array;
  dsaPublic: Uint8Array;
  validFrom: string;
  validUntil?: string;
};

export type FileEnvelope = {
  version: 1;
  contextString: string;
  recipients: Array<{
    identity: string;
    kemCiphertext: Uint8Array;
    wrappedCek: Uint8Array;
  }>;
  contentNonce: Uint8Array;
  contentCiphertext: Uint8Array;
  signerIdentity: string;
  signature: Uint8Array;
};
```

Envelope adapts RFC 9629 CMS+KEM with CBOR (not ASN.1) + signature-context-strings per BC 1.79+.

### 4.2 Solves 3 git-crypt rejection properties

| Rejection | Solution |
|---|---|
| No revocation | **Forward-revocation** via recipient-set rotation (drop entry, re-encrypt working tree). Retroactive revocation requires history rewrite (same fundamental limit as git-crypt; out of scope for 081KSNY2Z0008QG0R002JKH50A). |
| Binary diffs break review | Implement git `textconv` filter (per git-agecrypt's pattern); reviewers see plaintext diffs locally; CI sees ciphertext blobs |
| Metadata leak | **Partial fix**: directory-level encryption obscures filenames within dirs; full commit-message encryption requires out-of-band layer (out of scope for 081KSNY2Z0008QG0R002JKH50A v1) |

### 4.3 PQ posture

- Lattice-based (XWing = ML-KEM-768 Module-LWE)
- Hybrid (X25519 + ML-KEM-768)
- Signature side ML-DSA-65 (Dilithium) — domain-separated; same lattice family ⇒ single substrate to monitor

### 4.4 Sonatype-guide result

**Auth-required; deferred to PR-time gate.** Pre-audit expectation: `@noble/*` packages have clean Sonatype histories; `@noble/post-quantum` expected to follow.

### 4.5 Composition with 081KRW63S0008QG0R000QJR08H Adinkras-ECC

Decouple. 081KSNY2Z0008QG0R0030V5ZVS ships TODAY with ML-KEM-768+X25519 XWing + ML-DSA-65 signatures. 081KRW63S0008QG0R000QJR08H's Adinkras-ECC matures separately; when constructive proof prototype lands, becomes OPTIONAL key-generation source via parameterized seed source (`SeedSource = RandomBytes | AdinkraDerived | HsmDerived`).

### 4.6 Alternative path (Open Question #1)

**Buy-not-build:** age 1.3.0+ + git-agecrypt. Zero crypto code; Cure53 audit; textconv-filter pattern; PQ-hybrid via age's `-pq` flag.

**Recommendation:** surface to operator as binary choice. Both paths satisfy 081KSNY2Z0008QG0R0030V5ZVS's ASAP need.

---

## Section 5 — Open questions for operator

1. **Buy-not-build vs build?** Noble-based path (P1 substantial, 2-4 weeks production-grade) vs age+git-agecrypt (P2 small, 1-3 days integration). Both satisfy 081KSNY2Z0008QG0R0030V5ZVS ASAP. Defensibility / maintenance burden / algorithm flexibility / "AI built the crypto" critique all tradeoff axes.

2. **"Swapple lattice" naming clarification:** SWOOSH (most-likely) vs operator coinage vs SWIFFT/Saber (low probability). Practical outcome converges on ML-KEM-768 either way.

3. **Sonatype-guide auth + review timing:** defer to implementation PR (maintainer-auth context) vs run audit pre-PR?

4. **Retroactive revocation scope:** forward-revocation-only acceptable for 081KSNY2Z0008QG0R002JKH50A/081KSNY2Z0008QG0R0030V5ZVS? Or require true retroactive (out-of-git content-addressed store; substantially larger architecture)?

5. **Metadata protection scope:** content-encryption-only acceptable in first iteration? Filename + commit-message encryption P1 follow-up?

6. **081KRW63S0008QG0R000QJR08H Adinkras-ECC integration timing:** ship 081KSNY2Z0008QG0R002JKH50A with parameterized seed-source interface (substrate-swap preserved) + random-bytes today, or wait for 081KRW63S0008QG0R000QJR08H to ship first?

7. **Side-channel posture acceptance:** bound 081KSNY2Z0008QG0R002JKH50A to "git-at-rest only; no timing-observable deployment" with follow-up B-NNNN tracking constant-time substrate? Or accept timing-channel limitation upfront across all scopes?

---

## Appendix A — RFC 9629 envelope adaptation (CBOR-encoded)

```text
{
  "v": 1,
  "ctx": "zeta.git-crypt.file.v1",
  "alg": {
    "kem": "ML-KEM-768+X25519",   // XWing identifier
    "kdf": "HKDF-SHA256",
    "wrap": "AES-256-KEYWRAP" OR "ChaCha20-Poly1305-AEAD",
    "content": "ChaCha20-Poly1305"
  },
  "recipients": [{ "id", "kem_ct", "wrapped_cek", "kdf_info" }, ...],
  "content_nonce": <12 bytes>,
  "content_ct": <bytes>,
  "sig": {
    "alg": "ML-DSA-65",
    "signer": "<identity>",
    "context": "zeta.git-crypt.file.v1",
    "value": <bytes>
  }
}
```

## Appendix B — Algorithm parameter rationale

- **ML-KEM-768** (Level 3 ≈ AES-192): PK 1184B / SK 2400B / CT 1088B / SS 32B; matches XWing standard + age default + Chrome/Firefox TLS hybrid
- **ML-DSA-65** (Level 3): PK 1952B / SK 4032B / Sig 3293B; matches ML-KEM-768 security level
- **SLH-DSA** (hash-based): reserve for future "belt-and-braces signatures" iteration; not in 081KSNY2Z0008QG0R002JKH50A v1

## Appendix C — Sources

age 1.3.0+; Bouncy Castle 1.79+; git-agecrypt; KyberSlash paper (2024); liboqs-js; ML-KEM Mythbusting; @noble/post-quantum README + npm; RFC 9629 KEM in CMS; Saber Round 3 spec; PQC library survey arxiv 2508.16078; SWIFFT 2008; SWOOSH USENIX Sec 2024 + IACR 2023/271; X-Wing IETF draft + IACR 2024/039.

---

## Substrate-honest framing

- Does NOT prescribe final choice — surfaces tradeoffs + open questions per `no-directives.md`
- Operational claims only per `razor-discipline.md`
- Holds dialectical tension per `god-tier-claims-high-signal-high-suspicion-dont-collapse.md` on "swapple" naming
- Defaults-to-both per `default-to-both.md` on build-vs-buy
- Composes with 081KRW63S0008QG0R000QJR08H without forcing dependency per `additive-not-zero-sum.md`
- Bandwidth-served per `bandwidth-served-falsifier.md` — 16KB pure-JS vs 80-500KB-per-algorithm WASM
