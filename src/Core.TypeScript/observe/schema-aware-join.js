/**
 * src/Core.TypeScript/observe/schema-aware-join.ts -- Rx join propagation for
 * cross-Z-set schema evolution (Task 8).
 *
 * The kernel of the Rx propagation, NOT the full IVM. When a schema delta hits
 * one Z-set in a multi-Z-set composition, this operator propagates the change
 * to downstream materialized views:
 *
 *   SchemaCell (input A: schema changes) --+
 *                                          +--> SchemaAwareJoin --> Materialized view
 *   data rows  (input B: data)          ---+
 *
 * The join re-evaluates when EITHER input changes -- combineLatest semantics,
 * but SYNCHRONOUS and DETERMINISTIC (no RxJS scheduler).
 *
 * Why not RxJS combineLatest: a real Rx scheduler routes emissions through the
 * microtask queue -- ambient, unmetered timing. That is a noninterference
 * (entropy-quarantine) violation (.claude/rules/dv2-data-split-discipline-
 * activated.md #7) and breaks DST replay (.../manifesto-13-specifications.md
 * spec 7). So the cell pushes to subscribers synchronously, in subscription
 * order: one emit per input change, no glitches, byte-identical on replay.
 *
 * Beacon (anchor-to-human-prior-art):
 *   - Z-set / DBSP incremental view maintenance .... Budiu, McSherry, Ryzhyk,
 *     Tannen, "DBSP: Automatic Incremental View Maintenance for Rich Query
 *     Languages" (arXiv:2203.16684).
 *   - Braided (vs symmetric) monoidal structure ..... Joyal & Street,
 *     "Braided Tensor Categories" (Adv. Math. 102, 1993). Disjoint strands
 *     commute; adjacent strands satisfy the braid relation, NOT commutation.
 *   - Commutativity of concurrent ops (the property) . Shapiro, Preguica,
 *     Baquero, Zawirski, "Conflict-free Replicated Data Types" (2011) -- a
 *     CmRDT's concurrent ops commute; our disjoint-field deltas are the same
 *     shape (a join is a lawful merge only when its inputs commute).
 *   - The combineLatest glitch problem ............. Cooper & Krishnamurthi,
 *     "Embedding Dynamic Dataflow in a Call-by-Value Language" (ESOP 2006).
 *     We avoid glitches by single-emit-per-change, not topological ordering.
 *
 * Designed by Soraya (formal-verification-expert) on Otto's invocation,
 * Task 8 of docs/specs/zero-downtime-schema-evolution. Peer note: the literal
 * task statement `apply(apply(s,d1),d2) === apply(apply(s,d2),d1)` is false as
 * `===` (reference) AND as ordered-array equality (applyDelta appends new
 * fields in delta order). The honest theorem -- proved in the tests -- is
 * commutation UP TO Z-set canonical equality, CONDITIONED on field-disjoint
 * deltas. That condition is the braiding: same-field deltas do not commute.
 *
 * ASCII only (BP-09). Pure + synchronous -- no I/O, no Date.now, no random.
 *
 * Composes with:
 *   - ./schema-zset.ts (applyDelta -- the core operation, reused verbatim)
 *   - ./schema-cdc.ts (the CDC envelope a real producer would carry)
 *   - ./schema-overlap.ts (the overlap-window state machine this feeds)
 */
import { applyDelta, currentSchema, } from "./schema-zset";
// ─── Projection (the graceful add / degrade rule) ─────────────────────────────
/**
 * Project one data row against the active schema fields. This single rule
 * realises BOTH propagation requirements:
 *
 *   - Field ADDED: if it carries a default, predating rows degrade to that
 *     default; if it has no default, predating rows simply omit it (no crash).
 *     New rows that supply the value pass it through.
 *   - Field REMOVED: it leaves `currentSchema`, so it is dropped from output.
 *     A view that referenced it degrades gracefully -- the value is gone, the
 *     projection does not throw.
 *
 * Output keys are emitted in canonical (sorted-by-name) order so the view is
 * byte-stable for golden-vector / DST comparison.
 */
export function projectRow(fields, row) {
    const out = {};
    const sorted = [...fields].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const f of sorted) {
        if (Object.prototype.hasOwnProperty.call(row, f.name)) {
            out[f.name] = row[f.name]; // value present -> pass through
        }
        else if (f.default !== undefined) {
            out[f.name] = f.default; // absent but field carries a default -> degrade to default
        }
        // absent + no default -> dropped (graceful; field simply not in output)
    }
    return out;
}
/** Materialize the full view: every data row projected against the live schema. */
export function materialize(schema, data) {
    const fields = currentSchema(schema);
    const names = fields.map(f => f.name).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return { fields: names, rows: data.map(row => projectRow(fields, row)) };
}
/**
 * An observable schema Z-set. `evolve(delta)` folds the delta with the reused
 * `applyDelta` and pushes (newSchema, delta) to every subscriber synchronously,
 * in subscription order. This is requirement 1: observe a schema Z-set for
 * changes by subscribing to deltas.
 */
export class SchemaCell {
    schema;
    subscribers = [];
    constructor(initial) {
        this.schema = initial;
    }
    /** The current schema Z-set. */
    current() {
        return this.schema;
    }
    /** Subscribe to future deltas. Returns an unsubscribe thunk. */
    subscribe(fn) {
        this.subscribers.push(fn);
        return () => {
            const i = this.subscribers.indexOf(fn);
            if (i >= 0)
                this.subscribers.splice(i, 1);
        };
    }
    /** Apply a delta (reusing applyDelta) and notify subscribers. Synchronous. */
    evolve(delta) {
        this.schema = applyDelta(this.schema, delta);
        // Deterministic order; one notification per evolve -> glitch-free.
        for (const fn of [...this.subscribers])
            fn(this.schema, delta);
        return this.schema;
    }
}
/**
 * The join of a schema cell (input A) and data rows (input B). It holds the
 * latest of each and re-materializes the view whenever either changes --
 * combineLatest, done synchronously and deterministically.
 *
 *   - On a schema delta: re-evaluate (add) / degrade (remove) every row.
 *   - On a data change:  re-project against the unchanged live schema.
 *
 * Exactly one view emission per input change (glitch-free). DST-replayable:
 * the same construction + the same sequence of evolve/setData calls yields a
 * byte-identical view and the same emission count, with no ambient input.
 */
export class SchemaAwareJoin {
    schemaCell;
    data;
    view;
    subscribers = [];
    unsubscribeSchema;
    emitCount = 0;
    constructor(schemaCell, initialData = []) {
        this.schemaCell = schemaCell;
        this.data = initialData;
        this.view = materialize(schemaCell.current(), this.data);
        // Wire input A: any schema delta re-materializes and emits.
        this.unsubscribeSchema = schemaCell.subscribe(schema => {
            this.view = materialize(schema, this.data);
            this.emit();
        });
    }
    /** The latest materialized view. */
    currentView() {
        return this.view;
    }
    /** Number of view emissions so far (for glitch-freedom / DST assertions). */
    emissions() {
        return this.emitCount;
    }
    /** Subscribe to view changes. Returns an unsubscribe thunk. */
    subscribe(fn) {
        this.subscribers.push(fn);
        return () => {
            const i = this.subscribers.indexOf(fn);
            if (i >= 0)
                this.subscribers.splice(i, 1);
        };
    }
    /** Input B changed: re-project against the live schema and emit. */
    setData(rows) {
        this.data = rows;
        this.view = materialize(this.schemaCell.current(), this.data);
        this.emit();
    }
    /** Detach from the schema cell (stop receiving deltas). */
    dispose() {
        this.unsubscribeSchema();
    }
    emit() {
        this.emitCount += 1;
        for (const fn of [...this.subscribers])
            fn(this.view);
    }
}
// ─── Z-set canonical equality (the honest equality for the theorem) ───────────
/**
 * Canonical form of a schema Z-set: a Z-set is an unordered weighted bag, so
 * its canonical representation sorts entries by field name (each name is unique
 * after applyDelta) and serialises the load-bearing attributes. Two schemas are
 * Z-set-equal iff their canonical strings match -- equality up to reordering,
 * which is the ONLY equality under which the braided-monoid law holds.
 */
export function canonicalSchema(schema) {
    const rows = schema
        .map(e => ({
        name: e.field.name,
        type: e.field.type,
        required: e.field.required,
        default: e.field.default ?? null,
        weight: e.weight,
    }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return JSON.stringify(rows);
}
/** Z-set equality: equal as unordered weighted bags (text-comparable). */
export function schemaEqual(a, b) {
    return canonicalSchema(a) === canonicalSchema(b);
}
/** Canonical form of a materialized view (rows already key-sorted by projectRow). */
export function canonicalView(view) {
    return JSON.stringify({ fields: [...view.fields].sort(), rows: view.rows });
}
