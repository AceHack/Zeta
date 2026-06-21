/**
 * src/Core.TypeScript/observe/schema-zset.ts — schema as Z-set.
 *
 * Schema IS a Z-set. Evolution = retraction + insertion delta.
 * Same algebra as data evolution — no special migration machinery.
 *
 * A SchemaField at weight +1 = active (present in current schema).
 * A SchemaField at weight -1 = retracted (removed, pending consolidation).
 * A SchemaField at weight 0 = consolidated (dropped from the Z-set).
 *
 * Composes with:
 *   - src/Core.TypeScript/z-set/z-set.ts (the Z-set primitive)
 *   - src/Core.TypeScript/observe/workspace-port.ts (the first consumer)
 *   - docs/specs/zero-downtime-schema-evolution/ (the spec)
 *   - docs/DECISIONS/2026-06-15-zero-downtime-id-rotation-pattern-overlap-window-dual-key.md
 */
// ─── Construction ────────────────────────────────────────────────────────────
/** Create a schema Z-set from field definitions (each at weight +1). */
export function schemaZSet(fields) {
    return fields.map(field => ({ field, weight: 1 }));
}
// ─── Evolution (the core operation) ──────────────────────────────────────────
/**
 * Apply a delta to a schema Z-set. Retracted fields get weight -1 added;
 * inserted fields get weight +1 added. Per Z-set semantics: same field name
 * sums weights (a retraction of an existing field → weight 0 → consolidated out).
 */
export function applyDelta(schema, delta) {
    // Build a mutable map: fieldName → { field, weight }
    const map = new Map();
    for (const entry of schema) {
        const existing = map.get(entry.field.name);
        if (existing) {
            existing.weight += entry.weight;
        }
        else {
            map.set(entry.field.name, { field: entry.field, weight: entry.weight });
        }
    }
    // Apply retractions (weight -1)
    for (const field of delta.retract) {
        const existing = map.get(field.name);
        if (existing) {
            existing.weight -= 1;
        }
        else {
            map.set(field.name, { field, weight: -1 });
        }
    }
    // Apply insertions (weight +1)
    for (const field of delta.insert) {
        const existing = map.get(field.name);
        if (existing) {
            // If inserting a field that was retracted, update the field definition
            existing.weight += 1;
            existing.field = field; // new definition takes precedence
        }
        else {
            map.set(field.name, { field, weight: 1 });
        }
    }
    // Convert back to array (drop zero-weight entries = consolidation)
    return [...map.values()]
        .filter(e => e.weight !== 0)
        .map(e => ({ field: e.field, weight: e.weight }));
}
/**
 * Consolidate: same as applyDelta with empty delta — just drops zero-weight entries.
 * Explicitly closes the overlap window by removing fully-retracted fields.
 */
export function consolidate(schema) {
    return applyDelta(schema, { retract: [], insert: [] });
}
// ─── Queries ─────────────────────────────────────────────────────────────────
/** Get the current active schema (fields with positive weight). */
export function currentSchema(schema) {
    return schema.filter(e => e.weight > 0).map(e => e.field);
}
/** Resolve a single field by name (returns the field if active, undefined if retracted/absent). */
export function resolveField(schema, fieldName) {
    const entry = schema.find(e => e.field.name === fieldName && e.weight > 0);
    return entry?.field;
}
/** Check if a field is in the overlap window (both old and new present). */
export function isInOverlap(schema, fieldName) {
    const entries = schema.filter(e => e.field.name === fieldName);
    return entries.length > 1 || entries.some(e => e.weight < 0);
}
// ─── Delta computation ───────────────────────────────────────────────────────
/**
 * Compute the delta between two schema versions automatically.
 * Removed fields → retract. Added fields → insert. Changed fields → retract old + insert new.
 */
export function deltaFromSchemas(before, after) {
    const beforeMap = new Map(before.map(f => [f.name, f]));
    const afterMap = new Map(after.map(f => [f.name, f]));
    const retract = [];
    const insert = [];
    // Fields in before but not in after → retract
    for (const [name, field] of beforeMap) {
        if (!afterMap.has(name)) {
            retract.push(field);
        }
    }
    // Fields in after but not in before → insert
    for (const [name, field] of afterMap) {
        if (!beforeMap.has(name)) {
            insert.push(field);
        }
        else {
            // Field exists in both — check if definition changed
            const oldField = beforeMap.get(name);
            if (oldField.type !== field.type || oldField.required !== field.required) {
                retract.push(oldField);
                insert.push(field);
            }
        }
    }
    return { retract, insert };
}
// ─── The filesystem metadata schema (first instance) ─────────────────────────
export const FS_METADATA_SCHEMA_V1 = [
    { name: "contentHash", type: "string", required: true },
    { name: "paths", type: "string[]", required: true },
    { name: "executable", type: "boolean", required: true, default: true }, // Zeta inverted: alive by default
    { name: "binary", type: "boolean", required: true, default: false },
    { name: "created", type: "string", required: false },
    { name: "modified", type: "string", required: false },
];
export const FS_METADATA_SCHEMA_V2 = [
    ...FS_METADATA_SCHEMA_V1,
    { name: "owner", type: "zetaid", required: false }, // new: who owns this content
];
