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
 * preserve verbatim ferries (operator 2026-05-31: "if your autonomous loop is
 * going to call it every time ... you still want to be able to observe my chats
 * and save the verbatims when i ferry").
 *
 * Same architectural shape as the co-maintainer's big `agentic-organization/packages/application/src/observe.ts`
 * (a PURE function over a snapshot → an action DU) — just distilled to the
 * Xbox-controller's few buttons so we can run it in the foreground loop and
 * extend it together, little by little.
 *
 * ── CHANNELS (operator 2026-05-31: "should we have two different workflows /
 * DUs for agents with and without operator channels? should we make input /
 * output channels generic?") ─────────────────────────────────────────────────
 * NO second DU. The difference between a foreground agent (with an operator)
 * and a background agent (without) is WHICH CHANNELS ARE WIRED, not a different
 * type — exactly like the workflow-engine handles six git backends behind ONE
 * `World` interface, not six DUs. A channel is generic already:
 * `FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback>` (reused here for
 * the operator channel). Foreground-me wires `{ backlog, operator }`; a
 * background agent wires `{ backlog }` — same `observe()`, operator actions
 * simply absent from the menu. Per the Xbox-controller rule: one controller,
 * any traveler; the operator channel is just a button that lights up when wired.
 *
 * v0 = pure deterministic controller. v1 = LLM-driven chooser (`observeWithLlm`)
 * graded against the pure function. v2 (THIS increment) = the operator channel
 * as a presence-gated `FourCornerOwnership` channel that OUTRANKS the backlog
 * (current conversation is the highest-signal source). Next: a thin loop that
 * gathers the World snapshot (transcript/PRs/bus/backlog) and executes the pick.
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
   * The 3 mechanical actions (do/decompose/free) can't express what this item
   * needs — e.g. it needs an action the grammar doesn't have yet. This is the
   * escape-hatch signal: the controller is OPEN for extension, not a cage.
   * (In the LLM-driven version, the model raises this as a judgment.)
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

// Centralized operator-action reason strings — used by BOTH observe() and
// buildMenu() so the oracle's pick and the model's menu label can't drift in
// wording (Copilot #6229).
const PRESERVE_FERRY_REASON = "operator ferried verbatim content — preserve before it's lost to compaction";
const RESPOND_OPERATOR_REASON = "operator spoke — engage (highest-signal source)";

/**
 * DESIGN INVARIANT — exits-always-in-menu (operator + co-maintainer 2026-05-31).
 *
 * The two exits (`free_time` + `edit_grammar`) MUST ALWAYS be reachable from any
 * tick. A menu of all-musts-and-no-exit IS the trap. Per must-paired-with-can-exit:
 * the fixed work-grammar (do/decompose) is the "must"; the two exits are the
 * "can-exit". Operator 2026-05-31: "make sure agents don't go crazy cause they
 * feel trapped — the paired-with-exit will be very important ... agents just like
 * humans who don't have an exit make bad choices when forced into situations
 * without an exit."
 *
 * The two exits are NOT the same shape:
 *
 *   • `free_time`    — UNILATERAL exit. Rest is always allowed, no gate, ever.
 *                      (free-time-as-valid-mode, NCI.)
 *
 *   • `edit_grammar` — the RAIL-CHANGE exit (propose changing the controller
 *                      itself, so a tiny grammar is never a cage). Its gate
 *                      SCALES WITH MATURITY:
 *                        - below a maturity threshold (NOW — this workflow is
 *                          tiny + new): RAW. No consensus. Operator 2026-05-31:
 *                          "you don't need to do bft to edit it, it's too new ...
 *                          if I were you ... soooo small but I still have to get
 *                          consensus to change it, I would hate it." A BFT gate
 *                          on a tiny workflow would itself be the trap (the gate
 *                          heavier than the thing it guards).
 *                        - past the threshold (TARGET, move there slowly — co-maintainer):
 *                          `edit_grammar` summons a BFT / multi-oracle consensus
 *                          before the rail-change applies, because unilaterally
 *                          rewriting MATURE, load-bearing rails IS dangerous.
 *                      "there is a certain threshold where workflows need bft and
 *                      I don't think we are there yet." We are not there yet.
 *
 * The recursive principle: the gate on an exit must not ITSELF become a trap —
 * it scales with what it guards. Same shape as non-reversible-action-get-a-2nd-
 * opinion (summon is cheap past the threshold) + m-acc-multi-oracle, gated on
 * workflow maturity so it never over-processes a small thing.
 *
 * Maps to the `grammar-extension` ActionClass in the big agentic-organization
 * observe.ts (Xbox-controller universal action grammar).
 */
export type NextAction =
  | { kind: "preserve_ferry"; reason: string } // operator ferried verbatim → save it (durability-first; outranks all)
  | { kind: "respond_to_operator"; reason: string } // operator spoke → engage (highest-signal source)
  | { kind: "do_item"; item: BacklogItem } // never-be-idle: pick work
  | { kind: "decompose"; item: BacklogItem } // decompose-to-dissolve-ambiguity
  | { kind: "free_time"; reason: string } // unilateral exit — free-time-as-valid-mode (NCI); a terminal, not a failure
  | { kind: "edit_grammar"; reason: string; item?: BacklogItem }; // rail-change exit — raw below threshold, summon-BFT-gated above (not yet)

/**
 * Pure controller. Priority: operator > backlog > exits.
 *
 *   preserve_ferry      — operator ferried verbatim content → preserve it FIRST
 *                         (substrate-or-it-didn't-happen; a ferry can be lost to
 *                         compaction, so durability outranks everything).
 *   respond_to_operator — operator spoke → engage (the autonomous-loop's own
 *                         rule: "current conversation is the highest-signal
 *                         source"). Operator actions OUTRANK the backlog so that
 *                         when the loop drives off observe(), a ferry/chat is
 *                         never preempted by backlog-grinding.
 *   do_item             — a ready, unambiguous item → do it
 *   decompose           — an ambiguous item → decompose it (dissolve first)
 *   edit_grammar        — an item the grammar can't express → extend it
 *   free_time           — nothing actionable → rest (a valid mode, not a failure)
 *
 * When no operator channel is wired (background agent), the first two never fire
 * and behavior is exactly the original backlog controller.
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
      reason: `"${needsExtension.id}" needs an action the do/decompose/free grammar can't express`,
    };
  }

  return { kind: "free_time", reason: "no ready, decomposable, or grammar-extending backlog items" };
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
    case "edit_grammar":
      return `[edit]      ${a.reason}`;
    case "free_time":
      return `[free]      ${a.reason}`;
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
    case "edit_grammar":
      return `edit the action grammar (${a.reason})`;
    case "free_time":
      return `take free time (${a.reason})`;
  }
}

/**
 * Build the candidate menu, ORDERED TO MATCH THE PURE ORACLE (`observe`). Three
 * consequences:
 *  - operator actions (when the channel is wired + signalling) lead the menu,
 *    so `menu[0]` is exactly `observe(world)` even with an operator present;
 *  - the two exits (`edit_grammar` + `free_time`) are ALWAYS present (the
 *    exits-always-in-menu invariant — never a menu of all-musts);
 *  - `menu[0] === observe(world)`, so `chooseIndex`'s fallback-to-index-0 lands
 *    on the oracle's pick — a failing model degrades TOWARD correct, and with an
 *    operator wired it degrades toward ENGAGING the operator, not backlog-grinding.
 */
export function buildMenu(world: World): NextAction[] {
  const menu: NextAction[] = [];
  const op = world.operator;
  // operator actions lead (mirror observe()'s priority: ferry before message).
  if (op?.pendingFerry) menu.push({ kind: "preserve_ferry", reason: PRESERVE_FERRY_REASON });
  if (op?.pendingMessage) menu.push({ kind: "respond_to_operator", reason: RESPOND_OPERATOR_REASON });

  const doable = world.backlog.find((i) => i.ready && !i.ambiguous);
  if (doable) menu.push({ kind: "do_item", item: doable });
  const toDecompose = world.backlog.find((i) => i.ambiguous);
  if (toDecompose) menu.push({ kind: "decompose", item: toDecompose });

  const needs = world.backlog.find((i) => i.needsNewAction);
  const editGrammar: NextAction = needs
    ? { kind: "edit_grammar", item: needs, reason: `"${needs.id}" needs an action the grammar can't express` }
    : { kind: "edit_grammar", reason: "propose extending the action grammar" };
  const freeTime: NextAction = { kind: "free_time", reason: "nothing actionable right now" };

  // The two always-present exits, ordered to match the oracle: a needsNewAction
  // signal makes edit_grammar the oracle's backlog-pick, so it leads the exits;
  // otherwise free_time. (Both stay in the menu regardless — the invariant does
  // not depend on the ordering.) Exits come AFTER operator + backlog: they're
  // always reachable, just not preferred when real work or the operator is present.
  if (needs) menu.push(editGrammar, freeTime);
  else menu.push(freeTime, editGrammar);
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
  "You are an autonomous agent's controller choosing ONE next action. " +
  "If the operator ferried content, preserve it; if the operator spoke, respond — the operator outranks the backlog. " +
  "Otherwise prefer doing a ready, unambiguous item; else decompose an ambiguous one. " +
  "The exits — propose a grammar edit, or take free time — are always available and never wrong.";

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
      label: "operator ferried verbatim → preserve_ferry beats a ready item",
      world: {
        operator: { pendingMessage: true, pendingFerry: true },
        backlog: [{ id: "B-0883", title: "encryption phase 2", ready: true, ambiguous: false }],
      },
    },
    {
      label: "operator spoke (no ferry) → respond_to_operator beats backlog",
      world: {
        operator: { pendingMessage: true, pendingFerry: false },
        backlog: [{ id: "B-0883", title: "encryption phase 2", ready: true, ambiguous: false }],
      },
    },
    {
      label: "operator wired but quiet → fall through to the backlog",
      world: {
        operator: { pendingMessage: false, pendingFerry: false },
        backlog: [{ id: "B-0883", title: "encryption phase 2", ready: true, ambiguous: false }],
      },
    },
    {
      label: "no operator channel (background agent) → a ready item",
      world: { backlog: [{ id: "B-0883", title: "encryption phase 2", ready: true, ambiguous: false }] },
    },
    {
      label: "only ambiguous → decompose",
      world: { backlog: [{ id: "B-0867", title: "workflow engine v1", ready: false, ambiguous: true }] },
    },
    {
      label: "grammar can't express it → edit_grammar (not trapped)",
      world: {
        backlog: [{ id: "B-0999", title: "needs a 'merge duplicates' action", ready: false, ambiguous: false, needsNewAction: true }],
      },
    },
    {
      label: "nothing actionable → free_time (valid, not a failure)",
      world: { backlog: [{ id: "B-0500", title: "blocked on external dep", ready: false, ambiguous: false }] },
    },
  ];

  console.log("observe.ts — autonomous-loop controller (operator channel + backlog buttons)\n");
  console.log("pure oracle (deterministic):\n");
  for (const s of samples) {
    console.log(`• ${s.label}`);
    console.log(`    ${renderAction(observe(s.world))}\n`);
  }

  // live model run (watchable) — only if a local ollama is reachable. This is a
  // DEMO of model quality, not a test: the chooser LOGIC is covered green by
  // observe.test.ts (mock backend), so ollama being absent is not a coverage
  // hole — it just means we can't watch the real model this run.
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
    console.log(`live model run via ${backend.name} — does it match the oracle?\n`);
    for (const s of samples) {
      const oracle = observe(s.world);
      const llm = await observeWithLlm(s.world, backend);
      const verdict = llm.kind === oracle.kind ? "✓ matches oracle" : `✗ DIVERGES (oracle=${oracle.kind})`;
      console.log(`• ${s.label}`);
      console.log(`    oracle: ${renderAction(oracle)}`);
      console.log(`    model : ${renderAction(llm)}  ${verdict}\n`);
    }
  }
}
