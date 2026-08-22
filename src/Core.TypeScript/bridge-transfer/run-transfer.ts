#!/usr/bin/env bun
/**
 * The transfer experiment — run it with `bun src/Core.TypeScript/bridge-transfer/run-transfer.ts`.
 *
 * Emits the lesson x target matrix as text. The PRE-REGISTERED predictions live in
 * `transfer.test.ts` (written before the first run, and readable in the PR's first commit); this
 * file only reports what happened.
 */

import { BASELINE, CHIP9, CONTROLS, RELABEL, relabelForward, type Dialect } from "./dialects.ts";
import { lift, loadLessons, runLesson, translateLesson, type Lesson } from "./lessons.ts";

/** A column of the matrix: a dialect, the plane mask its predicates resolve against, and how the artifact is carried. */
export interface Column {
  readonly label: string;
  readonly dialect: Dialect;
  readonly planeMask: number;
  readonly carry: (l: Lesson) => Lesson;
}

const asIs = (l: Lesson): Lesson => l;

export const COLUMNS: readonly Column[] = [
  // The baseline. Not a result — the reading that the battery is well-posed at all.
  { label: "chip8 (baseline)", dialect: BASELINE, planeMask: 1, carry: asIs },
  // THE MORPHISM, region 1: inside the image of the inclusion. Expected to be TRUE BY
  // CONSTRUCTION and therefore to measure nothing — reported so the vacuity is visible.
  { label: "chip9 @plane0", dialect: CHIP9, planeMask: 1, carry: asIs },
  // THE MORPHISM, region 2: OUTSIDE the image — the lift into the planes CHIP-9 adds. This is the
  // only column that can carry a non-vacuous positive.
  { label: "chip9 @plane6 (lifted)", dialect: CHIP9, planeMask: 6, carry: (l) => lift(l, 6) },
  // NON-MORPHISM CHECK: the lifted artifact run on CHIP-8, which cannot reach plane 6. Expected to
  // fail everywhere. If it did NOT fail, the lifted region would be reachable from CHIP-8 and the
  // "outside the image" claim above would be false.
  { label: "chip8 @plane6 (lift unreachable)", dialect: BASELINE, planeMask: 6, carry: (l) => lift(l, 6) },
  // THE CONTROLS — one named structural destruction each.
  ...CONTROLS.map((d) => ({ label: `control: ${d.name}`, dialect: d, planeMask: 1, carry: asIs })),
  // THE TRAP CONTROL, both halves.
  { label: "trap: relabel (untranslated)", dialect: RELABEL, planeMask: 1, carry: asIs },
  {
    label: "trap: relabel (translated)",
    dialect: RELABEL,
    planeMask: 1,
    carry: (l) => translateLesson(l, relabelForward),
  },
];

export interface Cell {
  readonly lesson: string;
  readonly column: string;
  readonly transferred: boolean;
  readonly firstBreak: string | null;
}

export function runMatrix(lessons: readonly Lesson[] = loadLessons()): readonly Cell[] {
  const cells: Cell[] = [];
  for (const lesson of lessons) {
    for (const col of COLUMNS) {
      const outcome = runLesson(col.carry(lesson), col.dialect, col.planeMask);
      const broken = outcome.outcomes.find((o) => !o.held);
      cells.push({
        lesson: lesson.name,
        column: col.label,
        transferred: outcome.transferred,
        firstBreak: broken === undefined ? null : `@${broken.afterSteps} '${broken.source}' -> ${broken.observed}`,
      });
    }
  }
  return cells;
}

function main(): void {
  const lessons = loadLessons();
  const cells = runMatrix(lessons);
  const pad = (s: string, n: number): string => (s.length >= n ? s : s + " ".repeat(n - s.length));
  const nameWidth = Math.max(...COLUMNS.map((c) => c.label.length)) + 2;

  process.stdout.write("CHIP-8 -> CHIP-9 transfer matrix (PASS = every predicate in the lesson held)\n\n");
  for (const lesson of lessons) {
    process.stdout.write(`${lesson.name}  —  falsifier: ${lesson.falsifier}\n`);
    process.stdout.write(`  ${lesson.claim}\n`);
    for (const col of COLUMNS) {
      const cell = cells.find((c) => c.lesson === lesson.name && c.column === col.label);
      if (cell === undefined) continue;
      const verdict = cell.transferred ? "PASS" : "FAIL";
      const why = cell.firstBreak === null ? "" : `   ${cell.firstBreak}`;
      process.stdout.write(`    ${pad(col.label, nameWidth)}${verdict}${why}\n`);
    }
    process.stdout.write("\n");
  }

  const controlNames = new Set(CONTROLS.map((d) => `control: ${d.name}`));
  const controlFails = cells.filter((c) => controlNames.has(c.column) && !c.transferred).length;
  const controlTotal = cells.filter((c) => controlNames.has(c.column)).length;
  process.stdout.write(
    `control discrimination: ${controlFails}/${controlTotal} control cells failed ` +
      `(${lessons.length} lessons x ${CONTROLS.length} controls; a diagonal is ${lessons.length})\n`,
  );
}

if (import.meta.main) main();
