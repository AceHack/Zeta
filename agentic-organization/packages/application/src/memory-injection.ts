/**
 * Deterministic memory injection (MEM4) — the structural (not behavioral) memory
 * seam. Injection is a mandatory pre-turn step the kernel always runs; the agent
 * never decides whether it runs, only which surfaced memories it cites.
 *
 *   composeInjectionQuery(ctx)        — the recall query, a pure function of the
 *                                       binding (reproducible + cacheable by hash)
 *   buildRelevantMemoryBlock(hydrated)— the `## Relevant memory` prompt block,
 *                                       grouped hat→agent→work, weight + KPI annotated
 *   recordInjections(ranked, ctx)     — one idempotent ledger row per surfaced memory
 *   verifyCitations(cited, injected)  — anti-laundering: a cited id not injected this
 *                                       turn is a fabrication and is rejected
 *   nextUtility(prev, wasCited)       — the post-turn utility $inc (injected; cited)
 */

import {
  MemoryTier,
  type MemoryInjectionRecord,
  type MemoryUtilityCorrelation,
} from "../../domain/src/index.ts";
import { createHash } from "node:crypto";
import type { RankedMemory, RetrievalCtx } from "./memory-ranking.ts";

/** A ranked memory with its CONTENT text hydrated (from Hindsight) for the prompt. */
export type HydratedMemory = RankedMemory & { value: string };

/**
 * The recall query is a pure function of (task, recent turns, role sentence) — no
 * model call decides what to search for, so it is reproducible and cacheable.
 */
export type InjectionQueryInput = {
  roleSentence: string;
  taskSummary: string;
  recentTurns: readonly string[];
};

export function composeInjectionQuery(input: InjectionQueryInput): string {
  const turns = input.recentTurns.slice(-4).join(" • ");
  return [input.roleSentence, input.taskSummary, turns].filter((s) => s.length > 0).join("\n").trim();
}

export function injectionQueryHash(query: string): string {
  return createHash("sha256").update(query).digest("hex").slice(0, 16);
}

const TIER_ORDER: readonly MemoryTier[] = [
  MemoryTier.Org,
  MemoryTier.Department,
  MemoryTier.Hat,
  MemoryTier.Agent,
  MemoryTier.Work,
];

const TIER_HEADING: Record<MemoryTier, string> = {
  [MemoryTier.Org]: "Org",
  [MemoryTier.Department]: "Department",
  [MemoryTier.Hat]: "Hat",
  [MemoryTier.Agent]: "You (agent)",
  [MemoryTier.Work]: "This work",
};

/**
 * The `## Relevant memory` block injected into the prompt — grouped by tier, every
 * line annotated with its live weight + KPI record so the reviewer/gate can see
 * exactly what was surfaced (including relevant-but-unused, for the must-address gate).
 */
export function buildRelevantMemoryBlock(hydrated: readonly HydratedMemory[]): string {
  if (hydrated.length === 0) return "## Relevant memory\n\n(none surfaced)";
  const lines: string[] = ["## Relevant memory"];
  for (const tier of TIER_ORDER) {
    const group = hydrated.filter((h) => h.envelope.tier === tier);
    if (group.length === 0) continue;
    lines.push("", `### ${TIER_HEADING[tier]}`);
    for (const h of group) {
      const o = h.envelope.state.outcome;
      const u = h.envelope.state.utility;
      const kpi = `w=${h.weight.toFixed(2)} kpi=${o.successCount}/${o.successCount + o.failureCount} cited=${u.citedCount}/${u.injectedCount}`;
      lines.push(`- [${h.envelope.memoryId}] ${h.value}  _(${kpi})_`);
    }
  }
  return lines.join("\n");
}

/** Deterministic ledger id — idempotent on (run, memory) so re-injection is a no-op. */
export function injectionId(promptFlowRunId: string, memoryId: string): string {
  return createHash("sha256").update(`${promptFlowRunId}:${memoryId}`).digest("hex").slice(0, 32);
}

/** One ledger row per surfaced memory — the audit trail KPI + utility read from. */
export function recordInjections(
  ranked: readonly RankedMemory[],
  ctx: RetrievalCtx,
  promptFlowRunId: string,
  injectedAt: string,
): readonly MemoryInjectionRecord[] {
  return ranked.map((r) => ({
    injectionId: injectionId(promptFlowRunId, r.envelope.memoryId),
    organizationId: ctx.organizationId,
    memoryId: r.envelope.memoryId,
    workItemId: ctx.workItemId,
    hatId: ctx.hatId,
    agentId: ctx.agentId,
    promptFlowRunId,
    weightAtInjection: r.weight,
    cited: false,
    injectedAt,
  }));
}

export type CitationVerification = {
  /** cited ids that were genuinely injected this turn (count toward utility) */
  valid: readonly string[];
  /** cited ids NOT injected this turn — fabricated grounding, rejected */
  laundered: readonly string[];
};

/**
 * Anti-citation-laundering (§4.3) — same clamp discipline as the rest of the
 * kernel: an agent cannot cite a memory it was not actually shown. A cited id not
 * in the injected set is a fabrication and is rejected.
 */
export function verifyCitations(
  citedMemoryIds: readonly string[],
  injectedMemoryIds: readonly string[],
): CitationVerification {
  const injected = new Set(injectedMemoryIds);
  const valid: string[] = [];
  const laundered: string[] = [];
  for (const id of new Set(citedMemoryIds)) {
    if (injected.has(id)) valid.push(id);
    else laundered.push(id);
  }
  return { valid, laundered };
}

/** Post-turn utility $inc: every injected memory's injectedCount++; cited → citedCount++. */
export function nextUtility(
  prev: MemoryUtilityCorrelation,
  wasInjected: boolean,
  wasCited: boolean,
  at: string,
): MemoryUtilityCorrelation {
  return {
    injectedCount: prev.injectedCount + (wasInjected ? 1 : 0),
    citedCount: prev.citedCount + (wasCited ? 1 : 0),
    ...(wasInjected ? { lastInjectedAt: at } : prev.lastInjectedAt !== undefined ? { lastInjectedAt: prev.lastInjectedAt } : {}),
  };
}

/**
 * Must-address (§12.5) — a high-weight memory surfaced and the agent neither cited
 * it nor acknowledged it. The gate flags this as negligence (ignoring memory is as
 * costly as fabricating it). Returns the surfaced-but-unused high-weight memories.
 */
export function unaddressedHighWeight(
  ranked: readonly RankedMemory[],
  citedMemoryIds: readonly string[],
  highWeightThreshold = 0.6,
): readonly RankedMemory[] {
  const cited = new Set(citedMemoryIds);
  return ranked.filter((r) => r.weight >= highWeightThreshold && !cited.has(r.envelope.memoryId));
}
