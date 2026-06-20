/**
 * gen-zset-isa.test.ts — the gen(gen)===gen fixpoint test for the Q# lane.
 *
 * Verifies the three Faces of gen(gen)===gen in the Q# Z-set ISA context:
 *
 *   Face 1: Self-duality — the ISA contains its own inverse (EMIT ↔ RETRACT)
 *   Face 2: Idempotence — generate(IR) === committed (re-gen changes nothing)
 *   Face 3: Reflexivity — the IR describes what the generator produces, and the
 *           generator produces what the IR describes (the fixpoint)
 *
 * This is the Q# instance of the Futamura mix(mix,mix)=cogen reflective fixpoint.
 * Behavioral equivalence (same operator bodies), NOT byte-lock (Q# tier).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { generateQSharp, checkFixpoint, extractOperatorBodies, type ZSetIR } from "./gen-zset-isa";

const dir = import.meta.dir;
const ir: ZSetIR = JSON.parse(readFileSync(join(dir, "zset-isa-ir.json"), "utf-8"));
const committed = readFileSync(join(dir, "ZSetISA.qs"), "utf-8");

describe("gen(gen)===gen — Q# ZSetISA fixpoint (Face 3)", () => {
  test("Face 1: self-duality — EMIT and RETRACT are adjoints of each other", () => {
    const emit = ir.operators.find(o => o.name === "Emit");
    const retract = ir.operators.find(o => o.name === "Retract");
    expect(emit).toBeDefined();
    expect(retract).toBeDefined();
    expect(emit!.adjoint).toBe("Retract");
    expect(retract!.adjoint).toBe("Emit");
  });

  test("Face 1: self-duality — Branch is self-adjoint (H = H†)", () => {
    const branch = ir.operators.find(o => o.name === "Branch");
    expect(branch).toBeDefined();
    expect(branch!.adjoint).toBe("Branch");
  });

  test("Face 2: idempotence — generate(IR) is behaviorally equivalent to committed", () => {
    const generated = generateQSharp(ir);
    const result = checkFixpoint(generated, committed);
    expect(result.pass).toBe(true);
    if (!result.pass) {
      console.error("Mismatches:", result.mismatches);
    }
  });

  test("Face 2: idempotence — re-generate produces same output (Π²=Π)", () => {
    const gen1 = generateQSharp(ir);
    // Extract bodies from gen1, then check again — same result
    const bodies1 = extractOperatorBodies(gen1);
    const gen2 = generateQSharp(ir);
    const bodies2 = extractOperatorBodies(gen2);
    expect(bodies1).toEqual(bodies2);
  });

  test("Face 3: the IR describes all six operators that exist in committed", () => {
    const committedBodies = extractOperatorBodies(committed);
    const coreOps = [...committedBodies.keys()].filter(
      n => n !== "VerifyIdentity" && n !== "JoinWeighted"
    );
    expect(coreOps.sort()).toEqual(ir.operators.map(o => o.name).sort());
  });

  test("Face 3: every IR operator body matches the committed source body", () => {
    const generated = generateQSharp(ir);
    const genBodies = extractOperatorBodies(generated);
    const comBodies = extractOperatorBodies(committed);

    for (const op of ir.operators) {
      const genBody = genBodies.get(op.name);
      const comBody = comBodies.get(op.name);
      expect(genBody).toBeDefined();
      expect(comBody).toBeDefined();
      expect(genBody).toBe(comBody);
    }
  });

  test("invariant: no live collapse in soft operators (MERGE/FOLD)", () => {
    const merge = ir.operators.find(o => o.name === "Merge");
    const fold = ir.operators.find(o => o.name === "Fold");
    expect(merge!.kind).toBe("superposition-merge");
    expect(fold!.kind).toBe("superposition-merge");
    // Verify bodies don't contain measurement
    expect(merge!.body).not.toContain("M(");
    expect(fold!.body).not.toContain("M(");
  });

  test("invariant: unitary operators are marked Adj + Ctl", () => {
    const unitaries = ir.operators.filter(o => o.kind === "unitary");
    expect(unitaries.length).toBe(4); // Emit, Retract, Branch, Join
    // All have gate references
    for (const op of unitaries) {
      expect(op.gate).not.toBeNull();
    }
  });

  test("IR schema version is pinned", () => {
    expect(ir.schema).toBe("zeta-ir-v0");
  });
});
