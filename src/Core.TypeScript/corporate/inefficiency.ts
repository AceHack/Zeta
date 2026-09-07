/**
 * inefficiency.ts — the organization noticing that something keeps going wrong.
 *
 * ── WHAT THE DESIGN ASKS FOR, AND WHAT I GOT WRONG ───────────────────────────
 * `ORGANIZATION_RUNTIME_ARCHITECTURE.md` §"Workflow and Runtime Expansion":
 *
 *   > Agents should also be able to request new Temporal workflows, durable triggers, Dapr actors,
 *   > and scheduled automation when they discover **repeatable organizational inefficiency**.
 *
 * and its examples are all countable:
 *
 *   > Engineering Manager notices REPEATED review drift and requests `ReviewEscalationWorkflow`.
 *   > QA Engineering Manager notices REPEATED missed test coverage...
 *   > Security Manager notices REPEATED credential mistakes...
 *
 * `NORTH_STAR_ALIGNMENT_CHECKPOINT.md` says the same thing about the chain: *"escalate repeated
 * inefficiency through the management chain."*
 *
 * I had recorded `SuggestImprovement` as deliberately unsent, on the reasoning that an improvement
 * is "a judgement somebody chooses to offer" with no observable trigger. That was wrong, and it was
 * wrong in the way this register is least allowed to be: I asserted a limit about the design
 * without reading the part of the design that specifies it. The trigger is REPETITION, and
 * repetition is countable.
 *
 * ── THE DISTINCTION THAT MAKES THIS NOT AN ESCALATION ────────────────────────
 * An escalation is about ONE item that is stuck: this work cannot proceed, somebody decide. An
 * improvement is about the SAME friction recurring ACROSS items: the process itself is producing
 * this, and no per-item decision will stop the next one.
 *
 * So the unit of measurement is **distinct work items affected**, never occurrences. A gate that
 * rejects one item four times is a hard item — the churn detector and the escalation chain already
 * handle it, and reporting it as a process defect would blame the process for one difficult piece
 * of work. A gate that blocks four DIFFERENT items is the process.
 *
 * ── AND IT NAMES WHAT IT SAW, NOT WHAT TO DO ─────────────────────────────────
 * The finding carries the pattern and the items it recurred over. It does not propose the
 * workflow — the doc has a Director or a Manager deciding what to build, and a detector that
 * arrived with a solution would be making that call from the bottom of the chain with the least
 * context about what else the organization is already doing.
 */

import type { GateKind } from "./quality-gate";

/** How many DISTINCT work items must show the same friction before it is a pattern. */
export const RECURRENCE_THRESHOLD = 2;

export const InefficiencyKind = {
  /** The same gate blocked several different items — the doc's "repeated review drift". */
  GateDrift: "gate_drift",
  /** Several different items escalated — the process is producing decisions it cannot make. */
  EscalationDrift: "escalation_drift",
  /** The same refusal reason recurred across items — a rule the organization keeps hitting. */
  RepeatedRefusal: "repeated_refusal",
} as const;

export type InefficiencyKind = (typeof InefficiencyKind)[keyof typeof InefficiencyKind];

export interface Inefficiency {
  readonly kind: InefficiencyKind;
  /** The thing that recurred — a gate id, an escalation action, a refusal shape. */
  readonly pattern: string;
  /** The DISTINCT work items it affected. Its length is the measurement. */
  readonly workIds: readonly string[];
  /** One line naming what was seen, for the signal's message. */
  readonly summary: string;
}

export interface InefficiencyInput {
  readonly gateBlocked: readonly { readonly taskId: string; readonly gate: GateKind }[];
  readonly escalations: readonly { readonly taskId: string; readonly action: string }[];
  readonly refusals: readonly string[];
}

/**
 * What kept going wrong in this run.
 *
 * Ordered by how many items each pattern touched, most first — so a caller reporting only the
 * worst reports the one affecting the most work. Ties break ORDINALLY on the pattern, because two
 * patterns affecting the same number of items must not be ordered by which was found first.
 */
export function findInefficiencies(input: InefficiencyInput): readonly Inefficiency[] {
  const out: Inefficiency[] = [];

  const byGate = new Map<string, Set<string>>();
  for (const b of input.gateBlocked) {
    // A SET, so one item blocking at one gate four times counts once. Occurrences are churn;
    // distinct items are a pattern, and conflating them would report every hard task as a process
    // defect.
    if (!byGate.has(b.gate)) byGate.set(b.gate, new Set());
    byGate.get(b.gate)!.add(b.taskId);
  }
  for (const [gate, items] of byGate) {
    if (items.size < RECURRENCE_THRESHOLD) continue;
    const workIds = ordinal([...items]);
    out.push({
      kind: InefficiencyKind.GateDrift,
      pattern: gate,
      workIds,
      summary: `'${gate}' blocked ${String(workIds.length)} different work item(s)`,
    });
  }

  const byAction = new Map<string, Set<string>>();
  for (const e of input.escalations) {
    if (!byAction.has(e.action)) byAction.set(e.action, new Set());
    byAction.get(e.action)!.add(e.taskId);
  }
  for (const [action, items] of byAction) {
    if (items.size < RECURRENCE_THRESHOLD) continue;
    const workIds = ordinal([...items]);
    out.push({
      kind: InefficiencyKind.EscalationDrift,
      pattern: action,
      workIds,
      summary: `${String(workIds.length)} work item(s) escalated to '${action}'`,
    });
  }

  const byRefusal = new Map<string, Set<string>>();
  for (const r of input.refusals) {
    const shape = refusalShape(r);
    if (shape === undefined) continue;
    if (!byRefusal.has(shape.pattern)) byRefusal.set(shape.pattern, new Set());
    byRefusal.get(shape.pattern)!.add(shape.workId);
  }
  for (const [pattern, items] of byRefusal) {
    if (items.size < RECURRENCE_THRESHOLD) continue;
    const workIds = ordinal([...items]);
    out.push({
      kind: InefficiencyKind.RepeatedRefusal,
      pattern,
      workIds,
      summary: `'${pattern}' refused ${String(workIds.length)} different work item(s)`,
    });
  }

  return [...out].sort(
    (a, b) =>
      b.workIds.length - a.workIds.length ||
      (a.pattern < b.pattern ? -1 : a.pattern > b.pattern ? 1 : 0),
  );
}

/**
 * The SHAPE of a refusal — what recurred, separated from which item it happened to.
 *
 * Refusals are prose (`gates for task-013: producer 'command' ... could not run`), so grouping them
 * verbatim would put every item in its own bucket and find no pattern at all. The work id is
 * stripped out and the rest is the shape.
 *
 * `undefined` for a refusal naming no work item: an organization-level refusal happened once, to
 * nobody in particular, and counting it as a recurrence across items would be counting one thing
 * as many.
 */
function refusalShape(refusal: string): { readonly pattern: string; readonly workId: string } | undefined {
  const m = /\b(task-[A-Za-z0-9_-]+)\b/.exec(refusal);
  if (m === null) return undefined;
  const workId = m[1]!;
  // Every id replaced, not just the first: a refusal naming two items would otherwise keep the
  // second and split the pattern in two.
  const pattern = refusal.replace(/\btask-[A-Za-z0-9_-]+\b/g, "<item>").trim();
  return { pattern, workId };
}

/** ORDINAL. Two machines reporting the same pattern must list its items in the same order. */
function ordinal(xs: readonly string[]): readonly string[] {
  return [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
