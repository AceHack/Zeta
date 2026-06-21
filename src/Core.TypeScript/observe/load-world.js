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
 * folder + the canonical-id shape are the only contract.
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
import { nextActionFromBacklog } from "./backlog-reader";
import { fold } from "./observe";
import { loadNodeSession } from "./load-node-session";
/** The NextAction kinds a folded event log may legitimately contain. */
const KNOWN_KINDS = new Set([
    "preserve_ferry",
    "respond_to_operator",
    "do_item",
    "decompose",
    "explore",
    "play",
    "self_reflect",
    "free_time",
    "edit_grammar",
]);
const isCanonicalEventId = (id) => typeof id === "string" && /^[0-9a-f]{32}$/.test(id);
/**
 * The action payload must match its kind, or `fold → simulate` can throw (e.g. a
 * `{ kind: "do_item" }` with no `item` derefs `action.item.id`). Tolerant reader
 * rejects ill-shaped payloads.
 */
function hasValidPayload(kind, a) {
    if (kind === "do_item" || kind === "decompose") {
        const it = a.item;
        return typeof it === "object" && it !== null && typeof it.id === "string";
    }
    return typeof a.reason === "string"; // the reason-carrying kinds
}
/** Parse one event file → a ParsedEvent, or null if anything is missing/malformed (never throws). */
function parseEventFile(eventDir, name) {
    if (!name.endsWith(".json"))
        return null;
    try {
        const raw = JSON.parse(readFileSync(join(eventDir, name), "utf-8"));
        if (typeof raw !== "object" || raw === null)
            return null;
        const env = raw;
        const action = env.action;
        if (!isCanonicalEventId(env.id) || typeof env.at !== "string")
            return null;
        if (typeof action !== "object" || action === null)
            return null;
        const a = action;
        const kind = a.kind;
        if (typeof kind !== "string" || !KNOWN_KINDS.has(kind) || !hasValidPayload(kind, a))
            return null;
        return { id: env.id, at: env.at, action: action };
    }
    catch {
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
export function readEventActions(eventDir) {
    let names;
    try {
        names = readdirSync(eventDir, { recursive: true, encoding: "utf-8" });
    }
    catch {
        return []; // no event dir yet → empty log
    }
    const parsed = [];
    for (const name of names) {
        const p = parseEventFile(eventDir, name);
        if (p !== null)
            parsed.push(p);
    }
    parsed.sort((a, b) => {
        if (a.at !== b.at)
            return a.at < b.at ? -1 : 1;
        if (a.id !== b.id)
            return a.id < b.id ? -1 : 1;
        return 0;
    });
    return parsed.map((p) => p.action);
}
/**
 * Build the real `World`: backlog from the selector (oracle), mode from folding
 * the event log, operator if wired. The snapshot `observe()` reads — now sourced
 * from real channels, closing the observe → execute → observe loop.
 */
export function loadWorld(opts) {
    const next = opts.nextAction
        ? opts.nextAction()
        : nextActionFromBacklog(opts.repoRoot ?? process.cwd(), opts.activeClaims ?? [], opts.maxPriority ?? "P2");
    // Selector = oracle: the chosen item IS the backlog for this tick (no re-selection).
    const backlog = next.kind === "do_item" || next.kind === "decompose" ? [next.item] : [];
    // Mode = projection of the event log (v5). Fold over an EMPTY backlog: mode
    // transitions don't depend on backlog contents, so this isolates the persisted mode.
    const mode = fold({ backlog: [] }, readEventActions(opts.eventDir)).mode;
    const nodeSession = loadNodeSession(opts.nodeSession);
    return {
        backlog,
        ...(mode !== undefined ? { mode } : {}),
        ...(opts.operator !== undefined ? { operator: opts.operator } : {}),
        ...(nodeSession !== undefined ? { nodeSession } : {}),
    };
}
