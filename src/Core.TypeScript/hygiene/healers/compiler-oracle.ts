/**
 * compiler-oracle.ts — the acceptance gate that makes cheap models useful.
 *
 * Wraps ANY healer with a detector-based verification step:
 *   1. Run detector BEFORE heal → get the "before" findings
 *   2. Apply the healer → get the proposed tree
 *   3. Run detector AFTER heal → get the "after" findings
 *   4. ACCEPT iff: target finding is GONE and NO NEW findings appeared
 *   5. REJECT (return original tree): target still there OR new findings
 *
 * The model never has to be right — it just has to propose something the
 * compiler can verify. This is how 8GB of intelligence becomes useful:
 * the oracle (tsc/markdownlint/eslint) does the actual judgment.
 *
 * This wrapper is REUSABLE across every Tier-1 healer class. Each class
 * provides its own detector (what constitutes a "finding") and its own
 * proposer (what change to try). The oracle wrapper handles acceptance.
 *
 * Laws (inherited from the inner healer + verified by the gate):
 * - Idempotence: if the inner healer is idempotent, wrapping preserves it
 * - Closure-as-subset: ENFORCED by the gate (new findings → reject)
 * - Convergence: the gate makes the healer monotone (each pass removes ≥0 findings)
 * - Totality: never throws (returns original on any failure)
 * - Exit: rejection IS the decline (return original = "I cannot fix this")
 *
 * Composes with:
 * - src/Core.TypeScript/hygiene/healer-harness.ts (the certification API)
 * - src/Core.TypeScript/hygiene/healers/unused-import.ts (first Tier-0 healer)
 * - Otto's handoff: step 2 of the build order
 */

import type { Healer, Detector, Finding, FileTree } from "../healer-harness";
import { newFindings } from "../healer-harness";

// ═══ Decline Record (the escalation signal) ═════════════════════════════════════

/** Why the oracle rejected the proposal. */
export type DeclineReason =
  | { kind: "target-not-fixed"; finding: Finding }
  | { kind: "new-findings-introduced"; newFindings: readonly Finding[] }
  | { kind: "healer-threw"; error: string };

/** A decline record — the training signal for the next model. */
export interface DeclineRecord {
  readonly class: string; // stable class id (the join key for counting)
  readonly reason: DeclineReason;
  readonly tierAttempted: "tier-0" | "tier-1" | "tier-2";
}

// ═══ The Oracle Wrapper ═════════════════════════════════════════════════════════

export interface OracleHealerOptions {
  /** The inner healer that proposes fixes. */
  readonly proposer: Healer;
  /** The detector that acts as the oracle (compiler/linter). */
  readonly detector: Detector;
  /** The drift class this healer targets (for decline records). */
  readonly driftClass: string;
  /** The tier this wrapper runs at (for decline records). */
  readonly tier?: "tier-0" | "tier-1" | "tier-2";
  /** Callback when a proposal is declined (emits the escalation signal). */
  readonly onDecline?: (record: DeclineRecord) => void;
}

/**
 * Wrap a proposer healer with the compiler-oracle acceptance gate.
 *
 * The returned healer:
 * - Runs the detector to find current issues
 * - Applies the proposer to get a proposed fix
 * - Re-runs the detector on the proposed tree
 * - Accepts ONLY if findings decreased (or stayed zero) AND no new findings
 * - Declines (returns original) otherwise
 *
 * This is the single reusable component that makes the cheap tier viable.
 */
export function oracleHealer(opts: OracleHealerOptions): Healer {
  const tier = opts.tier ?? "tier-1";

  return {
    name: `oracle(${opts.proposer.name})`,

    heal(tree: FileTree): FileTree {
      // 1. Detect findings BEFORE
      const findingsBefore = opts.detector.detect(tree);

      // If there are no findings to fix, return unchanged (nothing to do)
      if (findingsBefore.length === 0) return tree;

      // 2. Apply the proposer
      let proposed: FileTree;
      try {
        proposed = opts.proposer.heal(tree);
      } catch (err) {
        // Totality: the proposer threw — decline, never propagate
        if (opts.onDecline) {
          opts.onDecline({
            class: opts.driftClass,
            reason: { kind: "healer-threw", error: err instanceof Error ? err.message : String(err) },
            tierAttempted: tier,
          });
        }
        return tree; // EXIT: return unchanged
      }

      // 3. Detect findings AFTER
      const findingsAfter = opts.detector.detect(proposed);

      // 4. Check for new findings (closure-as-subset violation)
      const introduced = newFindings(findingsBefore, findingsAfter);
      if (introduced.length > 0) {
        // REJECT: the proposer introduced new problems
        if (opts.onDecline) {
          opts.onDecline({
            class: opts.driftClass,
            reason: { kind: "new-findings-introduced", newFindings: introduced },
            tierAttempted: tier,
          });
        }
        return tree; // EXIT: return unchanged
      }

      // 5. Check that at least one finding was fixed
      if (findingsAfter.length >= findingsBefore.length) {
        // REJECT: nothing improved (the proposer's change was a no-op or made things equal)
        if (opts.onDecline) {
          opts.onDecline({
            class: opts.driftClass,
            reason: { kind: "target-not-fixed", finding: findingsBefore[0]! },
            tierAttempted: tier,
          });
        }
        return tree; // EXIT: return unchanged
      }

      // ACCEPT: findings decreased, no new ones introduced
      return proposed;
    },
  };
}
