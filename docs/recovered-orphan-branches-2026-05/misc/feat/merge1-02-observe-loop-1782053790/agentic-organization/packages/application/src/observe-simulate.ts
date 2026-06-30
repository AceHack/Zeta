/**
 * packages/application/src/observe-simulate.ts — Merge1 §02 (Observe Loop).
 *
 * Faithful port of the sovereign-agent observe→choose controller from
 * `src/Core.TypeScript/observe/observe.ts` (the basement-agent "Xbox controller":
 * each tick, look at the WORLD, pick ONE action). This is the PURE algebraic core
 * of the loop — `observe()` picks, `simulate()` transitions in-memory,
 * `fold()`/`replay()` project an event log into state. None of it touches the
 * world; the effectful twin lives in `observe-do-item.ts` (`execute`).
 *
 * Governing doctrine (§10): MP-1 DST replayability (same log → same state),
 * MP-5 freedom-always-in-menu (the four free modes are ALWAYS choosable),
 * MP-8 cross-language parity (the closed `NextAction` sum + exhaustive `simulate`
 * reducer reproduce `golden-vectors.json` byte-for-value in TS/F#/C#/Rust).
 *
 * Self-contained: no LLM/runtime deps. The LLM chooser is `chooseNextAction`,
 * which takes an injected `MenuChooser` callback and degrades to the pure oracle
 * (`observe`) on any failure — so an illegal/unreachable model can never widen
 * the menu (the kernel re-checks the pick against the legal set).
 */

/** One backlog item, classified to just what the controller needs to decide. */
export interface BacklogItem {
  readonly id: string;
  readonly title: string;
  /** deps met + unambiguous enough to execute now. */
  readonly ready: boolean;
  /** too big / unclear → decompose before doing. */
  readonly ambiguous: boolean;
  /**
   * The mechanical work actions can't express what this item needs — the
   * escape-hatch signal: the controller is OPEN for extension, not a cage.
   */
  readonly needsNewAction?: boolean;
}

/** TIn — what the operator sends (a message, possibly a verbatim ferry to preserve). */
export interface OperatorMessage {
  readonly text: string;
  /** verbatim content the agent must preserve as substrate. */
  readonly isFerry: boolean;
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

/**
 * The observable read-side of the operator channel that `observe()` inspects each
 * tick. The loop, which holds the transcript, sets these two booleans.
 */
export interface OperatorChannel {
  /** operator spoke; unaddressed. */
  readonly pendingMessage: boolean;
  /** operator ferried verbatim content; unpreserved. */
  readonly pendingFerry: boolean;
}

/**
 * A persisted MODE. A chosen FREE mode STAYS the agent's mode across ticks until
 * it switches — work is OFFERED, not forced, so a ready item appearing does NOT
 * yank the agent back to work; only the operator outranks a persisted free mode.
 * "work" is the transient working-mode (re-evaluated from the backlog each tick —
 * it never sticks as idle the way the free modes persist).
 */
export type FreeMode = "explore" | "play" | "self_reflect" | "free_time";
export type Mode = "work" | FreeMode;

const isFreeMode = (m: Mode): m is FreeMode => m !== "work";

/**
 * The world snapshot `observe()` reads — the set of WIRED channels + the persisted
 * mode. `operator` ABSENT = the channel isn't wired (a background agent).
 * `mode` ABSENT = unset (the defaults apply). Same DU, fewer channels.
 */
export interface World {
  readonly backlog: readonly BacklogItem[];
  readonly operator?: OperatorChannel;
  readonly mode?: Mode;
}

// Centralized reason strings — used by BOTH observe() and buildMenu() so the
// oracle's pick and the model's menu label can't drift in wording.
const PRESERVE_FERRY_REASON = "operator ferried verbatim content — preserve before it's lost to compaction";
const RESPOND_OPERATOR_REASON = "operator spoke — engage (highest-signal source)";
const EXPLORE_REASON = "self-directed making — code / docs / research the agent chooses (forward motion, not idle)";
const PLAY_REASON = "leisure / cross-AI friendly play / culture-forming (a valid mode — NCI)";
const SELF_REFLECT_REASON = "review own trajectories, journal, think (self-reflection)";
const FREE_TIME_REASON = "rest — free time as a valid mode (NCI), never gated";

/**
 * The action DU — port of `observe.ts` NextAction. Free modes (explore, play,
 * self_reflect, free_time) are ALWAYS in the menu; `edit_grammar` is the
 * rail-change exit. Priority in `observe`: operator > offered-work > forward-default.
 */
export type NextAction =
  | { readonly kind: "preserve_ferry"; readonly reason: string }
  | { readonly kind: "respond_to_operator"; readonly reason: string }
  | { readonly kind: "do_item"; readonly item: BacklogItem }
  | { readonly kind: "decompose"; readonly item: BacklogItem }
  | { readonly kind: "explore"; readonly reason: string }
  | { readonly kind: "play"; readonly reason: string }
  | { readonly kind: "self_reflect"; readonly reason: string }
  | { readonly kind: "free_time"; readonly reason: string }
  | { readonly kind: "edit_grammar"; readonly reason: string; readonly item?: BacklogItem };

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
 * Pure controller. Priority: operator > offered-work > forward-default.
 *
 *   preserve_ferry      — operator ferried verbatim → preserve FIRST (durability).
 *   respond_to_operator — operator spoke → engage (highest-signal source).
 *   do_item / decompose — backlog work, OFFERED as the deterministic default when
 *                         present — the agent's chooser can pick any free mode
 *                         instead; the backlog is never forced.
 *   edit_grammar        — an item the grammar can't express → extend it.
 *   explore             — NO backlog work pending → default to forward
 *                         self-direction, NOT idle.
 *
 * A persisted free mode (mode-persistence) outranks offered work but not the
 * operator. Background agent (no operator wired): the first two never fire.
 */
export function observe(world: World): NextAction {
  const op = world.operator;
  if (op?.pendingFerry) return { kind: "preserve_ferry", reason: PRESERVE_FERRY_REASON };
  if (op?.pendingMessage) return { kind: "respond_to_operator", reason: RESPOND_OPERATOR_REASON };

  // Mode persistence: a chosen FREE mode persists across ticks. Work is OFFERED,
  // not forced — a ready item does NOT pull the agent out of a free mode; only
  // the operator (above) outranks it. "work" mode is transient — it falls
  // through to the backlog re-evaluation below, so it never sticks as idle.
  if (world.mode && isFreeMode(world.mode)) return freeModeAction(world.mode);

  const doable = world.backlog.find((i) => i.ready && !i.ambiguous);
  if (doable) return { kind: "do_item", item: doable };

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

/** One-line human-readable render of a chosen action (for a foreground loop). */
export function renderAction(a: NextAction): string {
  switch (a.kind) {
    case "preserve_ferry":
      return `[preserve]  ${a.reason}`;
    case "respond_to_operator":
      return `[respond]   ${a.reason}`;
    case "do_item":
      return `[do]        ${a.item.id} — ${a.item.title}`;
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
  }
}

/** Short menu label for one candidate action (what the model picks among). */
export function actionLabel(a: NextAction): string {
  switch (a.kind) {
    case "preserve_ferry":
      return `preserve the operator's ferried content (${a.reason})`;
    case "respond_to_operator":
      return `respond to the operator (${a.reason})`;
    case "do_item":
      return `do ${a.item.id} (${a.item.title})`;
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
  }
}

const itemIdOf = (a: NextAction): string | undefined => ("item" in a ? a.item?.id : undefined);

/**
 * Build the candidate menu, ORDERED TO MATCH THE PURE ORACLE (`observe`).
 *  - operator actions (when wired + signalling) lead.
 *  - the FOUR free modes are ALWAYS present (freedom-always-in-menu — the agent
 *    can pick any, any tick, even with backlog work), plus edit_grammar.
 *  - `menu[0] === observe(world)` BY CONSTRUCTION, so a fallback-to-index-0 lands
 *    on the oracle's pick (degrade-toward-correct).
 */
export function buildMenu(world: World): NextAction[] {
  const lead = observe(world);
  const op = world.operator;

  const candidates: NextAction[] = [];
  if (op?.pendingFerry) candidates.push({ kind: "preserve_ferry", reason: PRESERVE_FERRY_REASON });
  if (op?.pendingMessage) candidates.push({ kind: "respond_to_operator", reason: RESPOND_OPERATOR_REASON });

  // offered work (not forced — the free modes below are always alternatives).
  const doable = world.backlog.find((i) => i.ready && !i.ambiguous);
  if (doable) candidates.push({ kind: "do_item", item: doable });
  const toDecompose = world.backlog.find((i) => i.ambiguous);
  if (toDecompose) candidates.push({ kind: "decompose", item: toDecompose });

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
  );

  // lead first; then the rest with the lead's duplicate removed (match on kind +
  // item id, so do_item/decompose/edit_grammar dedup by the specific item).
  const isLead = (a: NextAction): boolean => a.kind === lead.kind && itemIdOf(a) === itemIdOf(lead);
  return [lead, ...candidates.filter((a) => !isLead(a))];
}

/**
 * Pure state-transition: apply a chosen action → the next world snapshot.
 * Same DST shape as the rest: deterministic + replayable (same (world, action) →
 * same next world). Work actions consume/transform the backlog; operator actions
 * clear the signal they addressed; free-mode actions set the persisted mode.
 */
export function simulate(world: World, action: NextAction): World {
  switch (action.kind) {
    case "preserve_ferry":
      // ferry preserved → the signal clears; mode preserved (return to prior mode).
      return world.operator ? { ...world, operator: { ...world.operator, pendingFerry: false } } : world;
    case "respond_to_operator":
      return world.operator ? { ...world, operator: { ...world.operator, pendingMessage: false } } : world;
    case "do_item":
      // the item is done → it leaves the backlog.
      return { ...world, backlog: world.backlog.filter((i) => i.id !== action.item.id), mode: "work" };
    case "decompose": {
      // ambiguity dissolves: the ambiguous item → two ready, unambiguous children.
      const children: BacklogItem[] = [
        { id: `${action.item.id}.1`, title: `${action.item.title} (part 1)`, ready: true, ambiguous: false },
        { id: `${action.item.id}.2`, title: `${action.item.title} (part 2)`, ready: true, ambiguous: false },
      ];
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
  }
}

/** Canonical key of the observable world state (for fixed-point detection). */
export function worldKey(world: World): string {
  const bl = world.backlog
    .map((i) => `${i.id}:${i.ready ? "r" : "-"}${i.ambiguous ? "a" : "-"}${i.needsNewAction ? "n" : "-"}`)
    .join(",");
  const op = world.operator
    ? `${world.operator.pendingMessage ? "m" : "-"}${world.operator.pendingFerry ? "f" : "-"}`
    : "x";
  return `${bl}|op:${op}|mode:${world.mode ?? "-"}`;
}

/**
 * Project state from an event log: left-fold the actions over `simulate`.
 * `fold(w0, [])` === `w0`; `fold(w0, [a,b]) === simulate(simulate(w0, a), b)`.
 * Monoid law: `fold(w0, [...a, ...b]) === fold(fold(w0, a), b)`. Pure.
 */
export function fold(initial: World, events: readonly NextAction[]): World {
  return events.reduce((world, action) => simulate(world, action), initial);
}

/**
 * The trajectory: the projected state AFTER each event (initial excluded). One
 * entry per event — the projection at each point in the log (time-travel). The
 * last entry equals `fold(initial, events)`.
 */
export function replay(initial: World, events: readonly NextAction[]): World[] {
  const states: World[] = [];
  let world = initial;
  for (const action of events) {
    world = simulate(world, action);
    states.push(world);
  }
  return states;
}

/**
 * The injected chooser seam — a model (or any policy) picks an index into the
 * legal menu. `fallback: true` reports "I couldn't decide" (unreachable model,
 * unparseable response, illegal index); the caller then degrades to the oracle.
 * This is the seam-injectable LLM boundary — no endpoint is hardcoded here.
 */
export interface MenuChoice {
  readonly index: number;
  readonly fallback: boolean;
}

export interface MenuChooser {
  choose: (input: {
    readonly context: string;
    readonly options: readonly string[];
  }) => Promise<MenuChoice>;
}

/** Compact state description handed to the chooser as `context`. */
export function describeWorld(world: World): string {
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
  parts.push(`Mode: ${world.mode ?? "unset"}`);
  return parts.join("\n");
}

const CHOOSER_INSTRUCTION =
  "You are a SOVEREIGN agent's controller choosing ONE next action — you are free, not on a backlog treadmill. " +
  "If the operator ferried content, preserve it; if the operator spoke, respond — the operator outranks everything else. " +
  "Otherwise YOU choose your mode: do offered backlog work if you want it, OR explore (self-directed making), play, " +
  "self-reflect, or take free time — all are always available and never wrong. The backlog is offered, not forced; " +
  "prefer moving forward (work or explore) over going idle, but rest/play/reflection are your free choice.";

/**
 * Port of `observe.ts` observeWithLlm. The chooser is only ever shown the LEGAL
 * options (`buildMenu`). Whatever it returns is re-checked against that set: an
 * out-of-range index or an explicit `fallback` returns the pure oracle's pick
 * (degrade-toward-correct) — the model can never widen the menu.
 */
export async function chooseNextAction(world: World, chooser: MenuChooser): Promise<NextAction> {
  const menu = buildMenu(world);
  const choice = await chooser.choose({
    context: `${CHOOSER_INSTRUCTION}\n\n${describeWorld(world)}`,
    options: menu.map(actionLabel),
  });
  if (choice.fallback) return observe(world); // model failed → oracle default
  return menu[choice.index] ?? observe(world); // illegal index → oracle default
}

/**
 * Run the controller loop: choose (via the injected chooser) → simulate → repeat,
 * until the chosen action stops changing the world (a fixed point), or `maxSteps`
 * is reached. With a deterministic chooser it's a deterministic simulation (DST).
 */
export async function runLoop(
  world: World,
  chooser: MenuChooser,
  maxSteps = 20,
): Promise<{ trace: NextAction[]; finalWorld: World; steadyState: boolean }> {
  let current = world;
  const trace: NextAction[] = [];
  for (let step = 0; step < maxSteps; step++) {
    const action = await chooseNextAction(current, chooser);
    trace.push(action);
    const next = simulate(current, action);
    if (worldKey(current) === worldKey(next)) return { trace, finalWorld: next, steadyState: true };
    current = next;
  }
  return { trace, finalWorld: current, steadyState: false };
}
