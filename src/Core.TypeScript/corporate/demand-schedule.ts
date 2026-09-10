/**
 * corporate/demand-schedule.ts — ready gate steps become calendar blocks.
 *
 * ── THE MIDDLE OF THE INVERSION ──────────────────────────────────────────────
 * `gate-demand.ts` says WHAT the organization owes. `room-runtime` executes ONE step when an agent
 * reaches its slot. This is the piece between them: it takes the ready demand and books it onto
 * agents' calendars, which is what makes the calendar the execution mechanism rather than a picture
 * of one.
 *
 * ── WHY NOT `bookReviewBlocks` ───────────────────────────────────────────────
 * That function already books gate work, and it is the right shape for what it does: ONE item's
 * whole chain, laid END TO END from a cursor, as a plan of that item's review sequence. Every
 * assumption in that sentence is the pipeline shape — it presumes an item is walked start to finish
 * and that the sequence is known in advance.
 *
 * Demand is the other shape. Many items, ONE step each (`gate-demand` guarantees at most one per
 * item), and the question is not "when will this item's gates happen" but "who is free to take this
 * step next". So blocks are placed at each hat's own next free slot rather than end to end, and the
 * ordering across items is a scheduling decision instead of an item's internal sequence.
 *
 * Both survive. `bookReviewBlocks` still answers "is this item's chain runnable at all", which is
 * worth knowing before starting. This answers "what is the org doing this hour".
 *
 * ── A HAT IS NOT A WEARER, AND BOOKING ONE IS NOT STAFFING IT ────────────────
 * The chain from a ready step to an agent doing it has three links, not one:
 *
 *     ready gate step  ->  RMO provisions the HAT  ->  TPM assigns an AGENT to it  ->  block
 *
 * A hat with no authorizing binding is a role nobody is wearing. Booking a block on it produces a
 * calendar entry no agent will ever wake up to — the appointment exists, the attendee does not.
 * So an unstaffed hat is NOT a refusal here: it is demand for PROVISIONING, reported separately in
 * `provisioning` so the RMO can act on it and the step can be booked on the next pass. Collapsing
 * that into "could not schedule" would have hidden the org's actual bottleneck (nobody is wearing
 * the hat) behind a message about calendars.
 *
 * ── SCOPE, STATED SO IT IS NOT MISTAKEN FOR MORE ─────────────────────────────
 * This books the JUDGEMENT of each ready gate — the control, held by a hat with that approval
 * scope, excluding whoever did the work. Producing the artifact a gate judges is separate work on a
 * `PrioritizedWork` block, and conflating the two would put an architect's design session and the
 * review of that design on the same slot under the same name.
 */

import type { GateStep } from "./gate-demand";
import { isAuthorizing, type HatBinding } from "./hat-binding";
import type { OrgChart } from "./org-chart";
import { gateOwners } from "./quality-gate";
import {
  firstCommonFreeSlot,
  scheduleBlock,
  ScheduleBlockState,
  ScheduleBlockType,
  type Calendar,
  type ScheduleBlock,
} from "./work-schedule";

/** A step that found a staffed hat and a slot. */
export interface StepAssignment {
  readonly step: GateStep;
  readonly hatId: string;
  /**
   * The agent wearing that hat — WHO will actually wake up to this block.
   *
   * The calendar is keyed by hat, because the authority to judge a gate belongs to the role rather
   * than the person. But a schedule that only names roles cannot answer "what am I doing today" for
   * an agent, which is the question `observe` asks on wake.
   */
  readonly wearerAgentId?: string;
  readonly block: ScheduleBlock;
}

/**
 * A step nobody could take, and why.
 *
 * Never dropped. An organization with fourteen ready steps and eleven unbookable is in a specific,
 * fixable state — usually one hat holding a scope alone — and a scheduler that returned only the
 * three it managed would report that as a quiet day.
 */
export interface UnscheduledStep {
  readonly step: GateStep;
  readonly because: string;
}

/**
 * A step whose gate has an owner in the chart, but nobody is currently wearing that hat.
 *
 * The RMO's input. This is not a failure — it is the organization discovering it needs a role
 * staffed, which is exactly the signal `requiredSupply` and `decideSupply` exist to consume. Kept
 * apart from `unscheduled` because the two want opposite responses: provision a wearer, versus
 * wait for a calendar to clear.
 */
export interface ProvisionRequest {
  readonly step: GateStep;
  /** The hats that could judge this gate, none of them currently worn. */
  readonly hatIds: readonly string[];
  readonly because: string;
}

export interface DemandScheduleResult {
  readonly calendar: Calendar;
  readonly scheduled: readonly StepAssignment[];
  readonly unscheduled: readonly UnscheduledStep[];
  /** Steps waiting on a hat being staffed, for the RMO to provision. */
  readonly provisioning: readonly ProvisionRequest[];
}

/**
 * The order steps are offered slots in, when the caller supplies no ranking.
 *
 * REWORK FIRST, and this is the only opinion the default holds. A gate that came back is blocking
 * work the organization has ALREADY paid for; leaving it behind fresh demand is how an org fills up
 * with items that are ninety percent done. Beyond that the order is stable — the caller's own
 * order, preserved — because a scheduler inventing a priority it was not given is exactly the
 * hidden policy this register keeps out of defaults. `prioritization.ts` is where a real ranking
 * comes from, and it is injected rather than assumed.
 */
export function reworkFirst(a: GateStep, b: GateStep): number {
  if (a.rework !== b.rework) return a.rework ? -1 : 1;
  return 0;
}

export interface DemandScheduleInput {
  readonly chart: OrgChart;
  readonly calendar: Calendar;
  /** The ready steps from `gateDemand`. */
  readonly demand: readonly GateStep[];
  /** The window to book inside. A step that does not fit in it is reported, never pushed past it. */
  readonly fromMs: number;
  readonly untilMs: number;
  readonly blockMs: number;
  readonly createId: (prefix: string) => string;
  /**
   * How far apart candidate start times are tried. Defaults to `blockMs`, which packs blocks
   * without overlap; a smaller step finds tighter gaps between existing commitments.
   */
  readonly stepMs?: number;
  /**
   * Who DID the work this gate judges, so they can be excluded from judging it.
   *
   * Optional because the caller may genuinely not know — but when it is absent a hat can be booked
   * to review its own work, and `evaluateGate` will then refuse at execution time. Supplying it
   * turns a refusal at the slot into a refusal at the plan, which is hours earlier and free.
   */
  readonly proposerOf?: (step: GateStep) => string | undefined;
  /** A real ranking, e.g. from `prioritization.ts`. Lower sorts earlier. */
  readonly rankOf?: (step: GateStep) => number;
  /**
   * Who is wearing what, right now.
   *
   * REQUIRED, and deliberately not optional. Defaulting to "assume every hat is staffed" would let
   * this book blocks on roles nobody wears and report a full schedule — the reader-with-no-writer
   * failure, in calendar form. A caller with genuinely no bindings passes `[]` and gets every step
   * back as a provisioning request, which is the honest answer for an organization that has not
   * staffed anybody yet.
   */
  readonly bindings: readonly HatBinding[];
  /** The instant the schedule is being planned at; decides which bindings are authorizing. */
  readonly nowMs: number;
}

/**
 * Book every ready step that can be booked, and say why the rest could not.
 *
 * Each step is placed at the FIRST free slot of an eligible hat inside the window. Eligible hats are
 * tried in chart order, so a step is only unbookable when NONE of them has room — a hat being busy
 * moves the step to a colleague rather than dropping it, which is the free-flowing half of the
 * design: the work is fixed, who does it is not.
 */
export function scheduleDemand(input: DemandScheduleInput): DemandScheduleResult {
  const stepMs = input.stepMs ?? input.blockMs;
  let calendar = input.calendar;
  const scheduled: StepAssignment[] = [];
  const unscheduled: UnscheduledStep[] = [];
  const provisioning: ProvisionRequest[] = [];

  if (input.blockMs <= 0 || stepMs <= 0 || input.untilMs <= input.fromMs) {
    return {
      calendar,
      scheduled: [],
      provisioning: [],
      unscheduled: input.demand.map((step) => ({
        step,
        because: "the scheduling window is empty or the block length is not positive",
      })),
    };
  }

  // Who is actually wearing a hat at `nowMs`. A binding that is warming up, expired or released
  // does not count — `isAuthorizing` is the same predicate the gate evaluator uses, so a hat that
  // could not approve the gate at execution time is not booked for it at plan time either.
  const worn = new Set(
    input.bindings.filter((b) => isAuthorizing(b, input.nowMs)).map((b) => b.hatId),
  );
  const wearerOf = new Map(
    input.bindings.filter((b) => isAuthorizing(b, input.nowMs)).map((b) => [b.hatId, b.wearerAgentId]),
  );

  // Sorted on a COPY. Sorting the caller's array in place would reorder the demand list it is still
  // holding, and a scheduler that mutates its input is a defect waiting for a second reader.
  const rank = input.rankOf;
  const ordered = [...input.demand].sort((a, b) => {
    if (rank !== undefined) {
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
    }
    return reworkFirst(a, b);
  });

  for (const step of ordered) {
    const proposer = input.proposerOf?.(step);
    const owners = gateOwners(input.chart, step.gate);
    const eligible = owners.filter((h) => h.id !== proposer);

    if (owners.length === 0) {
      unscheduled.push({
        step,
        because: `no hat in this chart holds '${step.gate}', so nobody can judge it`,
      });
      continue;
    }
    if (eligible.length === 0) {
      unscheduled.push({
        step,
        because:
          `the only hat holding '${step.gate}' is '${String(proposer)}', which did the work — ` +
          `it cannot judge its own`,
      });
      continue;
    }

    // THE PROVISIONING FORK. Eligible hats that nobody is wearing cannot take the step, and saying
    // so as a scheduling failure would name the wrong problem entirely.
    const staffed = eligible.filter((h) => worn.has(h.id));
    if (staffed.length === 0) {
      provisioning.push({
        step,
        hatIds: eligible.map((h) => h.id),
        because:
          `'${step.gate}' is held by ${eligible.map((h) => h.id).join(", ")}, and no agent is ` +
          `currently wearing ${eligible.length === 1 ? "it" : "any of them"}`,
      });
      continue;
    }

    let placed = false;
    for (const hat of staffed) {
      const start = firstCommonFreeSlot(
        calendar,
        [hat.id],
        input.fromMs,
        input.untilMs,
        input.blockMs,
        stepMs,
      );
      if (start === undefined) continue;

      const block: ScheduleBlock = {
        blockId: input.createId("step"),
        hatId: hat.id,
        blockType: ScheduleBlockType.Review,
        startMs: start,
        endMs: start + input.blockMs,
        state: ScheduleBlockState.Scheduled,
        workItemId: step.workId,
      };
      const r = scheduleBlock(calendar, block);
      if (!r.ok) continue;

      calendar = r.calendar;
      scheduled.push({
        step,
        hatId: hat.id,
        block,
        ...(wearerOf.get(hat.id) === undefined ? {} : { wearerAgentId: wearerOf.get(hat.id)! }),
      });
      placed = true;
      break;
    }

    if (!placed) {
      unscheduled.push({
        step,
        because:
          `every staffed hat holding '${step.gate}' (${staffed.map((h) => h.id).join(", ")}) is ` +
          `booked solid for the whole window`,
      });
    }
  }

  return { calendar, scheduled, unscheduled, provisioning };
}

/** What one hat was booked to do in this pass — for `org agenda --hat architect`. */
export function assignmentsFor(
  result: DemandScheduleResult,
  hatId: string,
): readonly StepAssignment[] {
  return result.scheduled
    .filter((a) => a.hatId === hatId)
    .slice()
    .sort((a, b) => a.block.startMs - b.block.startMs);
}

/**
 * What one AGENT was booked to do — the question `observe` asks on wake.
 *
 * By wearer rather than by hat, because an agent can hold more than one and wakes up as itself. An
 * agent asking "what is on my calendar" gets its whole day across every hat it wears, in time
 * order, which is the only form of that answer it can act on.
 */
export function agendaForAgent(
  result: DemandScheduleResult,
  agentId: string,
): readonly StepAssignment[] {
  return result.scheduled
    .filter((a) => a.wearerAgentId === agentId)
    .slice()
    .sort((a, b) => a.block.startMs - b.block.startMs);
}

/**
 * How much of the ready demand actually found a slot, as a fraction.
 *
 * The number worth watching. Demand the organization cannot schedule is demand it is not doing,
 * and a run that books three of thirty steps looks identical to a healthy one in any report that
 * only counts what was booked. Returns 1 for empty demand — nothing owed is fully served, and a
 * zero there would read as total failure on an idle org.
 */
export function coverage(result: DemandScheduleResult): number {
  const total = result.scheduled.length + result.unscheduled.length + result.provisioning.length;
  return total === 0 ? 1 : result.scheduled.length / total;
}

/**
 * The hats the RMO should staff, most-demanded first.
 *
 * Aggregated across steps rather than reported per step, because provisioning is a decision about a
 * ROLE: three steps blocked on `architect` is one hiring decision, not three. The count is what
 * `requiredSupply` wants — how much work is waiting on this hat existing.
 */
export function hatsToProvision(
  result: DemandScheduleResult,
): readonly { readonly hatId: string; readonly waiting: number }[] {
  const counts = new Map<string, number>();
  for (const req of result.provisioning) {
    for (const hatId of req.hatIds) counts.set(hatId, (counts.get(hatId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([hatId, waiting]) => ({ hatId, waiting }))
    .sort((a, b) => (b.waiting - a.waiting) || a.hatId.localeCompare(b.hatId));
}
