import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ofArray as gSetOfArray, stringCompare } from "./g-set";
import { addWithSlot, empty, ofGSet as moduloOfGSet, toArray, toSlotArray, } from "./modulo-g-set";
function mergeHeat(left, right) {
    return {
        forgotten: gSetOfArray(stringCompare, [...left.forgotten, ...right.forgotten]),
        units: left.units + right.units,
    };
}
function stateOutput(state, heat, rejected, admissions) {
    return {
        admissions,
        exterior: toArray(stringCompare, state),
        heatForgotten: [...heat.forgotten],
        heatUnits: heat.units,
        rejected,
        stateSlots: toSlotArray(state),
    };
}
function replayOps(vector) {
    const start = empty(vector.config);
    if (!start.ok)
        return { error: start.error.kind, slots: start.error.slots };
    let state = start.value;
    let heat = { forgotten: [], units: 0 };
    let rejected = 0;
    const admissions = [];
    for (const op of vector.ops ?? []) {
        const added = addWithSlot(stringCompare, op.slot, op.value, state);
        if (!added.ok)
            return { error: added.error.kind, slots: added.error.slots };
        state = added.value.state;
        heat = mergeHeat(heat, added.value.heat);
        if (added.value.admission === "rejected-by-collision")
            rejected += 1;
        admissions.push({ admission: added.value.admission, slot: added.value.slot });
    }
    return stateOutput(state, heat, rejected, admissions);
}
function slotOf(vector) {
    if (vector.slotFunction !== "parse-int-mod-slots") {
        throw new Error(`unsupported modulo-gset slotFunction for vector ${vector.id}`);
    }
    return (value) => Number.parseInt(value, 10);
}
function replayFromGSet(vector) {
    const source = gSetOfArray(stringCompare, vector.sourceValues ?? []);
    const projected = moduloOfGSet(stringCompare, slotOf(vector), vector.config, source);
    if (!projected.ok)
        return { error: projected.error.kind, slots: projected.error.slots };
    return stateOutput(projected.value.state, projected.value.heat, projected.value.rejected, []);
}
function replay(vector) {
    return vector.mode === "from-gset" ? replayFromGSet(vector) : replayOps(vector);
}
describe("ModuloGSet", () => {
    const vectors = JSON.parse(readFileSync(join(import.meta.dir, "../../../tests/cross-verification/modulo-gset/vectors.json"), "utf8"));
    const tsOutput = JSON.parse(readFileSync(join(import.meta.dir, "../../../tests/cross-verification/modulo-gset/ts-output.json"), "utf8"));
    it("replays shared vectors to the canonical expected outputs", () => {
        expect(vectors.primitive).toBe("modulo-gset");
        expect(vectors.version).toBe("v1");
        expect(vectors.vectors.length).toBeGreaterThan(0);
        for (const vector of vectors.vectors) {
            expect(replay(vector)).toEqual(vector.expected);
        }
    });
    it("keeps committed TS oracle output synchronized with the implementation", () => {
        expect(tsOutput._source).toBe("hand-port");
        for (const vector of vectors.vectors) {
            expect(tsOutput[vector.id]).toEqual(replay(vector));
        }
    });
});
