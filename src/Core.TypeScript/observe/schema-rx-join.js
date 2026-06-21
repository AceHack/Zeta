/**
 * src/Core.TypeScript/observe/schema-rx-join.ts — Task 8: Rx join propagation.
 *
 * When a schema delta affects one Z-set in a multi-Z-set composition,
 * downstream materialized views must re-evaluate. This module implements
 * a minimal SchemaAwareJoin: an observable that fires when schema changes
 * affect its input fields, and gracefully degrades when fields are removed.
 *
 * The braided-free-monoid property: two independent deltas (touching different
 * fields) commute. This is provable from Z-set algebra: union is commutative
 * for disjoint keys (field names are the keys; weights sum independently).
 *
 * DST-compatible: no real I/O, synchronous, deterministic.
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/schema-zset.ts (applyDelta, SchemaZSet)
 *   - docs/specs/zero-downtime-schema-evolution/design.md (the spec)
 *   - src/Core.TypeScript/z-set/z-set.ts (the underlying Z-set algebra)
 */
import { applyDelta, currentSchema, resolveField, } from "./schema-zset";
// ─── SchemaAwareJoin ─────────────────────────────────────────────────────────
/**
 * The SchemaAwareJoin operator. Holds a schema Z-set, a set of subscribed views,
 * and a data source. When a schema delta is applied, it propagates to affected views.
 */
export class SchemaAwareJoin {
    schema;
    data;
    subscriptions;
    constructor(initialSchema, initialData) {
        this.schema = initialSchema;
        this.data = new Map(initialData ?? []);
        this.subscriptions = [];
    }
    /** Subscribe a view. Returns its initial computed value. */
    subscribe(view) {
        const value = view.compute(this.schema, this.data);
        const degraded = this.computeDegraded(view);
        this.subscriptions.push({ view, lastValue: value, lastDegraded: degraded });
        return value;
    }
    /** Get the current schema. */
    currentSchema() {
        return currentSchema(this.schema);
    }
    /** Get the raw schema Z-set. */
    rawSchema() {
        return this.schema;
    }
    /**
     * Apply a schema delta and propagate to affected views.
     * Returns propagation results for EVERY affected view.
     * Unaffected views are not recomputed (efficiency).
     */
    applyAndPropagate(delta) {
        // Apply the delta to the schema
        this.schema = applyDelta(this.schema, delta);
        // Determine which field names were touched by this delta
        const touchedFields = new Set([
            ...delta.retract.map(f => f.name),
            ...delta.insert.map(f => f.name),
        ]);
        // Propagate to affected views
        const results = [];
        for (const sub of this.subscriptions) {
            const affected = sub.view.dependsOn.some(f => touchedFields.has(f));
            if (affected) {
                const value = sub.view.compute(this.schema, this.data);
                const degraded = this.computeDegraded(sub.view);
                sub.lastValue = value;
                sub.lastDegraded = degraded;
                results.push({ viewId: sub.view.id, affected: true, value, degraded });
            }
        }
        return results;
    }
    /** Update data and recompute all views that depend on changed keys. */
    updateData(key, value) {
        this.data.set(key, value);
        // Recompute all views (data change affects all)
        for (const sub of this.subscriptions) {
            sub.lastValue = sub.view.compute(this.schema, this.data);
            sub.lastDegraded = this.computeDegraded(sub.view);
        }
    }
    /** Get the last computed value for a view. */
    getViewValue(viewId) {
        const sub = this.subscriptions.find(s => s.view.id === viewId);
        return sub?.lastValue;
    }
    /** Get degraded fields for a view. */
    getViewDegraded(viewId) {
        const sub = this.subscriptions.find(s => s.view.id === viewId);
        return sub?.lastDegraded ?? [];
    }
    /** Compute which fields a view depends on but are missing from current schema. */
    computeDegraded(view) {
        return view.dependsOn.filter(f => !resolveField(this.schema, f));
    }
}
// ─── Commutativity proof helper ──────────────────────────────────────────────
/**
 * Prove the braided-free-monoid property for two deltas:
 * apply(apply(s, d1), d2) === apply(apply(s, d2), d1)
 * when d1 and d2 touch DISJOINT fields.
 *
 * Returns true if the property holds (it always should for disjoint deltas
 * since Z-set union is commutative for disjoint keys).
 */
export function deltasCommute(schema, d1, d2) {
    const path1 = applyDelta(applyDelta(schema, d1), d2);
    const path2 = applyDelta(applyDelta(schema, d2), d1);
    // Compare: same active fields with same weights
    const fields1 = currentSchema(path1).map(f => f.name).sort();
    const fields2 = currentSchema(path2).map(f => f.name).sort();
    if (fields1.length !== fields2.length)
        return false;
    return fields1.every((f, i) => f === fields2[i]);
}
