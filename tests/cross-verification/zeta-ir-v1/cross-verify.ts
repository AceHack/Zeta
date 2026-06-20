// zeta-ir-v1 frozen-layout cross-verification oracle.
//
// This is the toolchain-free guard for the frozen generator-IR envelope. The F#
// tests prove the shipping `ZetaIrV1` module reproduces this file byte-for-byte;
// this CI oracle makes the cross-verification runner refuse an unchecked
// primitive directory.
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Op =
  | { readonly op: "mul"; readonly k: string }
  | { readonly op: "xorshr"; readonly s: string };

interface Ir {
  readonly generator: string;
  readonly version: number;
  readonly width: number;
  readonly ops: readonly Op[];
}

const known: readonly Ir[] = [
  {
    generator: "rng.splitmix64",
    version: 1,
    width: 64,
    ops: [
      { op: "mul", k: "-7046029254386353131" },
      { op: "xorshr", s: "30" },
      { op: "mul", k: "-4658895280553007687" },
      { op: "xorshr", s: "27" },
      { op: "mul", k: "-7723592293110705685" },
      { op: "xorshr", s: "31" },
    ],
  },
  {
    generator: "hash.fmix32",
    version: 1,
    width: 32,
    ops: [
      { op: "xorshr", s: "16" },
      { op: "mul", k: "2246822507" },
      { op: "xorshr", s: "13" },
      { op: "mul", k: "3266489909" },
      { op: "xorshr", s: "16" },
    ],
  },
  {
    generator: "hash.fmix64",
    version: 1,
    width: 64,
    ops: [
      { op: "xorshr", s: "33" },
      { op: "mul", k: "-49064778989728563" },
      { op: "xorshr", s: "33" },
      { op: "mul", k: "-4265267296055464877" },
      { op: "xorshr", s: "33" },
    ],
  },
];

function opJson(op: Op): string {
  return op.op === "mul" ? `{"op":"mul","k":${op.k}}` : `{"op":"xorshr","s":${op.s}}`;
}

function canonicalIrJson(ir: Ir): string {
  return `{"schema":"zeta-ir-v1","generator":${JSON.stringify(ir.generator)},"version":${ir.version},"width":${ir.width},"ops":[${ir.ops.map(opJson).join(",")}]}`;
}

const goldenPath = join(import.meta.dir, "zeta-ir-v1.golden.json");
const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as Record<string, string>;
const expected = new Map(known.map((ir) => [ir.generator, canonicalIrJson(ir)]));

let mismatches = 0;

console.log("zeta-ir-v1 cross-verification:");
console.log(`  expected frozen IRs: ${expected.size}`);

for (const key of Object.keys(golden).sort()) {
  if (!expected.has(key)) {
    console.error(`  unexpected generator in golden: ${key}`);
    mismatches++;
  }
}

for (const [generator, expectedJson] of expected) {
  const actual = golden[generator];
  if (actual === undefined) {
    console.error(`  missing generator in golden: ${generator}`);
    mismatches++;
    continue;
  }

  if (actual !== expectedJson) {
    console.error(`  ${generator} MISMATCH`);
    console.error(`    expected: ${expectedJson}`);
    console.error(`    actual:   ${actual}`);
    mismatches++;
  }

  if (actual.includes("zetaId")) {
    console.error(`  ${generator} carries forbidden stored zetaId`);
    mismatches++;
  }
}

if (mismatches === 0) {
  console.log(`  TS oracle agrees with all ${expected.size} frozen zeta-ir-v1 rows.`);
  process.exit(0);
}

console.error(`  ${mismatches} mismatch(es).`);
process.exit(1);
