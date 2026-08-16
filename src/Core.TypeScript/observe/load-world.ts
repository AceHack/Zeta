/**
 * src/Core.TypeScript/observe/load-world.ts — wire the real World snapshot (closes the loop).
 *
 * observe.ts's roadmap was "wire the real World snapshot + execute the pick." The
 * execute side landed (execute.ts + event-sink-folder.ts). `loadWorld` is the
 * read side: it builds a `World` from the real channels so the loop runs for real:
 *
 *   loadWorld()  →  observe / observeWithParticipant  →  execute (append event)  →  loadWorld()  →  …
 *
 * Two channels, each its own source of truth:
 *
 *   - BACKLOG  ← the existing selector (the oracle). Per backlog-reader.ts we do
 *     NOT reimplement selection: `nextActionFromBacklog` runs the priority-ranked
 *     `selectNextBacklogItem`, and the chosen item (if any) IS the world's backlog
 *     for this tick. A free_time selection (empty/blocked) → empty backlog.
 *   - MODE     ← a FOLD of the event log (per observe.ts v5: state is a projection
 *     of the event log). The events `execute` appended (via the folder sink) carry
 *     the chosen mode; folding them yields the persisted mode (operator: "i love
 *     mode persistance"). This is the read side of what the folder sink writes —
 *     the loop closing on itself.
 *
 * Schema-on-read (decoupled reader): `loadWorld` tolerantly parses the event JSON
 * for just `{ id, at, action }` — the reader doesn't depend on the writer's type,
 * skips anything malformed, and validates the action kind before trusting it. The
 * folder + the canonical id are the only contract. "Canonical" means the id DECODES as
 * a ZetaId (version + category), not merely that it is 32 hex characters — a shape
 * check accepted hex-encoded JSON as an id (see `zeta-id/canonical-hex.ts`).
 *
 * operator is OPTIONAL: absent = a background agent (no operator wired); a
 * foreground caller injects the live channel. Same World DU, fewer channels.
 *
 * Pure-shaped + sync (reads files); the `nextAction` channel is injectable so the
 * whole thing is testable without the real backlog.
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/observe.ts (World / BacklogItem / Mode / NextAction / fold)
 *   - src/Core.TypeScript/observe/backlog-reader.ts (the backlog channel; selector = oracle)
 *   - src/Core.TypeScript/observe/execute.ts + event-sink-folder.ts (the write side this reads back)
 *   - docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { nextActionFromBacklog, type Priority } from "./backlog-reader";
import { fold, type BacklogItem, type Mode, type NextAction, type OperatorChannel, type World } from "./observe";
import { loadNodeSession, type LoadNodeSessionOptions } from "./load-node-session";
import { isCanonicalZetaIdHex } from "../zeta-id/canonical-hex";

/** The NextAction kinds a folded event log may legitimately contain. */
const KNOWN_KINDS: ReadonlySet<string> = new Set([
  "preserve_ferry",
  "respond_to_operator",
  "do_item",
  "decompose",
  "self_claim",
  "explore",
  "play",
  "self_reflect",
  "free_time",
  "edit_grammar",
]);

/**
 * Accept an id only if it DECODES as a ZetaId — not merely if it looks like one.
 *
 * This was `/^[0-9a-f]{32}$/`, which checks the encoding and never the value. That is
 * what let `7b226174746573746f72223a22616c65` (hex-encoded JSON: `{"attestor":"ale`) be
 * read as an event id. `isCanonicalZetaIdHex` decodes and checks version + category,
 * reusing the codec rather than adding a second parser. See
 * `src/Core.TypeScript/zeta-id/canonical-hex.ts`.
 */
const isCanonicalEventId = isCanonicalZetaIdHex;

/** What the reader extracts from one event file (schema-on-read; ignores extra fields). */
interface ParsedEvent {
  readonly id: string;
  readonly at: string;
  readonly action: NextAction;
}

/**
 * The action payload must match its kind, or `fold → simulate` can throw (e.g. a
 * `{ kind: "do_item" }` with no `item` derefs `action.item.id`). Tolerant reader
 * rejects ill-shaped payloads.
 */
function hasValidPayload(kind: string, a: Record<string, unknown>): boolean {
  if (kind === "do_item" || kind === "decompose") {
    const it = a.item;
    return typeof it === "object" && it !== null && typeof (it as Record<string, unknown>).id === "string";
  }
  if (kind === "self_claim") {
    const it = a.item;
    return typeof it === "object" && it !== null && typeof (it as Record<string, unknown>).id === "string" && typeof a.deadline === "number";
  }
  return typeof a.reason === "string"; // the reason-carrying kinds
}

/** Parse one event file → a ParsedEvent, or null if anything is missing/malformed (never throws). */
function parseEventFile(eventDir: string, name: string): ParsedEvent | null {
  if (!name.endsWith(".json")) return null;
  try {
    const raw: unknown = JSON.parse(readFileSync(join(eventDir, name), "utf-8"));
    if (typeof raw !== "object" || raw === null) return null;
    const env = raw as Record<string, unknown>;
    const action = env.action;
    if (!isCanonicalEventId(env.id) || typeof env.at !== "string") return null;
    if (typeof action !== "object" || action === null) return null;
    const a = action as Record<string, unknown>;
    const kind = a.kind;
    if (typeof kind !== "string" || !KNOWN_KINDS.has(kind) || !hasValidPayload(kind, a)) return null;
    return { id: env.id, at: env.at, action: action as NextAction };
  } catch {
    return null; // malformed file → skip
  }
}

/**
 * Read + deterministically order the event log → the recorded actions. Tolerant:
 * a missing dir, a non-JSON file, a malformed envelope, a non-canonical id, an
 * unknown action kind, or an ill-shaped payload is skipped (never throws). Recurses
 * date-partitioned dirs (YYYY/MM/DD/{id}.json, 081KSNY2Z0008QG0R001K6HJ7Z / bus shape). Ordered by
 * `at` then `id` so the fold is replayable (DST).
 */
export function readEventActions(eventDir: string): readonly NextAction[] {
  let names: readonly string[];
  try {
    names = readdirSync(eventDir, { recursive: true, encoding: "utf-8" });
  } catch {
    return []; // no event dir yet → empty log
  }
  const parsed: ParsedEvent[] = [];
  for (const name of names) {
    const p = parseEventFile(eventDir, name);
    if (p !== null) parsed.push(p);
  }
  parsed.sort((a, b) => {
    if (a.at !== b.at) return a.at < b.at ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });
  return parsed.map((p) => p.action);
}

export interface LoadWorldOptions {
  /** The git folder the folder sink appended events to (the mode channel). */
  readonly eventDir: string;
  /** Backlog channel (default: the real selector). Inject in tests. */
  readonly nextAction?: () => NextAction;
  /** Repo root for the default backlog channel (default: process.cwd()). */
  readonly repoRoot?: string;
  readonly activeClaims?: readonly string[];
  readonly maxPriority?: Priority;
  /** Live operator channel; omit for a background agent. */
  readonly operator?: OperatorChannel;
  /** First-session channel; default loads from marker + cred probe. Inject in tests. */
  readonly nodeSession?: LoadNodeSessionOptions;
}

/**
 * Build the real `World`: backlog from the selector (oracle), mode from folding
 * the event log, operator if wired. The snapshot `observe()` reads — now sourced
 * from real channels, closing the observe → execute → observe loop.
 */
export function loadWorld(opts: LoadWorldOptions): World {
  const next = opts.nextAction
    ? opts.nextAction()
    : nextActionFromBacklog(opts.repoRoot ?? process.cwd(), opts.activeClaims ?? [], opts.maxPriority ?? "P2");
  // Selector = oracle: the chosen item IS the backlog for this tick (no re-selection).
  const backlog: readonly BacklogItem[] = next.kind === "do_item" || next.kind === "decompose" ? [next.item] : [];

  // Mode = projection of the event log (v5). Fold over an EMPTY backlog: mode
  // transitions don't depend on backlog contents, so this isolates the persisted mode.
  const mode: Mode | undefined = fold({ backlog: [] }, readEventActions(opts.eventDir)).mode;

  const nodeSession = loadNodeSession(opts.nodeSession);

  return {
    backlog,
    ...(mode !== undefined ? { mode } : {}),
    ...(opts.operator !== undefined ? { operator: opts.operator } : {}),
    ...(nodeSession !== undefined ? { nodeSession } : {}),
  };
}
