/**
 * observe/chooser.ts — tiered decision engine (Sequoia memory-model for choices).
 *
 * The Sequoia memory model (Fatahalian et al., Stanford SC 2006) makes the memory
 * hierarchy FIRST-CLASS in the programming model. We apply the same principle to
 * decision-making: the decision hierarchy is first-class, and placement (which tier
 * resolves the choice) stays SOFT until evidence warrants escalation.
 *
 * Tier cascade:
 *   Oracle    (L1, ns)   — deterministic priority. Resolves when menu has one dominant option.
 *   Composer  (L2, ms)   — Bayesian/heuristic scoring. Resolves when confidence > threshold.
 *   Deliberator (L3, s)  — LLM or human. Resolves when composer confidence is insufficient.
 *
 * The same action type flows through all tiers. The cascade is:
 *   menu = buildMenu(world)
 *   choice = oracle(menu) ?? composer(menu) ?? deliberator(menu)
 *
 * Access-events-as-evidence: each time the oracle resolves correctly (the action it picks
 * leads to a good outcome), the posterior on "oracle is sufficient for this state shape"
 * strengthens. Over time, more state shapes resolve at L1 without needing the LLM.
 *
 * Composes with:
 *   - src/Core/SoftValue.fs (the placement stays soft; access = evidence)
 *   - src/Core/Cl3.fs (distance in Clifford space = "how far from deterministic")
 *   - src/Core.TypeScript/observe/observe.ts (buildMenu, observe)
 *   - src/Core.TypeScript/observe/participant.ts (observeWithParticipant, Participant)
 *   - docs/research/2026-06-10-sequoia-memory-model-in-softvalue-over-geospatial-clifford-space-soft-tier-placement.md
 */

import type { NextAction, World } from "./observe";
import { observe, buildMenu } from "./observe";
import { observeWithParticipant, type Participant } from "./participant";

// ─── Chooser interface ──────────────────────────────────────────────

export type ChooserTier = "oracle" | "composer" | "deliberator";

export interface ChooserResult {
  readonly action: NextAction;
  readonly tier: ChooserTier;
  readonly confidence: number; // 0..1 — how certain this tier is about its pick
}

export interface ComposerBackend {
  /** Score each option. Returns scores aligned with the menu array. */
  score(menu: readonly NextAction[], world: World): Promise<readonly number[]>;
}

export interface ChooserConfig {
  /** Minimum confidence for the oracle to resolve without escalation (default 0.9) */
  readonly oracleThreshold?: number;
  /** Minimum confidence for the composer to resolve without escalation (default 0.7) */
  readonly composerThreshold?: number;
  /** Optional composer backend (Bayesian scorer / local LLM). If absent, skip to deliberator. */
  readonly composer?: ComposerBackend;
  /** Optional deliberator participant. If absent, fall back to oracle pick. */
  readonly deliberator?: Participant;
}

// ─── Oracle tier ────────────────────────────────────────────────────

/**
 * L1: deterministic priority oracle. Resolves instantly when the menu has
 * one clearly dominant option (confidence = 1.0) or the deterministic
 * controller's pick is unambiguous.
 */
function oracleChoose(world: World, menu: readonly NextAction[]): ChooserResult | null {
  if (menu.length === 0) return null;

  // Deterministic controller always produces a pick
  const pick = observe(world);

  // Confidence = 1.0 when menu has ≤1 option or the priority-ordered pick is the only ready item
  if (menu.length === 1) {
    return { action: pick, tier: "oracle", confidence: 1.0 };
  }

  // High confidence when operator/ferry is present (these always dominate)
  if (pick.kind === "preserve_ferry" || pick.kind === "respond_to_operator") {
    return { action: pick, tier: "oracle", confidence: 1.0 };
  }

  // Medium confidence when there's clear work (one ready item)
  const readyItems = menu.filter(a => a.kind === "do_item");
  if (readyItems.length === 1 && pick.kind === "do_item") {
    return { action: pick, tier: "oracle", confidence: 0.95 };
  }

  // Low confidence when multiple viable options exist (need escalation)
  const viableCount = menu.filter(a =>
    a.kind === "do_item" || a.kind === "decompose" || a.kind === "explore"
  ).length;

  if (viableCount <= 1) {
    return { action: pick, tier: "oracle", confidence: 0.9 };
  }

  // Multiple viable options — oracle confidence drops below threshold
  return { action: pick, tier: "oracle", confidence: 0.5 / viableCount };
}

// ─── Composer tier ──────────────────────────────────────────────────

/**
 * L2: Bayesian/heuristic scoring. Resolves when one option clearly dominates
 * after scoring (confidence = normalized score gap).
 */
async function composerChoose(
  world: World,
  menu: readonly NextAction[],
  backend: ComposerBackend,
): Promise<ChooserResult> {
  const scores = await backend.score(menu, world);
  const maxScore = Math.max(...scores);
  const maxIdx = scores.indexOf(maxScore);
  const secondMax = Math.max(...scores.filter((_, i) => i !== maxIdx));

  // Confidence = normalized gap between best and second-best
  const confidence = maxScore > 0 ? (maxScore - secondMax) / maxScore : 0;

  return { action: menu[maxIdx]!, tier: "composer", confidence };
}

// ─── Deliberator tier ───────────────────────────────────────────────

/**
 * L3: full LLM/persona chooser via Participant interface. Always resolves
 * (confidence = 1.0 by convention — the most expensive tier is the final word).
 */
async function deliberatorChoose(world: World, participant: Participant): Promise<ChooserResult> {
  const action = await observeWithParticipant(world, participant);
  return { action, tier: "deliberator", confidence: 1.0 };
}

// ─── Cascade ────────────────────────────────────────────────────────

/**
 * The tiered decision cascade. Resolves at the cheapest tier where confidence
 * exceeds threshold. Falls through to more expensive tiers only when needed.
 *
 * This IS the Sequoia model applied to decisions:
 *   - Placement stays soft until evidence warrants escalation
 *   - Most ticks resolve at L1 (oracle) — instant, free
 *   - Ambiguous menus escalate to L2 (composer) — fast, cheap
 *   - Novel situations escalate to L3 (deliberator) — slow, expensive
 */
export async function choose(world: World, config: ChooserConfig = {}): Promise<ChooserResult> {
  const oracleThreshold = config.oracleThreshold ?? 0.9;
  const composerThreshold = config.composerThreshold ?? 0.7;
  const menu = buildMenu(world);

  // L1: Oracle (instant)
  const oracleResult = oracleChoose(world, menu);
  if (oracleResult && oracleResult.confidence >= oracleThreshold) {
    return oracleResult;
  }

  // L2: Composer (fast, if backend provided)
  if (config.composer) {
    const composerResult = await composerChoose(world, menu, config.composer);
    if (composerResult.confidence >= composerThreshold) {
      return composerResult;
    }
  }

  // L3: Deliberator (slow, if participant provided)
  const deliberatorParticipant = config.deliberator;
  if (deliberatorParticipant) {
    return deliberatorChoose(world, deliberatorParticipant);
  }

  // Fallback: oracle pick regardless of confidence (best we can do without backends)
  return oracleResult ?? { action: observe(world), tier: "oracle", confidence: 0.5 };
}
