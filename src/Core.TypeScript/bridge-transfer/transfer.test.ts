/**
 * THE PRE-REGISTRATION.
 *
 * Every expectation in this file was written before the matrix was run, and both readings were
 * fixed in advance:
 *
 *   POSITIVE — the lifted battery passes on CHIP-9 while each control breaks exactly the lesson
 *   that names it. Reading: the inclusion CHIP-8 -> CHIP-9 preserves these four structures, AND
 *   the instrument can tell preservation from its absence. Bounded: see the NON-RESULT below.
 *
 *   NEGATIVE — some lesson fails on the lifted CHIP-9 column. Reading: link one of the ladder is
 *   already broken, and the expensive rungs (ALE, ARC) should not be built on it. This would be a
 *   genuine finding, not a failure of the experiment.
 *
 *   DEGENERATE — everything passes everywhere, controls included. Reading: the battery is not
 *   measuring transfer at all, only that the machine runs. The whole instrument is then void and
 *   must be redesigned, NOT reported as a positive. `the control family discriminates` below is
 *   the assertion that catches this case, and it is the most important test in the file.
 *
 * NON-RESULT, stated up front so a green suite is not over-read: `chip9 @plane0` passing is
 * VACUOUS. CHIP-9 is a conservative extension whose default plane is 1, so a CHIP-8 ROM takes the
 * identical code path — that column is a tautology and is reported only to keep the tautology
 * visible. The `chip9 @plane6` column is the one that is not free, and even it is weakened by
 * shared implementation lineage: CHIP-9's plane path was written by generalising CHIP-8's mono
 * path in the same function. That is co-derivation, not independent confirmation.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BASELINE, CHIP9, CONTROLS, H, W, colorAt, create, loadRom, step, type Frame } from "./dialects.ts";
import { loadLessons } from "./lessons.ts";
import { runMatrix } from "./run-transfer.ts";

const lessons = loadLessons();
const matrix = runMatrix(lessons);

const cell = (lesson: string, column: string): boolean => {
  const found = matrix.find((c) => c.lesson === lesson && c.column === column);
  expect(found, `no cell for ${lesson} x ${column}`).toBeDefined();
  return found?.transferred ?? false;
};

describe("the instrument is faithful to the shipped oracle", () => {
  /**
   * The dialect family is a parameterised copy of `../chip9/chip9.ts`. If it drifts from the
   * treaty the four language oracles are locked to, every result above is measured on a machine
   * nobody ships. So: at the identity parameters, replay the treaty ROM and reproduce the golden
   * grid the F# oracle locked.
   */
  it("BYTE-LOCK: the dialect family at identity parameters reproduces the CHIP-9 treaty golden", () => {
    const lines = readFileSync(join(import.meta.dir, "..", "chip9", "golden-vectors.lines"), "utf-8")
      .split("\n")
      .filter((l) => !l.startsWith("#") && l.length > 0);
    const romHex = lines[0]?.split("\t")[1];
    const planeText = lines[1]?.split("\t")[1];
    expect(romHex).toBeDefined();
    expect(planeText).toBeDefined();
    if (romHex === undefined || planeText === undefined) return;

    const rom = new Uint8Array((romHex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)));
    const goldenRows = lines.slice(2, 2 + H);
    expect(goldenRows.length).toBe(H);

    let f = loadRom(rom, create());
    for (let k = 0; k < 8; k++) f.mem.set(0x300 + k, 0xff);
    for (let s = 0; s < 30; s++) f = step(f, CHIP9);

    expect(f.plane).toBe(Number.parseInt(planeText, 10));
    for (let y = 0; y < H; y++) {
      let row = "";
      for (let x = 0; x < W; x++) row += colorAt(x, y, f).toString(16);
      const golden = goldenRows[y];
      expect(golden, `golden row ${y} missing`).toBeDefined();
      if (golden === undefined) return;
      expect(row).toBe(golden);
    }
  });
});

describe("the morphism: the inclusion CHIP-8 -> CHIP-9", () => {
  /**
   * The morphism law itself, checked rather than asserted. Write i(s) for the CHIP-8 state s
   * viewed as a CHIP-9 state (plane := 1, extra := empty). The claim is that i is a functional
   * bisimulation on the CHIP-8 fragment — programs containing no `Fn01`:
   *
   *     step9(i s) = i(step8 s)
   *
   * Anchor: a machine homomorphism in the Hartmanis-Stearns sense, equivalently a conservative
   * extension of the operational semantics. Both entail the claim; neither is decoration.
   */
  it("i is a functional bisimulation on the CHIP-8 fragment (no Fn01 in the ROM)", () => {
    for (const lesson of lessons) {
      expect(lesson.rom.some((b, k) => k % 2 === 0 && (b & 0xf0) === 0xf0)).toBe(false);

      let a: Frame = loadRom(lesson.rom, create());
      let b: Frame = loadRom(lesson.rom, create());
      for (const [addr, byte] of lesson.seededMemory) {
        a.mem.set(addr, byte);
        b.mem.set(addr, byte);
      }
      const horizon = Math.max(...lesson.assertions.map((x) => x.afterSteps)) + 4;
      for (let s = 0; s < horizon; s++) {
        a = step(a, BASELINE);
        b = step(b, CHIP9);
        expect(b.pc, `${lesson.name} pc at step ${s}`).toBe(a.pc);
        expect([...b.v], `${lesson.name} regs at step ${s}`).toEqual([...a.v]);
        expect(b.i).toBe(a.i);
        // The extension's own state stays at its zero value — that IS the conservativity.
        expect(b.plane).toBe(1);
        expect(b.extra.size).toBe(0);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) expect(colorAt(x, y, b)).toBe(colorAt(x, y, a));
      }
    }
  });

  it("VACUOUS BY CONSTRUCTION: every lesson transfers to chip9 @plane0, and this measures nothing", () => {
    for (const l of lessons) expect(cell(l.name, "chip9 @plane0")).toBe(true);
  });

  it("the lifted region is genuinely OUTSIDE the image of i — CHIP-8 cannot satisfy a lifted lesson", () => {
    // Without this, "it transferred to the planes" could just mean the predicates were satisfiable
    // on plane 0 all along and the lift was cosmetic.
    for (const l of lessons) expect(cell(l.name, "chip8 @plane6 (lift unreachable)")).toBe(false);
  });

  it("THE RESULT: every lesson survives the lift into the planes CHIP-9 adds", () => {
    for (const l of lessons) expect(cell(l.name, "chip9 @plane6 (lifted)")).toBe(true);
  });
});

describe("the control family — without which the result above is unfalsifiable", () => {
  it("the baseline battery is well-posed on CHIP-8", () => {
    for (const l of lessons) expect(cell(l.name, "chip8 (baseline)")).toBe(true);
  });

  it("each control breaks EXACTLY the lesson that names it as its falsifier", () => {
    // The diagonal. This is the calibration: a control family that failed everything would be a
    // blunt instrument (and would make the CHIP-9 pass meaningless by contrast), while one that
    // failed nothing would be no control at all.
    for (const lesson of lessons)
      for (const control of CONTROLS)
        expect(cell(lesson.name, `control: ${control.name}`), `${lesson.name} on ${control.name}`).toBe(
          control.name !== lesson.falsifier,
        );
  });

  it("the control family discriminates — it is neither blind nor blunt", () => {
    const controlCells = matrix.filter((c) => c.column.startsWith("control: "));
    const failed = controlCells.filter((c) => !c.transferred).length;
    expect(failed).toBeGreaterThan(0); // not blind
    expect(failed).toBeLessThan(controlCells.length); // not blunt
    expect(failed).toBe(lessons.length); // a clean diagonal: one falsifier per lesson
  });

  it("every lesson names a falsifier that actually falsifies it", () => {
    // `toy-is-free-metered-must-be-earned.md`: a claim with no falsifier stays a toy. A lesson
    // that no control can break would be a tautology being reported as a transferred lesson.
    for (const l of lessons) {
      expect(CONTROLS.map((c) => c.name)).toContain(l.falsifier);
      expect(cell(l.name, `control: ${l.falsifier}`)).toBe(false);
    }
  });
});

describe("the trap control — why 'scrambled' must mean semantics, not labels", () => {
  /**
   * The intuitive control for a transfer experiment is "a scrambled target of the same
   * complexity". Permuting the opcode table is the obvious way to build one, and it is wrong: a
   * permutation of labels is an AUTOMORPHISM. The two assertions below are the demonstration —
   * the same relabelled machine fails or passes purely according to whether the artifact was
   * carried through the same permutation. What that measures is bookkeeping, not structure.
   */
  it("untranslated, every lesson fails on the relabelled machine — which looks like a control", () => {
    for (const l of lessons) expect(cell(l.name, "trap: relabel (untranslated)")).toBe(false);
  });

  it("translated, every lesson passes — proving the relabelling destroyed no structure at all", () => {
    for (const l of lessons) expect(cell(l.name, "trap: relabel (translated)")).toBe(true);
  });
});
