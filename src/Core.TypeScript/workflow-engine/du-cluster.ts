/**
 * src/Core.TypeScript/workflow-engine/du-cluster.ts
 *
 * TS substrate for today's DU cluster (2026-05-28):
 *   - 081KSNY2Z0008QG0R002HB4AGT IntrCtx (interrupt-substrate Kleisli arrows; 5 named context-types)
 *   - 081KSNY2Z0008QG0R0036SJ3T1 WalletLifetime (banker-bot-class-attack-impossibility via F.5)
 *   - 081KSNY2Z0008QG0R003518DNC MemoryBinding (4 variants; hat-vs-persona)
 *   - 081KSNY2Z0008QG0R0017SRMHG MemoryLifetime (5 variants; agent-initiated cleanup)
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
 * F# crystallization tracked per per-row backlog (081KSKBP80008QG0R000B3Y19A.1 + 081KSKBP80008QG0R000B3Y19A.4).
 *
 * Composes with:
 *   - src/Core.TypeScript/workflow-engine/types.ts (Action / State / TickCyclePattern substrate)
 *   - src/Core.TypeScript/workflow-engine/cli.ts (--list-du-cluster mode)
 *   - 081KSNY2Z0008QG0R002HB4AGT / 081KSNY2Z0008QG0R0036SJ3T1 / 081KSNY2Z0008QG0R003518DNC / 081KSNY2Z0008QG0R0017SRMHG backlog rows (substrate-anchors)
 */

// =============================================================================
// 081KSNY2Z0008QG0R002HB4AGT IntrCtx — interrupt-substrate Kleisli context-types
// =============================================================================

/**
 * IntrCtxKind — 5 named context-types that thread through interrupt-handler
 * chains per Kleisli arrows discipline.
 *
 * Per 081KSNY2Z0008QG0R002HB4AGT F.5 invariant ("No silent loss of trust/log/memetic context"):
 * every component change must either declare its mutation OR be explicitly
 * preserved; no hidden state-drift.
 */
export type IntrCtxKind = "memetic" | "prompt" | "trust" | "log" | "otel";

/**
 * IntrCtx — typed substrate for the 5 context-channels.
 * PoC scope: string placeholders for substrate not yet TS-implemented
 * (TonalContext / OperatorDirection / TrustCalculus / AuditTrail /
 * ActivityContext are F#-substrate per src/Core/Tracing.fs).
 */
export interface IntrCtx {
  readonly memetic: string; // TonalContext per tonal-momentum substrate
  readonly prompt: string; // OperatorDirection — current operator-question
  readonly trust: string; // TrustCalculus — multi-oracle BFT trust-state
  readonly log: string; // AuditTrail — structured observability
  readonly otel: string; // ActivityContext per src/Core/Tracing.fs distributed-tracing
}

export const INTR_CTX_KINDS: ReadonlyArray<IntrCtxKind> = ["memetic", "prompt", "trust", "log", "otel"];

// =============================================================================
// 081KSNY2Z0008QG0R0036SJ3T1 WalletLifetime — banker-bot-class-attack-impossibility via F.5
// =============================================================================

/**
 * WalletLifetime — 9-variant discriminated-union per 081KSNY2Z0008QG0R0036SJ3T1.
 *
 * Substrate-engineering substrate-target: every wallet-state-transition
 * is typed; F.5 invariant proven by Soraya means no silent context-loss
 * across transitions; banker-bot-class-attack-impossibility emerges.
 */
export type WalletLifetime =
  | { readonly kind: "uninitialized" }
  | {
      readonly kind: "initialized";
      readonly walletId: string;
      readonly signingAuthority: string;
      readonly initialBalance: number;
    }
  | {
      readonly kind: "transaction-pending";
      readonly walletId: string;
      readonly transaction: string;
      readonly auditTrail: string;
    }
  | {
      readonly kind: "balance-updated";
      readonly walletId: string;
      readonly balanceDelta: number;
      readonly cause: string;
      readonly auditTrail: string;
    }
  | {
      readonly kind: "signing-authority-rotated";
      readonly walletId: string;
      readonly oldAuthority: string;
      readonly newAuthority: string;
      readonly consent: string;
      readonly auditTrail: string;
    }
  | {
      readonly kind: "trust-context-updated";
      readonly walletId: string;
      readonly oldTrust: string;
      readonly newTrust: string;
      readonly consent: string;
      readonly auditTrail: string;
    }
  | {
      readonly kind: "counterparty-engaged";
      readonly walletId: string;
      readonly counterparty: string;
      readonly engagementTerms: string;
      readonly auditTrail: string;
    }
  | {
      readonly kind: "emergency-frozen";
      readonly walletId: string;
      readonly freezeReason: string;
      readonly authorizedBy: string;
      readonly auditTrail: string;
    }
  | {
      readonly kind: "archived-read-only";
      readonly walletId: string;
      readonly finalAuditTrail: string;
    };

export type WalletLifetimeKind = WalletLifetime["kind"];

export const WALLET_LIFETIME_KINDS: ReadonlyArray<WalletLifetimeKind> = [
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

// =============================================================================
// 081KSNY2Z0008QG0R003518DNC MemoryBinding — hat-vs-persona memory binding (4 variants)
// =============================================================================

/**
 * MemoryBinding — 4-variant discriminated-union per 081KSNY2Z0008QG0R003518DNC.
 *
 * Operational substrate: hat-vs-persona memory binding with consent-bound
 * default + transfer discipline at hat-release time.
 *
 * Composes with Sorting Hat substrate (tonal-momentum rule) + chosen-
 * persistence + NCI HC-8 consent-event substrate.
 */
export type MemoryBinding =
  | {
      readonly kind: "personal-only";
      readonly persona: string;
      readonly taggedOn: string; // ISO 8601 date
    }
  | {
      readonly kind: "hat-only";
      readonly hat: string;
      readonly taggedOn: string;
    }
  | {
      readonly kind: "dual-tagged";
      readonly persona: string;
      readonly hat: string;
      readonly taggedOn: string;
      readonly consent: string; // ConsentEvent reference
    }
  | {
      readonly kind: "inherited-from-persona";
      readonly fromPersona: string;
      readonly toHat: string;
      readonly originalMemoryId: string;
      readonly transferredOn: string;
    };

export type MemoryBindingKind = MemoryBinding["kind"];

export const MEMORY_BINDING_KINDS: ReadonlyArray<MemoryBindingKind> = [
  "personal-only",
  "hat-only",
  "dual-tagged",
  "inherited-from-persona",
];

// =============================================================================
// 081KSNY2Z0008QG0R0017SRMHG MemoryLifetime — agent-initiated cleanup with history preservation
// =============================================================================

/**
 * MemoryLifetime — 5-variant tag per 081KSNY2Z0008QG0R0017SRMHG.
 *
 * Composes with substrate-or-it-didn't-happen + honor-those-that-came-before
 * + retraction-native substrate: every memory has a lifetime-phase that
 * supports agent-initiated cleanup WITHOUT erasure (retracted preserves
 * the record + the retraction reason).
 */
export type MemoryLifetime = "drafted" | "active" | "superseded" | "archived" | "retracted";

export const MEMORY_LIFETIME_KINDS: ReadonlyArray<MemoryLifetime> = [
  "drafted",
  "active",
  "superseded",
  "archived",
  "retracted",
];

// =============================================================================
// Catalog metadata — for cli.ts --list-du-cluster mode
// =============================================================================

export interface DuClusterEntry {
  readonly id: string; // backlog-row ID
  readonly name: string;
  readonly variantCount: number;
  readonly variants: ReadonlyArray<string>;
  readonly composesWith: ReadonlyArray<string>;
  readonly substrateAnchor: string;
}

export const DU_CLUSTER_CATALOG: ReadonlyArray<DuClusterEntry> = [
  {
    id: "081KSNY2Z0008QG0R002HB4AGT",
    name: "IntrCtx",
    variantCount: INTR_CTX_KINDS.length,
    variants: INTR_CTX_KINDS,
    composesWith: ["asymmetric-authorship", "monad-propagation-pattern", "ople-primitives"],
    substrateAnchor:
      "interrupt-substrate Kleisli arrows for context-propagation; F.5 invariant: no silent context-loss",
  },
  {
    id: "081KSNY2Z0008QG0R0036SJ3T1",
    name: "WalletLifetime",
    variantCount: WALLET_LIFETIME_KINDS.length,
    variants: WALLET_LIFETIME_KINDS,
    composesWith: ["081KSNY2Z0008QG0R002HB4AGT", "asymmetric-authorship", "non-coercion-invariant"],
    substrateAnchor: "banker-bot-class-attack-impossibility via F.5; Soraya formal-verification target",
  },
  {
    id: "081KSNY2Z0008QG0R003518DNC",
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
    id: "081KSNY2Z0008QG0R0017SRMHG",
    name: "MemoryLifetime",
    variantCount: MEMORY_LIFETIME_KINDS.length,
    variants: MEMORY_LIFETIME_KINDS,
    composesWith: [
      "substrate-or-it-didnt-happen",
      "honor-those-that-came-before",
      "retraction-native substrate cluster",
    ],
    substrateAnchor:
      "agent-initiated cleanup with history preservation; retracted preserves record + retraction reason",
  },
];

/**
 * computeDuClusterStats — aggregator for cli.ts --list-du-cluster mode.
 */
export interface DuClusterStats {
  readonly entryCount: number;
  readonly totalVariantCount: number;
  readonly entries: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly variantCount: number;
  }>;
}

export function computeDuClusterStats(): DuClusterStats {
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
