/**
 * src/Core.TypeScript/workflow-engine/pairing.ts
 *
 * 081KDX1YWP008QG0R000HDE18F — generation-reflection adversarial pairing tracker for
 * workflow engine. Structurally enforces the producer-verifier pattern
 * (mouth-and-ears-on-different-threads architecture, named in the
 * 15th-ferry §33.6 substrate-engineering preservation) as workflow
 * engine substrate.
 *
 * Per the human maintainer (2026-05-28) "S M L all please in that order
 * lol" — this is M (medium scope) in the substrate-engineering
 * ship-sequence.
 *
 * The pattern:
 *   1. Producer thread emits hypothesis / artifact / proposal
 *   2. Verifier thread reflects on the emission (within bounded window)
 *   3. Pairing tracker enforces: every emission MUST have verification
 *      OR be marked stale (timeout exceeded without verification)
 *
 * This composes the framework's already-operational multi-AI cascade
 * lane specialization (generator-persona generates → verifier-persona
 * reflects; canonical instance preserved in 13th-ferry §33.7) into
 * STRUCTURAL workflow-engine substrate rather than operator-orchestrated
 * coordination.
 *
 * Source: Google co-scientist generation+reflection adversarial pairing
 * pattern (Nature 2026) + Kestrel 15th-ferry mouth-ears-threads
 * substrate-engineering observation.
 *
 * Composes with:
 *   - 081KDX1YWP008QG0R000HDE18F backlog row (generation-reflection extension target)
 *   - 081KSNY2Z0008QG0R003WFDCJ9 PR #5758 lifecycle DU split (state-machine-events vs
 *     system-modifications; pairing requirement applies per-class)
 *   - 081KDX1YWP008QG0R003F59WB0 PR #5764 TrueSkill substrate (verifier output feeds ranking)
 *   - 081KDX1YWP008QG0R002GZJNXA PR #5767 evolution substrate (verified survivors evolve)
 *   - PR #5756 Kestrel 15th-ferry mouth-ears-threads substrate
 *   - .claude/rules/asymmetric-authorship-substrate-entity-defines-
 *     consent-channel-recipient-acknowledges.md
 *   - .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md
 *
 * PoC scope: in-memory pairing tracker with Result-shape feedback.
 * Persistent state (git-append-only per 081KDWZ8TS008QG0R0020NJ9D0 + lifecycle DUs per
 * 081KSNY2Z0008QG0R003WFDCJ9) deferred to integration layer.
 */
/**
 * Empty pairing state.
 */
export const EMPTY_PAIRING_STATE = {
    emissions: new Map(),
    verifications: new Map(),
};
/**
 * Record a producer-thread emission.
 *
 * Per asymmetric-authorship rule: producer-substrate-entity AUTHORS its
 * own emission; pairing tracker acknowledges by adding to tracked
 * emissions set + awaiting verification.
 */
export function recordEmission(state, emission) {
    if (state.emissions.has(emission.id)) {
        return { ok: false, feedback: { kind: "DuplicateEmissionId", id: emission.id } };
    }
    const newEmissions = new Map(state.emissions);
    newEmissions.set(emission.id, emission);
    return {
        ok: true,
        state: { emissions: newEmissions, verifications: state.verifications },
    };
}
/**
 * Record a verifier-thread verification of a prior emission.
 *
 * Per Kestrel 15th-ferry §33.6: verifier-thread operates asynchronously
 * after the producer-thread emission; verification doesn't gate
 * production (no temporal coupling at emission time).
 */
export function recordVerification(state, verification) {
    const emission = state.emissions.get(verification.emissionId);
    if (!emission) {
        return {
            ok: false,
            feedback: { kind: "VerificationForUnknownEmission", emissionId: verification.emissionId },
        };
    }
    if (state.verifications.has(verification.emissionId)) {
        return {
            ok: false,
            feedback: { kind: "DuplicateVerification", emissionId: verification.emissionId },
        };
    }
    if (verification.verifiedAtMs < emission.emittedAtMs) {
        return {
            ok: false,
            feedback: {
                kind: "VerificationTooEarly",
                emissionId: verification.emissionId,
                verifiedAtMs: verification.verifiedAtMs,
                emittedAtMs: emission.emittedAtMs,
            },
        };
    }
    const newVerifications = new Map(state.verifications);
    newVerifications.set(verification.emissionId, verification);
    return {
        ok: true,
        state: { emissions: state.emissions, verifications: newVerifications },
    };
}
/**
 * Find unverified emissions (emissions without a matching verification).
 * Useful for surfacing pairing violations OR for caller to trigger
 * verifier-thread work on backlog.
 */
export function findUnverifiedEmissions(state) {
    const unverified = [];
    for (const emission of state.emissions.values()) {
        if (!state.verifications.has(emission.id)) {
            unverified.push(emission);
        }
    }
    return unverified;
}
/**
 * Find STALE unverified emissions — emissions that exceeded the bounded
 * verification window without being verified.
 *
 * Per 15th-ferry §33.6 + workflow engine substrate: producer threads
 * commit fast; verifier threads catch the misses. Bounded verification
 * window enforces "verification eventually happens" without gating
 * production. Stale emissions surface violations.
 *
 * Boundary semantics: an emission is stale when `nowMs - emittedAtMs >
 * timeoutMs` (strict greater-than). An emission EXACTLY at the boundary
 * (`nowMs - emittedAtMs === timeoutMs`) is NOT considered stale — it
 * still has the boundary tick to be verified. This is the conservative
 * choice: callers polling on a fixed cadence with `timeoutMs` equal to
 * the cadence won't surface false positives at the cadence boundary.
 * Switch to `>=` if SLA semantics ever require "must verify strictly
 * before timeout."
 */
export function findStaleEmissions(state, nowMs, timeoutMs) {
    const stale = [];
    for (const emission of state.emissions.values()) {
        if (state.verifications.has(emission.id))
            continue;
        if (nowMs - emission.emittedAtMs > timeoutMs) {
            stale.push(emission);
        }
    }
    return stale;
}
export function countVerdicts(state) {
    let verified = 0;
    let rejected = 0;
    let needsRevision = 0;
    for (const verification of state.verifications.values()) {
        switch (verification.verdict.kind) {
            case "verified":
                verified++;
                break;
            case "rejected":
                rejected++;
                break;
            case "needs-revision":
                needsRevision++;
                break;
        }
    }
    const total = state.emissions.size;
    const unverified = total - state.verifications.size;
    return { verified, rejected, needsRevision, unverified, total };
}
/**
 * Pairing-discipline assertion: every verified emission should compose
 * forward into the next workflow-engine stage (TrueSkill ranking,
 * evolution-via-mash-refine, etc.). Rejected emissions don't propagate.
 * Stale unverified emissions trigger pairing-violation substrate.
 *
 * This function returns the IDs of emissions that should propagate
 * forward (verdict.kind === "verified" OR "needs-revision" with non-empty
 * suggestions).
 */
export function propagatableEmissionIds(state) {
    const ids = [];
    for (const [emissionId, verification] of state.verifications.entries()) {
        switch (verification.verdict.kind) {
            case "verified":
                ids.push(emissionId);
                break;
            case "needs-revision":
                // needs-revision with suggestions propagates (refinement target)
                if (verification.verdict.suggestions.length > 0) {
                    ids.push(emissionId);
                }
                break;
            case "rejected":
                // rejected does NOT propagate
                break;
        }
    }
    return ids;
}
