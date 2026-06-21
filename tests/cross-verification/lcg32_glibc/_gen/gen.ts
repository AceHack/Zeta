import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fromCanonicalJson, type Tagged } from "../../../../src/Core.TypeScript/dynamic-value/json.ts";
import { parse, type YamlValue } from "../../../../src/Core.TypeScript/yaml/dom.ts";
import * as generatorIr from "../../_harness/generator-ir-registry.ts";

const MASK = (1n << 32n) - 1n;
const u32 = (x: bigint): bigint => x & MASK;
const fromI64 = (i: bigint): bigint => u32(i);

type MixOp =
  | { readonly op: "mul"; readonly k: bigint }
  | { readonly op: "xorshr"; readonly s: bigint }
  | { readonly op: "rotl"; readonly r: bigint }
  | { readonly op: "xrotxor"; readonly rs: readonly bigint[] }
  | { readonly op: "xshrxor"; readonly ss: readonly bigint[] }
  | { readonly op: "add"; readonly k: bigint };

const zetaId = generatorIr.idOf("rng.lcg32_glibc", 1);
const irRow = generatorIr.byZetaId(zetaId);
if (!irRow) throw new Error(`no IR row on the relation for rng.lcg32_glibc@1`);
const decoded = fromCanonicalJson(irRow.irCanonicalJson);
if (!decoded.ok) throw new Error(`rng.lcg32_glibc@1 IR row is not a canonical DynamicValue: ${decoded.error}`);

function field(obj: Tagged, key: string): Tagged {
  if (obj.t !== "obj") throw new Error("IR: expected object");
  const hit = obj.v.find(([k]) => k === key);
  if (!hit) throw new Error(`IR: missing field "${key}"`);
  return hit[1];
}
function asInt(v: Tagged): bigint {
  if (v.t !== "int") throw new Error("IR: expected int");
  return BigInt(v.v);
}
function asStr(v: Tagged): string {
  if (v.t !== "str") throw new Error("IR: expected string");
  return v.v;
}
function asIntList(v: Tagged): bigint[] {
  if (v.t !== "arr") throw new Error("IR: expected array");
  return v.v.map(asInt);
}

const schema = asStr(field(decoded.value, "schema"));
if (schema !== "zeta-ir-v4") throw new Error(`IR: lcg32_glibc expects schema zeta-ir-v4, got ${schema}`);
const width = asInt(field(decoded.value, "width"));
if (width !== 32n) throw new Error(`IR: lcg32_glibc expects width 32, got ${width}`);

function parseOps(ir: Tagged): readonly MixOp[] {
  const opsNode = field(ir, "ops");
  if (opsNode.t !== "arr") throw new Error("IR: ops must be an array");
  return opsNode.v.map((node): MixOp => {
    const op = asStr(field(node, "op"));
    switch (op) {
      case "mul": return { op: "mul", k: fromI64(asInt(field(node, "k"))) };
      case "xorshr": return { op: "xorshr", s: asInt(field(node, "s")) };
      case "rotl": return { op: "rotl", r: asInt(field(node, "r")) };
      case "xrotxor": return { op: "xrotxor", rs: asIntList(field(node, "rs")) };
      case "xshrxor": return { op: "xshrxor", ss: asIntList(field(node, "ss")) };
      case "add": return { op: "add", k: fromI64(asInt(field(node, "k"))) };
      default: throw new Error(`IR: unknown op "${op}"`);
    }
  });
}
const LCG_IR: readonly MixOp[] = parseOps(decoded.value);

const rotl = (x: bigint, r: bigint, w: bigint): bigint => {
  const k = ((r % w) + w) % w;
  return k === 0n ? u32(x) : u32(((x << k) | (x >> (w - k))) & MASK);
};

function mix(x: bigint): bigint {
  return LCG_IR.reduce((z, step) => {
    switch (step.op) {
      case "mul": return u32(z * step.k);
      case "xorshr": return u32(z ^ (z >> step.s));
      case "rotl": return rotl(z, step.r, width);
      case "xrotxor": return u32(step.rs.reduce((acc, r) => acc ^ rotl(z, r, width), z));
      case "xshrxor": return u32(step.ss.reduce((acc, s) => acc ^ (z >> s), z));
      case "add": return u32(z + step.k);
    }
  }, u32(x));
}

const dir = dirname(import.meta.dir);
const vectorsPath = join(dir, "vectors.yaml");
const vectorsYaml = readFileSync(vectorsPath, "utf8");

interface Vector {
  readonly id: string;
  readonly state: bigint;
}

function asYamlMap(v: YamlValue, ctx: string): Array<[string, YamlValue]> {
  if (v.t !== "Map") throw new Error(`expected YAML map at ${ctx}, got ${v.t}`);
  return v.entries;
}

function yamlField(entries: Array<[string, YamlValue]>, key: string): YamlValue | undefined {
  for (const [k, val] of entries) if (k === key) return val;
  return undefined;
}

function yamlStr(v: YamlValue | undefined, ctx: string): string {
  if (v?.t !== "Str") throw new Error(`expected YAML string at ${ctx}`);
  return v.value;
}

function yamlInt(v: YamlValue | undefined, ctx: string): bigint {
  if (v?.t !== "Int") throw new Error(`expected YAML int at ${ctx}`);
  return v.value;
}

function loadVectors(text: string): readonly Vector[] {
  const parsed = parse(text);
  if (!parsed.ok) throw new Error(`YAML parse failed: ${JSON.stringify(parsed.feedback)}`);
  const root = asYamlMap(parsed.value, "root");
  const vectorsNode = yamlField(root, "vectors");
  if (vectorsNode?.t !== "Seq") throw new Error("fixture: missing YAML vectors sequence");
  return vectorsNode.items.map((item, i) => {
    const entries = asYamlMap(item, `vectors[${i}]`);
    return {
      id: yamlStr(yamlField(entries, "id"), `vectors[${i}].id`),
      state: yamlInt(yamlField(entries, "state"), `vectors[${i}].state`),
    };
  });
}

const vectors = loadVectors(vectorsYaml);

const out: Record<string, string> = { _source: "generated-from-ir" };
for (const v of vectors) {
  out[v.id] = mix(v.state).toString();
}
writeFileSync(join(dir, 'ts-output.json'), JSON.stringify(out, null, 2));
