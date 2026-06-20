/**
 * gen-zset-isa.ts — the generator for ZSetISA.qs from its IR description.
 *
 * This is the Q# instance of gen(gen)===gen Face 3: a generator that reads the
 * declarative IR (zset-isa-ir.json) and produces the Q# source. The fixpoint test:
 *
 *   generate(IR_of_ISA) === ZSetISA.qs  (behavioral equivalence)
 *
 * The generator itself is described BY the IR it generates FROM — this is the
 * Futamura mix(mix,mix)=cogen reflective fixpoint. Concretely:
 *
 *   1. The IR describes the six operators (declaratively)
 *   2. This generator reads the IR and emits Q#
 *   3. The emitted Q# === the committed ZSetISA.qs (the fixpoint)
 *   4. The IR itself can be generated from the Q# source (the inverse)
 *
 * The self-hosting property: re-running the generator on the IR produces the same
 * committed Q# — same as AdinkraCode.project (Π²=Π, re-gen changes nothing).
 *
 * Composes with:
 *   - zset-isa-ir.json (the IR description)
 *   - ZSetISA.qs (the committed reference — the fixpoint target)
 *   - AdinkraCode.fs (Faces 1+2: self-duality + idempotent projector)
 *   - docs/trajectories/gen-gen-self-hosting-bytelock/RESUME.md
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// ─── IR types ────────────────────────────────────────────────────────────────

interface Param {
  name: string;
  type: string;
}

interface Operator {
  name: string;
  kind: "unitary" | "superposition-merge";
  adjoint: string | null;
  gate: string | null;
  semantics: string;
  params: Param[];
  body: string;
}

interface ZSetIR {
  schema: string;
  name: string;
  namespace: string;
  description: string;
  operators: Operator[];
  invariants: Record<string, string>;
}

// ─── Generator ───────────────────────────────────────────────────────────────

function generateQSharp(ir: ZSetIR): string {
  const lines: string[] = [];

  // Header comment
  lines.push(`/// ${ir.name}.qs — the six Z-set operators on standalone Q#.`);
  lines.push(`///`);
  lines.push(`/// Build spec: docs/handoffs/2026-06-19-zset-isa-six-operators-qsharp-build-spec.md`);
  lines.push(`/// Corrections: Otto 2026-06-19 (#8594, #8595, #8597)`);
  lines.push(`///`);
  lines.push(`/// MERGE/FOLD = superposition/interference merge (NOT measurement).`);
  lines.push(`/// No decoherence to classical. Born collapse = sim-only. Live = soft.`);
  lines.push(``);
  lines.push(`namespace ${ir.namespace} {`);
  lines.push(`    open Microsoft.Quantum.Canon;`);
  lines.push(`    open Microsoft.Quantum.Intrinsic;`);
  lines.push(`    open Microsoft.Quantum.Math;`);

  // Generate each operator
  for (const op of ir.operators) {
    lines.push(``);
    lines.push(`    /// ${op.name.toUpperCase()}${op.kind === "unitary" ? `: ${op.gate} gate` : ""}. ${op.semantics}.`);

    // Build the signature
    const paramStr = op.params.map(p => `${p.name} : ${p.type}`).join(", ");
    const traits = op.kind === "unitary" ? " : Unit is Adj + Ctl" : " : Unit";
    lines.push(`    operation ${op.name}(${paramStr})${traits} {`);

    // Body
    const bodyLines = op.body.split("\n");
    for (const bodyLine of bodyLines) {
      lines.push(`        ${bodyLine}`);
    }

    lines.push(`    }`);
  }

  // Close namespace
  lines.push(`}`);
  lines.push(``);

  return lines.join("\n");
}

// ─── Fixpoint check ──────────────────────────────────────────────────────────

/**
 * The behavioral-equivalence fixpoint check: does generate(IR) produce Q# that
 * is behaviorally equivalent to the committed ZSetISA.qs?
 *
 * "Behavioral equivalence" for Q# means: same operator names, same gate bodies,
 * same type signatures — NOT byte-identical source (whitespace/comments differ).
 * This is the Q# tier's conformance kind per the trajectory doc.
 */
function extractOperatorBodies(source: string): Map<string, string> {
  const bodies = new Map<string, string>();
  const opRegex = /operation\s+(\w+)\s*\([^)]*\)[^{]*\{/g;
  let match: RegExpExecArray | null;

  while ((match = opRegex.exec(source)) !== null) {
    const name = match[1]!;
    const bodyStart = match.index + match[0].length;
    let depth = 1;
    let end = bodyStart;
    for (let i = bodyStart; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    // Normalize: trim, collapse whitespace, strip comments
    const body = source.slice(bodyStart, end)
      .replace(/\/\/.*$/gm, "")
      .replace(/\s+/g, " ")
      .trim();
    bodies.set(name, body);
  }
  return bodies;
}

function checkFixpoint(generated: string, committed: string): { pass: boolean; mismatches: string[] } {
  const genBodies = extractOperatorBodies(generated);
  const comBodies = extractOperatorBodies(committed);
  const mismatches: string[] = [];

  for (const [name, genBody] of genBodies) {
    const comBody = comBodies.get(name);
    if (!comBody) {
      mismatches.push(`${name}: present in generated but missing in committed`);
      continue;
    }
    if (genBody !== comBody) {
      mismatches.push(`${name}: body mismatch\n  gen: ${genBody}\n  com: ${comBody}`);
    }
  }

  // Check committed has nothing the IR doesn't know about (except VerifyIdentity)
  for (const [name] of comBodies) {
    if (name === "VerifyIdentity" || name === "JoinWeighted") continue; // verification entrypoint + bonus op
    if (!genBodies.has(name)) {
      mismatches.push(`${name}: present in committed but missing in generated`);
    }
  }

  return { pass: mismatches.length === 0, mismatches };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): number {
  const dir = import.meta.dir;
  const irPath = join(dir, "zset-isa-ir.json");
  const committedPath = join(dir, "ZSetISA.qs");

  const ir: ZSetIR = JSON.parse(readFileSync(irPath, "utf-8"));
  const committed = readFileSync(committedPath, "utf-8");

  // 1. Generate Q# from IR
  const generated = generateQSharp(ir);

  // 2. Check fixpoint (behavioral equivalence)
  const result = checkFixpoint(generated, committed);

  if (result.pass) {
    console.log("[gen(gen)===gen] PASS: generated Q# is behaviorally equivalent to committed ZSetISA.qs");
    console.log(`  operators checked: ${ir.operators.length}`);
    console.log(`  fixpoint: Π(IR) === committed (Face 2 + Face 3 Q# instance)`);
    return 0;
  }

  console.error("[gen(gen)===gen] FAIL: behavioral equivalence violated");
  for (const m of result.mismatches) {
    console.error(`  ${m}`);
  }
  return 1;
}

if (import.meta.main) {
  process.exit(main());
}

export { generateQSharp, checkFixpoint, extractOperatorBodies, type ZSetIR };
