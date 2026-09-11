/**
 * corporate/memory-loop.ts — the circuit that makes memory more than a diary.
 *
 * ── WHAT WAS MISSING, AND WHY IT MATTERED ────────────────────────────────────
 * Memory was WRITTEN and never READ. That is not a small gap: every signal that decides whether a
 * memory survives — `injectedCount`, `citedCount`, the outcome correlation — is produced by the act
 * of using it. Without a read path those counters stay at zero forever, `utilityRatio` sits at its
 * neutral 0.5 for the life of the process, and the weight is driven by freshness alone.
 *
 * So the "self-tuning, KPI-correlated substrate" would have decayed on a timer and learned nothing.
 * A memory nobody ever consults cannot be shown to be useless, and one that saved a run cannot be
 * shown to have helped. Both look identical. This module closes the circuit:
 *
 *      write → INJECT → CITE → CORRELATE WITH THE OUTCOME → weight → forget
 *
 * ── THE CLAMP THAT KEEPS A CITATION HONEST ───────────────────────────────────
 * An agent may only cite what was actually put in front of it this turn. `memory.noteCited` refuses
 * the rest, and `recordCitations` refuses a whole batch that names a memory outside the injected
 * set — because an agent that can cite anything can manufacture its own grounding, and the utility
 * ratio would then measure the agent's claims instead of its behaviour.
 */

import {
  noteCited,
  noteInjected,
  noteOutcome,
  recall,
  WorkOutcomeSignal,
  type RecalledMemory,
} from "./memory";
import type { MemoryStore } from "./memory-store";
import type { OrgFact } from "./org-event";

/** Who is about to do something, and therefore whose memory is in scope. */
export interface Binding {
  readonly hatId?: string;
  readonly agentId?: string;
  readonly workId?: string;
  readonly departmentId?: string;
  readonly orgId?: string;
}

export interface Injection {
  readonly memories: readonly RecalledMemory[];
  /** The ids that were injected. The ONLY ids a citation may name afterwards. */
  readonly injectedIds: readonly string[];
  /** Rendered for a prompt, weight-annotated so a reader can see why it surfaced. */
  readonly text: string;
}

/**
 * Put what is known in front of whoever is about to act, and record that it happened.
 *
 * THE RECORDING IS THE POINT. An injection that is not counted cannot later be judged useless, so
 * this writes the store rather than being a pure read — the one place in this module that has to.
 */
export function inject(
  store: MemoryStore,
  binding: Binding,
  nowMs: number,
  budget = 8,
): Injection {
  const all = store.load();
  const recalled = recall(all, binding, { nowMs, ...binding }, budget);

  for (const r of recalled) {
    store.save({ content: r.memory.content, state: noteInjected(r.memory.state, nowMs) });
  }

  return {
    memories: recalled,
    injectedIds: recalled.map((r) => r.memory.content.memoryId),
    text: renderForPrompt(recalled),
  };
}

/**
 * How memory reaches an agent.
 *
 * Each line carries its WEIGHT and its id. The weight so a reader can see why this surfaced above
 * something else; the id because a citation has to name something, and a citation naming prose
 * cannot be checked against what was injected.
 */
export function renderForPrompt(recalled: readonly RecalledMemory[]): string {
  if (recalled.length === 0) return "";
  // The HINT is rendered alongside the value, not dropped. It is where a memory keeps the evidence
  // behind its claim — a calibration's counts live there precisely because `write` must not compare
  // them — and a claim an agent cannot weigh is a claim it has to take on faith.
  const lines = recalled.map((r) => {
    const hint = r.memory.content.contextHint;
    return (
      `- [${r.memory.content.memoryId}] (${r.weight.toFixed(2)}, ${r.memory.content.tier}) ` +
      r.memory.content.value +
      (hint === undefined || hint.trim() === "" ? "" : `  _(${hint.trim()})_`)
    );
  });
  return [
    "## What this hat already knows",
    "",
    "Cite any line you actually relied on, by its id in square brackets.",
    "",
    ...lines,
  ].join("\n");
}

/**
 * Read the ids an agent claims it used.
 *
 * Deliberately tolerant of surrounding prose — an agent writing `cite: [4:hat|...]` in a sentence
 * is citing — and deliberately intolerant of anything that was not injected, which is checked by
 * the caller rather than guessed at here.
 */
export function citedIdsIn(text: string): readonly string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\[([0-9]+:[^\]]+)\]/g)) {
    const id = m[1];
    if (id !== undefined) out.add(id);
  }
  return [...out];
}

export type CitationResult =
  | { readonly ok: true; readonly recorded: readonly string[]; readonly facts: readonly OrgFact[] }
  | { readonly ok: false; readonly reason: string };

/**
 * Record that an agent used what it was given.
 *
 * REFUSES THE WHOLE BATCH if any cited id was not injected this turn. Recording the valid subset
 * and dropping the rest would let a fabricated citation pass silently while its neighbours counted
 * — and the point of the clamp is that fabricating one is a thing somebody finds out about.
 */
export function recordCitations(
  store: MemoryStore,
  injectedIds: readonly string[],
  citedIds: readonly string[],
  nowMs: number,
  workId?: string,
): CitationResult {
  const injected = new Set(injectedIds);
  const fabricated = citedIds.filter((id) => !injected.has(id));
  if (fabricated.length > 0) {
    return {
      ok: false,
      reason: `cited ${String(fabricated.length)} memory/memories that were never injected: ${fabricated.join(", ")}`,
    };
  }

  const all = store.load();
  const recorded: string[] = [];
  const facts: OrgFact[] = [];
  // ── ONE CREDIT PER ID, EVEN IF NAMED TWICE ────────────────────────────────
  // State is read once above, so iterating a repeated id applied `noteCited` twice to the SAME
  // starting state: the store ended correct (the second save wrote the same value) while
  // `recorded` claimed two citations. An over-reported count is worse than a wrong one — it is a
  // number that agrees with itself and disagrees with the store.
  for (const id of [...new Set(citedIds)]) {
    const memory = all.find((m) => m.content.memoryId === id);
    if (memory === undefined) continue;
    const cited = noteCited(memory.state, nowMs);
    // `noteCited` enforces one citation per injection. A refusal here is not an error — it means
    // the same id was named twice in one answer, which credits the memory once.
    if (!cited.ok) continue;
    store.save({ content: memory.content, state: cited.state });
    recorded.push(id);
    facts.push({
      kind: "memory_cited",
      memoryId: id,
      byHatId: memory.content.scope,
      // Spread conditionally: `exactOptionalPropertyTypes` means an explicit `undefined` is not
      // the same as an absent field, and the fact declares the field optional.
      ...(workId === undefined ? {} : { workId }),
    });
  }
  return { ok: true, recorded, facts };
}

/**
 * Tell the memories that were in scope how the work turned out.
 *
 * ── WHY THIS IS THE HALF THAT MATTERS ───────────────────────────────────────
 * Freshness measures how recently something was confirmed; utility measures whether anybody read
 * it. Neither says whether it was RIGHT. The outcome correlation is the only signal that does, and
 * it is why `outcomeRatio` carries the heaviest weight of the four.
 *
 * One work item votes once — enforced in `noteOutcome` — so a long item that touched a memory at
 * every gate does not cast fourteen votes for the same evidence.
 */
export function correlateOutcome(
  store: MemoryStore,
  workId: string,
  injectedIds: readonly string[],
  signal: WorkOutcomeSignal,
  nowMs: number,
): readonly string[] {
  const all = store.load();
  const touched: string[] = [];
  for (const id of injectedIds) {
    const memory = all.find((m) => m.content.memoryId === id);
    if (memory === undefined) continue;
    const next = noteOutcome(memory.state, workId, signal, nowMs);
    if (next === memory.state) continue; // already voted on this item
    store.save({ content: memory.content, state: next });
    touched.push(id);
  }
  return touched;
}

/** What the run remembers about one work item, so the outcome can be attributed later. */
export interface InjectionLedger {
  readonly byWork: ReadonlyMap<string, readonly string[]>;
}

export const EMPTY_LEDGER: InjectionLedger = { byWork: new Map() };

/** Add an injection to the ledger, so the work item's outcome can find it again. */
export function noteInjectionFor(ledger: InjectionLedger, workId: string, ids: readonly string[]): InjectionLedger {
  const existing = ledger.byWork.get(workId) ?? [];
  const merged = [...new Set([...existing, ...ids])];
  const byWork = new Map(ledger.byWork);
  byWork.set(workId, merged);
  return { byWork };
}

/** The signal a work outcome sends to the memories that were in scope for it. */
export function signalFor(delivered: boolean, blocked: boolean): WorkOutcomeSignal {
  if (delivered) return WorkOutcomeSignal.Success;
  // BLOCKED IS NOT FAILURE. Work stopped at a human checkpoint tells you nothing about whether the
  // memory in scope was right, and counting it as a failure would punish memories for being used on
  // careful work.
  return blocked ? WorkOutcomeSignal.Inconclusive : WorkOutcomeSignal.Failure;
}
