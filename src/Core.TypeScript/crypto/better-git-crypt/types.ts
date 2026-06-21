/**
 * tools/crypto/better-git-crypt/types.ts
 *
 * 081KSNY2Z0008QG0R002JKH50A v1 — better-git-crypt PoC scaffold (TS-side per
 * zeta-ships-with-skills-immediate-value.md)
 *
 * Declarative type substrate per the v1 design memo
 * (docs/research/2026-05-28-b-0883-v1-design-memo-noble-xwing-mldsa65-
 * cbor-envelope-with-locked-decisions.md):
 *
 *   - Noble + XWing (ML-KEM-768 + X25519 hybrid) for KEM
 *   - ML-DSA-65 for signatures
 *   - CBOR envelope adapting RFC 9629 CMS+KEM pattern
 *   - Multi-cipher hedge (081KSNY2Z0008QG0R002ZAVMEK) — Saber / NTRU-Prime / FrodoKEM
 *     as alternates when TS-native impls mature
 *   - Content-only encryption v1 (081KSNY2Z0008QG0R0020KXAPS); metadata deferred
 *   - Bounded to git-at-rest threat model (081KSNY2Z0008QG0R001FN4DDB)
 *   - Forward-only revocation (081KSNY2Z0008QG0R0008EJDW1 future)
 *   - Adinkras-ECC seed source parameterized (081KRW63S0008QG0R000QJR08H composes)
 *
 * PoC scope: declarative type substrate + invariant validation. Real
 * Noble integration + KEM operations + CBOR encoding = Phase 2
 * (operator-authorized follow-up). The PoC scaffold types the
 * substrate per the v1 design memo + validates invariants + provides
 * --dry-run for envelope structure inspection.
 *
 * Composes with:
 *   - 081KSNY2Z0008QG0R002JKH50A row (canonical v1 design)
 *   - 081KSNY2Z0008QG0R0037X4DP4 library landscape audit (Noble recommendation)
 *   - 081KSNY2Z0008QG0R002ZAVMEK multi-cipher hedge
 *   - 081KSNY2Z0008QG0R0008EJDW1 content-addressed-store (future revocation)
 *   - 081KSNY2Z0008QG0R001FN4DDB side-channel scope boundary
 *   - 081KSNY2Z0008QG0R0020KXAPS metadata encryption follow-up
 *   - 081KSNY2Z0008QG0R000459FRH glass-halo open-by-default (encryption-as-earned)
 *   - 081KSNY2Z0008QG0R0034JR61Z plaintext-readable ciphertext format research
 *   - 081KSNY2Z0008QG0R0030V5ZVS agent private encrypted state (Otto + Addison ASAP consumer)
 *   - 081KRW63S0008QG0R000QJR08H Adinkras-ECC (seed source future)
 *   - 081KSNY2Z0008QG0R001A431CN encryption-thermal-cost two-axis classification
 *   - 081KSNY2Z0008QG0R002QA720J three-lanes-concurrent (this advances the encryption lane)
 *   - rule asymmetric-authorship (TFeedback per cipher operation)
 *   - rule monad-propagation-pattern-cross-language-substrate-shape
 *   - rule ople-primitives-surface-t-and-tfeedback (Persist-as-bridge per 081KSNY2Z0008QG0R002SZZ5Y0)
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
  | "ships-v1" // Noble-native; ready for Phase 2 impl
  | "deferred-alternate" // multi-cipher hedge per 081KSNY2Z0008QG0R002ZAVMEK
  | "future-substrate"; // requires substrate that doesn't yet exist

/**
 * Algorithm spec — registry entry per cipher.
 */
export interface AlgSpec {
  readonly id: string; // e.g. "ML-KEM-768+X25519" (XWing identifier)
  readonly class: CipherClass;
  readonly status: CipherStatus;
  readonly description: string;
  readonly nobleModule?: string; // @noble/post-quantum module path when ships-v1
  readonly composesWith: readonly string[]; // backlog/rule references
}

/**
 * Seed source — parameterized per 081KRW63S0008QG0R000QJR08H (Adinkras-derived seeds swap in later).
 */
export type SeedSource =
  | "random-bytes" // v1 default; CSPRNG
  | "adinkra-derived" // 081KRW63S0008QG0R000QJR08H future; SUSY-ECC private state
  | "hsm-derived"; // future; HSM-backed seed source

/**
 * Recipient key — identity + public key material.
 */
export interface RecipientKey {
  readonly identity: string; // e.g. "otto-cli@zeta"
  readonly kemAlgId: string; // must reference AlgSpec.id of CipherClass "kem"
  readonly sigAlgId: string; // must reference AlgSpec.id of CipherClass "signature"
  readonly publicKemKey: Uint8Array;
  readonly publicSigKey: Uint8Array;
  readonly seedSource: SeedSource;
  readonly composesWith: readonly string[];
}

/**
 * Per-recipient envelope slot — KEM ciphertext + wrapped CEK.
 */
export interface RecipientSlot {
  readonly identity: string;
  readonly kemCt: Uint8Array; // XWing ciphertext (per-recipient)
  readonly wrappedCek: Uint8Array; // CEK encrypted under KDF(shared_secret)
  readonly kdfInfo: Uint8Array; // domain-separation tag for HKDF
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
  readonly context: string; // domain-separation; must equal "zeta.git-crypt.file.v1"
  readonly algKem: string; // AlgSpec.id of CipherClass "kem"
  readonly algKdf: string; // AlgSpec.id of CipherClass "kdf"
  readonly algWrap: string; // AlgSpec.id of CipherClass "aead"
  readonly algContent: string; // AlgSpec.id of CipherClass "aead"
  readonly algSig: string; // AlgSpec.id of CipherClass "signature"
  readonly recipients: readonly RecipientSlot[];
  readonly ciphertext: Uint8Array;
  readonly contentNonce: Uint8Array; // 12-byte ChaCha20-Poly1305 nonce for the content AEAD (memo schema "content_nonce"); covered by the signature
  readonly signerIdentity: string; // matches RecipientKey.identity of sender
  readonly signature: Uint8Array;
}

/**
 * Encryption context — parameters passed to the encrypt operation.
 */
export interface EncryptionContext {
  readonly plaintext: Uint8Array;
  readonly recipients: readonly RecipientKey[];
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
 * + 081KSNY2Z0008QG0R002SZZ5Y0 (Persist-as-bridge): encryption is one specific Persist-as-bridge
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
export const ALG_REGISTRY: readonly AlgSpec[] = [
  // KEM
  {
    id: "ML-KEM-768+X25519",
    class: "kem",
    status: "ships-v1",
    description: "XWing — ML-KEM-768 (post-quantum) + X25519 (classical) hybrid; primary v1 KEM",
    nobleModule: "@noble/post-quantum/ml-kem",
    composesWith: ["081KSNY2Z0008QG0R002JKH50A", "081KSNY2Z0008QG0R0037X4DP4"],
  },
  {
    id: "Saber",
    class: "kem",
    status: "deferred-alternate",
    description: "lattice-based KEM alternate; deferred until TS-native impl",
    composesWith: ["081KSNY2Z0008QG0R002ZAVMEK"],
  },
  {
    id: "NTRU-Prime",
    class: "kem",
    status: "deferred-alternate",
    description: "lattice-based KEM alternate; deferred until TS-native impl",
    composesWith: ["081KSNY2Z0008QG0R002ZAVMEK"],
  },
  {
    id: "FrodoKEM",
    class: "kem",
    status: "deferred-alternate",
    description: "LWE-based KEM alternate (most conservative); deferred until TS-native impl",
    composesWith: ["081KSNY2Z0008QG0R002ZAVMEK"],
  },
  // Signature
  {
    id: "ML-DSA-65",
    class: "signature",
    status: "ships-v1",
    description: "Dilithium-65 — post-quantum signature primary v1",
    nobleModule: "@noble/post-quantum/ml-dsa",
    composesWith: ["081KSNY2Z0008QG0R002JKH50A", "081KSNY2Z0008QG0R0037X4DP4"],
  },
  {
    id: "SLH-DSA",
    class: "signature",
    // deferred-alternate, NOT ships-v1: Noble has it, but crypto.ts v1 only
    // dispatches ML-DSA-65. Marking it ships-v1 would let determineEncryptionPath
    // advertise a signature the crypto layer can't actually produce (registry/
    // planner inconsistency — Copilot P1 on PR #6217). Promote when real
    // SLH-DSA dispatch lands.
    status: "deferred-alternate",
    description: "SPHINCS+ — hash-based signature alternate; Noble-native; deferred until crypto.ts dispatch added",
    nobleModule: "@noble/post-quantum/slh-dsa",
    composesWith: ["081KSNY2Z0008QG0R0037X4DP4"],
  },
  // KDF
  {
    id: "HKDF-SHA256",
    class: "kdf",
    status: "ships-v1",
    description: "HMAC-based KDF with SHA-256",
    nobleModule: "@noble/hashes/hkdf",
    composesWith: ["081KSNY2Z0008QG0R002JKH50A"],
  },
  // AEAD
  {
    id: "ChaCha20-Poly1305-AEAD",
    class: "aead",
    status: "ships-v1",
    description: "ChaCha20 stream cipher with Poly1305 MAC; AEAD",
    nobleModule: "@noble/ciphers/chacha",
    composesWith: ["081KSNY2Z0008QG0R002JKH50A"],
  },
  {
    id: "ChaCha20-Poly1305",
    class: "aead",
    status: "ships-v1",
    description: "ChaCha20-Poly1305 for content encryption",
    nobleModule: "@noble/ciphers/chacha",
    composesWith: ["081KSNY2Z0008QG0R002JKH50A"],
  },
];

/**
 * Look up an algorithm by id.
 */
export function findAlg(id: string): AlgSpec | undefined {
  return ALG_REGISTRY.find((a) => a.id === id);
}

/**
 * 081KSNY2Z0008QG0R002JKH50A — determineEncryptionPath: substantive lane work per
 * Aaron's 3-lane substrate-check (Amara ferry §33.2 PR #5757).
 *
 * Structurally parallel to workflow-engine's determineReviewLevel
 * discriminator (PR #5758) at encryption-substrate scope:
 *   - Input: EncryptionContext (recipients + sender + seed source)
 *   - Output: Result<PlannedEncryptionPath, EncryptionFeedback>
 *   - Path declares the KEM + KDF + WRAP + CONTENT + SIG algorithms
 *     to use for the operation, per the v1 design memo
 *
 * Per asymmetric-authorship rule (PR #5516): the function authors
 * its own TFeedback channel via existing EncryptionFeedback variants.
 * Per monad-propagation rule (PR #5511): Result<T, TFeedback> shape.
 * Per OPLE primitive rule (081KSNY2Z0008QG0R002SZZ5Y0 Persist-as-bridge): encryption IS
 * Persist-as-bridge instantiated at file-substrate scope.
 *
 * Composes with:
 *   - 081KSNY2Z0008QG0R003WFDCJ9 determineReviewLevel discriminator (PR #5758) — same
 *     shape at different substrate scope
 *   - 081KSNY2Z0008QG0R002JKH50A v1 design memo (algorithm selection per v1)
 *   - validateEncryptionContext (called as precondition)
 *
 * PoC scope: pure-function selection of algorithms from ALG_REGISTRY
 * based on context invariants. Actual crypto operations deferred to
 * Phase 2.
 */

/**
 * Planned encryption path — declares which algorithms will be used
 * for an encryption operation. All AlgSpec.id values; validated to
 * exist in ALG_REGISTRY and have CipherClass matching the slot.
 */
export interface PlannedEncryptionPath {
  readonly algKem: string; // CipherClass: kem
  readonly algKdf: string; // CipherClass: kdf
  readonly algWrap: string; // CipherClass: aead (for CEK wrap)
  readonly algContent: string; // CipherClass: aead (for plaintext)
  readonly algSig: string; // CipherClass: signature
  readonly recipientCount: number;
  readonly senderIdentity: string;
  readonly composesWith: readonly string[];
}

/**
 * Discriminator-shape Result for path-planning per monad-propagation rule.
 *
 * Aligned with the substrate's existing EncryptionFeedback discriminator
 * so the path-planner composes cleanly with downstream encrypt operations
 * via Result.bind chains.
 */
export type PlanResult = { ok: true; path: PlannedEncryptionPath } | { ok: false; feedback: EncryptionFeedback };

/**
 * `determineEncryptionPath` — discriminator that maps an EncryptionContext
 * to its PlannedEncryptionPath, or returns the EncryptionFeedback variant
 * naming why planning failed.
 *
 * Policy per v1 design memo:
 *   - Recipients' kemAlgIds must all reference the same KEM (no per-recipient
 *     KEM variation in v1 — single envelope KEM column per FileEnvelope.algKem)
 *   - Sender's sigAlgId determines envelope signature algorithm
 *   - KDF defaults to HKDF-SHA256 (only ships-v1 KDF in registry)
 *   - WRAP and CONTENT default to ChaCha20-Poly1305-AEAD (per design memo)
 *   - Empty recipient set → EmptyRecipientSet
 *   - Sender not in recipient set → SenderNotInRecipientSet
 *   - Algorithm not in registry → AlgUnsupported
 *   - Algorithm with non-ships-v1 status → AlgUnsupported (deferred-alternate
 *     algorithms can't ship encrypt operations until Phase 2)
 *
 * Exhaustive over the failure-mode space the v1 design memo names; future
 * extensions to EncryptionFeedback union must update this function (TS
 * strict mode enforces).
 */
export function determineEncryptionPath(context: EncryptionContext): PlanResult {
  // Empty recipient set:
  if (context.recipients.length === 0) {
    return { ok: false, feedback: { kind: "EmptyRecipientSet" } };
  }

  // Sender must be in recipient set (sender encrypts to self too for
  // round-trip recovery, per design memo):
  const senderInRecipients = context.recipients.some((r) => r.identity === context.sender.identity);
  if (!senderInRecipients) {
    return {
      ok: false,
      feedback: {
        kind: "SenderNotInRecipientSet",
        senderIdentity: context.sender.identity,
      },
    };
  }

  // All recipient KEM algs must be the same (single envelope KEM column in v1):
  const firstKemId = context.recipients[0]?.kemAlgId;
  if (!firstKemId) {
    return { ok: false, feedback: { kind: "EmptyRecipientSet" } };
  }
  const allSameKem = context.recipients.every((r) => r.kemAlgId === firstKemId);
  if (!allSameKem) {
    // Use RecipientKeyInvalid (not AlgUnsupported) — the per-recipient
    // KEM is itself well-formed and supported; the failure is that v1's
    // single-envelope-KEM-column constraint requires all recipients use
    // the SAME KEM. RecipientKeyInvalid surfaces the specific mismatched
    // identity + the v1 constraint reason for the caller's handler.
    const mismatched = context.recipients.find((r) => r.kemAlgId !== firstKemId);
    return {
      ok: false,
      feedback: {
        kind: "RecipientKeyInvalid",
        identity: mismatched?.identity ?? "unknown",
        reason: `v1 requires single KEM across recipients; expected ${firstKemId}`,
      },
    };
  }

  // KEM alg must be ships-v1:
  const kemAlg = findAlg(firstKemId);
  if (kemAlg?.class !== "kem" || kemAlg.status !== "ships-v1") {
    return {
      ok: false,
      feedback: { kind: "AlgUnsupported", algId: firstKemId },
    };
  }

  // Signature alg must be ships-v1:
  const sigAlgId = context.sender.sigAlgId;
  const sigAlg = findAlg(sigAlgId);
  if (sigAlg?.class !== "signature" || sigAlg.status !== "ships-v1") {
    return {
      ok: false,
      feedback: { kind: "AlgUnsupported", algId: sigAlgId },
    };
  }

  // KDF + WRAP + CONTENT defaults per v1 design memo:
  const algKdf = "HKDF-SHA256";
  const algWrap = "ChaCha20-Poly1305-AEAD";
  const algContent = "ChaCha20-Poly1305-AEAD";

  // Sanity-check the defaults exist (should always hold given seed registry):
  for (const id of [algKdf, algWrap, algContent]) {
    const alg = findAlg(id);
    if (alg?.status !== "ships-v1") {
      return { ok: false, feedback: { kind: "AlgUnsupported", algId: id } };
    }
  }

  return {
    ok: true,
    path: {
      algKem: firstKemId,
      algKdf,
      algWrap,
      algContent,
      algSig: sigAlgId,
      recipientCount: context.recipients.length,
      senderIdentity: context.sender.identity,
      composesWith: ["081KSNY2Z0008QG0R002JKH50A", "081KSNY2Z0008QG0R0037X4DP4", "081KSNY2Z0008QG0R003WFDCJ9"],
    },
  };
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
export function validateAlgRegistry(reg: readonly AlgSpec[]): void {
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
  // contentNonce is a fixed 12-byte ChaCha20-Poly1305 nonce. Enforce it in the
  // SHARED validator so callers that validate/decrypt without going through
  // decodeEnvelope still reject a malformed nonce structurally (not as a late
  // crypto failure).
  if (env.contentNonce.length !== 12) {
    throw new Error(`envelope contentNonce must be 12 bytes, got ${env.contentNonce.length}`);
  }
}

/**
 * Validate an EncryptionContext before invoking encrypt.
 *
 * Returns the first EncryptionFeedback variant if invalid; undefined otherwise.
 */
export function validateEncryptionContext(
  ctx: EncryptionContext,
  reg: readonly AlgSpec[],
): EncryptionFeedback | undefined {
  if (ctx.recipients.length === 0) {
    return { kind: "EmptyRecipientSet" };
  }
  const senderInRecipients = ctx.recipients.some((r) => r.identity === ctx.sender.identity);
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
