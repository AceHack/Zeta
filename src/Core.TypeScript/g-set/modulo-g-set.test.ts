import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ofArray as gSetOfArray, stringCompare, type GSet } from "./g-set";
import {
  addWithSlot,
  empty,
  ofGSet as moduloOfGSet,
  toArray,
  toSlotArray,
  type ModuloGSet,
  type ModuloGSetAdmission,
  type ModuloGSetConfig,
  type ModuloGSetHeat,
} from "./modulo-g-set";

interface VectorOp {
  readonly value: string;
  readonly slot: number;
}

interface Vector {
  readonly id: string;
  readonly config: ModuloGSetConfig;
  readonly mode: "ops" | "from-gset";
  readonly ops?: readonly VectorOp[];
  readonly sourceValues?: readonly string[];
  readonly slotFunction?: "parse-int-mod-slots";
  readonly expected: Output;
}

type Output =
  | {
      readonly error: "non-positive-slots";
      readonly slots: number;
    }
  | {
      readonly admissions: readonly { readonly admission: ModuloGSetAdmission; readonly slot: number }[];
      readonly exterior: readonly string[];
      readonly heatForgotten: readonly string[];
      readonly heatUnits: number;
      readonly rejected: number;
      readonly stateSlots: readonly { readonly slot: number; readonly value: string }[];
    };

interface VectorsFile {
  readonly primitive: string;
  readonly version: string;
  readonly vectors: readonly Vector[];
}

function mergeHeat(left: ModuloGSetHeat<string>, right: ModuloGSetHeat<string>): ModuloGSetHeat<string> {
  return {
    forgotten: gSetOfArray(stringCompare, [...left.forgotten, ...right.forgotten]),
    units: left.units + right.units,
  };
}

function stateOutput(
  state: ModuloGSet<string>,
  heat: ModuloGSetHeat<string>,
  rejected: number,
  admissions: readonly { readonly admission: ModuloGSetAdmission; readonly slot: number }[],
): Output {
  return {
    admissions,
    exterior: toArray(stringCompare, state),
    heatForgotten: [...heat.forgotten],
    heatUnits: heat.units,
    rejected,
    stateSlots: toSlotArray(state),
  };
}

function replayOps(vector: Vector): Output {
  const start = empty<string>(vector.config);
  if (!start.ok) return { error: start.error.kind, slots: start.error.slots };

  let state = start.value;
  let heat: ModuloGSetHeat<string> = { forgotten: [], units: 0 };
  let rejected = 0;
  const admissions: { admission: ModuloGSetAdmission; slot: number }[] = [];

  for (const op of vector.ops ?? []) {
    const added = addWithSlot(stringCompare, op.slot, op.value, state);
    if (!added.ok) return { error: added.error.kind, slots: added.error.slots };

    state = added.value.state;
    heat = mergeHeat(heat, added.value.heat);
    if (added.value.admission === "rejected-by-collision") rejected += 1;
    admissions.push({ admission: added.value.admission, slot: added.value.slot });
  }

  return stateOutput(state, heat, rejected, admissions);
}

function slotOf(vector: Vector): (value: string) => number {
  if (vector.slotFunction !== "parse-int-mod-slots") {
    throw new Error(`unsupported modulo-gset slotFunction for vector ${vector.id}`);
  }

  return (value) => Number.parseInt(value, 10);
}

function replayFromGSet(vector: Vector): Output {
  const source: GSet<string> = gSetOfArray(stringCompare, vector.sourceValues ?? []);
  const projected = moduloOfGSet(stringCompare, slotOf(vector), vector.config, source);
  if (!projected.ok) return { error: projected.error.kind, slots: projected.error.slots };
  return stateOutput(projected.value.state, projected.value.heat, projected.value.rejected, []);
}

function replay(vector: Vector): Output {
  return vector.mode === "from-gset" ? replayFromGSet(vector) : replayOps(vector);
}

describe("ModuloGSet", () => {
  const vectors = JSON.parse(
    readFileSync(join(import.meta.dir, "../../../tests/cross-verification/modulo-gset/vectors.json"), "utf8"),
  ) as VectorsFile;
  const tsOutput = JSON.parse(
    readFileSync(join(import.meta.dir, "../../../tests/cross-verification/modulo-gset/ts-output.json"), "utf8"),
  ) as Record<string, Output | string>;

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
