import { type Compare, type GSet, ofArray } from "./g-set";

export type ModuloGSetCollisionPolicy = "reject-collision" | "replace-existing";

export interface ModuloGSetConfig {
  readonly slots: number;
  readonly collisionPolicy: ModuloGSetCollisionPolicy;
}

export interface ModuloGSetError {
  readonly kind: "non-positive-slots";
  readonly slots: number;
}

export type ModuloResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ModuloGSetError };

export type ModuloGSetAdmission = "admitted" | "already-present" | "replaced" | "rejected-by-collision";

export interface ModuloGSetSlot<T> {
  readonly slot: number;
  readonly value: T;
}

export interface ModuloGSetHeat<T> {
  readonly forgotten: GSet<T>;
  readonly units: number;
}

export interface ModuloGSet<T> {
  readonly config: ModuloGSetConfig;
  readonly slotValues: readonly ModuloGSetSlot<T>[];
}

export interface ModuloGSetAddResult<T> {
  readonly state: ModuloGSet<T>;
  readonly admission: ModuloGSetAdmission;
  readonly slot: number;
  readonly heat: ModuloGSetHeat<T>;
}

export interface ModuloGSetProjectionResult<T> {
  readonly state: ModuloGSet<T>;
  readonly heat: ModuloGSetHeat<T>;
  readonly rejected: number;
}

export function emptyHeat<T>(): ModuloGSetHeat<T> {
  return { forgotten: [], units: 0 };
}

function validate(config: ModuloGSetConfig): ModuloResult<ModuloGSetConfig> {
  return config.slots <= 0
    ? { ok: false, error: { kind: "non-positive-slots", slots: config.slots } }
    : { ok: true, value: config };
}

function normalizeSlot(slots: number, rawSlot: number): number {
  const whole = Math.trunc(rawSlot);
  const remainder = whole % slots;
  return remainder < 0 ? remainder + slots : remainder;
}

function replaceSlot<T>(slots: readonly ModuloGSetSlot<T>[], slot: number, value: T): readonly ModuloGSetSlot<T>[] {
  const without = slots.filter((entry) => entry.slot !== slot);
  return [...without, { slot, value }].sort((a, b) => a.slot - b.slot);
}

function heatOf<T>(compare: Compare<T>, value: T): ModuloGSetHeat<T> {
  return { forgotten: ofArray(compare, [value]), units: 1 };
}

function combineHeat<T>(compare: Compare<T>, left: ModuloGSetHeat<T>, right: ModuloGSetHeat<T>): ModuloGSetHeat<T> {
  return {
    forgotten: ofArray(compare, [...left.forgotten, ...right.forgotten]),
    units: left.units + right.units,
  };
}

export function empty<T>(config: ModuloGSetConfig): ModuloResult<ModuloGSet<T>> {
  const valid = validate(config);
  if (!valid.ok) return valid;
  return { ok: true, value: { config: valid.value, slotValues: [] } };
}

export function toSlotArray<T>(modulo: ModuloGSet<T>): ModuloGSetSlot<T>[] {
  return [...modulo.slotValues];
}

export function toGSet<T>(compare: Compare<T>, modulo: ModuloGSet<T>): GSet<T> {
  return ofArray(
    compare,
    modulo.slotValues.map((entry) => entry.value),
  );
}

export function toArray<T>(compare: Compare<T>, modulo: ModuloGSet<T>): T[] {
  return [...toGSet(compare, modulo)];
}

export function count<T>(modulo: ModuloGSet<T>): number {
  return modulo.slotValues.length;
}

export function contains<T>(compare: Compare<T>, modulo: ModuloGSet<T>, value: T): boolean {
  return modulo.slotValues.some((entry) => compare(entry.value, value) === 0);
}

export function addWithSlot<T>(
  compare: Compare<T>,
  rawSlot: number,
  value: T,
  modulo: ModuloGSet<T>,
): ModuloResult<ModuloGSetAddResult<T>> {
  const valid = validate(modulo.config);
  if (!valid.ok) return valid;

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

export function add<T>(
  compare: Compare<T>,
  slotOf: (value: T) => number,
  value: T,
  modulo: ModuloGSet<T>,
): ModuloResult<ModuloGSetAddResult<T>> {
  return addWithSlot(compare, slotOf(value), value, modulo);
}

export function ofArrayModulo<T>(
  compare: Compare<T>,
  slotOf: (value: T) => number,
  config: ModuloGSetConfig,
  values: readonly T[],
): ModuloResult<ModuloGSetProjectionResult<T>> {
  const initial = empty<T>(config);
  if (!initial.ok) return initial;

  let state = initial.value;
  let heat = emptyHeat<T>();
  let rejected = 0;

  for (const value of values) {
    const added = add(compare, slotOf, value, state);
    if (!added.ok) return added;
    state = added.value.state;
    heat = combineHeat(compare, heat, added.value.heat);
    if (added.value.admission === "rejected-by-collision") rejected += 1;
  }

  return { ok: true, value: { state, heat, rejected } };
}

export function ofGSet<T>(
  compare: Compare<T>,
  slotOf: (value: T) => number,
  config: ModuloGSetConfig,
  values: GSet<T>,
): ModuloResult<ModuloGSetProjectionResult<T>> {
  return ofArrayModulo(compare, slotOf, config, values);
}
