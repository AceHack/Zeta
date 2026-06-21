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
 * Seed v1 algorithm registry per design memo.
 */
export const ALG_REGISTRY = [
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
export function findAlg(id) {
    return ALG_REGISTRY.find((a) => a.id === id);
}
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
export function determineEncryptionPath(context) {
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
export function validateAlgRegistry(reg) {
    const ids = new Set();
    for (const a of reg) {
        if (ids.has(a.id)) {
            throw new Error(`duplicate algorithm id: ${a.id}`);
        }
        ids.add(a.id);
    }
    for (const cls of ["kem", "signature", "kdf", "aead"]) {
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
export function validateEnvelopeStructure(env) {
    if (env.version !== 1) {
        throw new Error(`unsupported envelope version: ${env.version}`);
    }
    if (env.context !== "zeta.git-crypt.file.v1") {
        throw new Error(`context mismatch: ${env.context}`);
    }
    const checkAlg = (id, expectedClass, role) => {
        const alg = findAlg(id);
        if (!alg)
            throw new Error(`unknown algorithm in ${role}: ${id}`);
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
export function validateEncryptionContext(ctx, reg) {
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
