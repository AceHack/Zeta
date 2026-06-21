/**
 * Heartbeat-file integrity attack vector taxonomy.
 * Grounded in Otto-339/340/342: substrate-poisoning of heartbeat files
 * is cognition-poisoning and identity-corruption for the agent.
 *
 * This is a *versioned* discriminated union, NOT an exhaustive one.
 * TypeScript exhaustiveness means all declared variants are handled —
 * it makes no claim about completeness of the declared set.
 * New vectors are added as threat-model-critic review rounds surface them.
 *
 * v1 (B-0032.1, PR #2390): 5 vectors
 * v2 (B-0032.3, 2026-05-10): +content-injection (AH-2); STRIDE fixes (AH-7);
 *   BouncyCastle mitigation clarified (AH-6)
 */
export const ALL_HEARTBEAT_ATTACK_VECTORS = [
    {
        kind: 'repository-compromise',
        surface: 'push-permissions-to-main',
        impact: 'poisoned-heartbeat-write',
        mitigation: 'branch-protection + signed-commits + SLSA',
    },
    {
        kind: 'force-push-attack',
        surface: 'admin-override-bypass',
        impact: 'history-rewrite-poison',
        mitigation: 'force-push:false + signed-commits + immutable-history',
    },
    {
        kind: 'insider-threat',
        surface: 'authorized-contributor',
        impact: 'hard-to-detect-poison',
        mitigation: 'review-gate (T0/T1 only at bus-factor-1) + per-commit-attestation',
    },
    {
        kind: 'supply-chain',
        surface: 'compromised-ci-runner',
        impact: 'main-write-poison',
        mitigation: 'SLSA + Sigstore + runner-attestation + signing-infrastructure-pending-Otto-346',
    },
    {
        kind: 'direct-to-main-bypass',
        surface: 'task-276-low-gate-without-threat-model',
        impact: 'review-gate-removal',
        mitigation: 'this-row (B-0032) + Otto-346 sequencing',
    },
    {
        kind: 'content-injection',
        surface: 'heartbeat-file-body-or-frontmatter',
        impact: 'ai-state-vector-shift-via-crafted-natural-language-or-invisible-unicode',
        mitigation: 'semantic-diff-lint + outlier-detection + invisible-unicode-gate (none deployed)',
    },
];
const KNOWN_KINDS = [
    'repository-compromise',
    'force-push-attack',
    'insider-threat',
    'supply-chain',
    'direct-to-main-bypass',
    'content-injection',
];
export function isHeartbeatAttackVector(v) {
    return (typeof v === 'object' &&
        v !== null &&
        'kind' in v &&
        typeof v.kind === 'string' &&
        KNOWN_KINDS.includes(v.kind));
}
