/**
 * src/Core.TypeScript/observe/schema-cdc.ts — CDC envelope for schema evolution events.
 *
 * Schema evolution events use a CloudEvents-compatible envelope with a
 * Debezium-style before/after data payload. This lets consumers process
 * schema changes with standard event tooling (Kafka, event routers) and
 * distinguish which fields were added, removed, or changed.
 *
 * The envelope is the same shape as the observe event envelope (ZetaId-keyed,
 * ISO-8601 timestamped, actor-attributed) but typed for schema evolution.
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/schema-zset.ts (the delta this envelope carries)
 *   - src/Core.TypeScript/observe/event-sink-folder.ts (the EventSink pattern)
 *   - src/Core.TypeScript/zeta-id/ (ZetaId minting for event identity)
 *   - CloudEvents spec 1.0 (https://cloudevents.io/)
 *   - Debezium CDC envelope shape (before/after/op)
 */
import { mintObserveEventIdHex } from "./event-sink-folder";
/**
 * Build a CloudEvents-compatible schema evolution event.
 * Pure function — no I/O. The caller is responsible for appending it
 * to the event log via the EventSink.
 */
export function emitSchemaEvent(before, after, delta, opts) {
    const mint = opts.mint ?? mintObserveEventIdHex;
    const now = opts.now ?? Date.now;
    return {
        id: mint(),
        source: opts.source,
        type: "schema.evolved",
        specversion: "1.0",
        time: new Date(now()).toISOString(),
        ...(opts.subject !== undefined ? { subject: opts.subject } : {}),
        datacontenttype: "application/json",
        data: {
            before,
            after,
            delta,
            actor: opts.actor,
        },
    };
}
/**
 * Parse and validate a schema evolution event from raw JSON.
 * Returns a typed result — never throws.
 */
export function parseSchemaEvent(raw) {
    if (typeof raw !== "object" || raw === null) {
        return { ok: false, reason: "expected an object" };
    }
    const obj = raw;
    // Required CloudEvents fields
    if (typeof obj.id !== "string" || obj.id.length === 0) {
        return { ok: false, reason: "missing or empty 'id'" };
    }
    if (typeof obj.source !== "string" || obj.source.length === 0) {
        return { ok: false, reason: "missing or empty 'source'" };
    }
    if (obj.type !== "schema.evolved") {
        return { ok: false, reason: `expected type 'schema.evolved', got '${String(obj.type)}'` };
    }
    if (obj.specversion !== "1.0") {
        return { ok: false, reason: `expected specversion '1.0', got '${String(obj.specversion)}'` };
    }
    if (typeof obj.time !== "string") {
        return { ok: false, reason: "missing 'time'" };
    }
    // Data payload
    if (typeof obj.data !== "object" || obj.data === null) {
        return { ok: false, reason: "missing 'data' payload" };
    }
    const data = obj.data;
    if (!Array.isArray(data.before)) {
        return { ok: false, reason: "data.before must be an array" };
    }
    if (!Array.isArray(data.after)) {
        return { ok: false, reason: "data.after must be an array" };
    }
    if (typeof data.delta !== "object" || data.delta === null) {
        return { ok: false, reason: "data.delta must be an object" };
    }
    if (typeof data.actor !== "string") {
        return { ok: false, reason: "data.actor must be a string" };
    }
    return { ok: true, event: obj };
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Extract added fields from a parsed event (in 'after' but not 'before'). */
export function addedFields(event) {
    const beforeNames = new Set(event.data.before.map(f => f.name));
    return event.data.after.filter(f => !beforeNames.has(f.name));
}
/** Extract removed fields from a parsed event (in 'before' but not 'after'). */
export function removedFields(event) {
    const afterNames = new Set(event.data.after.map(f => f.name));
    return event.data.before.filter(f => !afterNames.has(f.name));
}
/** Extract changed fields (present in both but type/required differs). */
export function changedFields(event) {
    const beforeMap = new Map(event.data.before.map(f => [f.name, f]));
    const result = [];
    for (const after of event.data.after) {
        const before = beforeMap.get(after.name);
        if (before && (before.type !== after.type || before.required !== after.required)) {
            result.push({ before, after });
        }
    }
    return result;
}
