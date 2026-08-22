/**
 * A LESSON, operationally.
 *
 * The transfer claim is untestable until "a lesson" is a thing you can pick up and carry, so this
 * file fixes the definition:
 *
 *   A lesson is a TEXT ARTIFACT holding (a) seeded memory, (b) a ROM, and (c) assertions over the
 *   trace, written in a machine-neutral predicate vocabulary — plus the name of the structural
 *   axis whose destruction is expected to falsify it.
 *
 * Two things follow, and both matter. It is carriable: the artifact is a file, so "transferring a
 * lesson" is a real operation (open it, run it on the other machine, evaluate the predicates)
 * rather than a metaphor. And it is falsifiable: every lesson names a falsifier, so a lesson that
 * no control can break is refused as a lesson — it would be measuring "the machine runs", not
 * "the structure held" (`toy-is-free-metered-must-be-earned.md`).
 *
 * The predicate vocabulary is deliberately plane-agnostic. `lit x y` means "the SELECTED plane
 * mask is fully set at (x,y)", `dark x y` means "fully clear". This is the whole trick behind the
 * lift: because the assertions never mention plane 0 by name, the lift acts on the ROM alone and
 * leaves the claim's text untouched — which is what "the same lesson, carried" has to mean if the
 * word "same" is doing any work.
 *
 * Register: `metered`. The battery's falsifier is `dialects.ts`'s control family, and
 * `transfer.test.ts` asserts the full expected pass/fail matrix — a lesson that stopped
 * discriminating would go red rather than silently degrade into a tautology.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { colorAt, create, loadRom, step, type Dialect, type Frame } from "./dialects.ts";

export type Predicate =
  | { readonly kind: "lit"; readonly x: number; readonly y: number }
  | { readonly kind: "dark"; readonly x: number; readonly y: number }
  | { readonly kind: "vf"; readonly value: number };

export interface Assertion {
  readonly afterSteps: number;
  readonly predicate: Predicate;
  readonly source: string;
}

export interface Lesson {
  readonly name: string;
  readonly claim: string;
  readonly discoveredOn: string;
  /** The control dialect expected to break this lesson. A lesson with no falsifier is refused. */
  readonly falsifier: string;
  readonly seededMemory: ReadonlyMap<number, number>;
  readonly rom: Uint8Array;
  readonly assertions: readonly Assertion[];
}

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array((hex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)));
}

function parsePredicate(text: string): Predicate {
  const parts = text.trim().split(/\s+/);
  const head = parts[0];
  if (head === "vf") {
    const raw = parts[1];
    if (raw === undefined) throw new Error(`vf predicate needs a value: '${text}'`);
    return { kind: "vf", value: Number.parseInt(raw, 10) };
  }
  if (head === "lit" || head === "dark") {
    const xs = parts[1];
    const ys = parts[2];
    if (xs === undefined || ys === undefined) throw new Error(`${head} predicate needs x and y: '${text}'`);
    return { kind: head, x: Number.parseInt(xs, 10), y: Number.parseInt(ys, 10) };
  }
  throw new Error(`unknown predicate '${text}'`);
}

export function parseLesson(text: string, origin: string): Lesson {
  const meta = new Map<string, string>();
  const seededMemory = new Map<number, number>();
  const assertions: Assertion[] = [];
  let rom: Uint8Array | null = null;

  for (const line of text.split("\n")) {
    if (line.startsWith("#") || line.trim().length === 0) continue;
    const [tag, a, b] = line.split("\t");
    if (tag === "meta" && a !== undefined && b !== undefined) meta.set(a, b);
    else if (tag === "mem" && a !== undefined && b !== undefined) {
      const base = Number.parseInt(a, 16);
      hexToBytes(b).forEach((byte, i) => seededMemory.set(base + i, byte));
    } else if (tag === "rom" && a !== undefined) rom = hexToBytes(a);
    else if (tag === "assert" && a !== undefined && b !== undefined)
      assertions.push({ afterSteps: Number.parseInt(a, 10), predicate: parsePredicate(b), source: b });
  }

  const name = meta.get("name");
  const claim = meta.get("claim");
  const falsifier = meta.get("falsifier");
  if (name === undefined || claim === undefined || falsifier === undefined || rom === null)
    throw new Error(`${origin}: a lesson needs meta name/claim/falsifier and a rom line`);
  if (assertions.length === 0) throw new Error(`${origin}: a lesson with no assertions asserts nothing`);

  return {
    name,
    claim,
    discoveredOn: meta.get("discovered-on") ?? "chip8",
    falsifier,
    seededMemory,
    rom,
    assertions,
  };
}

export function loadLessons(dir: string = join(import.meta.dir, "lessons")): readonly Lesson[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".lesson.lines"))
    .sort()
    .map((f) => parseLesson(readFileSync(join(dir, f), "utf-8"), f));
}

/**
 * THE LIFT — the morphism's action on artifacts.
 *
 * `lift(L, m)` prepends `Fm01` to the ROM and re-bases every step count by one. The assertions are
 * carried VERBATIM: because they read the selected plane mask rather than plane 0, the identical
 * predicate text now speaks about planes {G,B} instead of {mono}.
 *
 * Note what `lift` deliberately does NOT do: it does not touch the claim, does not relax a
 * predicate, and does not special-case a lesson. If the lifted battery passes it is because the
 * machine preserved the structure, not because the artifact was edited until it agreed.
 */
export function lift(lesson: Lesson, planeMask: number): Lesson {
  const prefix = new Uint8Array([0xf0 | (planeMask & 0b111), 0x01]);
  const rom = new Uint8Array(prefix.length + lesson.rom.length);
  rom.set(prefix, 0);
  rom.set(lesson.rom, prefix.length);
  return {
    ...lesson,
    name: `${lesson.name}@plane${planeMask}`,
    rom,
    assertions: lesson.assertions.map((a) => ({ ...a, afterSteps: a.afterSteps + 1 })),
  };
}

/** Rewrite a ROM's opcode high nibbles through a bijection — the translation half of `relabel`. */
export function translateRom(rom: Uint8Array, nibble: (hi: number) => number): Uint8Array {
  const out = new Uint8Array(rom);
  for (let i = 0; i + 1 < out.length; i += 2) {
    const b = out[i] ?? 0;
    out[i] = (nibble(b >> 4) << 4) | (b & 0x0f);
  }
  return out;
}

export function translateLesson(lesson: Lesson, nibble: (hi: number) => number): Lesson {
  return { ...lesson, name: `${lesson.name}+translated`, rom: translateRom(lesson.rom, nibble) };
}

export interface AssertionOutcome {
  readonly source: string;
  readonly afterSteps: number;
  readonly held: boolean;
  readonly observed: string;
}

export interface LessonOutcome {
  readonly lesson: string;
  readonly dialect: string;
  readonly planeMask: number;
  readonly transferred: boolean;
  readonly outcomes: readonly AssertionOutcome[];
}

/**
 * Run one lesson on one dialect under one plane mask and report whether every predicate held.
 * `planeMask` is the mask the neutral vocabulary resolves against — 1 for the mono region, 6 for
 * the lifted region.
 */
export function runLesson(lesson: Lesson, dialect: Dialect, planeMask: number): LessonOutcome {
  const byStep = new Map<number, Assertion[]>();
  for (const a of lesson.assertions) {
    const bucket = byStep.get(a.afterSteps);
    if (bucket === undefined) byStep.set(a.afterSteps, [a]);
    else bucket.push(a);
  }
  const lastStep = Math.max(...lesson.assertions.map((a) => a.afterSteps));

  let f: Frame = loadRom(lesson.rom, create());
  for (const [addr, byte] of lesson.seededMemory) f.mem.set(addr, byte);

  const outcomes: AssertionOutcome[] = [];
  for (let s = 1; s <= lastStep; s++) {
    f = step(f, dialect);
    for (const a of byStep.get(s) ?? []) {
      const p = a.predicate;
      let held: boolean;
      let observed: string;
      if (p.kind === "vf") {
        const vf = f.v[0xf] ?? 0;
        held = vf === p.value;
        observed = `vf=${vf}`;
      } else {
        const c = colorAt(p.x, p.y, f);
        const masked = c & planeMask;
        held = p.kind === "lit" ? masked === planeMask : masked === 0;
        observed = `color(${p.x},${p.y})=${c} &mask${planeMask}=${masked}`;
      }
      outcomes.push({ source: a.source, afterSteps: a.afterSteps, held, observed });
    }
  }

  return {
    lesson: lesson.name,
    dialect: dialect.name,
    planeMask,
    transferred: outcomes.every((o) => o.held),
    outcomes,
  };
}
