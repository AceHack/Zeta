// tools/accelerator/event-store-schema.ts
//
// PR-less git-monster accelerator — git-event-store schema, version @1.
// Action Item 2 of docs/accelerator/EVENT-STORE-SCHEMA.md.
//
// A move-next transition persisted as an append-only Git event. Composes with
// tools/agent-loop/state-machine.ts (the AgentState + MenuOption DUs + pure
// `transition`). This module IS the canonical move-next-event@1 schema
// (schema-in-the-stream: a future @2 lands as updated types + a schema-def event).
//
// Design (full rationale in docs/accelerator/EVENT-STORE-SCHEMA.md):
//   - One event per file: events/<agent>/<ulid>.json
//   - ULID filename = 128-bit, time-sortable, globally unique → per-agent dir +
//     unique filename ⇒ no two agents write the same path ⇒ conflict-free merges
//     ⇒ PR-less swarm (B-0867 128-bit-unique-ID design; B-0874 no-PR swarm).
//   - Z-set weight (+1 assert / -1 retract): forgiveness is logical; the file
//     stays on disk (physical cost) → compaction/tiering is the forgiveness-budget
//     ("run out of space = run out of forgiveness", razor-flow Insight 3).
//   - schema-in-the-stream: every event carries `schema`; schema-def events
//     declare versions → automatic schema-evolution over history (Insight 4).
//
// Pure types + validation + a builder. No I/O (the GH-Actions-recursion harness
// that reads/writes/pushes is Action Item 3).

import type {
  AgentContext,
  AgentPersona,
  AgentState,
  Lane,
  MenuOption,
} from "../agent-loop/state-machine.ts";

// ─── Zeta-ID (the canonical 128-bit merge primitive) ─────────────────
// Event ids are the canonical ZetaId (B-0893; src/Core.TypeScript/zeta-id/),
// serialized as a 32-char lowercase-hex string of the 128-bit value. The
// ZetaId encodes version+timestamp in its HIGH bits, so lexical-hex order =
// chronological order (same property the old ULID gave us), AND the key now
// carries category / persona / authority / location / momentum (provenance in
// the key itself) instead of being opaque timestamp+randomness.
export type ZetaIdHex = string & { readonly __brand: "ZetaIdHex" };

const ZETA_ID_HEX_RE = /^[0-9a-f]{32}$/; // 128 bits, zero-padded lowercase hex

export function isZetaIdHex(s: string): s is ZetaIdHex {
  return ZETA_ID_HEX_RE.test(s);
}

// ─── Legacy ULID (back-compat for move-next-event@1) ─────────────────
// @1 events were keyed by a placeholder ULID (Crockford base32, 26 chars).
// Retained so replay still validates pre-@2 events on the stream; new events
// (@2) use ZetaIdHex. `isEventId` accepts either format.
export type Ulid = string & { readonly __brand: "Ulid" };

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/; // Crockford base32, 26 chars

export function isUlid(s: string): s is Ulid {
  return ULID_RE.test(s);
}

/** An event id is valid if it is a @2 ZetaIdHex OR a legacy @1 ULID. */
export function isEventId(s: string): boolean {
  return isZetaIdHex(s) || isUlid(s);
}

// ─── Schema identity (schema-in-the-stream) ──────────────────────────
// @2 = Zeta-ID-keyed events (was @1 = placeholder-ULID-keyed). The id format
// changed (ULID → ZetaIdHex); replay still accepts legacy @1 ids via isEventId.
export const CURRENT_SCHEMA = "move-next-event@2" as const;
export type SchemaId = `${string}@${number}`;

// ─── Z-set weight (forgiveness algebra) ──────────────────────────────
// +1 assert, -1 retract. The active state is the Z-set sum of weights;
// net-zero (asserted-then-retracted) pairs are compaction candidates.
export type Weight = 1 | -1;

// ─── Event kinds ─────────────────────────────────────────────────────
export type EventKind =
  | "transition"
  | "heartbeat"
  | "schema-def"
  | "retraction";

interface EventBase {
  readonly id: ZetaIdHex; // also the filename: events/<agent>/<id>.json
  readonly schema: SchemaId; // which schema interprets this event
  readonly ts: string; // ISO-8601; redundant with the ZetaId timestamp, explicit for readers
  readonly agent: AgentPersona;
  readonly cycle: number; // AgentContext.cycle
  readonly prev: ZetaIdHex | Ulid | null; // previous event in THIS agent's stream (causal link); null = first. Ulid permitted only for a legacy @1 predecessor.
  readonly weight: Weight;
  readonly agencySig?: Readonly<Record<string, unknown>>; // AgencySignature v1 trailer fields
}

/** A persisted move-next transition: the record of `transition(from, option) = to`. */
export interface TransitionEvent extends EventBase {
  readonly kind: "transition";
  readonly from: AgentState;
  readonly option: MenuOption;
  readonly to: AgentState; // = transition(from, option); stored for audit + reader convenience
}

/** A heartbeat (RecordingHeartbeat; composes with B-0858 heartbeat folder). */
export interface HeartbeatEvent extends EventBase {
  readonly kind: "heartbeat";
  readonly lane: Lane;
  readonly note?: string;
}

/** Declares a schema version (schema-in-the-stream). Lands in events/_schema/. */
export interface SchemaDefEvent extends EventBase {
  readonly kind: "schema-def";
  readonly schemaName: string; // e.g. "move-next-event"
  readonly schemaVersion: number; // e.g. 2
  readonly jsonSchema: Readonly<Record<string, unknown>>; // the declared shape
}

/** Negates a prior event (logical forgiveness; weight is -1). */
export interface RetractionEvent extends EventBase {
  readonly kind: "retraction";
  readonly weight: -1;
  readonly retracts: ZetaIdHex | Ulid; // the event id being negated (Ulid only if negating a legacy @1 event)
}

export type EventEnvelope =
  | TransitionEvent
  | HeartbeatEvent
  | SchemaDefEvent
  | RetractionEvent;

// ─── Validation ──────────────────────────────────────────────────────
// Result-over-exception (per Zeta convention): returns Ok | Error-shape rather
// than throwing, so the harness (Action Item 3) handles malformed events as data.
export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly string[] };

export function validateEnvelope(e: EventEnvelope): ValidationResult {
  const errors: string[] = [];
  if (!isEventId(e.id)) errors.push(`id is not a valid Zeta-ID (or legacy ULID): ${String(e.id)}`);
  if (e.prev !== null && !isEventId(e.prev)) {
    errors.push(`prev is neither null nor a valid Zeta-ID (or legacy ULID): ${String(e.prev)}`);
  }
  if (!/^.+@\d+$/.test(e.schema)) {
    errors.push(`schema is not "<name>@<version>": ${e.schema}`);
  }
  if (Number.isNaN(Date.parse(e.ts))) errors.push(`ts is not ISO-8601: ${e.ts}`);
  if (e.weight !== 1 && e.weight !== -1) {
    errors.push(`weight must be +1 or -1: ${String(e.weight)}`);
  }
  if (e.kind === "retraction") {
    if (e.weight !== -1) errors.push("retraction events must have weight -1");
    if (!isEventId(e.retracts)) {
      errors.push(`retraction.retracts is not a valid Zeta-ID (or legacy ULID): ${String(e.retracts)}`);
    }
  }
  if (e.kind === "transition" && e.weight !== 1) {
    errors.push("transition events must have weight +1 (retract via a retraction event)");
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// ─── The per-agent path for an event (conflict-free by construction) ──
export function eventPath(agent: AgentPersona, id: ZetaIdHex): string {
  return `events/${agent}/${id}.json`;
}

// ─── Builders ────────────────────────────────────────────────────────
// The harness supplies the Zeta-ID generator (the codec-backed `newId`) + a
// clock; these builders keep the shape correct and the schema/weight invariants
// by construction. `newId` takes the SEMANTICS that go into the key's category /
// persona / authority bits (the schema stays decoupled from the codec types;
// the harness's realDeps.newId does the actual pack()).

/** Event-key semantics — the provenance the harness packs into the ZetaId. */
export interface IdSemantics {
  readonly agent: AgentPersona; // → ZetaId persona bits
  readonly category: "Observation" | "Emission" | "Workflow" | "Heartbeat"; // → ZetaId category bits
  readonly authority?: "Simulated" | "BestEffort" | "Standard" | "TrustedAgent" | "HumanVerified"; // → ZetaId authority bits (default Simulated)
}

export interface BuildDeps {
  readonly newId: (sem: IdSemantics) => ZetaIdHex;
  readonly nowIso: () => string;
}

/** Category for a transition: heartbeat options → Heartbeat, else Workflow. */
function categoryForOption(option: MenuOption): IdSemantics["category"] {
  return option.tag === "EmitHeartbeat" ? "Heartbeat" : "Workflow";
}

export function makeTransitionEvent(
  deps: BuildDeps,
  args: {
    readonly context: AgentContext;
    readonly prev: ZetaIdHex | Ulid | null;
    readonly from: AgentState;
    readonly option: MenuOption;
    readonly to: AgentState;
    readonly agencySig?: Readonly<Record<string, unknown>>;
  },
): TransitionEvent {
  return {
    kind: "transition",
    id: deps.newId({ agent: args.context.agent, category: categoryForOption(args.option) }),
    schema: CURRENT_SCHEMA,
    ts: deps.nowIso(),
    agent: args.context.agent,
    cycle: args.context.cycle,
    prev: args.prev,
    weight: 1,
    from: args.from,
    option: args.option,
    to: args.to,
    ...(args.agencySig === undefined ? {} : { agencySig: args.agencySig }),
  };
}

export function makeRetractionEvent(
  deps: BuildDeps,
  args: {
    readonly context: AgentContext;
    readonly prev: ZetaIdHex | Ulid | null;
    readonly retracts: ZetaIdHex | Ulid;
    readonly agencySig?: Readonly<Record<string, unknown>>;
  },
): RetractionEvent {
  return {
    kind: "retraction",
    id: deps.newId({ agent: args.context.agent, category: "Workflow" }),
    schema: CURRENT_SCHEMA,
    ts: deps.nowIso(),
    agent: args.context.agent,
    cycle: args.context.cycle,
    prev: args.prev,
    weight: -1,
    retracts: args.retracts,
    ...(args.agencySig === undefined ? {} : { agencySig: args.agencySig }),
  };
}
