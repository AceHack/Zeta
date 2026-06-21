import { ofArray } from "./g-set";
export function emptyHeat() {
    return { forgotten: [], units: 0 };
}
function validate(config) {
    return config.slots <= 0
        ? { ok: false, error: { kind: "non-positive-slots", slots: config.slots } }
        : { ok: true, value: config };
}
function normalizeSlot(slots, rawSlot) {
    const whole = Math.trunc(rawSlot);
    const remainder = whole % slots;
    return remainder < 0 ? remainder + slots : remainder;
}
function replaceSlot(slots, slot, value) {
    const without = slots.filter((entry) => entry.slot !== slot);
    return [...without, { slot, value }].sort((a, b) => a.slot - b.slot);
}
function heatOf(compare, value) {
    return { forgotten: ofArray(compare, [value]), units: 1 };
}
function combineHeat(compare, left, right) {
    return {
        forgotten: ofArray(compare, [...left.forgotten, ...right.forgotten]),
        units: left.units + right.units,
    };
}
export function empty(config) {
    const valid = validate(config);
    if (!valid.ok)
        return valid;
    return { ok: true, value: { config: valid.value, slotValues: [] } };
}
export function toSlotArray(modulo) {
    return [...modulo.slotValues];
}
export function toGSet(compare, modulo) {
    return ofArray(compare, modulo.slotValues.map((entry) => entry.value));
}
export function toArray(compare, modulo) {
    return [...toGSet(compare, modulo)];
}
export function count(modulo) {
    return modulo.slotValues.length;
}
export function contains(compare, modulo, value) {
    return modulo.slotValues.some((entry) => compare(entry.value, value) === 0);
}
export function addWithSlot(compare, rawSlot, value, modulo) {
    const valid = validate(modulo.config);
    if (!valid.ok)
        return valid;
    const slot = normalizeSlot(valid.value.slots, rawSlot);
    const existing = modulo.slotValues.find((entry) => entry.slot === slot);
    if (existing === undefined) {
        return {
            ok: true,
            value: {
                state: { config: valid.value, slotValues: replaceSlot(modulo.slotValues, slot, value) },
                admission: "admitted",
                slot,
                heat: emptyHeat(),
            },
        };
    }
    if (compare(existing.value, value) === 0) {
        return {
            ok: true,
            value: {
                state: modulo,
                admission: "already-present",
                slot,
                heat: emptyHeat(),
            },
        };
    }
    if (valid.value.collisionPolicy === "reject-collision") {
        return {
            ok: true,
            value: {
                state: modulo,
                admission: "rejected-by-collision",
                slot,
                heat: emptyHeat(),
            },
        };
    }
    return {
        ok: true,
        value: {
            state: { config: valid.value, slotValues: replaceSlot(modulo.slotValues, slot, value) },
            admission: "replaced",
            slot,
            heat: heatOf(compare, existing.value),
        },
    };
}
export function add(compare, slotOf, value, modulo) {
    return addWithSlot(compare, slotOf(value), value, modulo);
}
export function ofArrayModulo(compare, slotOf, config, values) {
    const initial = empty(config);
    if (!initial.ok)
        return initial;
    let state = initial.value;
    let heat = emptyHeat();
    let rejected = 0;
    for (const value of values) {
        const added = add(compare, slotOf, value, state);
        if (!added.ok)
            return added;
        state = added.value.state;
        heat = combineHeat(compare, heat, added.value.heat);
        if (added.value.admission === "rejected-by-collision")
            rejected += 1;
    }
    return { ok: true, value: { state, heat, rejected } };
}
export function ofGSet(compare, slotOf, config, values) {
    return ofArrayModulo(compare, slotOf, config, values);
}
