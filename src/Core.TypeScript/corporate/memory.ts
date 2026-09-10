/**
 * corporate/memory.ts — what the organization remembers, and what it is allowed to forget.
 *
 * ── PORTED, NOT COPIED ───────────────────────────────────────────────────────
 * The model comes from `agentic-organization/docs/DYNAMIC_MEMORY_SYSTEM_DESIGN.md`: memory is a
 * **weighted, decaying, outcome-correlated substrate**, split content-from-state on a Data-Vault
 * change-rate boundary, with a lifecycle whose terminal phase means *never surfaces again*.
 *
 * What is taken: the tier ladder, the hub/satellite split, the composite weight, decay with an
 * archive floor, outcome correlation, utility self-tuning, and the phase machine.
 *
 * What is NOT taken: its storage (Cockroach + NATS + a vector store). This register keeps its own
 * discipline — pure functions over values, I/O behind a port — and the user asked for something the
 * original does not have: **agents keep their memory in git repositories they own.** So the store is
 * a filesystem of readable markdown, and a memory's history is a `git log`.
 *
 * ── THE CORRECTION THIS PORT MAKES, AND WHY IT MATTERS ───────────────────────
 * The source weights a SEMANTIC score at 0.30 and substitutes a constant `0.5` when no embedder is
 * configured. That constant does not change the RANKING — it is the same for every memory — but it
 * silently adds a floor of `0.15` to every weight. The archive floor is also `0.15`. So with no
 * embedder, **a memory can essentially never reach the floor**, and "zero means never again" — the
 * stated point of the whole design — quietly stops being reachable.
 *
 * This port therefore RENORMALISES over the terms it actually has rather than feeding a constant.
 * With no semantic scorer the remaining four weights are scaled to sum to 1, so a stale, uncited,
 * badly-correlated memory really does fall to zero and really is forgotten. `memory.test.ts` pins
 * that with the arithmetic, because it is the difference between a memory system and a memory leak.
 */


import { stringCompare } from "../collation/collation.ts";
/** Where a memory belongs in the organization. */
export const MemoryTier = {
  /** The whole company. Slowest to decay. */
  Org: "org",
  Department: "department",
  /** The ROLE's accumulated wisdom — inherited by whoever wears the hat next. */
  Hat: "hat",
  /** A specific actor's personal layer: calibration, tendencies. Travels across hats. */
  Agent: "agent",
  /** Local to one unit of work. Decays fastest, because it is usually only true there. */
  Work: "work",
} as const;

export type MemoryTier = (typeof MemoryTier)[keyof typeof MemoryTier];

export const MemoryPhase = {
  Draft: "draft",
  Active: "active",
  Reinforced: "reinforced",
  Stale: "stale",
  Demoted: "demoted",
  Promoted: "promoted",
  Conflicted: "conflicted",
  /** TERMINAL. Weight is floored; it never surfaces again. The row is kept for audit. */
  Archived: "archived",
} as const;

export type MemoryPhase = (typeof MemoryPhase)[keyof typeof MemoryPhase];

export function isTerminalPhase(phase: MemoryPhase): boolean {
  return phase === MemoryPhase.Archived;
}

/** Written rarely. The part a person reads and a `git log` should show real edits to. */
export interface MemoryContent {
  /** Stable join key, derived from `tier:scope:key`. Never random — see `memoryIdOf`. */
  readonly memoryId: string;
  readonly tier: MemoryTier;
  /** `org` | a department id | a hat id | an agent id | a work id. */
  readonly scope: string;
  /** A stable slug: `review:require-rollback-plan`. What makes two writes the SAME memory. */
  readonly key: string;
  /** The memory itself, in words. */
  readonly value: string;
  /** Why it exists. Kept because a memory with no provenance cannot be judged later. */
  readonly contextHint?: string;
  /** Never auto-archived or auto-demoted. For things the organization must not forget by neglect. */
  readonly protected: boolean;
  /** A hat id, an agent id, or `human`. */
  readonly writtenBy: string;
  readonly writtenAtMs: number;
}

/** Updated constantly. Split out so counter bumps do not churn the content's history. */
export interface MemoryState {
  readonly memoryId: string;
  /** 0..1, a write-time guess that outcomes refine. */
  readonly confidence: number;
  /** Decay runs from here. Reinforcement resets it. */
  readonly freshnessAtMs: number;
  readonly reinforcementCount: number;
  readonly outcome: {
    readonly successCount: number;
    readonly failureCount: number;
    readonly inconclusiveCount: number;
    readonly lastOutcomeAtMs: number | undefined;
    /** Capped, and used for dedup: one work item may only vote once. */
    readonly workItemsObserved: readonly string[];
  };
  readonly utility: {
    /** Times it was put in front of an agent. */
    readonly injectedCount: number;
    /** Times an agent actually said it used it. Injected-but-never-cited sinks. */
    readonly citedCount: number;
    readonly lastInjectedAtMs: number | undefined;
  };
  readonly crossScope: {
    /** Distinct scopes that observed the same lesson — the promotion signal. */
    readonly distinctScopes: readonly string[];
    readonly firstObservedAtMs: number;
    readonly lastObservedAtMs: number;
  };
  readonly phase: MemoryPhase;
  readonly archivedAtMs?: number;
}

export interface Memory {
  readonly content: MemoryContent;
  readonly state: MemoryState;
}

/**
 * The id of a memory, derived from what makes it the same memory.
 *
 * DERIVED, NEVER MINTED. Two writes of `hat:code_reviewer:require-rollback-plan` are the same
 * memory being reinforced; a random id would make them two memories that both surface, and the
 * organization would slowly fill with duplicates of its own advice.
 *
 * Length-prefixed for the same reason `externalRefOf` is: a scope or key containing the delimiter
 * must not be able to forge a different id.
 */
export function memoryIdOf(tier: MemoryTier, scope: string, key: string): string {
  const part = (s: string): string => `${String(s.length)}:${s}`;
  return `${part(tier)}|${part(scope)}|${part(key)}`;
}

/** Days of half-life per tier — how long before a memory is half as likely to surface. */
export const HALF_LIFE_DAYS: Readonly<Record<MemoryTier, number>> = {
  work: 30,
  hat: 120,
  agent: 120,
  department: 180,
  org: 365,
};

/** Below this a memory is not retrieved by default, but is still recoverable. */
export const READ_FLOOR: Readonly<Record<MemoryTier, number>> = {
  work: 0.35,
  hat: 0.3,
  agent: 0.3,
  department: 0.3,
  org: 0.25,
};

/** At or below this a memory is archived and never surfaces again. */
export const ARCHIVE_FLOOR: Readonly<Record<MemoryTier, number>> = {
  work: 0.15,
  hat: 0.15,
  agent: 0.15,
  department: 0.15,
  org: 0.1,
};

/**
 * How long recall may pass a memory over before that silence counts as evidence.
 *
 * A threshold rather than a decay, because the thing being measured is not age: it is the number
 * of opportunities the retrieval had to choose this memory and did not. Ninety days of an
 * organisation working is a great many, and a memory it never once reached for in that time is not
 * being neglected — it is being declined.
 */
export const NEVER_ASKED_FOR_MS = 90 * 86_400_000;

const DAY_MS = 86_400_000;

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * How fresh a memory is: 1 when just confirmed, 0 once it is twice its half-life old.
 *
 * Linear rather than exponential on purpose. An exponential curve never reaches zero, so a memory
 * would asymptotically approach the floor and never cross it — the same unreachable-floor defect
 * this module's header describes, arriving by a different route.
 */
export function freshnessOf(memory: Memory, nowMs: number): number {
  const halfLife = HALF_LIFE_DAYS[memory.content.tier];
  const elapsedDays = (nowMs - memory.state.freshnessAtMs) / DAY_MS;
  return clamp01(1 - elapsedDays / (2 * halfLife));
}

/**
 * Success over success+failure, NEUTRAL until there is enough signal to mean anything.
 *
 * Three samples is the threshold from the source design, kept: one success is not evidence that a
 * memory helps, and letting it read as `1.0` would promote whatever happened to be in scope first.
 */
export function outcomeRatioOf(state: MemoryState): number {
  const total = state.outcome.successCount + state.outcome.failureCount;
  return total < 3 ? 0.5 : state.outcome.successCount / total;
}

/** Cited over injected. Neutral until five injections, then it bites. */
export function utilityRatioOf(state: MemoryState): number {
  if (state.utility.injectedCount < 5) return 0.5;
  return Math.min(1, state.utility.citedCount / state.utility.injectedCount);
}

export interface RetrievalContext {
  readonly nowMs: number;
  readonly hatId?: string;
  readonly agentId?: string;
  readonly workId?: string;
  /**
   * A semantic similarity in 0..1, when something can compute one.
   *
   * ABSENT IS NOT 0.5. The source substituted a constant, which floors every weight at 0.15 and
   * makes the archive floor unreachable. Absent here means the semantic TERM IS REMOVED and the
   * remaining weights are renormalised — see `weightOf`.
   */
  readonly semanticScore?: number;
}

/** The weights of the composite score. They sum to 1 when every term is present. */
const W = { semantic: 0.3, freshness: 0.2, confidence: 0.15, outcome: 0.2, utility: 0.15 } as const;

/**
 * How likely a memory should be to surface. Pure, and the whole economy rests on it.
 *
 * ── RENORMALISATION, AND WHY IT IS NOT A DETAIL ──────────────────────────────
 * With no semantic scorer the four remaining terms are scaled by `1 / (1 - 0.30)`. Feeding a
 * constant instead — as the source does — adds `0.15` to every memory: it changes no ranking and
 * silently raises the FLOOR above the archive threshold, so nothing is ever forgotten. Renormalising
 * keeps the ranking identical and restores the range, so a memory that is stale, uncited and badly
 * correlated actually reaches zero.
 */
export function weightOf(memory: Memory, ctx: RetrievalContext): number {
  const freshness = freshnessOf(memory, ctx.nowMs);
  const confidence = clamp01(memory.state.confidence);
  const outcome = outcomeRatioOf(memory.state);
  const utility = utilityRatioOf(memory.state);

  // The four terms this register can always compute, at their declared weights.
  const known = W.freshness * freshness + W.confidence * confidence + W.outcome * outcome + W.utility * utility;
  const base =
    ctx.semanticScore === undefined
      // No embedder: divide by the weight that IS present, so the four terms sum to 1 rather than
      // to 0.70. The ranking is unchanged; the range is restored, and the floor becomes reachable.
      ? known / (W.freshness + W.confidence + W.outcome + W.utility)
      : W.semantic * clamp01(ctx.semanticScore) + known;

  // Additive scope boosts, capped by clamp01. A memory about THIS hat, THIS agent or THIS work item
  // is more likely to be the relevant one, and the boost is small enough not to rescue a dead one.
  const t = memory.content.tier;
  const boost =
    (t === MemoryTier.Hat && memory.content.scope === ctx.hatId ? 0.05 : 0) +
    (t === MemoryTier.Agent && memory.content.scope === ctx.agentId ? 0.05 : 0) +
    (t === MemoryTier.Work && memory.content.scope === ctx.workId ? 0.05 : 0);

  return clamp01(base + boost);
}

/** Whether a memory has fallen far enough to stop surfacing forever. */
export function atArchiveFloor(memory: Memory, ctx: RetrievalContext): boolean {
  // PROTECTED MEMORIES ARE NEVER AUTO-ARCHIVED. Something the organization decided it must not
  // forget is not allowed to be forgotten by arithmetic.
  if (memory.content.protected) return false;
  return weightOf(memory, ctx) <= ARCHIVE_FLOOR[memory.content.tier];
}

export function belowReadFloor(memory: Memory, ctx: RetrievalContext): boolean {
  return weightOf(memory, ctx) < READ_FLOOR[memory.content.tier];
}

/**
 * The scopes a binding can see: the org, its department, its hat, its agent, its work.
 *
 * A UNION, not a lookup. A hat's institutional knowledge and an agent's personal calibration are
 * both true at once, and the point of the ladder is that whoever wears the hat next inherits the
 * hat's lessons without inheriting the last wearer's habits.
 */
export function scopesFor(binding: {
  readonly orgId?: string;
  readonly departmentId?: string;
  readonly hatId?: string;
  readonly agentId?: string;
  readonly workId?: string;
}): readonly { readonly tier: MemoryTier; readonly scope: string }[] {
  const out: { tier: MemoryTier; scope: string }[] = [];
  if (binding.orgId !== undefined) out.push({ tier: MemoryTier.Org, scope: binding.orgId });
  if (binding.departmentId !== undefined) out.push({ tier: MemoryTier.Department, scope: binding.departmentId });
  if (binding.hatId !== undefined) out.push({ tier: MemoryTier.Hat, scope: binding.hatId });
  if (binding.agentId !== undefined) out.push({ tier: MemoryTier.Agent, scope: binding.agentId });
  if (binding.workId !== undefined) out.push({ tier: MemoryTier.Work, scope: binding.workId });
  return out;
}

export interface RecalledMemory {
  readonly memory: Memory;
  readonly weight: number;
}

/**
 * What an agent should be shown, ranked, and capped at a budget.
 *
 * DETERMINISM PICKS THE SET; THE AGENT PICKS WITHIN IT. The agent cannot widen this — it sees what
 * the rules surfaced and nothing else. That is the same clamp the rest of this register keeps, and
 * it is what makes a citation checkable: a memory that was never injected cannot have been used.
 */
export function recall(
  memories: readonly Memory[],
  binding: Parameters<typeof scopesFor>[0],
  ctx: RetrievalContext,
  budget = 12,
): readonly RecalledMemory[] {
  const wanted = new Set(scopesFor(binding).map((s) => `${s.tier}:${s.scope}`));
  const out: RecalledMemory[] = [];
  for (const memory of memories) {
    if (isTerminalPhase(memory.state.phase)) continue;
    if (!wanted.has(`${memory.content.tier}:${memory.content.scope}`)) continue;
    const weight = weightOf(memory, ctx);
    if (weight < READ_FLOOR[memory.content.tier]) continue;
    out.push({ memory, weight });
  }
  // Heaviest first; ties broken by id so the order is stable across runs — a recall that reorders
  // between two identical runs would make the whole thing unreplayable.
  out.sort((a, b) =>
    b.weight === a.weight ? stringCompare(a.memory.content.memoryId, b.memory.content.memoryId) : b.weight - a.weight,
  );
  return out.slice(0, budget);
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

export const TransitionAuthority = {
  /** The system applies it: decay, reinforcement, hitting the archive floor. */
  Auto: "auto",
  /** A hat wears the authority and chooses within the legal set. */
  HatDecided: "hat_decided",
} as const;

export type TransitionAuthority = (typeof TransitionAuthority)[keyof typeof TransitionAuthority];

export interface LegalTransition {
  readonly to: MemoryPhase;
  readonly authority: TransitionAuthority;
  readonly reason: string;
}

/**
 * What may happen next, from where it is. Pure — no thresholds applied here.
 *
 * The maintenance cycle decides which of these actually fire. Keeping the legality separate from
 * the firing is what lets a person read "what could this memory do next" without simulating a run.
 */
export function legalTransitions(phase: MemoryPhase): readonly LegalTransition[] {
  if (isTerminalPhase(phase)) return [];
  const A = TransitionAuthority.Auto;
  const D = TransitionAuthority.HatDecided;
  const archived: LegalTransition = {
    to: MemoryPhase.Archived,
    authority: A,
    reason: "weight fell to the archive floor",
  };
  switch (phase) {
    case MemoryPhase.Draft:
      return [{ to: MemoryPhase.Active, authority: A, reason: "first observation confirmed it" }, archived];
    case MemoryPhase.Active:
      return [
        { to: MemoryPhase.Reinforced, authority: A, reason: "confirmed again" },
        { to: MemoryPhase.Stale, authority: A, reason: "freshness decayed past the read floor" },
        archived,
        { to: MemoryPhase.Promoted, authority: D, reason: "observed across scopes — promote a tier" },
        { to: MemoryPhase.Demoted, authority: D, reason: "outcome correlation turned negative" },
        { to: MemoryPhase.Conflicted, authority: D, reason: "another active memory says otherwise" },
      ];
    case MemoryPhase.Reinforced:
      return [
        { to: MemoryPhase.Active, authority: A, reason: "reinforcement decayed to baseline" },
        { to: MemoryPhase.Stale, authority: A, reason: "freshness decayed past the read floor" },
        archived,
        { to: MemoryPhase.Promoted, authority: D, reason: "observed across scopes — promote a tier" },
      ];
    case MemoryPhase.Stale:
      return [
        { to: MemoryPhase.Reinforced, authority: A, reason: "confirmed again after going stale" },
        archived,
        { to: MemoryPhase.Demoted, authority: D, reason: "judged wrong rather than merely old" },
      ];
    case MemoryPhase.Demoted:
      return [archived, { to: MemoryPhase.Active, authority: D, reason: "the demotion was reconsidered" }];
    case MemoryPhase.Promoted:
      // The SOURCE of a promotion stays usable. Promotion copies a lesson up a tier; deleting the
      // original would erase where it was learned, which is the only thing that explains it.
      return [{ to: MemoryPhase.Active, authority: A, reason: "the source memory remains in its own scope" }, archived];
    case MemoryPhase.Conflicted:
      return [
        { to: MemoryPhase.Active, authority: D, reason: "the conflict was resolved in its favour" },
        archived,
      ];
    default:
      return [];
  }
}

export function mayTransition(from: MemoryPhase, to: MemoryPhase): boolean {
  return legalTransitions(from).some((t) => t.to === to);
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export interface WriteInput {
  readonly tier: MemoryTier;
  readonly scope: string;
  readonly key: string;
  readonly value: string;
  readonly contextHint?: string;
  readonly writtenBy: string;
  readonly atMs: number;
  readonly confidence?: number;
  readonly protected?: boolean;
}

export type WriteResult =
  | { readonly ok: true; readonly memory: Memory; readonly reinforced: boolean; readonly conflicted: boolean }
  | { readonly ok: false; readonly reason: string };

/**
 * Write a memory, or reinforce the one already there.
 *
 * Three outcomes and they are genuinely different:
 *   - NEW: nothing had this id. A draft.
 *   - REINFORCED: same id, same value. Freshness resets, confidence lifts, count rises. This is how
 *     a lesson that keeps being true stops decaying.
 *   - CONFLICTED: same id, DIFFERENT value. The memory is flagged rather than overwritten, because
 *     silently replacing the organization's belief with the most recent writer's is how a register
 *     loses an argument nobody knew was happening.
 *
 * A protected memory is never overwritten by this path at all.
 */
export function write(existing: Memory | undefined, input: WriteInput): WriteResult {
  if (input.key.trim() === "") return { ok: false, reason: "a memory needs a key: it is what makes two writes the same memory" };
  if (input.value.trim() === "") return { ok: false, reason: "a memory with no value remembers nothing" };
  if (input.scope.trim() === "") return { ok: false, reason: "a memory needs a scope: whose memory is it" };
  if (input.writtenBy.trim() === "") return { ok: false, reason: "a memory needs an author" };

  const memoryId = memoryIdOf(input.tier, input.scope, input.key);
  const confidence = clamp01(input.confidence ?? 0.6);

  if (existing === undefined) {
    return {
      ok: true,
      reinforced: false,
      conflicted: false,
      memory: {
        content: {
          memoryId,
          tier: input.tier,
          scope: input.scope,
          key: input.key,
          value: input.value,
          ...(input.contextHint === undefined ? {} : { contextHint: input.contextHint }),
          protected: input.protected ?? false,
          writtenBy: input.writtenBy,
          writtenAtMs: input.atMs,
        },
        state: {
          memoryId,
          confidence,
          freshnessAtMs: input.atMs,
          reinforcementCount: 0,
          outcome: {
            successCount: 0,
            failureCount: 0,
            inconclusiveCount: 0,
            lastOutcomeAtMs: undefined,
            workItemsObserved: [],
          },
          utility: { injectedCount: 0, citedCount: 0, lastInjectedAtMs: undefined },
          crossScope: { distinctScopes: [input.scope], firstObservedAtMs: input.atMs, lastObservedAtMs: input.atMs },
          phase: MemoryPhase.Draft,
        },
      },
    };
  }

  if (existing.content.protected && existing.content.value !== input.value) {
    return { ok: false, reason: `'${input.key}' is protected: it cannot be overwritten by a write` };
  }

  const same = existing.content.value.trim() === input.value.trim();
  const phase = same
    ? MemoryPhase.Reinforced
    : isTerminalPhase(existing.state.phase)
      ? existing.state.phase
      : MemoryPhase.Conflicted;

  return {
    ok: true,
    reinforced: same,
    conflicted: !same,
    memory: {
      // THE VALUE DOES NOT CHANGE ON CONFLICT. The existing belief stands until somebody decides;
      // taking the new one would make "conflicted" a label on a change that already happened.
      content: same ? existing.content : { ...existing.content },
      state: {
        ...existing.state,
        confidence: same ? clamp01(existing.state.confidence + 0.1) : existing.state.confidence,
        freshnessAtMs: same ? input.atMs : existing.state.freshnessAtMs,
        reinforcementCount: same ? existing.state.reinforcementCount + 1 : existing.state.reinforcementCount,
        phase,
      },
    },
  };
}

/** Record that a memory was put in front of an agent. Drives the utility ratio. */
export function noteInjected(state: MemoryState, atMs: number): MemoryState {
  return {
    ...state,
    utility: {
      ...state.utility,
      injectedCount: state.utility.injectedCount + 1,
      lastInjectedAtMs: atMs,
    },
  };
}

/**
 * Record that an agent actually used it.
 *
 * REFUSES A CITATION THAT WAS NEVER INJECTED. An agent that could cite anything could manufacture
 * its own grounding, and the utility ratio — which decides what survives — would measure the
 * agent's claims rather than its behaviour.
 */
export function noteCited(state: MemoryState, atMs: number): { readonly ok: true; readonly state: MemoryState } | { readonly ok: false; readonly reason: string } {
  if (state.utility.injectedCount === 0) {
    return { ok: false, reason: "cited a memory that was never injected — a citation must follow an injection" };
  }
  if (state.utility.citedCount >= state.utility.injectedCount) {
    return { ok: false, reason: "cited more often than injected — one injection may be cited once" };
  }
  return {
    ok: true,
    state: { ...state, utility: { ...state.utility, citedCount: state.utility.citedCount + 1 }, freshnessAtMs: atMs },
  };
}

export const WorkOutcomeSignal = { Success: "success", Failure: "failure", Inconclusive: "inconclusive" } as const;
export type WorkOutcomeSignal = (typeof WorkOutcomeSignal)[keyof typeof WorkOutcomeSignal];

const OBSERVED_CAP = 50;

/**
 * Correlate a memory with how the work it was in scope for turned out.
 *
 * ONE WORK ITEM VOTES ONCE. Without the dedup a long-running item that touches a memory on every
 * gate would cast fourteen votes, and the outcome ratio would measure how chatty a run was.
 */
export function noteOutcome(state: MemoryState, workId: string, signal: WorkOutcomeSignal, atMs: number): MemoryState {
  if (state.outcome.workItemsObserved.includes(workId)) return state;
  const observed = [...state.outcome.workItemsObserved, workId].slice(-OBSERVED_CAP);
  return {
    ...state,
    outcome: {
      successCount: state.outcome.successCount + (signal === WorkOutcomeSignal.Success ? 1 : 0),
      failureCount: state.outcome.failureCount + (signal === WorkOutcomeSignal.Failure ? 1 : 0),
      inconclusiveCount: state.outcome.inconclusiveCount + (signal === WorkOutcomeSignal.Inconclusive ? 1 : 0),
      lastOutcomeAtMs: atMs,
      workItemsObserved: observed,
    },
  };
}

/** A memory seen to be true in another scope — the signal that it belongs a tier up. */
export function noteCrossScope(state: MemoryState, scope: string, atMs: number): MemoryState {
  if (state.crossScope.distinctScopes.includes(scope)) return state;
  return {
    ...state,
    crossScope: {
      distinctScopes: [...state.crossScope.distinctScopes, scope].slice(-OBSERVED_CAP),
      firstObservedAtMs: state.crossScope.firstObservedAtMs,
      lastObservedAtMs: atMs,
    },
  };
}

/** How many distinct scopes must see a lesson before it is worth promoting. */
export const PROMOTION_THRESHOLD = 3;

export function promotionCandidate(memory: Memory): boolean {
  if (memory.content.tier === MemoryTier.Org) return false;
  if (isTerminalPhase(memory.state.phase)) return false;
  return memory.state.crossScope.distinctScopes.length >= PROMOTION_THRESHOLD;
}

/** The tier a lesson moves up to when enough scopes have learned it independently. */
export function tierAbove(tier: MemoryTier): MemoryTier | undefined {
  switch (tier) {
    case MemoryTier.Work:
      return MemoryTier.Hat;
    case MemoryTier.Agent:
      return MemoryTier.Department;
    case MemoryTier.Hat:
      return MemoryTier.Department;
    case MemoryTier.Department:
      return MemoryTier.Org;
    default:
      return undefined;
  }
}

// ─── The maintenance pass ────────────────────────────────────────────────────

export interface MaintenanceAction {
  readonly memoryId: string;
  readonly from: MemoryPhase;
  readonly to: MemoryPhase;
  readonly authority: TransitionAuthority;
  readonly reason: string;
  readonly weight: number;
}

/**
 * One nightly pass: what should change, and who is allowed to change it.
 *
 * Returns a PLAN rather than applying anything. The auto transitions can be applied by the caller;
 * the hat-decided ones are candidates a person or a hat rules on. Splitting the proposal from the
 * application is what makes the pass reviewable — and it is why a demotion cannot happen because a
 * number moved.
 */
export function maintenancePass(memories: readonly Memory[], ctx: RetrievalContext): readonly MaintenanceAction[] {
  const out: MaintenanceAction[] = [];

  // ── IS ANYBODY READING? ────────────────────────────────────────────────────
  // The one question a per-memory rule cannot answer, and the whole reason this lives here.
  //
  // `utilityRatioOf` returns a neutral 0.5 below five injections because, looking at one memory, it
  // genuinely cannot tell "not asked for yet" from "never wanted". The consequence, measured: a
  // memory never injected and never judged bottoms out at 0.3464 after TEN YEARS — above the read
  // floor and more than twice the archive floor. Nothing the organisation writes and never looks at
  // again can ever be forgotten, which is exactly backwards, since that is the likeliest junk.
  //
  // At store scope the distinction is decidable. If SOMETHING has been injected, recall is running,
  // and a memory it has passed over for months has been passed over on purpose. If nothing has been
  // injected the store has never been read, silence means nothing, and no memory is judged for it.
  const recallIsRunning = memories.some((m) => m.state.utility.injectedCount > 0);

  for (const memory of memories) {
    const from = memory.state.phase;
    if (isTerminalPhase(from)) continue;
    const weight = weightOf(memory, ctx);

    if (atArchiveFloor(memory, ctx) && mayTransition(from, MemoryPhase.Archived)) {
      out.push({
        memoryId: memory.content.memoryId,
        from,
        to: MemoryPhase.Archived,
        authority: TransitionAuthority.Auto,
        reason: `weight ${weight.toFixed(3)} is at or below the archive floor ${String(ARCHIVE_FLOOR[memory.content.tier])}`,
        weight,
      });
      continue;
    }

    // Checked BEFORE the read floor, and reported with its own reason, so "nobody ever asked for
    // this" never arrives disguised as "its weight fell". They are different findings and a person
    // reading the log should be able to tell which one happened.
    if (
      recallIsRunning &&
      memory.state.utility.injectedCount === 0 &&
      ctx.nowMs - memory.state.freshnessAtMs >= NEVER_ASKED_FOR_MS &&
      mayTransition(from, MemoryPhase.Stale)
    ) {
      out.push({
        memoryId: memory.content.memoryId,
        from,
        to: MemoryPhase.Stale,
        authority: TransitionAuthority.Auto,
        // STALE, not Archived. Stale is recoverable — one injection and one citation brings it
        // back. Archiving on an ABSENCE of evidence would make a permanent decision because
        // nothing happened, and this register does not move in that direction.
        reason: `recall has been running and never once asked for this in ${String(Math.floor((ctx.nowMs - memory.state.freshnessAtMs) / DAY_MS))} day(s)`,
        weight,
      });
      continue;
    }

    if (belowReadFloor(memory, ctx) && mayTransition(from, MemoryPhase.Stale)) {
      out.push({
        memoryId: memory.content.memoryId,
        from,
        to: MemoryPhase.Stale,
        authority: TransitionAuthority.Auto,
        reason: `weight ${weight.toFixed(3)} is below the read floor ${String(READ_FLOOR[memory.content.tier])}`,
        weight,
      });
      continue;
    }

    if (from === MemoryPhase.Draft && mayTransition(from, MemoryPhase.Active)) {
      out.push({
        memoryId: memory.content.memoryId,
        from,
        to: MemoryPhase.Active,
        authority: TransitionAuthority.Auto,
        reason: "a draft above the read floor joins the pool",
        weight,
      });
      continue;
    }

    if (promotionCandidate(memory) && mayTransition(from, MemoryPhase.Promoted)) {
      out.push({
        memoryId: memory.content.memoryId,
        from,
        to: MemoryPhase.Promoted,
        authority: TransitionAuthority.HatDecided,
        reason: `${String(memory.state.crossScope.distinctScopes.length)} distinct scopes learned this independently`,
        weight,
      });
    }
  }
  return out;
}

/** Apply one action. Refuses an illegal transition rather than forcing it. */
export function applyAction(
  memory: Memory,
  action: MaintenanceAction,
  atMs: number,
): { readonly ok: true; readonly memory: Memory } | { readonly ok: false; readonly reason: string } {
  if (!mayTransition(memory.state.phase, action.to)) {
    return { ok: false, reason: `'${memory.state.phase}' may not become '${action.to}'` };
  }
  if (memory.content.protected && (action.to === MemoryPhase.Archived || action.to === MemoryPhase.Demoted)) {
    return { ok: false, reason: `'${memory.content.key}' is protected and may not be ${action.to}` };
  }
  return {
    ok: true,
    memory: {
      content: memory.content,
      state: {
        ...memory.state,
        phase: action.to,
        ...(action.to === MemoryPhase.Archived ? { archivedAtMs: atMs } : {}),
        ...(action.to === MemoryPhase.Reinforced ? { freshnessAtMs: atMs } : {}),
      },
    },
  };
}
