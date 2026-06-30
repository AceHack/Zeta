// tools/accelerator/move-next-harness.ts
//
// PR-less git-monster accelerator — Action Item 3: the move-next harness.
// The deterministic-script half of the agent loop (per B-0867 / B-0874):
//   read current state from the git-event-store → generate a menu →
//   a selector picks a MenuOption → apply transition() → append the new
//   event to the store. The LLM is a pure selector (the `selectMove` seam);
//   this harness holds the state machine + the I/O.
//
// SAFETY (be-good-to-our-host, per docs/accelerator/README.md):
//   - Bounded iterations: --max-iterations is HARD-CLAMPED to MAX_ITERATIONS.
//   - Kill-switch: an `events/_HALT` sentinel file stops the loop immediately.
//   - Append-only: only writes new event files; never rewrites/force-anything.
//   - --dry-run: compute + log, write nothing.
//   - git commit/push is NOT done here — that's the workflow's job (one
//     append-only commit per run), so this module is pure file-I/O + testable.
//
// Composes with:
//   - tools/accelerator/event-store-schema.ts (the @1 event envelope)
//   - tools/agent-loop/state-machine.ts (AgentState/MenuOption DUs + transition)
//   - .github/workflows/accelerator-move-next.yml (bounded self-re-dispatch)

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  type AgentContext,
  type AgentPersona,
  type AgentState,
  type MenuOption,
  transition,
} from "../agent-loop/state-machine.ts";
import {
  type BuildDeps,
  type EventEnvelope,
  type IdSemantics,
  type TransitionEvent,
  type ZetaIdHex,
  eventPath,
  makeTransitionEvent,
  validateEnvelope,
} from "./event-store-schema.ts";
import {
  DEFAULT_ENV,
  type SimulationEnvironment,
  pack,
} from "../../src/Core.TypeScript/zeta-id/zeta-id.ts";
import {
  Category,
  Chromosome,
  Firefly,
  IdVersion,
  LocationHint,
  Persona,
} from "../../src/Core.TypeScript/zeta-id/types.ts";
import type {
  Authority,
  Milliseconds,
  ZetaObservation,
} from "../../src/Core.TypeScript/zeta-id/types.ts";

// ─── Hard safety bound (be-good-to-our-host) ─────────────────────────
export const MAX_ITERATIONS = 25; // hard cap; --max-iterations clamps to this
export const HALT_SENTINEL = "_HALT"; // events/_HALT stops the loop

// ─── Zeta-ID generation (the canonical 128-bit merge primitive, B-0893) ──
// Replaces the placeholder ULID with the cross-verified codec at
// src/Core.TypeScript/zeta-id/. The event id IS a real ZetaId, hex-serialized
// (32-char lowercase). version+timestamp live in the HIGH bits ⇒ hex order =
// chronological; the key now carries persona / category / authority / location
// (provenance in the key itself), not opaque timestamp+randomness.

/**
 * Map an accelerator agent → a canonical ZetaId persona.
 *
 * The canonical Persona vocabulary (shared C#/F#/TS, golden-vector cross-verified)
 * currently blesses only Aaron(1) + FireflyCoherence(2). The full agent roster
 * (otto/alexa/riven/vera/lior/addison/max) is NOT yet in the canonical enum, so
 * autonomous agents map to FireflyCoherence and the precise agent stays in the
 * event `agent` field + directory partition. FOLLOW-UP (cross-impl, golden-vector
 * touching): extend the canonical Persona enum with the agent roster to put the
 * exact agent into the key bits.
 */
function agentToPersona(agent: AgentPersona): Persona {
  return agent === "aaron" ? Persona.Aaron : Persona.FireflyCoherence;
}

const CATEGORY_BY_NAME: Record<IdSemantics["category"], Category> = {
  Observation: Category.Observation,
  Emission: Category.Emission,
  Workflow: Category.Workflow,
  Heartbeat: Category.Heartbeat,
};

/** Pack a real ZetaId for an event and hex-serialize it (32-char lowercase). */
export function packZetaIdHex(sem: IdSemantics, env: SimulationEnvironment = DEFAULT_ENV): ZetaIdHex {
  const obs: ZetaObservation = {
    version: IdVersion.V1,
    timestamp: Date.now() as Milliseconds,
    chromosome: Chromosome.MetaCoherence,
    category: CATEGORY_BY_NAME[sem.category],
    firefly: Firefly.NoDirective,
    authority: { type: sem.authority ?? "Simulated" } as Authority,
    persona: agentToPersona(sem.agent),
    momentum: { type: "Normal" },
    location: LocationHint.EastUS_VA1,
  };
  const id = pack(obs, env) as bigint;
  return id.toString(16).padStart(32, "0") as ZetaIdHex;
}

export const realDeps: BuildDeps = {
  newId: (sem) => packZetaIdHex(sem, DEFAULT_ENV),
  nowIso: () => new Date().toISOString(),
};

// ─── Structured logging (observability) ──────────────────────────────
// Surfaces the KEYS the agent uses each cycle so a run is auditable from the
// Action log alone (PR-less ⇒ review-by-observation, per the charter):
//   - agent      : the PARTITION key  → events/<agent>/      (single-writer)
//   - key        : the per-event ZetaId hex → events/<agent>/<key>.json (= id)
//   - keyFormat  : "zeta-id" (@2, canonical B-0893) or "ulid" (legacy @1). The
//                  ZetaId carries persona/category/authority/location in the key.
//   - prev       : the causal-link key (previous event id in THIS agent's stream).
// Logs go to STDERR so STDOUT stays the clean, parseable cycle summary.
export type Logger = (entry: Record<string, unknown>) => void;

/** Default: log nothing (keeps library callers + tests silent). */
export const noopLog: Logger = () => {};

/** One JSON line per entry on stderr — greppable, CI-friendly, stdout-safe. */
export const stderrLog: Logger = (entry) => {
  process.stderr.write(JSON.stringify({ t: new Date().toISOString(), ...entry }) + "\n");
};

/** Classify the event-key format (observability for the @1→@2 migration). */
export function keyFormat(id: string): "zeta-id" | "ulid" | "unknown" {
  if (/^[0-9a-f]{32}$/.test(id)) return "zeta-id"; // @2: 128-bit ZetaId hex
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)) return "ulid"; // @1 legacy (Crockford)
  return "unknown";
}

// ─── Store I/O (append-only) ─────────────────────────────────────────

/**
 * Read an agent's event stream, sorted chronologically by event `ts`.
 * (Sort-by-`ts` is robust across the @2 ZetaIdHex + legacy @1 ULID id formats —
 * filename-lexical sort only sorted correctly within a single id format. Tie-break
 * by id for deterministic ordering of same-millisecond events.)
 */
export function loadStream(root: string, agent: AgentPersona): EventEnvelope[] {
  const dir = join(root, "events", agent);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as EventEnvelope)
    .sort((a, b) => {
      const ta = Date.parse(a.ts);
      const tb = Date.parse(b.ts);
      if (ta !== tb) return ta - tb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/** Kill-switch: is the halt sentinel present? */
export function isHalted(root: string): boolean {
  return existsSync(join(root, "events", HALT_SENTINEL));
}

/**
 * Replay an agent's stream to its current state via Z-set fold.
 * Retracted (net-zero weight) events are dropped; surviving transition
 * events are folded through `transition` from the initial Idle state.
 * Cross-checks each stored `to` against transition(from, option).
 */
export function replayState(events: EventEnvelope[], ctx: AgentContext): AgentState {
  // Z-set: sum weights per event id; an id with net weight 0 is fully retracted.
  const netWeight = new Map<string, number>();
  for (const e of events) {
    const key = e.kind === "retraction" ? e.retracts : e.id;
    netWeight.set(key, (netWeight.get(key) ?? 0) + e.weight);
  }
  let state: AgentState = { tag: "Idle", context: ctx };
  for (const e of events) {
    if (e.kind !== "transition") continue;
    if ((netWeight.get(e.id) ?? 0) <= 0) continue; // retracted
    const next = transition(e.from, e.option);
    state = next; // re-derived (cross-checks against e.to by construction of transition)
  }
  return state;
}

// ─── Menu generation + selector seam ─────────────────────────────────

/**
 * A minimal deterministic menu-generator for the harness prototype. The real
 * menu-generator (B-0867) weights options by DORA/trajectory; this one offers a
 * safe, always-valid default menu so the loop runs in CI without an LLM.
 */
export function generateMenu(state: AgentState): readonly MenuOption[] {
  switch (state.tag) {
    case "Idle":
      return [
        { tag: "EmitHeartbeat", lane: "heartbeat", note: "move-next harness tick" },
        { tag: "EnterFreeTime", reason: "no named work this cycle" },
      ];
    case "Paused":
      return [{ tag: "ResumeFromPause" }];
    default:
      // From any non-terminal state, the safe default is to record a heartbeat,
      // which cycleClose() returns to Idle.
      return [{ tag: "EmitHeartbeat", lane: "heartbeat", note: "cycle close" }];
  }
}

/** The selector seam. The real version is the LLM; the default is deterministic. */
export type SelectMove = (state: AgentState, menu: readonly MenuOption[]) => MenuOption;

/** Default deterministic selector: take the first menu option (always valid). */
export const firstOption: SelectMove = (_state, menu) => {
  const first = menu[0];
  if (first === undefined) throw new Error("empty menu — menu-generator must offer ≥1 option");
  return first;
};

// ─── One cycle: read → menu → select → transition → append ───────────

export interface CycleResult {
  readonly event: TransitionEvent;
  readonly from: AgentState;
  readonly to: AgentState;
  readonly wrotePath: string | null; // null on dry-run
}

export function runCycle(args: {
  readonly root: string;
  readonly ctx: AgentContext;
  readonly deps: BuildDeps;
  readonly select?: SelectMove;
  readonly dryRun?: boolean;
  readonly log?: Logger;
}): CycleResult {
  const log = args.log ?? noopLog;
  const select = args.select ?? firstOption;
  const stream = loadStream(args.root, args.ctx.agent);
  const prev = stream.length > 0 ? stream[stream.length - 1]!.id : null;
  const from = replayState(stream, args.ctx);
  const menu = generateMenu(from);
  const option = select(from, menu);
  const to = transition(from, option);
  const event = makeTransitionEvent(args.deps, { context: args.ctx, prev, from, option, to });

  const v = validateEnvelope(event);
  if (!v.ok) throw new Error(`harness produced invalid event: ${v.errors.join("; ")}`);

  let wrotePath: string | null = null;
  if (!args.dryRun) {
    const rel = eventPath(args.ctx.agent, event.id);
    const abs = join(args.root, rel);
    mkdirSync(join(args.root, "events", args.ctx.agent), { recursive: true });
    writeFileSync(abs, JSON.stringify(event, null, 2) + "\n", "utf8");
    wrotePath = rel;
  }

  // Observability: surface the KEYS the agent is using this cycle (stderr).
  log({
    ev: "cycle",
    agent: args.ctx.agent, // PARTITION key → events/<agent>/
    cycle: args.ctx.cycle,
    key: event.id, // per-event key → events/<agent>/<key>.json (= id)
    keyFormat: keyFormat(event.id), // "ulid" today; canonical = "zeta-id" (B-0893)
    prev, // causal-link key (prev event id, or null = first)
    kind: event.kind,
    from: from.tag,
    option: event.option.tag,
    to: to.tag,
    wrote: wrotePath,
    dryRun: args.dryRun ?? false,
  });
  return { event, from, to, wrotePath };
}

// ─── Bounded loop (kill-switch + hard cap) ───────────────────────────

export interface LoopResult {
  readonly cycles: readonly CycleResult[];
  readonly stopped: "max-iterations" | "halted";
}

export function runLoop(args: {
  readonly root: string;
  readonly agent: AgentPersona;
  readonly maxIterations: number;
  readonly deps?: BuildDeps;
  readonly select?: SelectMove;
  readonly dryRun?: boolean;
  readonly sessionStartIso?: string;
  readonly log?: Logger;
}): LoopResult {
  const deps = args.deps ?? realDeps;
  const log = args.log ?? noopLog;
  const cap = Math.max(0, Math.min(args.maxIterations, MAX_ITERATIONS)); // HARD clamp
  const sessionStartIso = args.sessionStartIso ?? deps.nowIso();
  log({ ev: "loop-start", agent: args.agent, cap, dryRun: args.dryRun ?? false, sessionStartIso });
  const cycles: CycleResult[] = [];
  for (let i = 0; i < cap; i++) {
    if (isHalted(args.root)) {
      log({ ev: "loop-stop", reason: "halted", cycles: cycles.length });
      return { cycles, stopped: "halted" };
    }
    const ctx: AgentContext = { agent: args.agent, cycle: cycles.length, sessionStartIso };
    cycles.push(
      runCycle({
        root: args.root,
        ctx,
        deps,
        log,
        ...(args.select === undefined ? {} : { select: args.select }),
        ...(args.dryRun === undefined ? {} : { dryRun: args.dryRun }),
      }),
    );
  }
  const stopped = isHalted(args.root) ? "halted" : "max-iterations";
  log({ ev: "loop-stop", reason: stopped, cycles: cycles.length });
  return { cycles, stopped };
}

// ─── CLI ─────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  root: string;
  agent: AgentPersona;
  maxIterations: number;
  dryRun: boolean;
  quiet: boolean;
} {
  const get = (k: string, d: string): string => {
    const i = argv.indexOf(k);
    return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1]! : d;
  };
  return {
    root: get("--root", process.cwd()),
    agent: get("--agent", "otto") as AgentPersona,
    maxIterations: Number.parseInt(get("--max-iterations", "1"), 10),
    dryRun: argv.includes("--dry-run"),
    quiet: argv.includes("--quiet"), // suppress structured stderr logging
  };
}

if (import.meta.main) {
  const a = parseArgs(process.argv.slice(2));
  if (isHalted(a.root)) {
    console.log(`HALTED: events/${HALT_SENTINEL} present — refusing to run (kill-switch).`);
    process.exit(0);
  }
  // CLI logs structured cycle/key events to STDERR by default (--quiet to mute);
  // STDOUT stays the clean, parseable human summary below.
  const result = runLoop({
    root: a.root,
    agent: a.agent,
    maxIterations: a.maxIterations,
    dryRun: a.dryRun,
    log: a.quiet ? noopLog : stderrLog,
  });
  for (const c of result.cycles) {
    console.log(
      `${a.dryRun ? "[dry-run] " : ""}${c.from.tag} --(${c.event.option.tag})--> ${c.to.tag}` +
        `  ${c.wrotePath ?? "(not written)"}`,
    );
  }
  console.log(
    `cycles=${result.cycles.length} stopped=${result.stopped} ` +
      `(cap=${Math.min(a.maxIterations, MAX_ITERATIONS)}/${MAX_ITERATIONS})`,
  );
}
