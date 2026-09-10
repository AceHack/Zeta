/**
 * corporate/agent-calibration.ts — what an ACTOR learns about itself, as opposed to its role.
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 * `MemoryTier.Agent` is described in `memory.ts` as *"a specific actor's personal layer:
 * calibration, tendencies. Travels across hats."* It was fully READABLE — `recallScopes` includes
 * it, `weightOf` gives a memory in your own agent scope a bonus, and `repoDirFor` routes it to its
 * own repository under `agents/<id>` — and nothing anywhere WROTE one. A reader with no writer:
 * the recall path could only ever find zero agent memories, the per-agent repositories could never
 * come into existence, and the weight bonus applied to a set that is empty by construction.
 *
 * ── WHY IT IS A CALIBRATION AND NOT A DIARY ──────────────────────────────────
 * A hat memory is what the ROLE knows and is inherited by whoever wears it next. An agent memory
 * has to be about the actor, survive a change of hat, and be worth having — so it is the one thing
 * the log can say about an actor independently of its role: HOW THE WORK IT TOOK ON FARED.
 *
 * The join is real and already in the log. `work_claimed` carries `actorAgentId` and the work id;
 * the gate evaluations say how that work was judged. Nothing here is asserted.
 *
 * ── THE THRESHOLD, AND WHY THERE IS ONE ──────────────────────────────────────
 * One work item through one gate is a data point, not a tendency, and writing "you are sent back
 * at peer review" off a single rejection is exactly the coincidence-promoted-to-belief this repo
 * has a rule against (`numerology-vs-number-theory`: a count is not an identification). So a
 * calibration needs at least two work items before it is written at all, and the memory states its
 * denominator so a reader can see how thin it is.
 */

import type { WriteInput } from "./memory";
import { MemoryTier as Tier } from "./memory";
import { OrgEventKind, type OrgEvent } from "./org-event";
import { foldGateEvaluations } from "./org-fold";
import { GateOutcome } from "./quality-gate";

/** How an actor's own work has fared at one gate. */
export interface AgentCalibration {
  readonly agentId: string;
  readonly gate: string;
  /** Work items this agent claimed that were judged at this gate. The denominator. */
  readonly workItems: readonly string[];
  /** Judgements that sent it back — rejected or changes requested. */
  readonly sentBack: number;
  /** Judgements that let it through — approved or waived. */
  readonly passed: number;
}

/** Two work items before a pattern is a pattern. See the header. */
export const MIN_WORK_ITEMS = 2;

/**
 * Which work each agent claimed, from the log.
 *
 * `WorkClaimed` is the only EVENT that names an actor and a work item together, which is why the
 * join runs through it rather than through the hat. Note it is an event kind and not a fact — the
 * first draft tested `event.fact?.kind !== "work_claimed"` as well, and the compiler pointed out
 * that no such fact exists, so that half of the condition was always true and did nothing.
 *
 * An agent that claimed nothing has no record, and gets no memory — not an empty one.
 */
export function claimsByAgent(events: readonly OrgEvent[]): ReadonlyMap<string, ReadonlySet<string>> {
  const out = new Map<string, Set<string>>();
  for (const event of events) {
    if (event.actorAgentId === undefined) continue;
    if (event.kind !== OrgEventKind.WorkClaimed) continue;
    const seen = out.get(event.actorAgentId) ?? new Set<string>();
    seen.add(event.subjectId);
    out.set(event.actorAgentId, seen);
  }
  return out;
}

/**
 * How each actor's own work has been judged, per gate.
 *
 * Below `MIN_WORK_ITEMS` distinct work items nothing is returned for that (agent, gate) — see the
 * header.
 *
 * Sorted by (agent, gate) and NOT by when the work happened. `factEvents` already canonicalises
 * the log by time, so the accumulation order is a function of WHEN each agent's work was judged —
 * which means an agent whose work happened to be judged first would sort first, and the same
 * organisation would produce a differently-ordered list on a day the reviews ran in a different
 * sequence. Sorting by identity is what makes the list a property of the organisation rather than
 * of its schedule, and it is what lets the memory ids stay stable so a second run REINFORCES
 * rather than writing a second belief with the same content.
 */
export function agentCalibrations(
  events: readonly OrgEvent[],
  minWorkItems: number = MIN_WORK_ITEMS,
): readonly AgentCalibration[] {
  const claims = claimsByAgent(events);
  if (claims.size === 0) return [];
  const evaluations = foldGateEvaluations(events);

  const byKey = new Map<string, { agentId: string; gate: string; work: Set<string>; sentBack: number; passed: number }>();
  for (const e of evaluations) {
    for (const [agentId, workIds] of claims) {
      if (!workIds.has(e.workId)) continue;
      const key = `${agentId}|${String(e.gate)}`;
      const row = byKey.get(key) ?? { agentId, gate: String(e.gate), work: new Set<string>(), sentBack: 0, passed: 0 };
      row.work.add(e.workId);
      if (e.outcome === GateOutcome.Rejected || e.outcome === GateOutcome.ChangesRequested) row.sentBack += 1;
      else row.passed += 1;
      byKey.set(key, row);
    }
  }

  return [...byKey.values()]
    .filter((r) => r.work.size >= minWorkItems)
    .map((r) => ({
      agentId: r.agentId,
      gate: r.gate,
      workItems: [...r.work].sort((a, b) => a.localeCompare(b)),
      sentBack: r.sentBack,
      passed: r.passed,
    }))
    .sort((a, b) => (a.agentId === b.agentId ? a.gate.localeCompare(b.gate) : a.agentId.localeCompare(b.agentId)));
}

/**
 * The finding, at a granularity that does not churn.
 *
 * Four buckets rather than a ratio, and the reason is mechanical rather than stylistic: the value
 * of a memory is what `write` compares to decide reinforcement against conflict. A running total
 * changes on every run, so a value containing one can NEVER be reinforced — see the header note in
 * `memoryFromCalibration`. A bucket changes only when the finding changes, which is exactly when a
 * conflict is the right answer.
 */
function findingOf(sentBack: number, total: number): string {
  if (sentBack === 0) return "has passed every time";
  if (sentBack === total) return "has been sent back every time";
  return sentBack * 2 > total ? "is usually sent back" : "is usually let through";
}

/**
 * The memory an actor writes about itself.
 *
 * ── THE BELIEF IS THE VALUE; THE EVIDENCE IS THE HINT ────────────────────────
 * The counts are NOT in the value, and that placement is load-bearing. `write` compares values to
 * tell a reinforcement from a conflict, so a value carrying a running total is a value that
 * changes every run — the memory is flagged as self-contradictory, `reinforcementCount` stays at
 * zero, and confidence can only ever fall. A memory that cannot be reinforced is one that is
 * always on its way to being forgotten, however true it keeps turning out to be.
 *
 * So the value states the FINDING, which is stable while the finding is stable, and the counts go
 * in `contextHint`, which `write` does not compare. The evidence is not lost: `renderForPrompt`
 * shows the hint alongside the value, so an agent reading its own calibration sees how much is
 * behind it. A change of FINDING remains a conflict, which is the case somebody should look at.
 *
 * ── CONFIDENCE IS BOUNDED BY THE SAMPLE ──────────────────────────────────────
 * Two work items cannot support a confident belief however lopsided the outcome, so confidence
 * rises with the denominator and stops well short of certain. A calibration written at 0.9 off two
 * observations would outrank a lesson learned from a year of delivery.
 */
export function memoryFromCalibration(calibration: AgentCalibration, nowMs: number): WriteInput | undefined {
  const total = calibration.sentBack + calibration.passed;
  if (total === 0) return undefined;
  if (calibration.workItems.length < MIN_WORK_ITEMS) return undefined;

  return {
    tier: Tier.Agent,
    scope: calibration.agentId,
    key: `calibration:${calibration.gate}`,
    value: `Work I take through '${calibration.gate}' ${findingOf(calibration.sentBack, total)}.`,
    contextHint: `${String(calibration.sentBack)} sent back of ${String(total)} judgement(s), across ${calibration.workItems.join(", ")}`,
    writtenBy: calibration.agentId,
    atMs: nowMs,
    // Capped deliberately. Two observations is a hint; ten is a tendency; neither is a fact.
    confidence: Math.min(0.7, 0.35 + 0.05 * calibration.workItems.length),
  };
}
