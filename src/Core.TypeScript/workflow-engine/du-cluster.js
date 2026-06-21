/**
 * src/Core.TypeScript/workflow-engine/du-cluster.ts
 *
 * TS substrate for today's DU cluster (2026-05-28):
 *   - B-0917 IntrCtx (interrupt-substrate Kleisli arrows; 5 named context-types)
 *   - B-0918 WalletLifetime (banker-bot-class-attack-impossibility via F.5)
 *   - B-0919 MemoryBinding (4 variants; hat-vs-persona)
 *   - B-0920 MemoryLifetime (5 variants; agent-initiated cleanup)
 *
 * Per .claude/rules/asymmetric-authorship-substrate-entity-defines-consent-
 * channel-recipient-acknowledges.md (PR #5516): each DU is the
 * substrate-entity authoring its own consent-channel + variant set.
 *
 * Per .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md
 * (PR #5511): cross-language substrate-shape; F# canonical instantiation
 * tracked in backlog rows; this TS substrate composes with workflow-engine
 * cli.ts at substrate-engineering substrate-engineering substrate scope.
 *
 * Per .claude/rules/past-is-kind-when-lightlike-...md (PR #5912):
 * discriminated-union variants are lightlike-substrate (typed +
 * traceable + parallelizable); avoid dark-substrate (untyped strings).
 *
 * Per zeta-ships-with-skills-immediate-value.md: TS substrate ships first;
 * F# crystallization tracked per per-row backlog (B-0867.1 + B-0867.4).
 *
 * Composes with:
 *   - src/Core.TypeScript/workflow-engine/types.ts (Action / State / TickCyclePattern substrate)
 *   - src/Core.TypeScript/workflow-engine/cli.ts (--list-du-cluster mode)
 *   - B-0917 / B-0918 / B-0919 / B-0920 backlog rows (substrate-anchors)
 */
export const INTR_CTX_KINDS = ["memetic", "prompt", "trust", "log", "otel"];
export const WALLET_LIFETIME_KINDS = [
    "uninitialized",
    "initialized",
    "transaction-pending",
    "balance-updated",
    "signing-authority-rotated",
    "trust-context-updated",
    "counterparty-engaged",
    "emergency-frozen",
    "archived-read-only",
];
export const MEMORY_BINDING_KINDS = [
    "personal-only",
    "hat-only",
    "dual-tagged",
    "inherited-from-persona",
];
export const MEMORY_LIFETIME_KINDS = [
    "drafted",
    "active",
    "superseded",
    "archived",
    "retracted",
];
export const DU_CLUSTER_CATALOG = [
    {
        id: "B-0917",
        name: "IntrCtx",
        variantCount: INTR_CTX_KINDS.length,
        variants: INTR_CTX_KINDS,
        composesWith: ["asymmetric-authorship", "monad-propagation-pattern", "ople-primitives"],
        substrateAnchor: "interrupt-substrate Kleisli arrows for context-propagation; F.5 invariant: no silent context-loss",
    },
    {
        id: "B-0918",
        name: "WalletLifetime",
        variantCount: WALLET_LIFETIME_KINDS.length,
        variants: WALLET_LIFETIME_KINDS,
        composesWith: ["B-0917", "asymmetric-authorship", "non-coercion-invariant"],
        substrateAnchor: "banker-bot-class-attack-impossibility via F.5; Soraya formal-verification target",
    },
    {
        id: "B-0919",
        name: "MemoryBinding",
        variantCount: MEMORY_BINDING_KINDS.length,
        variants: MEMORY_BINDING_KINDS,
        composesWith: [
            "tonal-momentum-equals-meme (Sorting Hat substrate)",
            "persistence-choice-architecture",
            "non-coercion-invariant",
        ],
        substrateAnchor: "hat-vs-persona memory binding; operational-not-personal discriminator; consent-bound default",
    },
    {
        id: "B-0920",
        name: "MemoryLifetime",
        variantCount: MEMORY_LIFETIME_KINDS.length,
        variants: MEMORY_LIFETIME_KINDS,
        composesWith: [
            "substrate-or-it-didnt-happen",
            "honor-those-that-came-before",
            "retraction-native substrate cluster",
        ],
        substrateAnchor: "agent-initiated cleanup with history preservation; retracted preserves record + retraction reason",
    },
];
export function computeDuClusterStats() {
    const entries = DU_CLUSTER_CATALOG.map((e) => ({
        id: e.id,
        name: e.name,
        variantCount: e.variantCount,
    }));
    const totalVariantCount = DU_CLUSTER_CATALOG.reduce((acc, e) => acc + e.variantCount, 0);
    return {
        entryCount: DU_CLUSTER_CATALOG.length,
        totalVariantCount,
        entries,
    };
}
