import { T, F, N, type Tri } from "./types";
import {
  fromBool,
  isLiving,
  isCertain,
  cooperate,
  measure,
  mapTri,
  bindTri,
  notTri,
  andTri,
  orTri,
} from "./tri-boolean";
import { parse, type YamlValue } from "../yaml/dom";

function toTri(s: string): Tri {
  switch (s) {
    case "T":
      return T;
    case "F":
      return F;
    case "N":
      return N;
    default:
      throw new Error(`unknown tri state: ${s}`);
  }
}

function toStr(t: Tri): string {
  return t.s;
}

// Read the fixture through our YAML port.
function asMap(v: YamlValue, ctx: string): Array<[string, YamlValue]> {
  if (v.t !== "Map") throw new Error(`expected Map at ${ctx}, got ${v.t}`);
  return v.entries;
}

function field(entries: Array<[string, YamlValue]>, key: string): YamlValue | undefined {
  for (const [k, val] of entries) if (k === key) return val;
  return undefined;
}

function asStr(v: YamlValue | undefined): string | undefined {
  return v !== undefined && v.t === "Str" ? v.value : undefined;
}

function _asBool(v: YamlValue | undefined): boolean | undefined {
  return v !== undefined && v.t === "Bool" ? v.value : undefined;
}
// Re-export for future use (avoids TS6133 while keeping the helper available)
export { _asBool as asBool };

const yamlText = await Bun.file("../../../tests/cross-verification/tri-boolean/vectors.yaml").text();
const parsed = parse(yamlText);
if (!parsed.ok) {
  console.error(`YAML parse failed: ${JSON.stringify(parsed.feedback)}`);
  process.exit(1);
}

const root = asMap(parsed.value, "root");
const vectorsNode = field(root, "vectors");
if (vectorsNode === undefined || vectorsNode.t !== "Seq") {
  console.error("fixture: missing `vectors` sequence");
  process.exit(1);
}

const results: Record<string, any> = {};

for (const item of vectorsNode.items) {
  const e = asMap(item, "vector");
  const id = asStr(field(e, "id"))!;
  const type = asStr(field(e, "type"))!;

  if (type === "unary") {
    const stateStr = asStr(field(e, "state"))!;
    const t = toTri(stateStr);

    const mRes = measure(t);

    results[id] = {
      type: "unary",
      state: stateStr,
      isLiving: isLiving(t),
      isCertain: isCertain(t),
      notState: toStr(notTri(t)),
      cooperateState: toStr(cooperate(t)),
      measureOk: mRes.ok,
      measureValue: mRes.ok ? mRes.value : false,
      measureFeedback: mRes.ok ? "" : mRes.feedback.reason,
      mapNot: toStr(mapTri(t, (b) => !b)),
      bindNot: toStr(bindTri(t, (b) => fromBool(!b))),
      bindToT: toStr(bindTri(t, () => T)),
    };
  } else if (type === "binary") {
    const leftStr = asStr(field(e, "left"))!;
    const rightStr = asStr(field(e, "right"))!;
    const left = toTri(leftStr);
    const right = toTri(rightStr);

    results[id] = {
      type: "binary",
      left: leftStr,
      right: rightStr,
      expectedAnd: toStr(andTri(left, right)),
      expectedOr: toStr(orTri(left, right)),
    };
  }
}

// Write outputs to tests/cross-verification/tri-boolean/ts-output.json
await Bun.write(
  "../../../tests/cross-verification/tri-boolean/ts-output.json",
  JSON.stringify(results, null, 2) + "\n"
);
console.log(`TS cross-verify completed for ${vectorsNode.items.length} vectors.`);
