import { readFileSync } from "fs";
import { parse } from "../../../src/Core.TypeScript/yaml/dom";
import type { YamlValue } from "../../../src/Core.TypeScript/yaml/dom";

// Cross-language ZetaId byte-lock. Each `<lang>-output.json` is
// `{ [id]: hexString | { hex, crockford } }`. Compares present oracles
// against each other AND against `vectors.yaml` `expected_hex` /
// `expected_crockford`. A mutually consistent but stale output set
// must fail — that was Gap 1 in README.md (closed).
//
// MUMPS is a required oracle (Gap 2, closed): missing `mumps-output.json`
// fails closed. The other five language files stay optional-if-absent so a
// partial checkout can still pin TS against the fixture.
//
// `parse-reject` vectors store the illegal Crockford input in
// `expected_crockford`; oracles emit `crockford: "rejected"`. Pin hex
// to `expected_hex` ("rejected") and crockford to that same reject
// token, not the input string.

export type OracleValue = string | { hex: string; crockford?: string };
export type OracleMap = Record<string, OracleValue>;

export type CanonicalVector = {
  id: string;
  type?: string;
  expectedHex: string;
  expectedCrockford: string;
};

export function valueHex(v: OracleValue | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "string" ? v : v.hex;
}

export function valueCrockford(v: OracleValue | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "string" ? undefined : v.crockford;
}

export function expectedCrockfordForOutput(v: CanonicalVector): string {
  return v.type === "parse-reject" ? "rejected" : v.expectedCrockford;
}

function expectMap(v: YamlValue, ctx: string): Array<[string, YamlValue]> {
  if (v.t !== "Map") throw new Error(`expected Map at ${ctx}, got ${v.t}`);
  return v.entries;
}

function field(entries: Array<[string, YamlValue]>, key: string, ctx: string): YamlValue {
  const found = entries.find(([k]) => k === key);
  if (found === undefined) throw new Error(`missing field '${key}' at ${ctx}`);
  return found[1];
}

function asStr(v: YamlValue, ctx: string): string {
  if (v.t !== "Str") throw new Error(`expected Str at ${ctx}, got ${v.t}`);
  return v.value;
}

export function loadCanonicalVectors(yamlText: string): CanonicalVector[] {
  const parsed = parse(yamlText);
  if (!parsed.ok) {
    throw new Error(`vectors.yaml declined: ${parsed.feedback}`);
  }
  const top = expectMap(parsed.value, "<root>");
  const vectorsVal = field(top, "vectors", "<root>");
  if (vectorsVal.t !== "Seq") {
    throw new Error(`expected Seq at vectors, got ${vectorsVal.t}`);
  }
  return vectorsVal.items.map((item, i) => {
    const ctx = `vectors[${i}]`;
    const m = expectMap(item, ctx);
    const typeVal = m.find(([k]) => k === "type");
    const vec: CanonicalVector = {
      id: asStr(field(m, "id", ctx), `${ctx}.id`),
      expectedHex: asStr(field(m, "expected_hex", ctx), `${ctx}.expected_hex`),
      expectedCrockford: asStr(
        field(m, "expected_crockford", ctx),
        `${ctx}.expected_crockford`,
      ),
    };
    if (typeVal) vec.type = asStr(typeVal[1], `${ctx}.type`);
    return vec;
  });
}

export type CompareResult = {
  mismatches: string[];
  implCounts: Record<string, number | "MISSING">;
};

export function compareOracles(
  fixture: readonly CanonicalVector[],
  impls: Record<string, OracleMap | null>,
  required: readonly string[] = [],
): CompareResult {
  const mismatches: string[] = [];
  const implCounts: Record<string, number | "MISSING"> = {};
  for (const [name, impl] of Object.entries(impls)) {
    implCounts[name] = impl === null ? "MISSING" : Object.keys(impl).length;
  }

  for (const name of required) {
    if (impls[name] === null || impls[name] === undefined) {
      mismatches.push(
        `${name} output missing — required oracle (assert-don't-skip).`,
      );
    }
  }

  const ts = impls.TS;
  if (ts === null || ts === undefined) {
    mismatches.push("ts-output.json missing — run the TS cross-verify first.");
    return { mismatches, implCounts };
  }

  const fixtureIds = fixture.map((v) => v.id);
  const fixtureSet = new Set(fixtureIds);
  const tsKeys = Object.keys(ts);
  const tsKeySet = new Set(tsKeys);

  if (fixtureIds.length !== new Set(fixtureIds).size) {
    mismatches.push("Duplicate vector id in vectors.yaml");
  }

  for (const id of fixtureIds) {
    if (!tsKeySet.has(id)) {
      mismatches.push(`Fixture vector missing from TS: ${id}`);
    }
  }
  for (const key of tsKeys) {
    if (!fixtureSet.has(key)) {
      mismatches.push(`TS vector not present in vectors.yaml: ${key}`);
    }
  }

  for (const [name, impl] of Object.entries(impls)) {
    if (name === "TS" || impl === null) continue;
    const implKeys = Object.keys(impl);
    for (const k of implKeys) {
      if (!tsKeySet.has(k)) {
        mismatches.push(`Extra vector in ${name} not present in TS: ${k}`);
      }
    }
    if (implKeys.length !== tsKeys.length) {
      mismatches.push(`Vector count mismatch: TS=${tsKeys.length} ${name}=${implKeys.length}`);
    }
  }

  const byId = new Map(fixture.map((v) => [v.id, v]));

  for (const key of tsKeys) {
    const canonical = byId.get(key);
    const tsHex = valueHex(ts[key]);
    const tsCrockford = valueCrockford(ts[key]);

    if (canonical !== undefined) {
      const wantCrockford = expectedCrockfordForOutput(canonical);
      if (tsHex !== canonical.expectedHex) {
        mismatches.push(
          `Mismatch ${key} hex: TS=${tsHex} fixture=${canonical.expectedHex}`,
        );
      }
      if (tsCrockford !== undefined && tsCrockford !== wantCrockford) {
        mismatches.push(
          `Mismatch ${key} crockford: TS=${tsCrockford} fixture=${wantCrockford}`,
        );
      }
    }

    for (const [name, impl] of Object.entries(impls)) {
      if (name === "TS" || impl === null) continue;
      const implHex = valueHex(impl[key]);
      const implCrockford = valueCrockford(impl[key]);
      if (tsHex !== implHex) {
        mismatches.push(`Mismatch ${key} hex: TS=${tsHex} ${name}=${implHex ?? "MISSING"}`);
      }
      if (tsCrockford !== implCrockford) {
        mismatches.push(
          `Mismatch ${key} crockford: TS=${tsCrockford} ${name}=${implCrockford ?? "MISSING"}`,
        );
      }
    }
  }

  return { mismatches, implCounts };
}

function loadJson(path: string): OracleMap | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as OracleMap;
  } catch {
    return null;
  }
}

function main(): number {
  let fixture: CanonicalVector[];
  try {
    fixture = loadCanonicalVectors(readFileSync("vectors.yaml", "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`vectors.yaml: ${message}`);
    return 1;
  }

  const impls: Record<string, OracleMap | null> = {
    TS: loadJson("ts-output.json"),
    "F#": loadJson("fsharp-output.json"),
    "C#": loadJson("cs-output.json"),
    Rust: loadJson("rust-output.json"),
    Py: loadJson("python-output.json"),
    Go: loadJson("go-output.json"),
    Mumps: loadJson("mumps-output.json"),
  };

  const { mismatches, implCounts } = compareOracles(fixture, impls, ["Mumps"]);

  console.log(`Cross-verification across implementations:`);
  console.log(`  fixture: ${String(fixture.length)} vectors`);
  for (const name of ["TS", "F#", "C#", "Rust", "Py", "Go", "Mumps"]) {
    const count = implCounts[name];
    const shown = count === "MISSING" ? "MISSING" : `${String(count)} vectors`;
    console.log(`  ${name.padEnd(6, " ")} ${shown}`);
  }

  for (const line of mismatches) console.error(line);

  if (mismatches.length === 0) {
    console.log(`✅ All implementations agree on ${fixture.length} vectors (pinned to vectors.yaml).`);
    return 0;
  }
  console.log(`❌ ${mismatches.length} mismatches.`);
  return 1;
}

if (import.meta.main) {
  process.exit(main());
}
