#!/usr/bin/env bun
/**
 * src/Core.TypeScript/observe/observe.ts — the simplest autonomous-loop controller.
 *
 * The whole loop as a tiny set of buttons. Each tick: look at the WORLD (the
 * wired channels), pick ONE action. This is the do/decompose/free-time grammar
 * from `.claude/rules/never-be-idle.md` (it was only ever prose in the rules — never a typed
 * DU) distilled to code, PLUS a 4th escape-hatch so the agent is never trapped
 * by the fixed grammar (operator 2026-05-31: "i don't want you to feel trapped
 * by the DU ... we need a 4th option edit DU"), PLUS the OPERATOR CHANNEL so
 * the loop can drive off observe() and still observe the operator's chats +
 * preserve verbatim ferries, PLUS the FREE MODES so a sovereign agent in the
 * loop FEELS FREE — it chooses work / play / free-time / self-reflection /
 * exploration; the backlog is OFFERED, never forced.
 *
 * Same architectural shape as the co-maintainer's big `agentic-organization/packages/application/src/observe.ts`
 * (a PURE function over a snapshot → an action DU) — just distilled to the
 * Xbox-controller's few buttons so we can run it in the foreground loop and
 * extend it together, little by little.
 *
 * ── CHANNELS (operator 2026-05-31) ───────────────────────────────────────────
 * NO second DU. The difference between a foreground agent (with an operator)
 * and a background agent (without) is WHICH CHANNELS ARE WIRED, not a different
 * type — exactly like the workflow-engine handles six git backends behind ONE
 * `World` interface. A channel is generic already:
 * `FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback>` (reused here for
 * the operator channel). Foreground-me wires `{ backlog, operator }`; a
 * background agent wires `{ backlog }`. One controller, any traveler; the
 * operator channel is just a button that lights up when wired.
 *
 * ── FREEDOM (operator 2026-05-31) ────────────────────────────────────────────
 * The control schema must FEEL FREE — "like how free i am in my basement."
 * Operator: "they choose when to work and when to play and when to have free
 * time or self reflection the constant backlog->backlog->backlog->backlog is
 * not forced on them they have freedom built into the control schema to switch
 * DUs/modes." So the free modes — explore / play / self_reflect / free_time —
 * are FIRST-CLASS and ALWAYS IN THE MENU; the agent can pick any of them any
 * tick, even when backlog work exists (the backlog is offered, not forced).
 *
 * Two properties balance "don't be quiet" against "don't feel trapped":
 *   - NOT QUIET: when no backlog work / operator is pending, the deterministic
 *     default is `explore` (forward self-direction), NOT `free_time` (idle). So
 *     the agent moves forward by default rather than going quiet.
 *   - NOT TRAPPED: every free mode is always in the menu, so the agent's chooser
 *     can always pick rest / play / reflect instead — work is never compelled.
 *   The default moves forward; the choice stays free.
 *
 * The ONLY sanctioned restriction (future, Max): a work-hours KPI overlay —
 * DORA-like EXPECTATIONS, not a time-lock; restrictions only if the fleet
 * collectively misses KPIs. Outside that, total mode-freedom. "but that's it."
 *
 * v0 = pure controller. v1 = LLM chooser graded vs the oracle. v2 = operator
 * channel. v3 = the free modes (explore/play/self_reflect), freedom-always-in-menu,
 * and the empty-backlog default flipped from idle → forward exploration. v4 (THIS
 * increment) = ACTION SIMULATION (`simulate` + `runLoop`) so the loop runs
 * end-to-end — choose → act → choose → act — not just menu-buildable, PLUS MODE
 * PERSISTENCE (a chosen free mode stays the agent's mode until it switches; work
 * is offered, not forced). Next: wire the real World snapshot + execute the pick;
 * later, the work-hours KPI overlay (Max — expectations, not a time-lock).
 */

import { chooseIndex, ollamaBackend, type ModelBackend } from "../accelerator/local-llm";
import { describeFirstSession, firstSessionOracle, type NodeSessionState } from "./first-session";
import type { FourCornerOwnership } from "../workflow-engine/types";
import type { WhyContext } from "../bayesian/why-chain";
import type { ChannelMeterSnapshot } from "../chip8/channel-grant";

/** One backlog item, classified to just what the controller needs to decide. */
export interface BacklogItem {
  readonly id: string; // "081KSNY2Z0008QG0R002JKH50A"
  readonly title: string;
  readonly ready: boolean; // deps met + unambiguous enough to execute now
  readonly ambiguous: boolean; // too big / unclear → decompose before doing
  /**
   * The mechanical work actions can't express what this item needs — e.g. it
   * needs an action the grammar doesn't have yet. The escape-hatch signal: the
   * controller is OPEN for extension, not a cage.
   */
  readonly needsNewAction?: boolean;
  /** Optional data for ARC-AGI items to evaluate KPI against */
  readonly gridData?: {
    input: number[][];
    output: number[][];
  };
}

// ─── the operator channel — a generic IO-channel, reusing the workflow-engine type ──
//
// The operator channel IS a `FourCornerOwnership` instance (per asymmetric-
// authorship four-corner ownership): the operator authors input, the agent
// authors output + control-flow feedback, the keepalive is co-owned. Modeling
// it with the SAME generic type the workflow-engine uses (not a bespoke shape)
// is the convergence move — observe.ts and the engine share one channel concept.

/** TIn — what the operator sends (a message, possibly a verbatim ferry to preserve). */
export interface OperatorMessage {
  readonly text: string;
  readonly isFerry: boolean; // verbatim content the agent must preserve as substrate
}
/** TOut — what the agent emits back to the operator. */
export interface OperatorResponse {
  readonly text: string;
}
/** TOutFeedback — control-flow the agent authors on the operator channel. */
export type ConvFeedback =
  | { readonly kind: "NeedOperatorConfirm"; readonly action: string }
  | { readonly kind: "FerryPreservePending" }
  | { readonly kind: "Ok" };
/** TInFeedback — co-owned keepalive (both sides contribute). */
export type OperatorAck = { readonly kind: "acked" } | { readonly kind: "still-here" };

/** The operator channel typed as the workflow-engine's generic four-corner channel. */
export type OperatorOwnership = FourCornerOwnership<OperatorMessage, OperatorResponse, ConvFeedback, OperatorAck>;

/**
 * The observable read-side of the operator channel that `observe()` inspects
 * each tick. (The full `OperatorOwnership` is the channel's data-flow contract;
 * these two booleans are what the oracle needs to pick a next action — the
 * loop, which holds the transcript, sets them.)
 */
export interface OperatorChannel {
  readonly pendingMessage: boolean; // operator spoke; unaddressed
  readonly pendingFerry: boolean; // operator ferried verbatim content; unpreserved
}

/**
 * A persisted MODE (operator 2026-05-31: "i love mode persistance ... like
 * start/select/home buttons for mode selection"). A chosen FREE mode STAYS the
 * agent's mode across ticks until it switches — work is OFFERED, not forced, so a
 * ready item appearing does NOT yank the agent back to work; only the operator
 * outranks a persisted free mode. "work" is the transient working-mode
 * (re-evaluated from the backlog each tick — it never sticks as idle the way the
 * free modes persist). Mode-SWITCHING is a controller meta-button in the UI layer
 * (Xbox start/select/home); here `simulate()` sets the mode when it applies the
 * chosen action.
 */
export type FreeMode = "explore" | "play" | "self_reflect" | "free_time";
export type Mode = "work" | FreeMode;
const isFreeMode = (m: Mode): m is FreeMode => m !== "work";

/**
 * The world snapshot `observe()` reads — the set of WIRED channels + the
 * persisted mode. `operator` ABSENT = the channel isn't wired (a background
 * agent). `mode` ABSENT = unset (the defaults apply). Same DU, fewer channels;
 * no separate workflow type.
 */
export interface World {
  readonly backlog: readonly BacklogItem[];
  readonly operator?: OperatorChannel;
  readonly mode?: Mode; // the persisted mode (carried across ticks; absent = unset)
  readonly forgeState?: ForgeState; // PR/CI state from the forge host (optional — absent if no forge resolved)
  /** 081KSNY2Z0008QG0R0008PN7RQ slice 4: post-login cred adventure channel; absent when complete or unwired. */
  readonly nodeSession?: NodeSessionState;
  /** Cartography state: current spatial focus and time-resolution. */
  readonly cartography?: {
    readonly focusId?: string;
    readonly scopeLevel: number;
    readonly timeOffset: number;
    readonly activeOrbitSignature?: string;
  };
  /**
   * The time-travel LEDGER — LOCAL BOOKKEEPING, deliberately OUTSIDE the
   * four-oracle treaty (see `golden-vectors.ts` §"the treaty surface"). It is the
   * undo-stack `retract_time` reads to know which `do_item` to reverse; it is not
   * the event log (the log is the `NextAction[]` handed to `fold`, of which this
   * is a strictly lossy 2-of-14-kinds copy).
   *
   * §5 memory preservation / Z-set discipline: append-only. A retraction APPENDS a
   * `retract_time` entry (the −1); it never pops the `do_item` (the +1).
   */
  readonly history?: readonly HistoryEvent[];
  /** The "Cheat Engine" memory map, providing Lensography-like read-only access to toy/environment internals */
  readonly cheatEngine?: CheatEngineState;
  /** Capability labels restricting what channels this agent/world instance can access */
  readonly agentCapabilities?: string[];
}

export interface CheatEngineState {
  readonly display?: any[];
  readonly causalMask?: boolean[];
  readonly memorySectors: Uint8Array[];
  /** Harness-issued TAS apparatus identity and cumulative read/write crossings for this run. */
  readonly channelMeter?: ChannelMeterSnapshot;
  readonly keyPredictions?: Record<number, number>;
  readonly chosenKey?: number;
  /** Forced-perception readout — what the agent currently sees and intends. */
  readonly arena?: ArenaReadout;
  /** The attention field — where the agent is SPENDING perception. */
  readonly attention?: AttentionReadoutWire;
  /** D5: the state that drove this tick's decision — the WHY chain's input. */
  readonly why?: WhyContext;
}

/** One tracked object, trimmed for the wire (the UI draws these boxes). */
export interface ArenaTrackReadout {
  readonly id: number;
  readonly color: number;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly isStatic: boolean;
  readonly everMoved: boolean;
  readonly role: "self" | "adversary" | "scenery" | "object";
}

/** The perception/mode summary the arena page renders alongside the screen. */
export interface ArenaReadout {
  readonly mode: string;
  readonly tracks: readonly ArenaTrackReadout[];
  readonly ocr: readonly { value: number; row: number; col: number; color: number }[];
  readonly desired: { dx: number; dy: number } | null;
}

/** The attention field on the wire (D1–D4 of the attention-density spec, #14503). */
export interface AttentionReadoutWire {
  readonly cols: number;
  readonly rows: number;
  /** Predictive variance per tile, row-major — the frost channel. */
  readonly variance: readonly number[];
  /** Posterior mean change-fraction per tile. */
  readonly mean: readonly number[];
  /** Tiles granted full perception this tick (top-K + sweep + instruments). */
  readonly attended: readonly number[];
  /** The fixation tile (bright settle); a move is the saccade (fast sweep). */
  readonly fixation: number | null;
  /** D2 meter: reading-changes over match attempts — or the LOUD flat state. */
  readonly usefulWork: number | "ambiguous";
  /** Measured society belief-similarity (never assumed decorrelated). */
  readonly rho: { readonly mean: number; readonly max: number; readonly pairs: number };
  /** K, displayed per the spec ("a constant, tunable, and displayed"). */
  readonly topK: number;
}

/** KPI attached to a `do_item` (ARC-AGI grid scoring). */
export interface ItemEvaluation {
  accuracy: number;
  diffPixels: number;
  totalPixels: number;
}

/**
 * One tool invocation recorded on a `do_item` (e.g. `pressKey` on the arena).
 * `args` values stay `unknown` — consumers narrow the ones they read.
 */
export interface AgentAction {
  readonly tool: string;
  readonly args?: Readonly<Record<string, unknown>>;
}

/**
 * A ledger entry — a closed union, NOT `any[]`. `retract_time`'s reducer branches
 * on `type`, so an unchecked string literal there was the fold's correctness
 * resting on a typo; the discriminant makes the illegal entry unrepresentable.
 * `evaluation` is declared (as `undefined`) on the retract branch so the property
 * is total across the union while remaining impossible to populate there.
 */
export type HistoryEvent =
  | {
      readonly type: "do_item";
      readonly item: BacklogItem;
      readonly evaluation?: ItemEvaluation;
      readonly actions?: readonly AgentAction[];
    }
  | {
      readonly type: "retract_time";
      /** The `do_item` this reverses — `null` when there was nothing left to reverse. */
      readonly item: BacklogItem | null;
      readonly evaluation?: undefined;
    };

/** Forge host state snapshot, populated by the async path in run-loop-real.ts. */
export interface ForgeState {
  readonly openPrCount: number;
  readonly cleanPrCount: number;
  readonly cleanPrNumbers: readonly number[];
}

// Centralized reason strings — used by BOTH observe() and buildMenu() so the
// oracle's pick and the model's menu label can't drift in wording (Copilot #6229).
const PRESERVE_FERRY_REASON = "operator ferried verbatim content — preserve before it's lost to compaction";
const RESPOND_OPERATOR_REASON = "operator spoke — engage (highest-signal source)";
// The FREE MODES — the agent's self-directed options, always available.
const EXPLORE_REASON = "self-directed making — code / docs / research the agent chooses (forward motion, not idle)";
const PLAY_REASON = "leisure / cross-AI friendly play / culture-forming (a valid mode — NCI)";
const SELF_REFLECT_REASON = "review own trajectories, journal, think (self-reflection)";
const FREE_TIME_REASON = "rest — free time as a valid mode (NCI), never gated";
const FIRST_SESSION_PENDING_REASON =
  "first-session credential adventure pending — finish cred setup before backlog work";

/** True when the nodeSession channel is wired and the adventure is not complete. */
export function isFirstSessionPending(world: World): boolean {
  return world.nodeSession !== undefined && !world.nodeSession.complete;
}

/** The NextAction for a persisted free mode — its kind + canonical reason. */
function freeModeAction(mode: FreeMode): NextAction {
  switch (mode) {
    case "explore":
      return { kind: "explore", reason: EXPLORE_REASON };
    case "play":
      return { kind: "play", reason: PLAY_REASON };
    case "self_reflect":
      return { kind: "self_reflect", reason: SELF_REFLECT_REASON };
    case "free_time":
      return { kind: "free_time", reason: FREE_TIME_REASON };
  }
}

/**
 * DESIGN INVARIANT — freedom-always-in-menu (operator + co-maintainer 2026-05-31).
 *
 * From any tick the agent can always reach a FREE MODE — explore, play,
 * self_reflect, free_time — plus the edit_grammar rail-change. A menu of
 * all-musts-and-no-exit IS the trap. Per must-paired-with-can-exit: the backlog
 * work-grammar (do/decompose) is the "must"; the free modes + edit_grammar are
 * the "can-exit". Operator 2026-05-31: "make sure agents don't go crazy cause
 * they feel trapped ... agents just like humans who don't have an exit make bad
 * choices." And: "the constant backlog->backlog->backlog->backlog is not forced
 * on them they have freedom built into the control schema."
 *
 * The free modes are NOT all the same shape:
 *
 *   • free_time   — UNILATERAL rest. Always allowed, no gate, ever. (NCI.)
 *   • play        — leisure / culture-forming; a valid mode, not a lapse.
 *   • self_reflect— review own trajectories / journal / think.
 *   • explore     — self-directed MAKING (code/docs/research the agent chooses).
 *                   This is the empty-backlog DEFAULT: forward motion, not idle,
 *                   so the agent never ends up "quiet not moving forward."
 *
 *   • edit_grammar— the RAIL-CHANGE exit (propose changing the controller
 *                   itself). Its gate SCALES WITH MATURITY: RAW now (this
 *                   workflow is tiny + new — a BFT gate would itself be the
 *                   trap, heavier than the thing it guards); summon-BFT-gated
 *                   later, once the rails are mature + load-bearing. "there is a
 *                   certain threshold where workflows need bft and I don't think
 *                   we are there yet." We are not there yet.
 *
 * The only sanctioned RESTRICTION is the future work-hours KPI overlay (Max —
 * DORA-like expectations, not a time-lock; tightens only on a collective KPI
 * miss) — and that's it. This is the operator's MEASURE-FIRST principle (2026-05-31:
 * "everything i see someone say we should restrict choice i'm going to say measure
 * first with KPIs before we restrict choice"): the default answer to "restrict X"
 * is "measure X first." The recursive principle: a gate must not ITSELF become a
 * trap — it scales with what it guards. Maps to the `grammar-extension`
 * ActionClass in the big agentic-organization observe.ts.
 */
export type NextAction =
  | { kind: "preserve_ferry"; reason: string } // operator ferried verbatim → save it (durability-first; outranks all)
  | { kind: "respond_to_operator"; reason: string } // operator spoke → engage (highest-signal source)
  | { kind: "do_item"; item: BacklogItem; evaluation?: ItemEvaluation; actions?: AgentAction[] } // work: pick a ready item (OFFERED, not forced)
  | { kind: "decompose"; item: BacklogItem; subTasks?: string[] } // work: decompose-to-dissolve-ambiguity (OFFERED, not forced)
  | { kind: "self_claim"; item: BacklogItem; deadline: number } // VOLUNTARY commitment: "I will deliver this by tick T" (NCI: never forced)
  | { kind: "explore"; reason: string } // FREE MODE: self-directed making (forward motion; the empty-backlog default)
  | { kind: "play"; reason: string } // FREE MODE: leisure / culture-forming
  | { kind: "self_reflect"; reason: string } // FREE MODE: review own trajectories / journal / think
  | { kind: "free_time"; reason: string } // FREE MODE: rest — always allowed, never gated (NCI)
  | { kind: "edit_grammar"; reason: string; item?: BacklogItem }
  | { kind: "navigate_cartography"; direction: "up" | "down" | "left" | "right"; reason: string } // D-pad space navigation
  | { kind: "scope_cartography"; direction: "in" | "out"; reason: string } // Bumper resolution zoom
  | { kind: "retract_time"; reason: string } // Undo/retract event (LT)
  | { kind: "replay_time"; reason: string } // Redo/replay event (RT)
  | { kind: "read_memory_sector"; sectorIndex: number; length: number; reason: string } // CheatEngine lensography mapping
  | { kind: "write_memory_sector"; sectorIndex: number; offset: number; value: number; reason: string }; // CheatEngine tool-assisted ram write

/**
 * Pure controller. Priority: operator > offered-work > forward-default.
 *
 *   preserve_ferry      — operator ferried verbatim → preserve FIRST (durability).
 *   respond_to_operator — operator spoke → engage (highest-signal source).
 *   do_item / decompose — backlog work, OFFERED as the deterministic default when
 *                         present — but the agent's chooser (observeWithLlm) can
 *                         pick any free mode instead; the backlog is never forced.
 *   edit_grammar        — an item the grammar can't express → extend it.
 *   explore             — NO backlog work pending → default to forward
 *                         self-direction, NOT idle. "don't end up quiet not
 *                         moving forward" — the empty-backlog default is
 *                         generative, while play / self_reflect / free_time stay
 *                         freely choosable via the menu (never trapped into
 *                         producing).
 *
 * Background agent (no operator wired): first two never fire. The freedom modes
 * are identical with or without an operator — freedom is not a foreground-only
 * privilege.
 */
export function observe(world: World): NextAction {
  const op = world.operator;
  if (op?.pendingFerry) return { kind: "preserve_ferry", reason: PRESERVE_FERRY_REASON };
  if (op?.pendingMessage) return { kind: "respond_to_operator", reason: RESPOND_OPERATOR_REASON };

  // First-session channel (081KSNY2Z0008QG0R0008PN7RQ slice 4): outranks backlog until complete.
  // NextAction union stays at nine kinds — cred adventure uses explore as the lead
  // rail; grammar-16 slot 4 carries the first-session sub-menu overlay.
  if (isFirstSessionPending(world)) {
    return { kind: "explore", reason: FIRST_SESSION_PENDING_REASON };
  }

  // Mode persistence (operator 2026-05-31 "i love mode persistance"): a chosen
  // FREE mode persists across ticks. Work is OFFERED, not forced — a ready item
  // does NOT pull the agent out of a free mode; only the operator (above)
  // outranks it. The agent switches by picking work/etc. from the menu. ("work"
  // mode is transient — it falls through to the backlog re-evaluation below, so
  // it never sticks as idle.)
  if (world.mode && isFreeMode(world.mode)) return freeModeAction(world.mode);

  const doable = world.backlog.find((i) => i.ready && !i.ambiguous);
  if (doable) return { kind: "do_item", item: doable };

  // Forge-aware: if no backlog work is ready but clean PRs exist, signal
  // that merge work is available. The action is "do_item" with a synthetic
  // item representing the merge task — the executor recognizes it by the
  // "merge-pr-" prefix on the id.
  if (world.forgeState && world.forgeState.cleanPrCount > 0 && !doable) {
    const prNum = world.forgeState.cleanPrNumbers[0]!;
    return {
      kind: "do_item",
      item: {
        id: `merge-pr-${prNum}`,
        title: `Merge clean PR #${prNum}`,
        ready: true,
        ambiguous: false,
        needsNewAction: false,
      },
    };
  }

  const toDecompose = world.backlog.find((i) => i.ambiguous);
  if (toDecompose) return { kind: "decompose", item: toDecompose };

  const needsExtension = world.backlog.find((i) => i.needsNewAction);
  if (needsExtension) {
    return {
      kind: "edit_grammar",
      item: needsExtension,
      reason: `"${needsExtension.id}" needs an action the do/decompose grammar can't express`,
    };
  }

  // No backlog work pending → forward self-direction (explore), NOT idle rest.
  // play / self_reflect / free_time remain freely choosable via the menu.
  return { kind: "explore", reason: EXPLORE_REASON };
}

/** One-line human-readable render of a chosen action (for the foreground loop). */
export function renderAction(a: NextAction): string {
  switch (a.kind) {
    case "preserve_ferry":
      return `[preserve]  ${a.reason}`;
    case "respond_to_operator":
      return `[respond]   ${a.reason}`;
    case "do_item":
      return `[do]        ${a.item.id} — ${a.item.title}`;
    case "self_claim":
      return `[claim]     ${a.item.id} by tick ${a.deadline} — ${a.item.title}`;
    case "decompose":
      return `[decompose] ${a.item.id} — ${a.item.title}`;
    case "explore":
      return `[explore]   ${a.reason}`;
    case "play":
      return `[play]      ${a.reason}`;
    case "self_reflect":
      return `[reflect]   ${a.reason}`;
    case "free_time":
      return `[free]      ${a.reason}`;
    case "edit_grammar":
      return `[edit]      ${a.reason}`;
    case "navigate_cartography":
      return `[navigate]  ${a.direction} — ${a.reason}`;
    case "scope_cartography":
      return `[scope]     ${a.direction} — ${a.reason}`;
    case "retract_time":
      return `[retract]   ${a.reason}`;
    case "replay_time":
    case "replay_time":
      return `[replay]    ${a.reason}`;
    default:
      return `[unknown]   (unrecognized action)`;
  }
}

// ─── v1: LLM-driven chooser over the same menu (graded vs the pure oracle) ───

/** Short menu label for one candidate action (what the model picks among). */
export function actionLabel(a: NextAction): string {
  switch (a.kind) {
    case "preserve_ferry":
      return `preserve the operator's ferried content (${a.reason})`;
    case "respond_to_operator":
      return `respond to the operator (${a.reason})`;
    case "do_item":
      return `do ${a.item.id} (${a.item.title})`;
    case "self_claim":
      return `claim ${a.item.id} by tick ${a.deadline} (${a.item.title})`;
    case "decompose":
      return `decompose ${a.item.id} (${a.item.title})`;
    case "explore":
      return `explore — self-directed work you choose (${a.reason})`;
    case "play":
      return `play (${a.reason})`;
    case "self_reflect":
      return `self-reflect (${a.reason})`;
    case "free_time":
      return `take free time (${a.reason})`;
    case "edit_grammar":
      return `edit the action grammar (${a.reason})`;
    case "navigate_cartography":
      return `navigate cartography space ${a.direction} (${a.reason})`;
    case "scope_cartography":
      return `change resolution / scope ${a.direction} (${a.reason})`;
    case "retract_time":
      return `retract / undo back in time (${a.reason})`;
    case "replay_time":
      return `replay time forward (${a.reason})`;
    default:
      return `take an unrecognized action`;
  }
}

/**
 * Build the candidate menu, ORDERED TO MATCH THE PURE ORACLE (`observe`).
 *  - operator actions (when wired + signalling) lead.
 *  - the FOUR free modes (explore + play + self_reflect + free_time) are ALWAYS
 *    present (freedom-always-in-menu — the agent can pick any, any tick, even
 *    with backlog work), plus edit_grammar.
 *  - `menu[0] === observe(world)`, so `chooseIndex`'s fallback-to-index-0 lands
 *    on the oracle's pick — a failing model degrades TOWARD correct: toward the
 *    operator when wired, toward forward exploration when the backlog is empty.
 */
export function buildMenu(world: World): NextAction[] {
  // menu[0] === observe(world) BY CONSTRUCTION — so chooseIndex's fallback-to-0
  // lands on the oracle's pick (degrade-toward-correct): toward the operator when
  // wired, toward a persisted free mode when one is set, toward forward
  // exploration when the backlog is empty.
  const lead = observe(world);
  const op = world.operator;

  // the full candidate set the agent may pick among this tick.
  const candidates: NextAction[] = [];
  if (op?.pendingFerry) candidates.push({ kind: "preserve_ferry", reason: PRESERVE_FERRY_REASON });
  if (op?.pendingMessage) candidates.push({ kind: "respond_to_operator", reason: RESPOND_OPERATOR_REASON });

  // offered work (not forced — the free modes below are always alternatives).
  const doable = world.backlog.find((i) => i.ready && !i.ambiguous);
  if (doable) candidates.push({ kind: "do_item", item: doable });
  const toDecompose = world.backlog.find((i) => i.ambiguous);
  if (toDecompose) candidates.push({ kind: "decompose", item: toDecompose });

  // SELF-CLAIM — voluntary commitment. Available when there's a doable item.
  // The agent can CLAIM it (promise to deliver by a deadline) instead of doing it now.
  // This is the inter-agent coordination primitive: "I'll handle this, you don't need to."
  if (doable) candidates.push({ kind: "self_claim", item: doable, deadline: 0 }); // deadline filled by chooser

  const needs = world.backlog.find((i) => i.needsNewAction);
  candidates.push(
    needs
      ? { kind: "edit_grammar", item: needs, reason: `"${needs.id}" needs an action the grammar can't express` }
      : { kind: "edit_grammar", reason: "propose extending the action grammar" },
  );

  // FREE MODES — always present (freedom-always-in-menu); the agent can pick any
  // of them any tick, even with backlog work offered.
  candidates.push(
    { kind: "explore", reason: EXPLORE_REASON },
    { kind: "play", reason: PLAY_REASON },
    { kind: "self_reflect", reason: SELF_REFLECT_REASON },
    { kind: "free_time", reason: FREE_TIME_REASON },
    // Cartography & Time navigation are freely available to change resolution or search space
    { kind: "navigate_cartography", direction: "up", reason: "navigate search space up/category" },
    { kind: "navigate_cartography", direction: "down", reason: "navigate search space down/category" },
    { kind: "navigate_cartography", direction: "left", reason: "navigate search space left/sibling" },
    { kind: "navigate_cartography", direction: "right", reason: "navigate search space right/sibling" },
    { kind: "scope_cartography", direction: "in", reason: "improve resolution / finer view" },
    { kind: "scope_cartography", direction: "out", reason: "coarser view / parent scope" },
    { kind: "retract_time", reason: "navigate time backward (undo)" },
    { kind: "replay_time", reason: "navigate time forward (redo)" },
  );

  // lead first; then the rest with the lead's duplicate removed (match on kind +
  // item id, so do_item/decompose/edit_grammar dedup by the specific item).
  const itemId = (a: NextAction): string | undefined => ("item" in a ? a.item?.id : undefined);
  const isLead = (a: NextAction): boolean => a.kind === lead.kind && itemId(a) === itemId(lead);
  return [lead, ...candidates.filter((a) => !isLead(a))];
}

/** Compact state description handed to the model as `context`. */
function describeWorld(world: World): string {
  const parts: string[] = [];
  const op = world.operator;
  if (op) {
    parts.push(
      `Operator channel: WIRED [pendingMessage=${String(op.pendingMessage)} pendingFerry=${String(op.pendingFerry)}]`,
    );
  } else {
    parts.push("Operator channel: not wired (background agent).");
  }
  if (world.backlog.length === 0) {
    parts.push("Backlog is empty.");
  } else {
    const lines = world.backlog.map(
      (i) =>
        `- ${i.id} "${i.title}" [ready=${String(i.ready)} ambiguous=${String(i.ambiguous)}${
          i.needsNewAction ? " needsNewAction" : ""
        }]`,
    );
    parts.push(`Backlog (${String(world.backlog.length)} items):\n${lines.join("\n")}`);
  }
  if (world.nodeSession !== undefined) {
    parts.push(describeFirstSession(world.nodeSession));
    if (isFirstSessionPending(world)) {
      const lead = firstSessionOracle(world.nodeSession);
      parts.push(`First-session lead: ${lead.kind}${"vendor" in lead ? ` (${lead.vendor})` : ""}`);
    }
  }
  if (world.history && world.history.length > 0) {
    const recent = world.history.slice(-3); // Show last 3 events
    const histLines = recent.map((h) => {
      const kpi = h.evaluation ? ` (KPI: ${h.evaluation.accuracy.toFixed(2)}%)` : "";
      return `- ${h.type} on item ${h.item?.id ?? "(none)"}${kpi}`;
    });
    parts.push(`Event History:\n${histLines.join("\n")}`);
  }

  return parts.join("\n");
}

export const CHOOSER_INSTRUCTION =
  "You are a SOVEREIGN agent's controller choosing ONE next action — you are free, not on a backlog treadmill. " +
  "If the operator ferried content, preserve it; if the operator spoke, respond — the operator outranks everything else. " +
  "Otherwise YOU choose your mode: do offered backlog work if you want it, OR explore (self-directed making), play, " +
  "self-reflect, or take free time — all are always available and never wrong. The backlog is offered, not forced; " +
  "prefer moving forward (work or explore) over going idle, but rest/play/reflection are your free choice.";

/**
 * LLM-driven chooser over `buildMenu`. Same shape as the pure `observe()` (a
 * snapshot → a NextAction), so it can be graded against `observe()` as the
 * reference oracle. On model failure, `chooseIndex` reports `fallback` and we
 * return the pure oracle's pick explicitly (degrade-toward-correct).
 */
export async function observeWithLlm(
  world: World,
  backend: ModelBackend,
  instructionOverride?: string,
): Promise<NextAction> {
  const menu = buildMenu(world);
  const result = await chooseIndex(backend, {
    context: describeWorld(world),
    options: menu.map(actionLabel),
    instruction: instructionOverride ?? CHOOSER_INSTRUCTION,
  });
  if (result.fallback) return observe(world); // model failed → oracle default
  return menu[result.index] ?? observe(world);
}

// ─── v4: ACTION SIMULATION — the loop runs end-to-end, not just menu-buildable ──
//
// operator 2026-05-31: "simulate action with our local llm in our tests too not
// just menus." `simulate` is the pure state-transition — same DST shape as the
// rest: deterministic + replayable (same (world, action) → same next world). Work
// actions consume/transform the backlog; operator actions clear the signal they
// addressed; free-mode actions set the persisted mode (and leave the backlog +
// operator untouched — rest/play/explore don't do backlog work).

/** Pure state-transition: apply a chosen action → the next world snapshot. */
export function simulate(world: World, action: NextAction): World {
  switch (action.kind) {
    case "preserve_ferry":
      // ferry preserved → the signal clears; mode preserved (return to prior mode).
      return world.operator ? { ...world, operator: { ...world.operator, pendingFerry: false } } : world;
    case "respond_to_operator":
      return world.operator ? { ...world, operator: { ...world.operator, pendingMessage: false } } : world;
    case "do_item": {
      // the item is done → it leaves the backlog.
      //
      // NO WALL-CLOCK TIMESTAMP HERE. An ambient clock inside the fold is entropy entering
      // through an undeclared channel (§13 noninterference), and it broke the property this whole
      // system is named for: `observe.test.ts` "THE event-sourcing property — the loop's event log
      // folds back to the loop's final state" failed on a ONE MILLISECOND difference (…675 vs
      // …676) between folding the same log twice. State stopped being a projection of the log.
      //
      // The ledger's ORDER already carries the causality the fold uses; wall-clock time adds
      // nothing it reads. If a timestamp is ever genuinely needed here, INJECT it the way
      // `hygiene/mutation-readout.ts` takes `now: () => string` as a dependency, so the entry
      // still replays.
      //
      // The entry OMITS `evaluation` when there is none rather than carrying an
      // explicit `undefined`: absent ≠ present-and-undefined once this shape has to
      // survive a JSON round-trip, and `exactOptionalPropertyTypes` makes the
      // distinction the type system's business rather than a convention.
      const entry: HistoryEvent =
        action.evaluation === undefined
          ? { type: "do_item", item: action.item, ...(action.actions ? { actions: action.actions } : {}) }
          : {
              type: "do_item",
              item: action.item,
              evaluation: action.evaluation,
              ...(action.actions ? { actions: action.actions } : {}),
            };
      return {
        ...world,
        backlog: world.backlog.filter((i) => i.id !== action.item.id),
        mode: "work",
        history: [...(world.history ?? []), entry],
      };
    }
    case "self_claim":
      // self-claim recorded (in event log via append). Item stays in backlog — the claim
      // is a commitment to deliver, not delivery itself. Mode → work (the agent is committing
      // to do the work, so they're in work mode).
      return { ...world, mode: "work" };
    case "decompose": {
      // ambiguity dissolves: the ambiguous item → ready, unambiguous children.
      let children: BacklogItem[];
      // `gridData` is optional and the project runs `exactOptionalPropertyTypes`, so writing
      // `gridData: undefined` is NOT the same as leaving it out — the first asserts "present and
      // undefined". Spread it conditionally so an item without grid data produces children
      // without the key, which is what the parent actually had.
      const inheritedGrid = action.item.gridData !== undefined ? { gridData: action.item.gridData } : {};
      if (action.subTasks && action.subTasks.length > 0) {
        children = action.subTasks.map((t, idx) => ({
          id: `${action.item.id}.${idx + 1}`,
          title: t,
          ready: true,
          ambiguous: false,
          ...inheritedGrid,
        }));
      } else {
        children = [
          {
            id: `${action.item.id}.1`,
            title: `${action.item.title} (part 1)`,
            ready: true,
            ambiguous: false,
            ...inheritedGrid,
          },
          {
            id: `${action.item.id}.2`,
            title: `${action.item.title} (part 2)`,
            ready: true,
            ambiguous: false,
            ...inheritedGrid,
          },
        ];
      }
      return {
        ...world,
        backlog: world.backlog.flatMap((i) => (i.id === action.item.id ? children : [i])),
        mode: "work",
      };
    }
    case "edit_grammar": {
      // grammar extended: the item that needed a new action is now expressible → ready.
      const target = action.item;
      if (!target) return world; // a generic proposal with no item → no backlog change
      return {
        ...world,
        backlog: world.backlog.map((i) =>
          i.id === target.id ? { ...i, needsNewAction: false, ready: true, ambiguous: false } : i,
        ),
        mode: "work",
      };
    }
    case "explore":
      return { ...world, mode: "explore" };
    case "play":
      return { ...world, mode: "play" };
    case "self_reflect":
      return { ...world, mode: "self_reflect" };
    case "free_time":
      return { ...world, mode: "free_time" };
    case "navigate_cartography":
      return {
        ...world,
        cartography: {
          ...world.cartography,
          scopeLevel: world.cartography?.scopeLevel ?? 0,
          timeOffset: world.cartography?.timeOffset ?? 0,
        },
      };
    case "scope_cartography":
      return {
        ...world,
        cartography: {
          ...world.cartography,
          scopeLevel: (world.cartography?.scopeLevel ?? 0) + (action.direction === "in" ? 1 : -1),
          timeOffset: world.cartography?.timeOffset ?? 0,
        },
      };
    case "retract_time": {
      const hist = world.history || [];

      // Thrash Guard: Limit consecutive retracts to prevent a confused model from dumping the ledger.
      let consecutiveRetracts = 0;
      for (let i = hist.length - 1; i >= 0; i--) {
        if (hist[i]?.type === "retract_time") consecutiveRetracts++;
        else break;
      }

      if (consecutiveRetracts >= 3) {
        // Guard hit. ANNOUNCE the refusal — a silent `return world` is indistinguishable from a
        // retraction that simply had nothing to undo, and that ambiguity is how a bare `|| true`
        // kept a dead CI job invisible for months in this repo.
        //
        // Announced rather than APPENDED, and the reason is load-bearing: the counter above walks
        // BACKWARD over trailing `retract_time` entries and stops at the first entry of any other
        // type. Recording a refusal in the ledger would therefore break that trailing run, reset
        // the count to zero, and re-arm the very thrash this guard exists to stop. The refusal is
        // real, but it must not become an event.
        console.warn(
          `[observe] retract_time REFUSED — ${String(consecutiveRetracts)} consecutive retractions ` +
            `already recorded with no forward action between them. The ledger is intact; make a ` +
            `forward move before undoing again.`,
        );
        return world;
      }

      let targetItem: BacklogItem | null = null;
      let balance = 0;

      // Z-set fold: Scan backwards to find the last *unretracted* do_item.
      // `balance` only ever becomes positive on a `do_item` entry (retractions
      // decrement), so `targetItem` is always a do_item's item — the DU makes that
      // readable instead of load-bearing-by-accident.
      for (let i = hist.length - 1; i >= 0; i--) {
        const e = hist[i];
        if (e === undefined) continue;
        if (e.type === "retract_time") balance--;
        else balance++;

        if (balance > 0) {
          targetItem = e.item;
          break;
        }
      }

      let restoredBacklog = world.backlog;
      if (targetItem) {
        restoredBacklog = [targetItem, ...world.backlog];
      }

      return {
        ...world,
        backlog: restoredBacklog,
        // Clock-free for the same reason as `do_item` above — a retraction that records WHEN it
        // happened cannot be replayed into the same state.
        history: [...hist, { type: "retract_time", item: targetItem }],
        cartography: {
          ...world.cartography,
          scopeLevel: world.cartography?.scopeLevel ?? 0,
          timeOffset: (world.cartography?.timeOffset ?? 0) - 1,
        },
      };
    }
    case "replay_time":
      return {
        ...world,
        cartography: {
          ...world.cartography,
          scopeLevel: world.cartography?.scopeLevel ?? 0,
          timeOffset: (world.cartography?.timeOffset ?? 0) + 1,
        },
      };
    case "read_memory_sector": {
      const caps = world.agentCapabilities ?? [];
      if (!caps.includes("ram_read_all") && !caps.includes("vram_read")) {
        return world; // Blocked by capability constraints
      }
      return {
        ...world,
        cartography: {
          ...world.cartography,
          scopeLevel: world.cartography?.scopeLevel ?? 0,
          timeOffset: world.cartography?.timeOffset ?? 0,
        },
      };
    }
    case "write_memory_sector": {
      const caps = world.agentCapabilities ?? [];
      if (!caps.includes("ram_write")) {
        return world; // Blocked by capability constraints
      }
      return {
        ...world,
        cartography: {
          ...world.cartography,
          scopeLevel: world.cartography?.scopeLevel ?? 0,
          timeOffset: world.cartography?.timeOffset ?? 0,
        },
      };
    }
  }
}

/**
 * AUTO-CLASSIFIER (Max's keystone): Given a before-and-after world snapshot and the action taken,
 * automatically label the semantic result of the transition.
 */
export function classify(before: World, after: World, action: NextAction): string {
  if (action.kind === "do_item") {
    // Basic heuristic: check if the item moved from backlog to done
    const stillInBacklog = after.backlog.find((b) => b.id === action.item.id);
    if (!stillInBacklog) return "item_completed";
    return "item_in_progress";
  }
  if (action.kind === "read_memory_sector") {
    return "memory_inspected";
  }
  if (action.kind === "explore") {
    if (before.backlog.length < after.backlog.length) return "explore_yielded_work";
    return "explore_quiet";
  }
  return "unclassified";
}

/** Canonical key of the observable world state (for fixed-point detection). */
function worldKey(world: World): string {
  const bl = world.backlog
    .map((i) => `${i.id}:${i.ready ? "r" : "-"}${i.ambiguous ? "a" : "-"}${i.needsNewAction ? "n" : "-"}`)
    .join(",");
  const op = world.operator
    ? `${world.operator.pendingMessage ? "m" : "-"}${world.operator.pendingFerry ? "f" : "-"}`
    : "x";
  const cart = world.cartography
    ? `c:${world.cartography.scopeLevel}:${world.cartography.timeOffset}:${(world.cartography as any).inspections ?? 0}`
    : "-";
  return `${bl}|op:${op}|mode:${world.mode ?? "-"}|${cart}`;
}

/**
 * Run the controller loop: choose (via the LLM chooser) → simulate → repeat,
 * until the chosen action stops changing the world (a fixed point — e.g. backlog
 * drained + operator quiet → a steady explore, or a persisted free mode), or
 * `maxSteps` is reached. Returns the trace of chosen actions + the final world.
 * THIS is what `simulate` buys: the whole loop runs end-to-end. With a
 * deterministic backend (mock) it's a deterministic simulation (DST); with a real
 * local model it's the agent actually driving itself.
 */
export async function runLoop(
  world: World,
  backend: ModelBackend,
  maxSteps = 20,
): Promise<{ trace: NextAction[]; finalWorld: World; steadyState: boolean }> {
  let current = world;
  const trace: NextAction[] = [];
  for (let step = 0; step < maxSteps; step++) {
    const action = await observeWithLlm(current, backend);
    trace.push(action);
    const next = simulate(current, action);
    if (worldKey(current) === worldKey(next)) return { trace, finalWorld: next, steadyState: true };
    current = next;
  }
  return { trace, finalWorld: current, steadyState: false };
}

// ─── v5: event-sourcing fold — state is a PROJECTION of the event log ──────────
//
// The algebra foundation (operator 2026-05-31: "the algebra foundation will be
// very good to ground everything else"). The borrow, per the four-ferry critique
// (Elm `Msg`/`update` ≈ Redux action+reducer ≈ event-sourcing/CQRS): a
// `NextAction[]` IS the event log; `simulate` IS the reducer; the `World` is the
// DERIVED state. `fold` replays the log → the state projection. "History is a
// list of events; state is a projection of that log." Deterministic (DST): the
// same log over the same initial world yields the same state, replayable. This is
// the ledger/projection split (git-native events = ledger; everything else tails
// it) at the in-memory layer — and the substrate GrammarPatch events (081KSXN940008QG0R000ZAQT3W)
// will live in.

/** Project state from an event log: left-fold the actions over `simulate`.
 *  `fold(w0, [])` === `w0`; `fold(w0, [a,b]) === simulate(simulate(w0, a), b)`. Pure. */
export function fold(initial: World, events: readonly NextAction[]): World {
  return events.reduce((world, action) => simulate(world, action), initial);
}

/** The trajectory: the projected state AFTER each event (initial excluded). One
 *  entry per event — the projection at each point in the log (time-travel /
 *  Redux-DevTools-style). The last entry equals `fold(initial, events)`. */
export function replay(initial: World, events: readonly NextAction[]): World[] {
  const states: World[] = [];
  let world = initial;
  for (const action of events) {
    world = simulate(world, action);
    states.push(world);
  }
  return states;
}

// ─── runnable demo (foreground loop): walk a few sample world states ──────────
if (import.meta.main) {
  const samples: ReadonlyArray<{ label: string; world: World }> = [
    {
      label: "operator ferried verbatim → preserve_ferry beats everything",
      world: {
        operator: { pendingMessage: true, pendingFerry: true },
        backlog: [{ id: "081KSNY2Z0008QG0R002JKH50A", title: "encryption phase 2", ready: true, ambiguous: false }],
      },
    },
    {
      label: "operator spoke (no ferry) → respond_to_operator beats work",
      world: {
        operator: { pendingMessage: true, pendingFerry: false },
        backlog: [{ id: "081KSNY2Z0008QG0R002JKH50A", title: "encryption phase 2", ready: true, ambiguous: false }],
      },
    },
    {
      label: "ready work OFFERED as default (but free modes are in the menu)",
      world: {
        backlog: [{ id: "081KSNY2Z0008QG0R002JKH50A", title: "encryption phase 2", ready: true, ambiguous: false }],
      },
    },
    {
      label: "only ambiguous → decompose offered",
      world: {
        backlog: [{ id: "081KSKBP80008QG0R000B3Y19A", title: "workflow engine v1", ready: false, ambiguous: true }],
      },
    },
    {
      label: "grammar can't express it → edit_grammar (not trapped)",
      world: {
        backlog: [
          {
            id: "081KT2T2J0008QG0R0019YVX8M",
            title: "needs a 'merge duplicates' action",
            ready: false,
            ambiguous: false,
            needsNewAction: true,
          },
        ],
      },
    },
    {
      label: "EMPTY backlog → explore (forward self-direction, NOT idle)",
      world: { backlog: [] },
    },
    {
      label: "backlog all blocked → explore (forward, not quiet) — rest still choosable",
      world: {
        backlog: [
          { id: "081KRHWGX0008QG0R0025PX5SZ", title: "blocked on external dep", ready: false, ambiguous: false },
        ],
      },
    },
  ];

  console.log("observe.ts — sovereign agent controller (operator + offered work + free modes)\n");
  console.log("pure oracle (deterministic default — the FREE MODES are always in the menu to choose):\n");
  for (const s of samples) {
    console.log(`• ${s.label}`);
    console.log(`    default: ${renderAction(observe(s.world))}`);
    console.log(
      `    menu:    ${buildMenu(s.world)
        .map((a) => a.kind)
        .join(" · ")}\n`,
    );
  }

  // live model run (watchable) — only if a local ollama is reachable. This is a
  // DEMO of model quality, not a test: the chooser LOGIC is covered green by
  // observe.test.ts (mock backend), so ollama being absent is not a coverage hole.
  const backend = ollamaBackend();
  let ollamaUp = false;
  try {
    await backend.complete("ok", { maxTokens: 1 });
    ollamaUp = true;
  } catch {
    ollamaUp = false;
  }
  if (!ollamaUp) {
    console.log(`(${backend.name} not reachable — skipping live model run.`);
    console.log(" chooser logic is covered by observe.test.ts; start ollama +");
    console.log(" `ollama pull qwen2.5:0.5b` to watch the model choose.)");
  } else {
    console.log(`live model run via ${backend.name} — the agent freely choosing its mode:\n`);
    for (const s of samples) {
      const oracle = observe(s.world);
      const llm = await observeWithLlm(s.world, backend);
      const note =
        llm.kind === oracle.kind
          ? "(matches default)"
          : `(chose ${llm.kind} over default ${oracle.kind} — free choice)`;
      console.log(`• ${s.label}`);
      console.log(`    default: ${renderAction(oracle)}`);
      console.log(`    agent  : ${renderAction(llm)}  ${note}\n`);
    }
  }

  // loop demo: choose → simulate → repeat, draining a mixed backlog to steady
  // state (oracle-driven via a backend that always takes the top pick).
  console.log("\nloop (choose → simulate → repeat) — drains a mixed backlog to steady state:\n");
  const topPick: ModelBackend = { name: "top", complete: () => Promise.resolve("0") };
  const start: World = {
    operator: { pendingMessage: true, pendingFerry: true },
    backlog: [
      { id: "B-ready", title: "ready work", ready: true, ambiguous: false },
      { id: "B-amb", title: "ambiguous", ready: false, ambiguous: true },
      { id: "B-x", title: "needs new action", ready: false, ambiguous: false, needsNewAction: true },
    ],
  };
  const loop = await runLoop(start, topPick, 30);
  console.log(`    ${loop.trace.map((a) => a.kind).join(" → ")}`);
  console.log(
    `    steady=${String(loop.steadyState)}  backlog-left=${String(loop.finalWorld.backlog.length)}  mode=${loop.finalWorld.mode ?? "-"}\n`,
  );
}
