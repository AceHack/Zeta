#!/usr/bin/env bun
/**
 * agent-loop/cli.ts — the execute → menu → choose → append shell.
 *
 * ── THE LOOP THE README DESCRIBES, ACTUALLY RUNNING ──────────────────────────
 * *"Every invocation reads current state from Git, gets a menu (the 'choose-your-own-adventure
 * output'), returns a choice. Script executes choice + appends new state."* That sentence has been
 * in the README since the module was written, listed under v2 scope, unimplemented. This is it.
 *
 *   bun cli.ts --agent alexa --at 2026-09-03T10:00:00.000Z --root .agent-loop
 *   bun cli.ts --agent alexa --at ... --choose 0          # take the first option
 *   bun cli.ts --agent alexa --at ... --choose EnterFreeTime
 *   bun cli.ts --agent alexa --at ... --history
 *
 * ── WHY `--at` IS REQUIRED AND NOT DEFAULTED ─────────────────────────────────
 * `.claude/rules/local-time-never-enters-the-shared-fold.md`. The record's time decides its ZetaId,
 * which decides its path, so a clock read here would put the same logical cycle at different
 * addresses on different machines and make the store non-replayable. Time enters through the
 * command line — a declared channel — or the run refuses.
 *
 * ── THE CHOICE IS CLAMPED, NEVER TRUSTED ─────────────────────────────────────
 * `--choose` names an index or a tag. An index outside the menu is CLAMPED into it and the clamp is
 * reported; a tag that is not on the menu is refused rather than silently substituted. The menu is
 * the legal set and nothing gets to leave it — the same kernel the rest of this substrate uses.
 *
 * ── EXIT CODES ───────────────────────────────────────────────────────────────
 *   0  a cycle ran (or the history was printed)
 *   1  the run was refused — no `--at`, an unknown agent, a tag not on the menu
 *   2  the menu was COERCIVE. Loud and separate, because a menu with no way out is a different
 *      kind of wrong from a bad argument, and collapsing them would hide it behind user error.
 */

import { appendCycle, coerciveCycles, currentState, nextCycleNumber, readHistory, type CycleRecord } from "./state-store";
import { generateMenu, isNonCoercive, type NamedDependencyOffer } from "./menu-generator";
import { participantFromSpec, type AgentParticipant } from "./participant";
import { cycleClose, postResultTransition, transition } from "./state-machine";
import type { AgentPersona, AgentState, Lane, MenuOption, StatusSnapshot, WorkCandidate, WorkResult } from "./state-machine";

const PERSONAS: readonly AgentPersona[] = ["otto", "alexa", "riven", "vera", "lior", "aaron", "addison", "max"];

export interface CliArgs {
  readonly agent: AgentPersona;
  readonly at: string;
  readonly root: string;
  /** An index into the menu, or a `MenuOption` tag. Absent means "show the menu and stop". */
  readonly choose?: string;
  /**
   * Who picks: `oracle` (deterministic), `local-llm`, `local-llm:<model>`.
   *
   * Absent means nobody picks automatically — the menu is shown and `--choose` decides. A
   * participant is the model playing the selector half of the loop.
   */
  readonly participant?: string;
  readonly history: boolean;
  readonly json: boolean;
}

export type ArgsResult = { readonly ok: true; readonly args: CliArgs } | { readonly ok: false; readonly reason: string };

/** Parse argv. Refuses rather than defaulting anything that would be a claim. */
export function parseArgs(argv: readonly string[]): ArgsResult {
  const value = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const agent = value("--agent");
  if (agent === undefined) return { ok: false, reason: "--agent is required" };
  if (!PERSONAS.includes(agent as AgentPersona)) {
    return { ok: false, reason: `unknown agent '${agent}' (known: ${PERSONAS.join(", ")})` };
  }
  const at = value("--at");
  if (at === undefined) {
    // Not defaulted to now. See the header: the timestamp decides the record's address.
    return { ok: false, reason: "--at <iso8601> is required — this loop never reads a clock" };
  }
  if (Number.isNaN(Date.parse(at))) return { ok: false, reason: `--at '${at}' is not a parseable ISO-8601 instant` };

  const choose = value("--choose");
  const participant = value("--participant");
  if (participant !== undefined) {
    const resolved = participantFromSpec(participant);
    if (!resolved.ok) return { ok: false, reason: resolved.reason };
  }
  if (participant !== undefined && choose !== undefined) {
    // Both would mean two choosers for one cycle, and the run's record could only name one.
    return { ok: false, reason: "--participant and --choose both pick; give one" };
  }
  return {
    ok: true,
    args: {
      agent: agent as AgentPersona,
      at,
      root: value("--root") ?? ".agent-loop",
      ...(choose === undefined ? {} : { choose }),
      ...(participant === undefined ? {} : { participant }),
      history: argv.includes("--history"),
      json: argv.includes("--json"),
    },
  };
}

/**
 * Resolve `--choose` against the menu.
 *
 * An INDEX is clamped into range and the clamp is reported — a chooser asking for option 99 of 7 is
 * malfunctioning, and a caller who cannot see the clamp cannot notice, because the pick is still
 * legal. A TAG that is not on the menu is refused instead of clamped: an index is a position and
 * positions can be out of range, but a tag is a request for a specific thing, and quietly
 * substituting a different one would answer a question nobody asked.
 */
export function resolveChoice(
  menu: readonly MenuOption[],
  choose: string,
): { readonly ok: true; readonly option: MenuOption; readonly clamped: boolean } | { readonly ok: false; readonly reason: string } {
  if (menu.length === 0) return { ok: false, reason: "the menu is empty — there is nothing to choose" };
  const asIndex = Number(choose);
  if (Number.isFinite(asIndex) && choose.trim() !== "") {
    const raw = Math.trunc(asIndex) || 0;
    const idx = Math.max(0, Math.min(menu.length - 1, raw));
    const option = menu[idx];
    if (option === undefined) return { ok: false, reason: "clamp failed" };
    return { ok: true, option, clamped: idx !== raw };
  }
  const found: MenuOption | undefined = menu.find((o) => o.tag === choose);
  if (found === undefined) {
    return { ok: false, reason: `'${choose}' is not on this menu (offered: ${menu.map((o) => o.tag).join(", ")})` };
  }
  return { ok: true, option: found, clamped: false };
}

/**
 * A status surface for an agent with nothing else supplying one.
 *
 * Every DORA field is zero and every list empty — and that is deliberately NOT a claim that the
 * organization is idle. It is the absence of a surface. A real caller supplies one from
 * `corporate/agent-loop-bridge.ts`, which derives it from an actual run; this exists so the loop is
 * runnable standalone, and its emptiness is why `--json` reports `surface: "empty"`.
 */
export function emptySurface(at: string): StatusSnapshot {
  return {
    snapshotIso: at,
    currentDora: {
      deploymentCount: 0,
      leadTimeMedianSeconds: 0,
      changeFailureRate: 0,
      mttrMedianSeconds: 0,
      substrateRatio: 0,
    },
    hotTrajectories: [],
    coolingTrajectories: [],
    explorationCandidates: [],
    perAgentRatios: {},
  };
}

/**
 * The same state, carrying the cycle it is about to run.
 *
 * `transition` preserves the context by design — advancing the cycle is the shell's job, not the
 * state machine's. Nothing was doing it, so `AgentContext.cycle` sat at 0 forever while the record
 * beside it counted properly: two records of one fact, disagreeing, with the dead one embedded in
 * the state an agent carries. An agent that asked itself what cycle it was on got the wrong answer.
 */
export function withCycle(state: AgentState, cycle: number): AgentState {
  const context = { ...state.context, cycle };
  return { ...state, context } as AgentState;
}

export interface CycleOutcome {
  readonly menu: readonly MenuOption[];
  readonly state: AgentState;
  readonly nonCoercive: boolean;
  readonly chosen?: MenuOption;
  readonly clamped: boolean;
  readonly record?: CycleRecord;
  readonly refusals: readonly string[];
  /**
   * Live work the cycle switched away from without producing a result for it.
   *
   * `agent-loop-bridge.runAgentCycle` already reported this and the CLI path did not, so the same
   * churn was visible through one entry point and silent through the other — and the CLI is the one
   * with a model and a store behind it, which is exactly where it matters.
   */
  readonly abandonedWorkId?: string;
}

/**
 * Run one cycle. Pure apart from the state it is handed — the caller does the I/O.
 *
 * Split out from `main` so the whole loop is testable without a filesystem, which is the same
 * reason `state-machine.ts` is pure: the part that decides and the part that persists are different
 * jobs and only one of them needs a disk to be checked.
 */
export function runCycle(input: {
  readonly state: AgentState;
  readonly snapshot: StatusSnapshot;
  readonly candidates: readonly WorkCandidate[];
  readonly namedDeps: readonly NamedDependencyOffer[];
  readonly heartbeatLane: Lane;
  readonly at: string;
  readonly cycle: number;
  readonly choose?: string;
  readonly resultFor?: (option: MenuOption) => WorkResult | undefined;
  /**
   * A register narrowing the menu — the seam `loop-policy.ts` and `agent-loop-bridge.ts` already
   * provide, here for the shell.
   *
   * It is also the ONLY way a menu can become coercive: `generateMenu` cannot produce one, so
   * without this seam the coercion check below could never fire and its exit code would be
   * unreachable — a guard that cannot fail, guarding the property this design exists for.
   */
  readonly menuPolicy?: (menu: readonly MenuOption[]) => readonly MenuOption[];
}): CycleOutcome {
  const refusals: string[] = [];
  const offered = generateMenu({
    state: input.state,
    snapshot: input.snapshot,
    candidates: input.candidates,
    namedDeps: input.namedDeps,
    heartbeatLane: input.heartbeatLane,
  });
  // Narrowed after the core built it, and checked AFTER the narrowing — checking the core's own
  // output would grade the wrong menu, since the core is not what can take an option away.
  const menu = input.menuPolicy?.(offered) ?? offered;
  const nonCoercive = isNonCoercive(menu);
  if (!nonCoercive) refusals.push("the menu offered to this agent was COERCIVE — a free mode was missing");

  if (input.choose === undefined) {
    // Showing the menu is a legitimate outcome and is NOT recorded as a cycle: nothing happened,
    // and writing a record saying so would put a cycle in the history the agent never took.
    return { menu, state: input.state, nonCoercive, clamped: false, refusals };
  }

  const choice = resolveChoice(menu, input.choose);
  if (!choice.ok) {
    return { menu, state: input.state, nonCoercive, clamped: false, refusals: [...refusals, choice.reason] };
  }
  if (choice.clamped) refusals.push(`--choose ${input.choose} was clamped into the menu`);

  const inFlight = input.state.tag === "ExecutingWork" ? input.state.work.id : undefined;
  const acted = transition(input.state, choice.option);
  const result = input.resultFor?.(choice.option);
  const after = result === undefined ? acted : postResultTransition(acted, result);
  const state = cycleClose(after);

  // Switched away from live work with nothing recorded about it. The canonical `transition`
  // replaces `ExecutingWork`'s item and keeps no note of the one it dropped, so this does not
  // change the transition — it names what happened.
  const abandonedWorkId =
    inFlight !== undefined && choice.option.tag === "PickWork" && choice.option.work.id !== inFlight && result === undefined
      ? inFlight
      : undefined;

  const record: CycleRecord = {
    at: input.at,
    agent: state.context.agent,
    cycle: input.cycle,
    menuSize: menu.length,
    nonCoercive,
    chosen: choice.option,
    state,
    ...(abandonedWorkId === undefined ? {} : { abandonedWorkId }),
  };
  return {
    menu,
    state,
    nonCoercive,
    chosen: choice.option,
    clamped: choice.clamped,
    record,
    refusals,
    ...(abandonedWorkId === undefined ? {} : { abandonedWorkId }),
  };
}

/** What an embedder may supply. A bare CLI run passes nothing. */
/** What the agent is looking at this cycle: the status surface and the work it could pick up. */
export interface LoopSurface {
  readonly snapshot: StatusSnapshot;
  readonly candidates: readonly WorkCandidate[];
  readonly namedDeps?: readonly NamedDependencyOffer[];
  readonly heartbeatLane?: Lane;
}

export interface MainDeps {
  readonly menuPolicy?: (menu: readonly MenuOption[]) => readonly MenuOption[];
  /**
   * WHERE THE REAL WORK COMES FROM.
   *
   * Absent, the loop runs against `emptySurface` — no candidates, no DORA, no trajectories. That is
   * the honest standalone default and it was also, until this seam existed, the ONLY thing the loop
   * ever saw: a model could drive it and would never be offered a single piece of work, because
   * nothing could hand it any.
   *
   * The core cannot reach for an organization — `register-boundary.test.ts` forbids it, and rightly:
   * an organization is one thing that can supply a surface, not a property of the loop. So the core
   * offers the seam and a register fills it. `corporate/run-agent.ts` is the first filler.
   */
  readonly surface?: (at: string) => LoopSurface;
  /**
   * WHAT A CHOSEN SLOT ACTUALLY DOES.
   *
   * `runOneCycle` takes a SYNCHRONOUS `resultFor`, and `main` never supplied one — so a participant
   * choosing `PickWork` advanced the state machine to `ExecutingWork` and nothing happened: the
   * work was never done and never reported done. The sync shape is also why nothing could be
   * supplied honestly, since reaching a delivery pipeline is asynchronous; the only value that fits
   * a sync seam is one made up on the spot.
   *
   * So the seam is ASYNC and lives here, and `mainAsync` awaits it after the participant has
   * chosen. Like `surface`, the core defines the shape and a register fills it — the loop still
   * does not know an organization exists.
   *
   * Returning `undefined` is a real answer: nothing was dispatched, and the agent stays in
   * `ExecutingWork` with the work outstanding. That is what a shadow lane looks like, and it must
   * never be rounded to a success.
   */
  readonly dispatch?: (option: MenuOption) => Promise<WorkResult | undefined>;
}

/**
 * Let a PARTICIPANT choose, and turn its answer into the `--choose` the cycle already understands.
 *
 * An index, because that is the only authority a participant has: `chooseIndex` guarantees it is
 * inside the menu, so a model cannot invent an option or reach past the one it was shown.
 */
export async function chooseByParticipant(
  participant: AgentParticipant,
  state: AgentState,
  snapshot: StatusSnapshot,
  menu: readonly MenuOption[],
): Promise<{ readonly choose: string; readonly note: string }> {
  const choice = await participant.choose(state, snapshot, menu);
  const note =
    `${participant.name} chose ${choice.index} (${choice.option.tag})` +
    (choice.cause === "none" ? "" : `  [${choice.cause}; answered ${JSON.stringify(choice.raw)}]`);
  return { choose: String(choice.index), note };
}

/**
 * A choice already made by a participant, plus the line to print about it.
 *
 * Threaded in rather than re-derived, so the menu the participant SAW is the menu the cycle then
 * runs. Regenerating it here would open a gap where the two could differ and the recorded choice
 * would index a menu nobody was shown.
 */
export interface ResolvedChoice {
  readonly choose: string;
  readonly note: string;
  /**
   * What dispatching that choice produced, when a dispatcher ran.
   *
   * Threaded through the SAME pre-resolution seam as the choice itself, for the same reason: the
   * dispatch must act on the option the participant actually chose, and re-deriving it here would
   * open a gap where the two could differ. Absent means nothing was dispatched — never a success.
   */
  readonly result?: WorkResult;
}

export function main(argv: readonly string[], deps: MainDeps = {}, resolved?: ResolvedChoice): number {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    console.error(`refused: ${parsed.reason}`);
    return 1;
  }
  const args = parsed.args;

  if (args.history) {
    const history = readHistory(args.root, args.agent);
    if (args.json) {
      console.log(JSON.stringify(history, null, 2));
      return 0;
    }
    console.log(`${history.length} recorded cycle(s) for ${args.agent}`);
    for (const r of history) {
      console.log(
        `  cycle ${String(r.cycle).padStart(3)}  ${r.at}  ${(r.chosen?.tag ?? "(none)").padEnd(26)} → ${r.state.tag}` +
          (r.nonCoercive ? "" : "   COERCIVE") +
          (r.abandonedWorkId === undefined ? "" : `   abandoned ${r.abandonedWorkId}`),
      );
    }
    const coercive = coerciveCycles(history);
    if (coercive.length > 0) console.log(`  ${coercive.length} cycle(s) were offered a menu with no way out`);
    return 0;
  }

  // RESUME, or start. A fresh agent has no recorded state, and that is not an error — but it is
  // also not silently treated as a resume: the state is built here, once, and every later cycle
  // comes from the store.
  const resumed = currentState(args.root, args.agent);
  const cycle = nextCycleNumber(args.root, args.agent);
  const state = withCycle(
    resumed ?? { tag: "Idle", context: { agent: args.agent, cycle, sessionStartIso: args.at } },
    cycle,
  );

  const surface = deps.surface?.(args.at) ?? { snapshot: emptySurface(args.at), candidates: [] };
  const outcome = runCycle({
    state,
    snapshot: surface.snapshot,
    candidates: surface.candidates,
    namedDeps: surface.namedDeps ?? [],
    heartbeatLane: surface.heartbeatLane ?? "operational",
    at: args.at,
    cycle,
    ...(() => {
      const choose = resolved?.choose ?? args.choose;
      return choose === undefined ? {} : { choose };
    })(),
    ...(deps.menuPolicy === undefined ? {} : { menuPolicy: deps.menuPolicy }),
    // The dispatch already happened, in `mainAsync`, on this exact option. `runCycle` applies what
    // it produced; `undefined` closes no cycle and leaves the work outstanding, which is true.
    ...(resolved?.result === undefined ? {} : { resultFor: () => resolved.result }),
  });
  if (resolved !== undefined) console.log(`  ${resolved.note}`);

  if (outcome.record !== undefined) appendCycle(outcome.record, args.root);

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          resumed: resumed !== undefined,
          surface: "empty",
          cycle,
          menu: outcome.menu.map((o) => o.tag),
          chosen: outcome.chosen?.tag,
          state: outcome.state,
          nonCoercive: outcome.nonCoercive,
          abandonedWorkId: outcome.abandonedWorkId,
          refusals: outcome.refusals,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`${args.agent} — cycle ${cycle} (${resumed === undefined ? "fresh" : "resumed"}) at ${args.at}`);
    console.log(`  state in:  ${state.tag}`);
    outcome.menu.forEach((o, i) => console.log(`   ${String(i).padStart(2)}. ${o.tag}`));
    if (outcome.chosen === undefined) {
      console.log(`  (no --choose given; nothing was recorded)`);
    } else {
      console.log(`  chose:     ${outcome.chosen.tag}`);
      if (outcome.abandonedWorkId !== undefined) {
        console.log(`   ! abandoned '${outcome.abandonedWorkId}' with no result recorded`);
      }
      console.log(`  state out: ${outcome.state.tag}   recorded as cycle ${cycle}`);
    }
    for (const r of outcome.refusals) console.log(`   ! ${r}`);
  }

  // A coercive menu is its own exit code. Folding it into the generic failure code would hide the
  // one outcome this whole design exists to prevent behind ordinary user error.
  if (!outcome.nonCoercive) return 2;
  if (outcome.chosen === undefined && args.choose !== undefined) return 1;
  return 0;
}

/**
 * The full entry: resolves a `--participant` before running the cycle.
 *
 * Async only because a model is; the deterministic path is untouched and stays synchronous, so
 * nothing that did not ask for a model pays for one.
 */
export async function mainAsync(argv: readonly string[], deps: MainDeps = {}): Promise<number> {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    console.error(`refused: ${parsed.reason}`);
    return 1;
  }
  const args = parsed.args;
  if (args.participant === undefined || args.history) return main(argv, deps);

  const resolvedParticipant = participantFromSpec(args.participant);
  if (!resolvedParticipant.ok) {
    console.error(`refused: ${resolvedParticipant.reason}`);
    return 1;
  }

  // The participant is shown EXACTLY the menu the cycle will run, built from the same state.
  const state = withCycle(
    currentState(args.root, args.agent) ?? {
      tag: "Idle",
      context: { agent: args.agent, cycle: 1, sessionStartIso: args.at },
    },
    nextCycleNumber(args.root, args.agent),
  );
  // The participant is shown the SAME surface the cycle will run, from the same provider. Calling
  // it twice would let the menu it saw differ from the menu that then ran.
  const surface = deps.surface?.(args.at) ?? { snapshot: emptySurface(args.at), candidates: [] };
  const offered = generateMenu({
    state,
    snapshot: surface.snapshot,
    candidates: surface.candidates,
    namedDeps: surface.namedDeps ?? [],
    heartbeatLane: surface.heartbeatLane ?? "operational",
  });
  const menu = deps.menuPolicy?.(offered) ?? offered;
  if (menu.length === 0) {
    console.error("refused: the menu is empty — there is nothing for a participant to choose");
    return 1;
  }

  const choice = await chooseByParticipant(resolvedParticipant.participant, state, surface.snapshot, menu);
  // THE DISPATCH — after the participant chose, before the cycle closes. `menu[Number(choice.choose)]`
  // is the option it actually saw and picked, taken from the same menu rather than regenerated.
  const chosen = menu[Number(choice.choose)];
  const result = chosen === undefined ? undefined : await deps.dispatch?.(chosen);
  return main(argv, deps, { ...choice, ...(result === undefined ? {} : { result }) });
}

if (import.meta.main) {
  process.exit(await mainAsync(process.argv.slice(2)));
}
