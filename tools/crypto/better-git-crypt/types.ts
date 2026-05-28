/**
 * tools/crypto/better-git-crypt/types.ts
 *
 * B-0883 v1 — better-git-crypt PoC scaffold (TS-side per
 * zeta-ships-with-skills-immediate-value.md)
 *
 * Declarative type substrate per the v1 design memo
 * (docs/research/2026-05-28-b-0883-v1-design-memo-noble-xwing-mldsa65-
 * cbor-envelope-with-locked-decisions.md):
 *
 *   - Noble + XWing (ML-KEM-768 + X25519 hybrid) for KEM
 *   - ML-DSA-65 for signatures
 *   - CBOR envelope adapting RFC 9629 CMS+KEM pattern
 *   - Multi-cipher hedge (B-0883.2) — Saber / NTRU-Prime / FrodoKEM
 *     as alternates when TS-native impls mature
 *   - Content-only encryption v1 (B-0883.5); metadata deferred
 *   - Bounded to git-at-rest threat model (B-0883.4)
 *   - Forward-only revocation (B-0883.3 future)
 *   - Adinkras-ECC seed source parameterized (B-0623 composes)
 *
 * PoC scope: declarative type substrate + invariant validation. Real
 * Noble integration + KEM operations + CBOR encoding = Phase 2
 * (operator-authorized follow-up). The PoC scaffold types the
 * substrate per the v1 design memo + validates invariants + provides
 * --dry-run for envelope structure inspection.
 *
 * Composes with:
 *   - B-0883 row (canonical v1 design)
 *   - B-0883.1 library landscape audit (Noble recommendation)
 *   - B-0883.2 multi-cipher hedge
 *   - B-0883.3 content-addressed-store (future revocation)
 *   - B-0883.4 side-channel scope boundary
 *   - B-0883.5 metadata encryption follow-up
 *   - B-0883.16 glass-halo open-by-default (encryption-as-earned)
 *   - B-0883.17 plaintext-readable ciphertext format research
 *   - B-0885 agent private encrypted state (Otto + Addison ASAP consumer)
 *   - B-0623 Adinkras-ECC (seed source future)
 *   - B-0906 encryption-thermal-cost two-axis classification
 *   - B-0892 three-lanes-concurrent (this advances the encryption lane)
 *   - rule asymmetric-authorship (TFeedback per cipher operation)
 *   - rule monad-propagation-pattern-cross-language-substrate-shape
 *   - rule ople-primitives-surface-t-and-tfeedback (Persist-as-bridge per B-0897)
 *   - rule forgetting-costs-energy-remembering-is-cheap (axiom-preservation)
 *   - rule rule-0-no-sh-files (TS-first)
 */

/**
 * Envelope version — bumps for breaking changes.
 *
 * v1 = Noble + XWing + ML-DSA-65 + CBOR + ChaCha20-Poly1305 content
 *      encryption per v1 design memo.
 */
export type EnvelopeVersion = 1;

/**
 * Cipher class — which crypto role the algorithm fulfills.
 */
export type CipherClass = "kem" | "signature" | "kdf" | "aead";

/**
 * Cipher implementation status — tracks Phase 1 ship vs deferred.
 */
export type CipherStatus =
  | "ships-v1"                    // Noble-native; ready for Phase 2 impl
  | "deferred-alternate"          // multi-cipher hedge per B-0883.2
  | "future-substrate";           // requires substrate that doesn't yet exist

/**
 * Algorithm spec — registry entry per cipher.
 */
export interface AlgSpec {
  readonly id: string;            // e.g. "ML-KEM-768+X25519" (XWing identifier)
  readonly class: CipherClass;
  readonly status: CipherStatus;
  readonly description: string;
  readonly nobleModule?: string;  // @noble/post-quantum module path when ships-v1
  readonly composesWith: ReadonlyArray<string>; // backlog/rule references
}

/**
 * Seed source — parameterized per B-0623 (Adinkras-derived seeds swap in later).
 */
export type SeedSource =
  | "random-bytes"        // v1 default; CSPRNG
  | "adinkra-derived"     // B-0623 future; SUSY-ECC private state
  | "hsm-derived";        // future; HSM-backed seed source

/**
 * Recipient key — identity + public key material.
 */
export interface RecipientKey {
  readonly identity: string;      // e.g. "otto-cli@zeta"
  readonly kemAlgId: string;      // must reference AlgSpec.id of CipherClass "kem"
  readonly sigAlgId: string;      // must reference AlgSpec.id of CipherClass "signature"
  readonly publicKemKey: Uint8Array;
  readonly publicSigKey: Uint8Array;
  readonly seedSource: SeedSource;
  readonly composesWith: ReadonlyArray<string>;
}

/**
 * Per-recipient envelope slot — KEM ciphertext + wrapped CEK.
 */
export interface RecipientSlot {
  readonly identity: string;
  readonly kemCt: Uint8Array;       // XWing ciphertext (per-recipient)
  readonly wrappedCek: Uint8Array;  // CEK encrypted under KDF(shared_secret)
  readonly kdfInfo: Uint8Array;     // domain-separation tag for HKDF
}

/**
 * File envelope — the on-disk encrypted file format.
 *
 * v1 format per design memo:
 *   - CBOR-encoded with domain-separation context string "zeta.git-crypt.file.v1"
 *   - Per-recipient slots (one slot per RecipientKey in the recipient set)
 *   - Content encrypted via AEAD with CEK derived per-recipient via XWing KEM
 *   - Signature over the entire envelope using ML-DSA-65 (sender authentication)
 */
export interface FileEnvelope {
  readonly version: EnvelopeVersion;
  readonly context: string;          // domain-separation; must equal "zeta.git-crypt.file.v1"
  readonly algKem: string;           // AlgSpec.id of CipherClass "kem"
  readonly algKdf: string;           // AlgSpec.id of CipherClass "kdf"
  readonly algWrap: string;          // AlgSpec.id of CipherClass "aead"
  readonly algContent: string;       // AlgSpec.id of CipherClass "aead"
  readonly algSig: string;           // AlgSpec.id of CipherClass "signature"
  readonly recipients: ReadonlyArray<RecipientSlot>;
  readonly ciphertext: Uint8Array;
  readonly signerIdentity: string;   // matches RecipientKey.identity of sender
  readonly signature: Uint8Array;
}

/**
 * Encryption context — parameters passed to the encrypt operation.
 */
export interface EncryptionContext {
  readonly plaintext: Uint8Array;
  readonly recipients: ReadonlyArray<RecipientKey>;
  readonly sender: RecipientKey;
  readonly seedSource: SeedSource;
}

/**
 * Encryption feedback — per asymmetric-authorship rule, the encrypt
 * operation AUTHORS its own TFeedback variants.
 *
 * Per .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md
 * + .claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md
 *
 * Per .claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md
 * + B-0897 (Persist-as-bridge): encryption is one specific Persist-as-bridge
 * instance — encrypted output flows to substrate (filesystem / git) for
 * future Observe (decrypt). The TFeedback variants below are the
 * Persist-bridge's authorial feedback channel.
 */
export type EncryptionFeedback =
  | { kind: "AlgUnsupported"; algId: string }
  | { kind: "RecipientKeyInvalid"; identity: string; reason: string }
  | { kind: "EmptyRecipientSet" }
  | { kind: "SenderNotInRecipientSet"; senderIdentity: string }
  | { kind: "SeedSourceNotAvailable"; seedSource: SeedSource }
  | { kind: "KemFailure"; recipientIdentity: string }
  | { kind: "SignatureFailure" }
  | { kind: "EnvelopeEncodeFailure"; reason: string };

/**
 * Decryption feedback — per asymmetric-authorship rule.
 */
export type DecryptionFeedback =
  | { kind: "EnvelopeMalformed"; reason: string }
  | { kind: "VersionUnsupported"; version: number }
  | { kind: "ContextMismatch"; expected: string; actual: string }
  | { kind: "AlgUnsupported"; algId: string }
  | { kind: "RecipientNotInEnvelope"; identity: string }
  | { kind: "KemFailure" }
  | { kind: "SignatureInvalid"; signerIdentity: string }
  | { kind: "ContentDecryptFailure" };

/**
 * Seed v1 algorithm registry per design memo.
 */
export const ALG_REGISTRY: ReadonlyArray<AlgSpec> = [
  // KEM
  {
    id: "ML-KEM-768+X25519",
    class: "kem",
    status: "ships-v1",
    description: "XWing — ML-KEM-768 (post-quantum) + X25519 (classical) hybrid; primary v1 KEM",
    nobleModule: "@noble/post-quantum/ml-kem",
    composesWith: ["B-0883", "B-0883.1"],
  },
  {
    id: "Saber",
    class: "kem",
    status: "deferred-alternate",
    description: "lattice-based KEM alternate; deferred until TS-native impl",
    composesWith: ["B-0883.2"],
  },
  {
    id: "NTRU-Prime",
    class: "kem",
    status: "deferred-alternate",
    description: "lattice-based KEM alternate; deferred until TS-native impl",
    composesWith: ["B-0883.2"],
  },
  {
    id: "FrodoKEM",
    class: "kem",
    status: "deferred-alternate",
    description: "LWE-based KEM alternate (most conservative); deferred until TS-native impl",
    composesWith: ["B-0883.2"],
  },
  // Signature
  {
    id: "ML-DSA-65",
    class: "signature",
    status: "ships-v1",
    description: "Dilithium-65 — post-quantum signature primary v1",
    nobleModule: "@noble/post-quantum/ml-dsa",
    composesWith: ["B-0883", "B-0883.1"],
  },
  {
    id: "SLH-DSA",
    class: "signature",
    status: "ships-v1",
    description: "SPHINCS+ — hash-based signature alternate; Noble-native",
    nobleModule: "@noble/post-quantum/slh-dsa",
    composesWith: ["B-0883.1"],
  },
  // KDF
  {
    id: "HKDF-SHA256",
    class: "kdf",
    status: "ships-v1",
    description: "HMAC-based KDF with SHA-256",
    nobleModule: "@noble/hashes/hkdf",
    composesWith: ["B-0883"],
  },
  // AEAD
  {
    id: "ChaCha20-Poly1305-AEAD",
    class: "aead",
    status: "ships-v1",
    description: "ChaCha20 stream cipher with Poly1305 MAC; AEAD",
    nobleModule: "@noble/ciphers/chacha",
    composesWith: ["B-0883"],
  },
  {
    id: "ChaCha20-Poly1305",
    class: "aead",
    status: "ships-v1",
    description: "ChaCha20-Poly1305 for content encryption",
    nobleModule: "@noble/ciphers/chacha",
    composesWith: ["B-0883"],
  },
];

/**
 * Look up an algorithm by id.
 */
export function findAlg(id: string): AlgSpec | undefined {
  return ALG_REGISTRY.find((a) => a.id === id);
}

/**
 * Validate algorithm registry invariants.
 *
 * Invariants:
 *   - all alg ids are unique
 *   - at least one ships-v1 KEM (XWing)
 *   - at least one ships-v1 signature (ML-DSA-65)
 *   - at least one ships-v1 KDF
 *   - at least one ships-v1 AEAD
 */
export function validateAlgRegistry(reg: ReadonlyArray<AlgSpec>): void {
  const ids = new Set<string>();
  for (const a of reg) {
    if (ids.has(a.id)) {
      throw new Error(`duplicate algorithm id: ${a.id}`);
    }
    ids.add(a.id);
  }
  for (const cls of ["kem", "signature", "kdf", "aead"] as const) {
    const hasShipsV1 = reg.some((a) => a.class === cls && a.status === "ships-v1");
    if (!hasShipsV1) {
      throw new Error(`no ships-v1 algorithm of class ${cls} present in registry`);
    }
  }
}

/**
 * Validate a FileEnvelope's structural invariants.
 *
 * Invariants (PoC scope; full crypto verification = Phase 2):
 *   - version is supported (v1 only currently)
 *   - context matches "zeta.git-crypt.file.v1"
 *   - all algorithm references resolve in the registry
 *   - each algorithm reference is the correct class
 *   - recipient set is non-empty
 *   - signer identity is non-empty
 */
export function validateEnvelopeStructure(env: FileEnvelope): void {
  if (env.version !== 1) {
    throw new Error(`unsupported envelope version: ${env.version}`);
  }
  if (env.context !== "zeta.git-crypt.file.v1") {
    throw new Error(`context mismatch: ${env.context}`);
  }
  const checkAlg = (id: string, expectedClass: CipherClass, role: string) => {
    const alg = findAlg(id);
    if (!alg) throw new Error(`unknown algorithm in ${role}: ${id}`);
    if (alg.class !== expectedClass) {
      throw new Error(`algorithm ${id} class ${alg.class} mismatch for ${role} (expected ${expectedClass})`);
    }
  };
  checkAlg(env.algKem, "kem", "algKem");
  checkAlg(env.algKdf, "kdf", "algKdf");
  checkAlg(env.algWrap, "aead", "algWrap");
  checkAlg(env.algContent, "aead", "algContent");
  checkAlg(env.algSig, "signature", "algSig");
  if (env.recipients.length === 0) {
    throw new Error("envelope has empty recipient set");
  }
  if (env.signerIdentity.length === 0) {
    throw new Error("envelope has empty signerIdentity");
  }
}

/**
 * Validate an EncryptionContext before invoking encrypt.
 *
 * Returns the first EncryptionFeedback variant if invalid; undefined otherwise.
 */
export function validateEncryptionContext(
  ctx: EncryptionContext,
  reg: ReadonlyArray<AlgSpec>,
): EncryptionFeedback | undefined {
  if (ctx.recipients.length === 0) {
    return { kind: "EmptyRecipientSet" };
  }
  const senderInRecipients = ctx.recipients.some(
    (r) => r.identity === ctx.sender.identity,
  );
  if (!senderInRecipients) {
    return { kind: "SenderNotInRecipientSet", senderIdentity: ctx.sender.identity };
  }
  for (const r of ctx.recipients) {
    const kemAlg = reg.find((a) => a.id === r.kemAlgId && a.class === "kem");
    if (!kemAlg) {
      return { kind: "AlgUnsupported", algId: r.kemAlgId };
    }
    const sigAlg = reg.find((a) => a.id === r.sigAlgId && a.class === "signature");
    if (!sigAlg) {
      return { kind: "AlgUnsupported", algId: r.sigAlgId };
    }
    if (r.publicKemKey.length === 0) {
      return { kind: "RecipientKeyInvalid", identity: r.identity, reason: "empty publicKemKey" };
    }
    if (r.publicSigKey.length === 0) {
      return { kind: "RecipientKeyInvalid", identity: r.identity, reason: "empty publicSigKey" };
    }
  }
  return undefined;
}
