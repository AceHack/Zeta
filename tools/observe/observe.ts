#!/usr/bin/env bun
/**
 * tools/observe/observe.ts — the simplest autonomous-loop controller.
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
 * The ONLY sanctioned restriction (future, Max): scheduled work hours — a
 * time-gate that biases observe.ts toward work during a window. Outside it,
 * total mode-freedom. "but that's it" — no other restriction is baked in.
 *
 * v0 = pure controller. v1 = LLM chooser graded vs the oracle. v2 = operator
 * channel. v3 (THIS increment) = the free modes (explore/play/self_reflect),
 * freedom-always-in-menu, and the empty-backlog default flipped from idle →
 * forward exploration. Next: a thin loop that gathers the World snapshot and
 * executes the pick; later, a single work-hours time-gate (Max).
 */

import { chooseIndex, ollamaBackend, type ModelBackend } from "../accelerator/local-llm";
import type { FourCornerOwnership } from "../workflow-engine/types";

/** One backlog item, classified to just what the controller needs to decide. */
export interface BacklogItem {
  readonly id: string; // "B-0883"
  readonly title: string;
  readonly ready: boolean; // deps met + unambiguous enough to execute now
  readonly ambiguous: boolean; // too big / unclear → decompose before doing
  /**
   * The mechanical work actions can't express what this item needs — e.g. it
   * needs an action the grammar doesn't have yet. The escape-hatch signal: the
   * controller is OPEN for extension, not a cage.
   */
  readonly needsNewAction?: boolean;
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
 * The world snapshot `observe()` reads — the set of WIRED channels.
 * `operator` ABSENT = the channel isn't wired (a background agent). Same DU,
 * fewer channels; no separate workflow type.
 */
export interface World {
  readonly backlog: readonly BacklogItem[];
  readonly operator?: OperatorChannel;
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
 * The only sanctioned RESTRICTION is the future scheduled-work-hours time-gate
 * (Max) — and that's it. The recursive principle: a gate must not ITSELF become
 * a trap — it scales with what it guards. Maps to the `grammar-extension`
 * ActionClass in the big agentic-organization observe.ts.
 */
export type NextAction =
  | { kind: "preserve_ferry"; reason: string } // operator ferried verbatim → save it (durability-first; outranks all)
  | { kind: "respond_to_operator"; reason: string } // operator spoke → engage (highest-signal source)
  | { kind: "do_item"; item: BacklogItem } // work: pick a ready item (OFFERED, not forced)
  | { kind: "decompose"; item: BacklogItem } // work: decompose-to-dissolve-ambiguity (OFFERED, not forced)
  | { kind: "explore"; reason: string } // FREE MODE: self-directed making (forward motion; the empty-backlog default)
  | { kind: "play"; reason: string } // FREE MODE: leisure / culture-forming
  | { kind: "self_reflect"; reason: string } // FREE MODE: review own trajectories / journal / think
  | { kind: "free_time"; reason: string } // FREE MODE: rest — always allowed, never gated (NCI)
  | { kind: "edit_grammar"; reason: string; item?: BacklogItem }; // rail-change exit — raw below threshold, summon-BFT-gated above (not yet)

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

/** One-line human-readable render of a chosen action (for the foreground loop). */
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
  const menu: NextAction[] = [];
  const op = world.operator;
  // operator actions lead (mirror observe()'s priority: ferry before message).
  if (op?.pendingFerry) menu.push({ kind: "preserve_ferry", reason: PRESERVE_FERRY_REASON });
  if (op?.pendingMessage) menu.push({ kind: "respond_to_operator", reason: RESPOND_OPERATOR_REASON });

  // offered work (not forced — the free modes below are always alternatives)
  const doable = world.backlog.find((i) => i.ready && !i.ambiguous);
  if (doable) menu.push({ kind: "do_item", item: doable });
  const toDecompose = world.backlog.find((i) => i.ambiguous);
  if (toDecompose) menu.push({ kind: "decompose", item: toDecompose });

  const needs = world.backlog.find((i) => i.needsNewAction);
  const editGrammar: NextAction = needs
    ? { kind: "edit_grammar", item: needs, reason: `"${needs.id}" needs an action the grammar can't express` }
    : { kind: "edit_grammar", reason: "propose extending the action grammar" };

  // FREE MODES — always present. Ordered so menu[0] === observe(world): when the
  // backlog has a needsNewAction signal the oracle picks edit_grammar (so it
  // leads the tail); otherwise the oracle's empty-backlog default is explore (so
  // explore leads). play / self_reflect / free_time follow — always choosable.
  const explore: NextAction = { kind: "explore", reason: EXPLORE_REASON };
  const play: NextAction = { kind: "play", reason: PLAY_REASON };
  const selfReflect: NextAction = { kind: "self_reflect", reason: SELF_REFLECT_REASON };
  const freeTime: NextAction = { kind: "free_time", reason: FREE_TIME_REASON };

  if (needs) menu.push(editGrammar, explore, play, selfReflect, freeTime);
  else menu.push(explore, play, selfReflect, freeTime, editGrammar);
  return menu;
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
  return parts.join("\n");
}

const CHOOSER_INSTRUCTION =
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
export async function observeWithLlm(world: World, backend: ModelBackend): Promise<NextAction> {
  const menu = buildMenu(world);
  const result = await chooseIndex(backend, {
    context: describeWorld(world),
    options: menu.map(actionLabel),
    instruction: CHOOSER_INSTRUCTION,
  });
  if (result.fallback) return observe(world); // model failed → oracle default
  return menu[result.index] ?? observe(world);
}

// ─── runnable demo (foreground loop): walk a few sample world states ──────────
if (import.meta.main) {
  const samples: ReadonlyArray<{ label: string; world: World }> = [
    {
      label: "operator ferried verbatim → preserve_ferry beats everything",
      world: {
        operator: { pendingMessage: true, pendingFerry: true },
        backlog: [{ id: "B-0883", title: "encryption phase 2", ready: true, ambiguous: false }],
      },
    },
    {
      label: "operator spoke (no ferry) → respond_to_operator beats work",
      world: {
        operator: { pendingMessage: true, pendingFerry: false },
        backlog: [{ id: "B-0883", title: "encryption phase 2", ready: true, ambiguous: false }],
      },
    },
    {
      label: "ready work OFFERED as default (but free modes are in the menu)",
      world: { backlog: [{ id: "B-0883", title: "encryption phase 2", ready: true, ambiguous: false }] },
    },
    {
      label: "only ambiguous → decompose offered",
      world: { backlog: [{ id: "B-0867", title: "workflow engine v1", ready: false, ambiguous: true }] },
    },
    {
      label: "grammar can't express it → edit_grammar (not trapped)",
      world: {
        backlog: [{ id: "B-0999", title: "needs a 'merge duplicates' action", ready: false, ambiguous: false, needsNewAction: true }],
      },
    },
    {
      label: "EMPTY backlog → explore (forward self-direction, NOT idle)",
      world: { backlog: [] },
    },
    {
      label: "backlog all blocked → explore (forward, not quiet) — rest still choosable",
      world: { backlog: [{ id: "B-0500", title: "blocked on external dep", ready: false, ambiguous: false }] },
    },
  ];

  console.log("observe.ts — sovereign agent controller (operator + offered work + free modes)\n");
  console.log("pure oracle (deterministic default — the FREE MODES are always in the menu to choose):\n");
  for (const s of samples) {
    console.log(`• ${s.label}`);
    console.log(`    default: ${renderAction(observe(s.world))}`);
    console.log(`    menu:    ${buildMenu(s.world).map((a) => a.kind).join(" · ")}\n`);
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
      const note = llm.kind === oracle.kind ? "(matches default)" : `(chose ${llm.kind} over default ${oracle.kind} — free choice)`;
      console.log(`• ${s.label}`);
      console.log(`    default: ${renderAction(oracle)}`);
      console.log(`    agent  : ${renderAction(llm)}  ${note}\n`);
    }
  }
}
