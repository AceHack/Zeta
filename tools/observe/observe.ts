#!/usr/bin/env bun
/**
 * tools/observe/observe.ts — the simplest autonomous-loop controller.
 *
 * The whole loop as a tiny set of buttons. Each tick: look at the backlog,
 * pick ONE action. This is the do/decompose/free-time grammar from
 * `never-be-idle.md` (it was only ever prose in the rules — never a typed DU)
 * distilled to code, PLUS a 4th escape-hatch so the agent is never trapped by
 * the fixed grammar (operator 2026-05-31: "i don't want you to feel trapped by
 * the DU ... we need a 4th option edit DU").
 *
 * Same architectural shape as Max's big `agentic-organization/.../observe.ts`
 * (a PURE function over a snapshot → an action DU) — just distilled to the
 * Xbox-controller's few buttons so we can run it in the foreground loop and
 * extend it together, little by little.
 *
 * v0 = pure deterministic controller + runnable demo. Next steps (extend
 * little by little): (1) a thin backlog reader from docs/backlog frontmatter;
 * (2) an LLM-driven chooser via tools/accelerator/local-llm.ts `chooseIndex`
 * with `edit_grammar` always in the menu; (3) declarative scenario tests
 * graded against this pure function as the reference oracle.
 */

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

/**
 * The things an agent can do per tick, as ONE explicit DU.
 *
 * The 4th variant (`edit_grammar`) is the escape-hatch / grammar-extension
 * action: the agent is never trapped by the fixed 3. Per the
 * must-paired-with-can-exit pattern, a fixed action-set with no exit IS a
 * "must" without a "can-exit"; `edit_grammar` is the can-exit at action-grammar
 * scope. Maps to the `grammar-extension` ActionClass in the big observe.ts.
 */
export type NextAction =
  | { kind: "do_item"; item: BacklogItem } // never-be-idle: pick work
  | { kind: "decompose"; item: BacklogItem } // decompose-to-dissolve-ambiguity
  | { kind: "free_time"; reason: string } // free-time-as-valid-mode (NCI); a first-class terminal, not a failure
  | { kind: "edit_grammar"; reason: string; item?: BacklogItem }; // escape-hatch: propose extending the action grammar itself

/**
 * Pure controller. Priority: do > decompose > edit-grammar > rest.
 *
 * - a ready, unambiguous item → do it
 * - an ambiguous item → decompose it (dissolve the ambiguity first)
 * - an item the current grammar can't express → edit_grammar (don't be trapped)
 * - nothing actionable → free_time (a valid mode, not a standing-by failure)
 */
export function observe(backlog: readonly BacklogItem[]): NextAction {
  const doable = backlog.find((i) => i.ready && !i.ambiguous);
  if (doable) return { kind: "do_item", item: doable };

  const toDecompose = backlog.find((i) => i.ambiguous);
  if (toDecompose) return { kind: "decompose", item: toDecompose };

  const needsExtension = backlog.find((i) => i.needsNewAction);
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

// ─── runnable demo (foreground loop): walk a few sample backlog states ───────
if (import.meta.main) {
  const samples: ReadonlyArray<{ label: string; backlog: BacklogItem[] }> = [
    {
      label: "a ready item beats everything",
      backlog: [
        { id: "B-0883", title: "encryption phase 2", ready: true, ambiguous: false },
        { id: "B-0867", title: "workflow engine", ready: false, ambiguous: true },
      ],
    },
    {
      label: "only ambiguous → decompose",
      backlog: [{ id: "B-0867", title: "workflow engine v1", ready: false, ambiguous: true }],
    },
    {
      label: "grammar can't express it → edit_grammar (not trapped)",
      backlog: [
        {
          id: "B-0999",
          title: "needs a 'merge duplicates' action",
          ready: false,
          ambiguous: false,
          needsNewAction: true,
        },
      ],
    },
    {
      label: "nothing actionable → free_time (valid, not a failure)",
      backlog: [{ id: "B-0500", title: "blocked on external dep", ready: false, ambiguous: false }],
    },
  ];

  console.log("observe.ts — 4-button autonomous-loop controller\n");
  for (const s of samples) {
    console.log(`• ${s.label}`);
    console.log(`    ${renderAction(observe(s.backlog))}\n`);
  }
}
