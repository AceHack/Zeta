// schema-aware-join.test.ts -- Rx join propagation for cross-Z-set schema
// evolution (Task 8). Designed by Soraya (formal-verification-expert) on
// Otto's invocation.
//
// Routing verdict (BP-16): the kernel is pure / total / synchronous /
// deterministic, with one load-bearing ALGEBRAIC claim (braided-free-monoid
// commutation). Primary tool = fast-check (TS analogue of FsCheck) for the
// commutation law over a generator of disjoint-field deltas; cross-checked by
// a deterministic worked golden + an explicit braiding (same-field) COUNTER-
// example that proves the disjointness precondition is load-bearing. No
// TLA+ (no temporal axis), no Z3 (the arithmetic is just Z-set weight sums
// already exercised by schema-zset.test.ts), no Lean (no deep-math axis).
//
// ASCII only (BP-09).
import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { schemaZSet, applyDelta, currentSchema, } from "./schema-zset";
import { SchemaCell, SchemaAwareJoin, projectRow, materialize, canonicalSchema, schemaEqual, canonicalView, } from "./schema-aware-join";
// ─── Fixtures ─────────────────────────────────────────────────────────────────
const BASE = [
    { name: "id", type: "string", required: true },
    { name: "title", type: "string", required: true },
];
const OWNER_NO_DEFAULT = { name: "owner", type: "zetaid", required: false };
const FLAG_WITH_DEFAULT = { name: "executable", type: "boolean", required: true, default: true };
const ADD_OWNER = { retract: [], insert: [OWNER_NO_DEFAULT] };
const ADD_FLAG = { retract: [], insert: [FLAG_WITH_DEFAULT] };
const REMOVE_TITLE = {
    retract: [{ name: "title", type: "string", required: true }],
    insert: [],
};
const ROWS = [
    { id: "r1", title: "first" }, // predating row (no owner, no executable)
    { id: "r2", title: "second", owner: "081KOWNER", executable: false }, // new-shape row
];
// ─── Requirement 1: observe a schema Z-set for changes (subscribe to deltas) ──
describe("SchemaCell -- subscribe to deltas", () => {
    test("evolve() notifies subscribers with (newSchema, delta), synchronously", () => {
        const cell = new SchemaCell(schemaZSet(BASE));
        const seen = [];
        cell.subscribe((schema, delta) => {
            seen.push({
                fields: currentSchema(schema).map(f => f.name),
                deltaInserts: delta.insert.map(f => f.name),
            });
        });
        cell.evolve(ADD_OWNER);
        // Synchronous: the notification is already recorded by the time evolve returns.
        expect(seen.length).toBe(1);
        expect(seen[0].deltaInserts).toEqual(["owner"]);
        expect(seen[0].fields).toContain("owner");
    });
    test("unsubscribe stops further notifications", () => {
        const cell = new SchemaCell(schemaZSet(BASE));
        let count = 0;
        const off = cell.subscribe(() => { count += 1; });
        cell.evolve(ADD_OWNER);
        off();
        cell.evolve(ADD_FLAG);
        expect(count).toBe(1);
    });
});
// ─── Requirement 2: field added -> downstream views re-evaluate ───────────────
describe("SchemaAwareJoin -- field ADDED re-evaluates the view", () => {
    test("add field WITH default -> predating rows degrade to the default; new rows keep their value", () => {
        const cell = new SchemaCell(schemaZSet(BASE));
        const join = new SchemaAwareJoin(cell, ROWS);
        // Before: executable is not in the schema, so it is absent from the view.
        expect(join.currentView().fields).not.toContain("executable");
        expect(join.currentView().rows[0]).not.toHaveProperty("executable");
        cell.evolve(ADD_FLAG); // schema delta on input A propagates through the join
        const view = join.currentView();
        expect(view.fields).toContain("executable");
        // Predating row r1 had no executable -> degrades to the field default (true).
        expect(view.rows[0].executable).toBe(true);
        // New-shape row r2 supplied executable=false -> its own value passes through.
        expect(view.rows[1].executable).toBe(false);
    });
    test("add field WITHOUT default -> predating rows omit it (graceful, no crash)", () => {
        const cell = new SchemaCell(schemaZSet(BASE));
        const join = new SchemaAwareJoin(cell, ROWS);
        cell.evolve(ADD_OWNER);
        const view = join.currentView();
        expect(view.fields).toContain("owner");
        expect(view.rows[0]).not.toHaveProperty("owner"); // r1 absent + no default -> dropped
        expect(view.rows[1].owner).toBe("081KOWNER"); // r2 supplied it -> passes through
    });
});
// ─── Requirement 3: field removed -> graceful degrade ─────────────────────────
describe("SchemaAwareJoin -- field REMOVED degrades gracefully", () => {
    test("removing a referenced field drops it from output without throwing", () => {
        const cell = new SchemaCell(schemaZSet(BASE));
        const join = new SchemaAwareJoin(cell, ROWS);
        expect(join.currentView().rows[0]).toHaveProperty("title");
        expect(() => cell.evolve(REMOVE_TITLE)).not.toThrow();
        const view = join.currentView();
        expect(view.fields).not.toContain("title");
        expect(view.rows[0]).not.toHaveProperty("title"); // gone, but row still resolves
        expect(view.rows[0].id).toBe("r1"); // surviving fields intact
    });
});
// ─── Glitch-freedom: exactly one emission per input change ────────────────────
describe("SchemaAwareJoin -- glitch-free (one emit per input change)", () => {
    test("each evolve / setData fires the view subscriber exactly once", () => {
        const cell = new SchemaCell(schemaZSet(BASE));
        const join = new SchemaAwareJoin(cell, ROWS);
        let emits = 0;
        join.subscribe(() => { emits += 1; });
        cell.evolve(ADD_FLAG); // 1
        cell.evolve(ADD_OWNER); // 2
        join.setData([{ id: "r3", title: "third" }]); // 3
        expect(emits).toBe(3);
        expect(join.emissions()).toBe(3);
    });
});
// ─── Requirement 5: DST-testable (deterministic, no real I/O) ─────────────────
describe("SchemaAwareJoin -- DST determinism", () => {
    test("same construction + same delta sequence -> byte-identical view and emit count", () => {
        const run = () => {
            const cell = new SchemaCell(schemaZSet(BASE));
            const join = new SchemaAwareJoin(cell, ROWS);
            cell.evolve(ADD_FLAG);
            cell.evolve(ADD_OWNER);
            cell.evolve(REMOVE_TITLE);
            return { view: canonicalView(join.currentView()), emits: join.emissions() };
        };
        const a = run();
        const b = run();
        expect(a.view).toBe(b.view); // byte-identical (text golden, no binary in proof lineage)
        expect(a.emits).toBe(b.emits);
    });
});
// ─── Requirement 4: braided-free-monoid -- DISJOINT deltas commute ────────────
// Generators -------------------------------------------------------------------
const TYPES = ["boolean", "string", "uint8array", "string[]", "number", "zetaid"];
const NAME_POOL = ["a", "b", "c", "d", "e", "f", "g", "h"];
const fieldArb = (name) => fc.record({
    type: fc.constantFrom(...TYPES),
    required: fc.boolean(),
    hasDefault: fc.boolean(),
}).map(({ type, required, hasDefault }) => hasDefault ? { name, type, required, default: 0 } : { name, type, required });
/**
 * Generate a base schema and two field-DISJOINT deltas. Each pooled name is
 * assigned to exactly one bucket (base-only / d1 / d2), and within a delta's
 * bucket each name is independently an insert (not in base) or a retract (in
 * base). Disjoint buckets => d1 and d2 touch disjoint map keys => they commute.
 */
const disjointScenarioArb = fc
    .record({
    buckets: fc.array(fc.constantFrom(0, 1, 2), { minLength: NAME_POOL.length, maxLength: NAME_POOL.length }),
    actions: fc.array(fc.constantFrom("insert", "retract"), { minLength: NAME_POOL.length, maxLength: NAME_POOL.length }),
})
    .chain(({ buckets, actions }) => fc.tuple(...NAME_POOL.map(n => fieldArb(n))).map(fields => {
    const base = [];
    const d1 = { retract: [], insert: [] };
    const d2 = { retract: [], insert: [] };
    NAME_POOL.forEach((_name, i) => {
        const field = fields[i];
        const bucket = buckets[i];
        if (bucket === 0) {
            base.push(field); // base-only, untouched by either delta
            return;
        }
        const delta = bucket === 1 ? d1 : d2;
        if (actions[i] === "retract") {
            base.push(field); // present in base...
            delta.retract.push(field); // ...and this delta retracts it
        }
        else {
            delta.insert.push(field); // new field this delta adds
        }
    });
    return { base, d1, d2 };
}));
describe("braided-free-monoid -- disjoint schema deltas commute (up to Z-set equality)", () => {
    test("property: applyDelta(applyDelta(s,d1),d2) =Z= applyDelta(applyDelta(s,d2),d1)", () => {
        fc.assert(fc.property(disjointScenarioArb, ({ base, d1, d2 }) => {
            const s = schemaZSet(base);
            const left = applyDelta(applyDelta(s, d1), d2);
            const right = applyDelta(applyDelta(s, d2), d1);
            // NOT reference / array equality: Z-set equality (canonical, sorted).
            return schemaEqual(left, right);
        }), { numRuns: 1000 });
    });
    test("worked golden: ADD_OWNER and ADD_FLAG (disjoint) commute", () => {
        const s = schemaZSet(BASE);
        const left = applyDelta(applyDelta(s, ADD_OWNER), ADD_FLAG);
        const right = applyDelta(applyDelta(s, ADD_FLAG), ADD_OWNER);
        expect(canonicalSchema(left)).toBe(canonicalSchema(right));
        // And it really did add both fields.
        const names = currentSchema(left).map(f => f.name).sort();
        expect(names).toEqual(["executable", "id", "owner", "title"]);
    });
    test("array order DIFFERS even though Z-sets are equal (why === is the wrong claim)", () => {
        const s = schemaZSet(BASE);
        const left = applyDelta(applyDelta(s, ADD_OWNER), ADD_FLAG);
        const right = applyDelta(applyDelta(s, ADD_FLAG), ADD_OWNER);
        const leftOrder = left.map(e => e.field.name);
        const rightOrder = right.map(e => e.field.name);
        expect(leftOrder).not.toEqual(rightOrder); // ordered-array equality FAILS...
        expect(schemaEqual(left, right)).toBe(true); // ...but Z-set equality HOLDS
    });
    test("view-level corollary: disjoint deltas yield equal materialized views", () => {
        const left = materialize(applyDelta(applyDelta(schemaZSet(BASE), ADD_OWNER), ADD_FLAG), ROWS);
        const right = materialize(applyDelta(applyDelta(schemaZSet(BASE), ADD_FLAG), ADD_OWNER), ROWS);
        expect(canonicalView(left)).toBe(canonicalView(right));
    });
});
// ─── The braiding: SAME-field deltas do NOT commute (precondition is real) ────
describe("braiding (not symmetry) -- same-field deltas need not commute", () => {
    test("two inserts on the same name with different defs: last-writer-wins => order matters", () => {
        const s = schemaZSet(BASE);
        const dA = { retract: [], insert: [{ name: "tag", type: "string", required: false }] };
        const dB = { retract: [], insert: [{ name: "tag", type: "number", required: true }] };
        const ab = applyDelta(applyDelta(s, dA), dB); // dB wins the "tag" definition
        const ba = applyDelta(applyDelta(s, dB), dA); // dA wins the "tag" definition
        // Commutation FAILS: this is the braid, not a symmetry. If this assertion
        // ever flips to equal, the disjointness precondition on the commutation
        // theorem has silently become vacuous -- a Precondition/Statement drift
        // (verification-drift-auditor class) and the theorem above is mis-stated.
        expect(schemaEqual(ab, ba)).toBe(false);
    });
});
// ─── projectRow unit coverage (the add/degrade rule in isolation) ─────────────
describe("projectRow -- the single add/degrade rule", () => {
    test("present value passes; absent+default degrades; absent+no-default drops", () => {
        const fields = [
            { name: "id", type: "string", required: true },
            { name: "executable", type: "boolean", required: true, default: true },
            { name: "owner", type: "zetaid", required: false },
        ];
        const out = projectRow(fields, { id: "x" });
        expect(out.id).toBe("x"); // present
        expect(out.executable).toBe(true); // absent + default -> degrade
        expect(out).not.toHaveProperty("owner"); // absent + no default -> drop
    });
    test("output keys are in canonical sorted order (byte-stable)", () => {
        const fields = [
            { name: "zeta", type: "string", required: false },
            { name: "alpha", type: "string", required: false },
        ];
        const out = projectRow(fields, { zeta: "z", alpha: "a" });
        expect(Object.keys(out)).toEqual(["alpha", "zeta"]);
    });
});
