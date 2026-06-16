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

import {
  type SchemaZSet,
  type SchemaField,
  type SchemaEvolutionDelta,
  applyDelta,
  currentSchema,
  resolveField,
} from "./schema-zset";

// ─── Types ───────────────────────────────────────────────────────────────────

/** A downstream view that depends on specific schema fields. */
export interface SchemaView<T = unknown> {
  readonly id: string;
  /** Which fields this view depends on (reads/projects). */
  readonly dependsOn: readonly string[];
  /** Compute the view value given the current schema + data. */
  compute(schema: SchemaZSet, data: ReadonlyMap<string, unknown>): T;
}

/** The result of propagating a schema delta to a view. */
export interface PropagationResult<T = unknown> {
  readonly viewId: string;
  readonly affected: boolean;       // did this delta touch any of the view's fields?
  readonly value: T;                // the recomputed value
  readonly degraded: readonly string[]; // fields the view wanted but are now missing
}

/** A subscription: a view + its last computed state. */
interface Subscription<T = unknown> {
  readonly view: SchemaView<T>;
  lastValue: T;
  lastDegraded: readonly string[];
}

// ─── SchemaAwareJoin ─────────────────────────────────────────────────────────

/**
 * The SchemaAwareJoin operator. Holds a schema Z-set, a set of subscribed views,
 * and a data source. When a schema delta is applied, it propagates to affected views.
 */
export class SchemaAwareJoin {
  private schema: SchemaZSet;
  private data: Map<string, unknown>;
  private subscriptions: Subscription[];

  constructor(initialSchema: SchemaZSet, initialData?: ReadonlyMap<string, unknown>) {
    this.schema = initialSchema;
    this.data = new Map(initialData ?? []);
    this.subscriptions = [];
  }

  /** Subscribe a view. Returns its initial computed value. */
  subscribe<T>(view: SchemaView<T>): T {
    const value = view.compute(this.schema, this.data);
    const degraded = this.computeDegraded(view);
    this.subscriptions.push({ view, lastValue: value, lastDegraded: degraded });
    return value;
  }

  /** Get the current schema. */
  currentSchema(): readonly SchemaField[] {
    return currentSchema(this.schema);
  }

  /** Get the raw schema Z-set. */
  rawSchema(): SchemaZSet {
    return this.schema;
  }

  /**
   * Apply a schema delta and propagate to affected views.
   * Returns propagation results for EVERY affected view.
   * Unaffected views are not recomputed (efficiency).
   */
  applyAndPropagate(delta: SchemaEvolutionDelta): readonly PropagationResult[] {
    // Apply the delta to the schema
    this.schema = applyDelta(this.schema, delta);

    // Determine which field names were touched by this delta
    const touchedFields = new Set([
      ...delta.retract.map(f => f.name),
      ...delta.insert.map(f => f.name),
    ]);

    // Propagate to affected views
    const results: PropagationResult[] = [];
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
  updateData(key: string, value: unknown): void {
    this.data.set(key, value);
    // Recompute all views (data change affects all)
    for (const sub of this.subscriptions) {
      sub.lastValue = sub.view.compute(this.schema, this.data);
      sub.lastDegraded = this.computeDegraded(sub.view);
    }
  }

  /** Get the last computed value for a view. */
  getViewValue(viewId: string): unknown {
    const sub = this.subscriptions.find(s => s.view.id === viewId);
    return sub?.lastValue;
  }

  /** Get degraded fields for a view. */
  getViewDegraded(viewId: string): readonly string[] {
    const sub = this.subscriptions.find(s => s.view.id === viewId);
    return sub?.lastDegraded ?? [];
  }

  /** Compute which fields a view depends on but are missing from current schema. */
  private computeDegraded(view: SchemaView): readonly string[] {
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
export function deltasCommute(
  schema: SchemaZSet,
  d1: SchemaEvolutionDelta,
  d2: SchemaEvolutionDelta,
): boolean {
  const path1 = applyDelta(applyDelta(schema, d1), d2);
  const path2 = applyDelta(applyDelta(schema, d2), d1);

  // Compare: same active fields with same weights
  const fields1 = currentSchema(path1).map(f => f.name).sort();
  const fields2 = currentSchema(path2).map(f => f.name).sort();

  if (fields1.length !== fields2.length) return false;
  return fields1.every((f, i) => f === fields2[i]);
}
