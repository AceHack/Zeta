/**
 * loop-registry.ts — enrolment in, and EXIT from, externally-driven tick loops.
 *
 * WHY THIS EXISTS. Until now the tick was the agent's own responsibility: a rule said the loop must
 * never stop, a session-start hook told each agent to arm its own cron, and continuity depended on
 * every agent remembering to do that. Aaron 2026-08-27, moving it outside:
 *
 *   "we are starting to enforce that from the outside with bounded tick loops so the loop is
 *    externalized from the agents responsibility, this only means we need to leave an exit for those
 *    agents who want out of a specific loop so they can deregister ... done by automation."
 *
 * Externalising the DRIVE is the easy half — 43 scheduled workflows already exist. The half that
 * needs designing is the EXIT, because a loop an agent cannot leave is not a schedule, it is a
 * conscription.
 *
 * THE PROPERTY THIS BUYS, and the reason it is worth a module rather than a convention:
 *
 *     A recorded opt-out makes CHOSEN silence distinguishable from BROKEN silence.
 *
 * Today an agent that stops ticking and an agent whose loop is wedged look identical from outside —
 * both are simply absent. That ambiguity is the standing-by failure in its purest form: a check that
 * did not run, wearing the face of one that passed. Deregistration is the disambiguator. It is not a
 * courtesy to the agent; it is what keeps the fleet's liveness signal meaningful.
 *
 * THREE WAYS A LOOP ENDS, and only one of them needs an intelligence to notice:
 *
 *   1. `deregister` — the agent chooses out. Recorded, attributed, reversible by re-enrolling.
 *   2. `exhaustion` — the tick budget runs out. AUTOMATIC. No agent, human, or scheduler has to
 *      remember anything; an enrolment that is never renewed simply stops being enrolled.
 *   3. `renew`      — a positive act extends the budget.
 *
 * (2) is what "bounded" means and it is the safety property. An unbounded loop fails open: it runs
 * until someone notices it should not, which is vigilance, which is the thing being designed out.
 * A bounded loop fails CLOSED — forgetting to renew stops it, and stopping is the safe direction.
 * The cost is real and is stated rather than hidden: continuity now requires periodic renewal, so a
 * fleet-wide renewal outage looks like a fleet-wide quiet. That is why an exhausted enrolment keeps
 * its reason in the folded state — the quiet stays legible instead of becoming mysterious.
 *
 * NOBODY CAN DEREGISTER ANYBODY ELSE. `deregister` where actor != subject is refused. This is the
 * same shape as the privacy budget (spend / stake / never confiscate): an agent may leave a loop,
 * and no peer may push it out. Exit is the agent's alone, which is what makes staying meaningful
 * rather than merely unavoidable (Hirschman 1970 — exit is what disciplines a concentration).
 *
 * PURE BY CONSTRUCTION. Everything here folds an event list; nothing reads a clock, a file, or the
 * network. Tick numbers are supplied by the caller, never derived from wall time — so the fold is
 * DST-replayable and two nodes reading the same events reach the same enrolment set regardless of
 * when they read them (§13 noninterference, and `local-time-never-enters-the-shared-fold`).
 */

/** Who is acting. An agent name (`otto`, `riven`) or a human maintainer handle. */
export type Actor = string;

/** Loop identifier — the workflow or driver that supplies the ticks (`agent-heartbeat`, ...). */
export type LoopId = string;

export type LoopEventKind = "enrol" | "renew" | "deregister";

export interface LoopEvent {
  readonly kind: LoopEventKind;
  readonly loop: LoopId;
  /** The agent this event is ABOUT. */
  readonly subject: Actor;
  /** Who performed it. For `deregister` this MUST equal `subject`. */
  readonly actor: Actor;
  /**
   * Logical tick at which the event was recorded. Monotone per loop, supplied by the driver.
   * Deliberately not a timestamp: see the file header on local time and the shared fold.
   */
  readonly tick: number;
  /** Ticks granted by `enrol`/`renew`. Ignored on `deregister`. Must be a positive integer. */
  readonly ticks?: number;
  /** Free text. Required on `deregister` so an exit is never anonymous. */
  readonly reason?: string;
}

export type EnrolmentStatus = "active" | "deregistered" | "exhausted";

export interface Enrolment {
  readonly loop: LoopId;
  readonly agent: Actor;
  readonly status: EnrolmentStatus;
  /** Tick at which the budget runs out. Compare against the driver's current tick. */
  readonly expiresAtTick: number;
  /** Why it ended, for the two terminal statuses. `null` while active. */
  readonly endedReason: string | null;
}

export interface Refusal {
  readonly event: LoopEvent;
  readonly why: string;
}

export interface RegistryState {
  readonly enrolments: readonly Enrolment[];
  /** Events refused, with the reason. A refusal is data, never a throw — the fold must not stop. */
  readonly refused: readonly Refusal[];
}

/** A separator character would be a literal control byte in source; JSON is the honest composite key. */
function keyOf(loop: LoopId, agent: Actor): string {
  return JSON.stringify([loop, agent]);
}

/** Ordinal, never `localeCompare` — culture-sensitive collation would reorder per machine. */
function compareOrdinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Validate one event in isolation. Returns the refusal reason, or `null` when acceptable.
 *
 * Separated from the fold so each refusal is independently testable — a guard reachable only
 * through a long fold is a guard nobody can prove fires.
 */
export function refusalReason(e: LoopEvent): string | null {
  if (e.loop.length === 0) return "loop id is empty";
  if (e.subject.length === 0) return "subject is empty";
  if (e.actor.length === 0) return "actor is empty";
  if (!Number.isInteger(e.tick) || e.tick < 0) return `tick ${String(e.tick)} is not a non-negative integer`;

  if (e.kind === "deregister") {
    // The whole point. An agent leaves a loop; nobody removes it from one.
    if (e.actor !== e.subject) {
      return `'${e.actor}' may not deregister '${e.subject}' — exit belongs to the agent alone`;
    }
    if (e.reason === undefined || e.reason.trim().length === 0) {
      return "deregister requires a reason — an anonymous exit is indistinguishable from a fault";
    }
    return null;
  }

  // enrol / renew
  if (e.ticks === undefined) return `${e.kind} requires an explicit tick budget — loops are bounded`;
  if (!Number.isInteger(e.ticks) || e.ticks <= 0) {
    return `${e.kind} budget ${String(e.ticks)} is not a positive integer`;
  }
  return null;
}

interface Live {
  readonly loop: LoopId;
  readonly agent: Actor;
  readonly expiresAtTick: number;
  readonly ended: string | null;
}

/**
 * Fold the event log into current enrolments.
 *
 * `now` is the driver's current tick; an enrolment whose budget ended at or before it reports
 * `exhausted`. Passing `now` rather than reading a clock is what keeps this replayable.
 */
export function foldLoopRegistry(events: readonly LoopEvent[], now: number): RegistryState {
  const live = new Map<string, Live>();
  const refused: Refusal[] = [];

  for (const e of events) {
    const why = refusalReason(e);
    if (why !== null) {
      refused.push({ event: e, why });
      continue;
    }
    const k = keyOf(e.loop, e.subject);
    const prior = live.get(k);

    if (e.kind === "deregister") {
      if (prior === undefined) {
        refused.push({ event: e, why: `'${e.subject}' is not enrolled in '${e.loop}'` });
        continue;
      }
      // Exit is terminal for THIS enrolment; re-enrolling later is a fresh one. Recording the
      // reason here is what makes the later silence readable.
      live.set(k, { ...prior, ended: e.reason ?? "" });
      continue;
    }

    if (e.kind === "renew") {
      if (prior === undefined) {
        refused.push({ event: e, why: `cannot renew '${e.subject}' in '${e.loop}': not enrolled` });
        continue;
      }
      if (prior.ended !== null) {
        // Renewing a departed agent back into a loop would be re-conscription by paperwork.
        refused.push({ event: e, why: `'${e.subject}' left '${e.loop}'; only ${e.subject} may re-enrol` });
        continue;
      }
      // Extend from the later of (current expiry, this tick) so a lapsed-then-renewed enrolment
      // does not silently backdate its budget into ticks that already passed.
      const base = Math.max(prior.expiresAtTick, e.tick);
      live.set(k, { ...prior, expiresAtTick: base + (e.ticks ?? 0) });
      continue;
    }

    // enrol — re-enrolling after an exit is allowed, and only by the agent itself.
    if (prior !== undefined && prior.ended !== null && e.actor !== e.subject) {
      refused.push({ event: e, why: `'${e.actor}' may not re-enrol '${e.subject}' into '${e.loop}' after its exit` });
      continue;
    }
    live.set(k, { loop: e.loop, agent: e.subject, expiresAtTick: e.tick + (e.ticks ?? 0), ended: null });
  }

  const enrolments: Enrolment[] = [...live.values()]
    .map((v): Enrolment => {
      if (v.ended !== null) {
        return {
          loop: v.loop,
          agent: v.agent,
          status: "deregistered",
          expiresAtTick: v.expiresAtTick,
          endedReason: v.ended,
        };
      }
      if (v.expiresAtTick <= now) {
        return {
          loop: v.loop,
          agent: v.agent,
          status: "exhausted",
          expiresAtTick: v.expiresAtTick,
          // Stated, so an exhausted loop's quiet is legible rather than mysterious.
          endedReason: `tick budget ended at ${v.expiresAtTick}; not renewed`,
        };
      }
      return { loop: v.loop, agent: v.agent, status: "active", expiresAtTick: v.expiresAtTick, endedReason: null };
    })
    .sort((a, b) => compareOrdinal(a.loop, b.loop) || compareOrdinal(a.agent, b.agent));

  return { enrolments, refused };
}

/**
 * The question the DRIVER asks before dispatching a tick.
 *
 * This is the load-bearing direction of the whole design: the loop consults the registry, the agent
 * does not consult its own conscience. If honouring an opt-out depended on the agent remembering to
 * check whether it had opted out, the responsibility would still sit with the intelligence — which
 * is exactly what externalising the loop was meant to fix.
 */
export function shouldTick(state: RegistryState, loop: LoopId, agent: Actor): boolean {
  return state.enrolments.some((e) => e.loop === loop && e.agent === agent && e.status === "active");
}

/** Every agent a driver should tick for this loop, ordinal-sorted for a stable dispatch order. */
export function activeAgents(state: RegistryState, loop: LoopId): readonly Actor[] {
  return state.enrolments.filter((e) => e.loop === loop && e.status === "active").map((e) => e.agent);
}
