// zset-isa-v2 golden-vector oracle.
//
// Runs the committed v2 ISA vectors through the same ring-generic TS
// interpreter used by the source tests. This makes the primitive enforceable by
// cross-verify-all while the F#/C#/Rust/Go ports are still catching up.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { softMixGeneric, type ZetaIrV1 } from "../../../src/Core.TypeScript/algebra/soft-mix";
import { complexRing, realRing, type Complex, type WEntry } from "../../../src/Core.TypeScript/algebra/star-ring";

interface Vector {
  readonly id: string;
  readonly ops: readonly Record<string, unknown>[];
  readonly input: string;
  readonly expected?: string;
  readonly expected_support?: number;
  readonly expected_states?: readonly string[];
  readonly expected_support_complex?: number;
  readonly expected_support_real?: number;
}

interface VectorsFile {
  readonly width: number;
  readonly vectors: readonly Vector[];
}

interface TestIr {
  schema: string;
  generator: string;
  version: number;
  width: number;
  ops: Record<string, unknown>[];
}

type MutableVector = {
  -readonly [K in keyof Vector]: Vector[K];
};

const EPS = 1e-12;
const isZeroComplex = (w: Complex): boolean => w.re * w.re + w.im * w.im < EPS;
const isZeroReal = (w: number): boolean => Math.abs(w) < EPS;

function makeIr(width: number, ops: readonly Record<string, unknown>[]): TestIr {
  return { schema: "zeta-ir-v2", generator: "zset-isa-v2.oracle", version: 1, width, ops: [...ops] };
}

function states<W>(entries: readonly WEntry<bigint, W>[]): string[] {
  return entries.map((entry) => entry.key.toString()).sort((left, right) => Number(BigInt(left) - BigInt(right)));
}

function runComplex(width: number, vector: Vector): WEntry<bigint, Complex>[] {
  return softMixGeneric(
    makeIr(width, vector.ops) as unknown as ZetaIrV1,
    complexRing,
    isZeroComplex,
    [{ key: BigInt(vector.input), weight: complexRing.one }],
  );
}

function runReal(width: number, vector: Vector): WEntry<bigint, number>[] {
  return softMixGeneric(
    makeIr(width, vector.ops) as unknown as ZetaIrV1,
    realRing,
    isZeroReal,
    [{ key: BigInt(vector.input), weight: realRing.one }],
  );
}

function parseScalarString(line: string): string {
  const raw = line.split(":").slice(1).join(":").trim();
  return raw.replace(/^"|"$/g, "");
}

function parseNumberField(line: string): number {
  return Number(parseScalarString(line));
}

function parseStates(line: string): string[] {
  return JSON.parse(line.split(":").slice(1).join(":").trim()) as string[];
}

function parseOps(line: string): Record<string, unknown>[] {
  return JSON.parse(line.split(":").slice(1).join(":").trim()) as Record<string, unknown>[];
}

function parseVectorsFallback(text: string): VectorsFile {
  const lines = text.split(/\r?\n/);
  const widthLine = lines.find((line) => line.startsWith("width:"));
  if (widthLine === undefined) throw new Error("vectors.yaml missing width");

  const vectors: Vector[] = [];
  let current: Partial<MutableVector> | undefined;

  const flush = (): void => {
    if (current === undefined) return;
    if (current.id === undefined || current.ops === undefined || current.input === undefined) {
      throw new Error(`incomplete zset-isa-v2 vector: ${JSON.stringify(current)}`);
    }
    vectors.push(current as Vector);
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- id:")) {
      flush();
      current = { id: parseScalarString(trimmed) };
    } else if (current !== undefined && trimmed.startsWith("ops:")) {
      current.ops = parseOps(trimmed);
    } else if (current !== undefined && trimmed.startsWith("input:")) {
      current.input = parseScalarString(trimmed);
    } else if (current !== undefined && trimmed.startsWith("expected:")) {
      current.expected = parseScalarString(trimmed);
    } else if (current !== undefined && trimmed.startsWith("expected_support_complex:")) {
      current.expected_support_complex = parseNumberField(trimmed);
    } else if (current !== undefined && trimmed.startsWith("expected_support_real:")) {
      current.expected_support_real = parseNumberField(trimmed);
    } else if (current !== undefined && trimmed.startsWith("expected_support:")) {
      current.expected_support = parseNumberField(trimmed);
    } else if (current !== undefined && trimmed.startsWith("expected_states:")) {
      current.expected_states = parseStates(trimmed);
    }
  }

  flush();
  return { width: parseNumberField(widthLine), vectors };
}

function parseVectors(text: string): VectorsFile {
  const yaml = (globalThis as { Bun?: { YAML?: { parse(s: string): unknown } } }).Bun?.YAML;
  if (yaml !== undefined) return yaml.parse(text) as VectorsFile;
  return parseVectorsFallback(text);
}

const fixture = parseVectors(await Bun.file(join(import.meta.dir, "vectors.yaml")).text());
const out: Record<string, { complexStates: string[]; realStates: string[]; complexSupport: number; realSupport: number }> = {};
let mismatches = 0;
const fail = (id: string, message: string): void => {
  mismatches++;
  console.error(`${id}: ${message}`);
};

for (const vector of fixture.vectors) {
  const complex = runComplex(fixture.width, vector);
  const real = runReal(fixture.width, vector);
  const complexStates = states(complex);
  const realStates = states(real);

  out[vector.id] = {
    complexStates,
    realStates,
    complexSupport: complex.length,
    realSupport: real.length,
  };

  if (vector.expected !== undefined) {
    if (complex.length !== 1 || complexStates[0] !== vector.expected) {
      fail(vector.id, `complex expected ${vector.expected}, got [${complexStates.join(",")}]`);
    }
    if (real.length !== 1 || realStates[0] !== vector.expected) {
      fail(vector.id, `real expected ${vector.expected}, got [${realStates.join(",")}]`);
    }
  }

  if (vector.expected_support !== undefined) {
    if (complex.length !== vector.expected_support) fail(vector.id, `complex support ${complex.length} != ${vector.expected_support}`);
    if (real.length !== vector.expected_support) fail(vector.id, `real support ${real.length} != ${vector.expected_support}`);
  }

  if (vector.expected_support_complex !== undefined && complex.length !== vector.expected_support_complex) {
    fail(vector.id, `complex support ${complex.length} != ${vector.expected_support_complex}`);
  }

  if (vector.expected_support_real !== undefined && real.length !== vector.expected_support_real) {
    fail(vector.id, `real support ${real.length} != ${vector.expected_support_real}`);
  }

  if (vector.expected_states !== undefined) {
    const expectedStates = [...vector.expected_states].sort((left, right) => Number(BigInt(left) - BigInt(right)));
    if (!Bun.deepEquals(complexStates, expectedStates)) {
      fail(vector.id, `complex states [${complexStates.join(",")}] != [${expectedStates.join(",")}]`);
    }
    if (!Bun.deepEquals(realStates, expectedStates)) {
      fail(vector.id, `real states [${realStates.join(",")}] != [${expectedStates.join(",")}]`);
    }
  }
}

writeFileSync(join(import.meta.dir, "ts-output.json"), `${JSON.stringify(out, null, 2)}\n`);
console.log(`zset-isa-v2 oracle: vectors=${fixture.vectors.length}, mismatches=${mismatches}.`);
if (mismatches > 0) process.exit(1);
