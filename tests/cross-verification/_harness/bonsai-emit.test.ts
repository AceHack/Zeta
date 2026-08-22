/**
 * bonsai-emit.test.ts — the falsifiers for the Bonsai→target edge.
 *
 * Five things are checked, and each one fails for a different reason:
 *
 *   1. THE PROGRAM IS REAL BONSAI. It round-trips through the SHIPPED serializer
 *      (`src/Core.TypeScript/bonsai/`) byte-for-byte, using only `call`/`lambda`/
 *      `param`/`const` — new `fn` VALUES, no new node kind, no version bump.
 *   2. THE BYTE-LOCK DID NOT MOVE. `emitRustAt(ir, TARGET_RUST_PORTABLE)` is
 *      byte-identical to the existing `emitRust(ir)`, for a width-64 IR, a
 *      width-32 IR, and a v3/v4-grammar IR. Adding the edge changed no lane.
 *   3. THE ARREST IS REAL. The same program under a descriptor with `{map, join}`
 *      arrests at L1 and emits an iterator chain; under an EMPTY descriptor it
 *      arrests at L0 and emits the loop. Both from one expression, one code path.
 *   4. IT IS SUBSTRATE AGNOSTIC. A descriptor declaring NOTHING native still
 *      emits — the Q#-shaped test. A design needing `map` would fail here.
 *   5. IT REFUSES. An un-lowerable `fn`, a non-native leaf, and an out-of-template
 *      separator all throw at generation time rather than emitting something else.
 *
 * The behavioural half — that both lanes COMPILE and produce byte-identical
 * `rust-output.json` — is `bonsai-emit-lanes.ts`, which needs a Rust toolchain and
 * so is a script rather than a unit test.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, serialize } from "../../../src/Core.TypeScript/bonsai/index";
import { emitRust, parseIrJson, type ZetaIrV1 } from "./codegen-from-ir";
import {
  PARALLEL_FNS,
  TARGET_FLOOR,
  TARGET_RUST_IDIOMATIC,
  TARGET_RUST_PORTABLE,
  arrest,
  assertParallelShaped,
  callsIn,
  emitRustAt,
  levelOf,
  outputAssemblyProgram,
  programWire,
  renderRustAssembly,
} from "./bonsai-emit";

const goldenFile = readFileSync(join(import.meta.dir, "../zeta-ir-v1/zeta-ir-v1.golden.json"), "utf-8");
const goldenMap: Record<string, string> = JSON.parse(goldenFile);
const splitmix64: ZetaIrV1 = parseIrJson(goldenMap["rng.splitmix64"]!);
const fmix32: ZetaIrV1 = parseIrJson(goldenMap["hash.fmix32"]!);

/** A v3/v4-grammar IR — no `xorshr` at all, so a mul/xorshr-only path cannot fake it. */
const rotlAdd: ZetaIrV1 = {
  schema: "zeta-ir-v4",
  generator: "test.rotl_add",
  version: 1,
  width: 64,
  ops: [{ op: "rotl", r: 7 }, { op: "mul", k: 5n }, { op: "add", k: 9n }],
};

const ALL_IRS: readonly [string, ZetaIrV1][] = [
  ["rng.splitmix64", splitmix64],
  ["hash.fmix32", fmix32],
  ["test.rotl_add", rotlAdd],
];

describe("bonsai-emit — the program is a real Bonsai expression", () => {
  test("it round-trips through the shipped serializer byte-for-byte", () => {
    const wire = programWire();
    const back = parse(wire);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const again = serialize(back.value);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value).toBe(wire);
  });

  test("it uses only v1 node kinds — the new names are `fn` VALUES, not kinds", () => {
    const wire = programWire();
    // Every `kind` tag present must be one the shipped v1 grammar already has.
    const kinds = new Set([...wire.matchAll(/"kind":"([a-z]+)"/g)].map((m) => m[1]!));
    expect([...kinds].sort()).toEqual(["call", "const", "lambda", "param"]);
    // …and the version tag is untouched.
    expect(wire.startsWith('{"v":1,')).toBe(true);
  });

  test("the higher-level names appear as call `fn`s", () => {
    expect(callsIn(outputAssemblyProgram()).sort()).toEqual(["join", "map", "mix", "row"]);
  });
});

describe("bonsai-emit — the authored program is massively-parallel shaped", () => {
  // Aaron 2026-08-15: "we only want massively parallel algos in our IR. We can
  // have specialization that optimizes for branching and CPUs for specialization,
  // but never in the spec itself." The constraint is on WHAT A PROGRAM MAY SAY,
  // not on whether the host language uses conditionals.

  test("every `fn` the program names is parallel-shaped", () => {
    for (const fn of callsIn(outputAssemblyProgram())) {
      expect(`${fn} ∈ PARALLEL_FNS: ${String(PARALLEL_FNS.includes(fn))}`).toBe(`${fn} ∈ PARALLEL_FNS: true`);
    }
  });

  test("the sequential form is a LOWERING PRODUCT, never authored", () => {
    // `loop_accum` sequences, so a program may not name it…
    expect(PARALLEL_FNS).not.toContain("loop_accum");
    const authored = { kind: "call", fn: "loop_accum", args: [] } as const;
    expect(() => assertParallelShaped(authored)).toThrow(/non-parallel-shaped/);
    // …yet it is exactly what the arrest produces for a target that needs it.
    expect(callsIn(arrest(outputAssemblyProgram(), TARGET_FLOOR))).toContain("loop_accum");
  });

  test("the program contains no `cond` node at all", () => {
    // Not because conditionals are banned — because Bonsai's `Cond` has no agreed
    // arm-evaluation semantics in this repo (see the research doc: BonsaiSoft
    // predicates BOTH arms, Resume.fs / resume.ts short-circuit ONE). Until the
    // spec picks one, a program that avoids `Cond` is the only one whose meaning
    // does not depend on which evaluator reads it.
    expect(programWire()).not.toContain('"kind":"cond"');
  });
});

describe("bonsai-emit — the existing byte-lock did not move", () => {
  for (const [name, ir] of ALL_IRS) {
    test(`${name}: emitRustAt(TARGET_RUST_PORTABLE) is byte-identical to emitRust`, () => {
      const viaBonsai = emitRustAt(ir, TARGET_RUST_PORTABLE);
      const existing = emitRust(ir);
      // Compare as one string so a diff names the first divergent character.
      expect(viaBonsai).toBe(existing);
    });
  }

  test("the idiomatic lane is NOT byte-identical — otherwise the arrest did nothing", () => {
    expect(emitRustAt(splitmix64, TARGET_RUST_IDIOMATIC)).not.toBe(emitRust(splitmix64));
  });

  test("both lanes emit a byte-identical `mix` — so any measured difference is the arrest", () => {
    const cut = (src: string) => src.slice(src.indexOf("fn mix"), src.indexOf("fn main"));
    expect(cut(emitRustAt(splitmix64, TARGET_RUST_IDIOMATIC))).toBe(cut(emitRust(splitmix64)));
  });
});

describe("bonsai-emit — the arrest is real", () => {
  test("a descriptor with {map, join} arrests at L1", () => {
    const arrested = arrest(outputAssemblyProgram(), TARGET_RUST_IDIOMATIC);
    expect(levelOf(arrested)).toBe("L1");
    expect(callsIn(arrested).sort()).toEqual(["join", "map", "mix", "row"]);
  });

  test("a descriptor with nothing native arrests at L0", () => {
    const arrested = arrest(outputAssemblyProgram(), TARGET_RUST_PORTABLE);
    expect(levelOf(arrested)).toBe("L0");
    expect(callsIn(arrested).sort()).toEqual(["loop_accum", "mix", "row"]);
  });

  test("L1 emits an iterator chain and ZERO `if`s; L0 emits the loop and one `if`", () => {
    const idiomatic = emitRustAt(splitmix64, TARGET_RUST_IDIOMATIC);
    const portable = emitRustAt(splitmix64, TARGET_RUST_PORTABLE);

    expect(idiomatic).toContain(".collect::<Vec<_>>()");
    expect(idiomatic).toContain('.join(",\\n")');
    expect(idiomatic).not.toContain("push_str");
    expect(idiomatic).not.toContain("enumerate()");

    expect(portable).toContain("push_str");
    expect(portable).toContain("enumerate()");
    expect(portable).not.toContain(".collect::<Vec<_>>()");

    // The branch-free design goal, as a count on the emitted text.
    const ifs = (src: string) => (src.match(/\bif\b/g) ?? []).length;
    expect(`L1 ifs=${String(ifs(idiomatic))}`).toBe("L1 ifs=0");
    expect(`L0 ifs=${String(ifs(portable))}`).toBe("L0 ifs=1");
  });

  test("the separator is READ from the tree, not hardcoded in the renderer", () => {
    // Swap the separator in the program and the REAL renderer's output changes.
    // Asserting the ORIGINAL separator is gone is what stops this passing
    // vacuously against a renderer that hardcodes ",\n" and ignores the tree.
    const prog = outputAssemblyProgram();
    if (prog.kind !== "call") throw new Error("unreachable");
    const swapped = { ...prog, args: [{ kind: "const", value: { t: "str", v: " | " } }, prog.args[1]!] } as typeof prog;
    const rendered = renderRustAssembly(arrest(swapped, TARGET_RUST_IDIOMATIC));
    expect(rendered).toContain('.join(" | ")');
    expect(rendered).not.toContain('.join(",\\n")');
  });

  test("the L0 template REFUSES a separator it does not implement", () => {
    // The L0 bytes are a committed byte-lock; re-rendering them under an
    // unimplemented separator would be silent mis-compilation.
    const prog = outputAssemblyProgram();
    if (prog.kind !== "call") throw new Error("unreachable");
    const swapped = { ...prog, args: [{ kind: "const", value: { t: "str", v: " | " } }, prog.args[1]!] } as typeof prog;
    expect(() => renderRustAssembly(arrest(swapped, TARGET_RUST_PORTABLE))).toThrow(
      /L0 loop template implements only the separator/,
    );
  });
});

describe("bonsai-emit — substrate agnostic (the Q#-shaped test)", () => {
  test("a target declaring NOTHING native still emits", () => {
    // Q# has never executed an op outside {mul, xorshr} and its IrOp interface
    // carries no r/rs/ss (#10822). A design that needs the target to have `map`
    // has found a fact about the four von-Neumann lanes, not about the substrate.
    expect(TARGET_FLOOR.nativeFns).toEqual([]);
    const out = emitRustAt(splitmix64, TARGET_FLOOR);
    expect(out.length).toBeGreaterThan(0);
    expect(levelOf(arrest(outputAssemblyProgram(), TARGET_FLOOR))).toBe("L0");
  });

  test("the floor descriptor and the portable descriptor produce the same bytes", () => {
    expect(emitRustAt(splitmix64, TARGET_FLOOR)).toBe(emitRustAt(splitmix64, TARGET_RUST_PORTABLE));
  });
});

describe("bonsai-emit — it refuses rather than approximating", () => {
  test("an un-lowerable, non-native `fn` is REFUSED", () => {
    const prog = outputAssemblyProgram();
    if (prog.kind !== "call") throw new Error("unreachable");
    const bad = { ...prog, fn: "frobnicate" } as typeof prog;
    expect(() => arrest(bad, TARGET_RUST_PORTABLE)).toThrow(/no lowering exists for it/);
  });

  test("`join` in a shape the lowering has not been shown to preserve is REFUSED", () => {
    const prog = outputAssemblyProgram();
    if (prog.kind !== "call") throw new Error("unreachable");
    // join(sep, <not a map>) — the lowering rule is only proven for join∘map.
    const bad = { ...prog, args: [prog.args[0]!, { kind: "param", name: "xs" }] } as typeof prog;
    expect(() => arrest(bad, TARGET_RUST_PORTABLE)).toThrow(/only in the shape join\(sep, map\(f, xs\)\)/);
  });

  test("an op outside the v1..v4 grammar is REFUSED through the new path too", () => {
    const bad: ZetaIrV1 = { ...splitmix64, ops: [{ op: "frobnicate" } as unknown as ZetaIrV1["ops"][0]] };
    expect(() => emitRustAt(bad, TARGET_RUST_IDIOMATIC)).toThrow(/not in the v1\.\.v4 grammar/);
    expect(() => emitRustAt(bad, TARGET_RUST_PORTABLE)).toThrow(/not in the v1\.\.v4 grammar/);
  });

  test("an unsupported width is REFUSED through the new path too", () => {
    const bad: ZetaIrV1 = { ...splitmix64, width: 24 };
    expect(() => emitRustAt(bad, TARGET_RUST_IDIOMATIC)).toThrow(/width 24 is not supported/);
    expect(() => emitRustAt(bad, TARGET_RUST_PORTABLE)).toThrow(/width 24 is not supported/);
  });
});
