// legacy-source.test.ts — the SINGLE-SOURCE-OF-TRUTH property, on the bun side.
//
// Twin of the F# `ZetaIrV1.toLegacyIrJson` byte-locks (tests/Tests.FSharp/ZetaIrV1.Tests).
// The legacy `*.ir.json` files are read directly by the bun oracles via the harness, so
// the "legacy file is DERIVED from the v1 envelope" property must hold on this runtime
// too, independently. This test re-derives each committed legacy file from a minimal v1
// envelope description and asserts byte-for-byte equality with the file on disk.
//
// Independence: the id is reconstructed via the harness's own `idOf` (the same content-
// address the relation uses), NOT copied — so splitmix64's `zetaId` is shown to be a pure
// function of `generator@version` on the TS side as well, never independent data. No
// committed bytes are produced or mutated here; this is a read-only guard.
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { idOf } from "../_harness/generator-ir-registry.ts";

const CV = join(import.meta.dir, ".."); // tests/cross-verification

type Op =
  | { readonly op: "mul"; readonly k: bigint }
  | { readonly op: "xorshr"; readonly s: bigint };

/** The v1 envelope source — the single source of truth the legacy file is derived FROM. */
interface V1 {
  readonly generator: string;
  readonly version: number;
  readonly width: number;
  readonly ops: readonly Op[];
  /** which legacy shape this generator serialised under (pre-v1). */
  readonly legacyShape: "zetaId-no-width" | "width-no-zetaId";
  readonly primitive: string;
  readonly file: string;
}

// the two known generators, expressed as v1 envelopes (mirror of ZetaIrV1.known).
const KNOWN: readonly V1[] = [
  {
    generator: "rng.splitmix64",
    version: 1,
    width: 64,
    legacyShape: "zetaId-no-width",
    primitive: "splitmix64",
    file: "splitmix64.ir.json",
    ops: [
      { op: "mul", k: -7046029254386353131n },
      { op: "xorshr", s: 30n },
      { op: "mul", k: -4658895280553007687n },
      { op: "xorshr", s: 27n },
      { op: "mul", k: -7723592293110705685n },
      { op: "xorshr", s: 31n },
    ],
  },
  {
    generator: "hash.fmix32",
    version: 1,
    width: 32,
    legacyShape: "width-no-zetaId",
    primitive: "fmix32",
    file: "fmix32.ir.json",
    ops: [
      { op: "xorshr", s: 16n },
      { op: "mul", k: 2246822507n },
      { op: "xorshr", s: 13n },
      { op: "mul", k: 3266489909n },
      { op: "xorshr", s: 16n },
    ],
  },
];

function opJson(op: Op): string {
  return op.op === "mul" ? `{"op":"mul","k":${op.k}}` : `{"op":"xorshr","s":${op.s}}`;
}

/** Derive the exact committed legacy bytes from the v1 envelope (single source of truth). */
function toLegacyIrJson(v1: V1): string {
  const opsArr = `[${v1.ops.map(opJson).join(",")}]`;
  if (v1.legacyShape === "zetaId-no-width") {
    // zetaId is RE-DERIVED from identity, never carried as v1 data.
    const zetaId = idOf(v1.generator, v1.version);
    return `{"generator":"${v1.generator}","version":${v1.version},"zetaId":"${zetaId}","ops":${opsArr}}`;
  }
  return `{"generator":"${v1.generator}","version":${v1.version},"width":${v1.width},"ops":${opsArr}}`;
}

function committed(v1: V1): string {
  return readFileSync(join(CV, v1.primitive, "_gen", v1.file), "utf8").trim();
}

for (const v1 of KNOWN) {
  test(`legacy ${v1.file} is byte-identical to the v1-derived projection`, () => {
    expect(toLegacyIrJson(v1)).toBe(committed(v1));
  });
}

test("splitmix64 legacy zetaId is reconstructed from identity (idOf), not stored as v1 data", () => {
  const sm = KNOWN.find((k) => k.generator === "rng.splitmix64")!;
  const derived = toLegacyIrJson(sm);
  // the historically-stored id, re-derived purely from generator@version.
  expect(derived).toContain(`"zetaId":"${idOf("rng.splitmix64", 1)}"`);
  expect(derived).toContain('"zetaId":"129c1fac3a48075b481c0f10f30deb06"');
});

test("changing an op constant breaks the byte-lock (the green can turn red)", () => {
  const sm = KNOWN.find((k) => k.generator === "rng.splitmix64")!;
  const mutated: V1 = {
    ...sm,
    ops: sm.ops.map((o, i) => (i === 0 && o.op === "mul" ? { op: "mul", k: o.k + 1n } : o)),
  };
  expect(toLegacyIrJson(mutated)).not.toBe(committed(sm));
});
