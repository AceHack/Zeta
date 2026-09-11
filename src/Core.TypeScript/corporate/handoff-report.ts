/**
 * handoff-report.ts — what a run's summary says about changes that are in front of people.
 *
 * MEASURED 2026-09-11 on the Agentic Team's agentic-tpm run: the organization followed up on three
 * open merge requests, pushed a review fix to one of them and merged nothing - and the log opened
 * with `=== DELIVERED ===` and closed with `task-040: Merged (... → Approve → Merge)`. Both were
 * read off the organization's own model of the work, in which "every gate approved" is the state
 * called Merged; under `delivery=human_review` that is exactly the moment the change is handed to
 * a person instead. A reader of the log had to check GitLab to learn that nothing had merged.
 *
 * So the summary asks the RECORD: a change handed off - in this run, or in an earlier one that
 * this run followed up - and not landed by the organization is awaiting human review, whatever the
 * internal model calls it.
 */

export interface ChangeLine {
  readonly workId: string;
  readonly state: string;
  readonly applied: readonly string[];
}

/**
 * The changes this run touched that are in front of people. `handedOffOnRecord` is every work id
 * with a `change_handed_off` fact in the store; it is narrowed to the changes this run reports, so
 * an unrelated handoff from another run of the same store is not claimed as this run's outcome.
 */
export function awaitingHumanReview(input: {
  readonly changes: readonly { readonly workId: string }[];
  readonly handedOffThisRun: readonly string[];
  readonly handedOffOnRecord: ReadonlySet<string>;
  readonly landed: readonly string[];
}): readonly string[] {
  const touched = new Set(input.changes.map((c) => c.workId));
  const out = new Set(input.handedOffThisRun);
  for (const w of input.handedOffOnRecord) if (touched.has(w)) out.add(w);
  return [...out].filter((w) => !input.landed.includes(w));
}

/**
 * One change as the summary prints it. A change in front of people is never printed as Merged: its
 * state says where it is, and its last step is the handoff that replaced the merge.
 */
export function describeChangeLine(c: ChangeLine, awaiting: readonly string[]): string {
  if (!awaiting.includes(c.workId)) return `${c.workId}: ${c.state}   (${c.applied.join(" → ")})`;
  const steps = [...c.applied];
  if (steps[steps.length - 1] === "Merge") steps[steps.length - 1] = "HandOff";
  return `${c.workId}: awaiting human review - nothing was merged   (${steps.join(" → ")})`;
}
