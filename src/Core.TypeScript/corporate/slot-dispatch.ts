/**
 * slot-dispatch.ts — what happens when an agent's chosen slot is supposed to DO something.
 *
 * ── THE NORTH STAR THIS IS BUILT AGAINST ─────────────────────────────────────
 * `agentic-organization/docs/OBSERVE_ACT_PROMOTION_GATE.md` defines three modes:
 *
 *   legacy               only the legacy lane runs
 *   observe_act_shadow   the menu is rendered, a slot is selected, EVIDENCE IS RECORDED — and
 *                        command and tool dispatch use SHADOW implementations
 *   observe_act_primary  command dispatch, tool dispatch and act-time authorization use the REAL
 *                        injected runtime
 *
 * and it is explicit that promotion is not the agent's to decide: *"Agents may select from legal
 * menu slots, but they do not decide whether the organization is safe to promote a lane."*
 *
 * ── WHAT WAS ACTUALLY HERE, AND WHY IT IS WORSE THAN SHADOW ──────────────────
 * The register had no mode, no dispatch seam and no gate. `run-org.ts` supplied
 *
 *     resultFor: (o) => o.tag === "PickWork"
 *       ? { workId: o.work.id, lane: o.work.lane, success: true, doraContribution: 0.5 }
 *       : undefined
 *
 * — a hardcoded success — and `run-agent.ts` supplied nothing at all. So the agent's choice either
 * reported work it had not done, or vanished.
 *
 * That is not shadow mode. A shadow lane's whole value is that it records what WOULD have happened
 * while everyone knows nothing did; a lane that fabricates `success: true` is indistinguishable in
 * the record from one that worked, which makes it the vacuity class sitting on top of the entire
 * pipeline this register spent fifteen passes making honest.
 *
 * ── THE THREE-STATE ANSWER, AGAIN ────────────────────────────────────────────
 * In shadow, the work was not done. `success: true` is a lie and `success: false` is also a lie —
 * it did not fail, it was not attempted. So a shadow dispatch returns NO `WorkResult` at all, and
 * the agent stays in `ExecutingWork`: picked up, outstanding. That is the true state, and
 * `WorkResult | undefined` already had a place to say it.
 */

import type { MenuOption, WorkResult } from "../workflow-engine/agent-loop/state-machine";
import { Fidelity, type ProviderMeta } from "./providers";
import { Port } from "./providers";

export const AgentLoopMode = {
  Legacy: "legacy",
  ObserveActShadow: "observe_act_shadow",
  ObserveActPrimary: "observe_act_primary",
} as const;

export type AgentLoopMode = (typeof AgentLoopMode)[keyof typeof AgentLoopMode];

/**
 * One slot, dispatched — and whether anything actually happened.
 *
 * `performed` is separate from `result` on purpose. A dispatch can perform work and produce no
 * result (an emitted heartbeat), and it can produce no result BECAUSE it performed nothing (a
 * shadow). Collapsing the two would lose exactly the distinction this file exists for.
 */
export interface Dispatch {
  readonly mode: AgentLoopMode;
  /** The menu option's tag — the slot the agent selected. */
  readonly slot: string;
  readonly workId: string | undefined;
  /** Did this dispatch reach anything outside the process? */
  readonly performed: boolean;
  /** Absent when nothing was produced. NEVER a fabricated success. */
  readonly result: WorkResult | undefined;
  readonly evidenceRefs: readonly string[];
  readonly summary: string;
  /**
   * Was a budget actually consulted for this dispatch?
   *
   * False means no budget was declared, NOT that one was checked and passed. A run in which real
   * work was dispatched without any budget check should be able to say so, and a boolean that
   * conflated "allowed" with "unbudgeted" could not.
   */
  readonly budgetChecked?: boolean;
}

export interface SlotDispatcher {
  /** Labelled real or simulated like every other port, so a run's fidelity report can see it. */
  readonly meta: ProviderMeta;
  dispatch(option: MenuOption): Promise<Dispatch>;
}

const workIdOf = (option: MenuOption): string | undefined =>
  option.tag === "PickWork" ? option.work.id : undefined;

/**
 * SHADOW — record what would have been dispatched, perform nothing, invent nothing.
 *
 * The returned `result` is always `undefined`. That is the point: the agent picked work and the
 * work is outstanding, which is what the state machine will then show. A shadow that closed the
 * cycle with a success would be the defect this replaces, wearing a new name.
 */
export function shadowDispatcher(): SlotDispatcher {
  return {
    meta: {
      port: Port.WorkExecution,
      name: "observe-act-shadow",
      fidelity: Fidelity.Simulated,
      describes: "records the selected slot; dispatches nothing and produces no result",
    },
    dispatch: async (option) => ({
      mode: AgentLoopMode.ObserveActShadow,
      slot: option.tag,
      workId: workIdOf(option),
      performed: false,
      result: undefined,
      evidenceRefs: [`observe-act-shadow:slot:${option.tag}`],
      summary: `shadow: would have dispatched '${option.tag}'${workIdOf(option) === undefined ? "" : ` for ${workIdOf(option)!}`}`,
    }),
  };
}

/** What a primary dispatcher needs in order to actually do the work of a `PickWork` slot. */
export type PerformWork = (workId: string) => Promise<{
  readonly succeeded: boolean;
  readonly evidenceRefs: readonly string[];
  readonly summary: string;
  /** What actually landed, measured — never a constant. */
  readonly doraContribution: number;
}>;

/**
 * The budget check a dispatcher consults before performing.
 *
 * Returns a refusal reason, or `undefined` to proceed. A function rather than a `Budget` value so
 * the dispatcher never holds or mutates the ledger — it asks, and whoever owns the budget answers.
 *
 * `Unbudgeted` is the caller's to decide, not this module's: an organization that has declared no
 * budget must not be stopped by a limit nobody set, and it must not be recorded as having passed a
 * check that never ran. Both facts reach the `Dispatch` — it proceeds, and `budgetChecked` is false.
 */
export type BudgetGate = (workId: string) => { readonly refusal?: string; readonly checked: boolean };

/**
 * PRIMARY — the selected slot reaches the real runtime.
 *
 * `PickWork` runs the pipeline for that item and reports what it did. Every other slot performs
 * nothing HERE and says so, rather than being quietly treated as a success: heartbeats, pauses and
 * free time are changes to the agent's own state, and the state machine already applies them.
 */
export function primaryDispatcher(perform: PerformWork, budget?: BudgetGate): SlotDispatcher {
  return {
    meta: {
      port: Port.WorkExecution,
      name: "observe-act-primary",
      fidelity: Fidelity.Real,
      describes: "a selected 'PickWork' slot runs the delivery pipeline for that item",
    },
    dispatch: async (option) => {
      if (option.tag !== "PickWork") {
        return {
          mode: AgentLoopMode.ObserveActPrimary,
          slot: option.tag,
          workId: undefined,
          performed: false,
          result: undefined,
          evidenceRefs: [],
          summary: `'${option.tag}' changes the agent's own state; nothing was dispatched`,
        };
      }
      // ── "IF BUDGET IS AVAILABLE" ────────────────────────────────────────
      // Checked BEFORE performing, because a budget consulted afterwards is a report and not a
      // limit. A refusal here means the work was not attempted — so it produces no result, exactly
      // as a shadow does: it did not fail, it was not started.
      const allowed = budget?.(option.work.id) ?? { checked: false };
      if (allowed.refusal !== undefined) {
        return {
          mode: AgentLoopMode.ObserveActPrimary,
          slot: option.tag,
          workId: option.work.id,
          performed: false,
          result: undefined,
          evidenceRefs: [`budget-refused:${option.work.id}`],
          summary: `budget refused '${option.work.id}': ${allowed.refusal}`,
          budgetChecked: allowed.checked,
        };
      }
      const done = await perform(option.work.id);
      return {
        mode: AgentLoopMode.ObserveActPrimary,
        slot: option.tag,
        workId: option.work.id,
        performed: true,
        budgetChecked: allowed.checked,
        result: {
          workId: option.work.id,
          lane: option.work.lane,
          success: done.succeeded,
          doraContribution: done.doraContribution,
          notes: done.summary,
        },
        evidenceRefs: done.evidenceRefs,
        summary: done.summary,
      };
    },
  };
}

// ─── The promotion gate ─────────────────────────────────────────────────────

/**
 * The window the gate judges. Every field is a MEASUREMENT, none is a setting.
 *
 * Named for the evidence refs the design document specifies
 * (`observe-act-promotion:shadow_ticks:*` and the rest), so what a gate decided can be traced back
 * to the numbers it decided from.
 */
export interface PromotionWindow {
  readonly shadowTicks: number;
  readonly shadowSoakHours: number;
  /** Slots the agent selected that were not legal. Any at all blocks promotion. */
  readonly shadowIllegalSelections: number;
  /**
   * Fraction, 0..1, of shadow dispatches that disagreed with what primary would have done.
   *
   * Meaningless unless `divergenceMeasured` is true — see below.
   */
  readonly shadowDivergenceRate: number;
  /**
   * Was divergence ACTUALLY measured over this window?
   *
   * Required, and it blocks when false. Measuring divergence means running the shadow choice and
   * the primary choice and comparing them; a window that never did it has a rate of zero for the
   * same reason an empty log has no errors. Letting that promote a lane would be the exact failure
   * this register keeps finding — absence of evidence read as evidence of safety — and it would be
   * the worst instance of it, because what it unlocks is real dispatch of side effects.
   */
  readonly divergenceMeasured: boolean;
  readonly primarySelectorRejections30m: number;
  readonly primaryControlBypassRejections30m: number;
}

export const PROMOTION_MIN_TICKS = 100;
export const PROMOTION_MIN_SOAK_HOURS = 24;
export const PROMOTION_MAX_DIVERGENCE = 0.05;

export interface GateVerdict {
  readonly mode: AgentLoopMode;
  /** Every reason the window failed to earn primary. Empty when it earned it. */
  readonly blockedBy: readonly string[];
  readonly evidenceRefs: readonly string[];
}

/**
 * Which mode this window has EARNED. Defaults to shadow, always.
 *
 * The default direction is the whole safety property: a window that cannot be evaluated, has not
 * soaked, or is missing its counters gets shadow. Promotion is something evidence buys; nothing
 * about an absent measurement should read as permission.
 *
 * Demotion is checked FIRST, because a lane with live primary failures must not be promoted by a
 * clean historical window — the recent bad news is the more important fact.
 */
export function evaluatePromotionGate(window: PromotionWindow): GateVerdict {
  const evidenceRefs = [
    `observe-act-promotion:shadow_ticks:${String(window.shadowTicks)}`,
    `observe-act-promotion:shadow_soak_hours:${String(window.shadowSoakHours)}`,
    `observe-act-promotion:shadow_divergence_rate:${window.divergenceMeasured ? String(window.shadowDivergenceRate) : "UNMEASURED"}`,
    `observe-act-promotion:shadow_illegal_selections:${String(window.shadowIllegalSelections)}`,
    `observe-act-promotion:primary_selector_rejections_30m:${String(window.primarySelectorRejections30m)}`,
    `observe-act-promotion:primary_control_bypass_rejections_30m:${String(window.primaryControlBypassRejections30m)}`,
  ];
  const blockedBy: string[] = [];

  if (window.primarySelectorRejections30m >= 2) {
    blockedBy.push(`${String(window.primarySelectorRejections30m)} primary selector rejection(s) in the last 30 minutes`);
  }
  if (window.primaryControlBypassRejections30m >= 1) {
    blockedBy.push(
      `${String(window.primaryControlBypassRejections30m)} primary control-bypass rejection(s) in the last 30 minutes`,
    );
  }
  // Soak is a DISJUNCTION — ticks OR hours — because a busy lane earns it by volume and a quiet one
  // by time, and requiring both would make a correct quiet lane unpromotable forever.
  if (window.shadowTicks < PROMOTION_MIN_TICKS && window.shadowSoakHours < PROMOTION_MIN_SOAK_HOURS) {
    blockedBy.push(
      `the shadow window has neither ${String(PROMOTION_MIN_TICKS)} ticks ` +
        `nor ${String(PROMOTION_MIN_SOAK_HOURS)}h of soak (${String(window.shadowTicks)} ticks, ` +
        `${String(window.shadowSoakHours)}h)`,
    );
  }
  if (window.shadowIllegalSelections > 0) {
    blockedBy.push(`${String(window.shadowIllegalSelections)} illegal slot selection(s) in the shadow window`);
  }
  if (!window.divergenceMeasured) {
    blockedBy.push(
      "divergence was never measured over this window — a rate of zero from a comparison nobody ran " +
        "is not a clean rate, and this is the gate that unlocks real side effects",
    );
  } else if (window.shadowDivergenceRate > PROMOTION_MAX_DIVERGENCE) {
    blockedBy.push(
      `divergence ${String(window.shadowDivergenceRate)} exceeds ${String(PROMOTION_MAX_DIVERGENCE)}`,
    );
  }

  return {
    mode: blockedBy.length === 0 ? AgentLoopMode.ObserveActPrimary : AgentLoopMode.ObserveActShadow,
    blockedBy,
    evidenceRefs,
  };
}

/**
 * The dispatcher a verdict entitles this run to.
 *
 * The gate decides; the caller does not get to pass `primary` and have it honoured. That inversion
 * is the design document's own sentence — agents select slots, they do not decide whether the
 * organization is safe to promote a lane — and it is the reason this takes a verdict rather than a
 * mode.
 */
export function dispatcherFor(
  verdict: GateVerdict,
  perform: PerformWork,
  budget?: BudgetGate,
): SlotDispatcher {
  return verdict.mode === AgentLoopMode.ObserveActPrimary
    ? primaryDispatcher(perform, budget)
    : shadowDispatcher();
}
