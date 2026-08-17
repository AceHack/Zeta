/**
 * bonsai-emit.ts — the missing EDGE between the two rungs of the nanopass ladder.
 *
 * WHAT WAS MISSING
 * ----------------
 * `Bonsai` (`src/Core/Bonsai.fs`, `src/Core.TypeScript/bonsai/`) is an expression
 * level with lambda + application and four language oracles — and **zero
 * emitters**. `ZetaIrV1`..`V4` is a lowered scalar-op level with **six emitters**
 * (`codegen-from-ir.ts`) and no expression level. Two rungs of one nanopass ladder
 * (Sarkar–Waddell–Dybvig, *A Nanopass Infrastructure for Compiler Education*,
 * ICFP 2004) that were never joined: `rg -l 'Bonsai' src/Core/ZetaIr*.fs
 * src/Core/MixIr.fs src/Core/Cogen.fs src/Core/GrammarIr.fs` → empty.
 *
 * This file is the first edge. It is deliberately ONE generator (splitmix64 and
 * anything else `codegen-from-ir.ts` already reads), ONE target (Rust), and ONE
 * higher-level `fn` pair (`map` + `join`). Proving an edge exists is the point;
 * widening it is not.
 *
 * WHAT AN EDGE MEANS HERE: ARREST, NOT TRANSLATE
 * ----------------------------------------------
 * One target-independent Bonsai expression is written once. Lowering then stops
 * at **the highest level the target declares it can express**:
 *
 *   L1  join(sep, map(f, xs))        — a target that has iterator combinators
 *   L0  loop_accum(sep, f, xs)       — the floor: mutable accumulation over a list
 *
 * `arrest` rewrites downward until every `fn` in the tree is one the descriptor
 * declares native, and the renderer is a total switch over what survives. A Rust
 * descriptor declaring `{map, join}` arrests at L1 and gets an iterator chain; a
 * descriptor declaring **nothing** arrests at L0 and gets the loop. Both are
 * emitted by the same code path from the same expression.
 *
 * SUBSTRATE AGNOSTIC — THE Q#-SHAPED TEST
 * ---------------------------------------
 * The sharp test is a target with an EMPTY native set. Q# has never executed an
 * op outside `{mul, xorshr}` and its `IrOp` interface carries no `r`/`rs`/`ss`
 * (#10822), so a design that needs the target to have `map` has found a fact
 * about the four von-Neumann lanes and not about the substrate. `TARGET_FLOOR`
 * declares `nativeFns: []` and must still emit. `bonsai-emit.test.ts` asserts it.
 *
 * WHY THE HINT IS NOT IN THE IR
 * -----------------------------
 * `TargetDescriptor` lives here, beside the emitter, and is passed in. It is
 * never read from, written to, or implied by the IR. #10827's carved test —
 * *"would this field change if you deleted a target from the project?"* — is
 * trivially YES for a descriptor, which is exactly why it may not be an IR field:
 * an IR carrying it would make a program's bytes a function of the project's
 * target list, and the four-oracle byte-lock is the thing that pays for.
 *
 * WHAT THE BYTE-LOCK GUARANTEE ACTUALLY IS (read this before trusting it)
 * ----------------------------------------------------------------------
 * `emitRustAt(ir, TARGET_RUST_PORTABLE)` is asserted BYTE-IDENTICAL to the
 * existing `emitRust(ir)` for every IR the test exercises. That is a *pin*, not
 * an independent derivation: the L0 renderer below is a template written to
 * reproduce those bytes, and the test is what keeps it reproducing them. The
 * value of the pin is the direction it fails in — if someone edits the L0
 * renderer, or edits `emitRust`, the two stop agreeing and the committed lanes'
 * byte-lock is defended by a named failure rather than by nobody having looked.
 *
 * BRANCH-FREE: WHERE IT HOLDS AND WHERE IT DOES NOT
 * -------------------------------------------------
 * Aaron's standing design goal is no branching `if`s — composable discriminated
 * unions instead. Honest status:
 *   HOLDS  — target selection. There is no `if (target === "rust")` anywhere in
 *            this file. The target is DATA (a descriptor), the lowering decision
 *            is set membership, and rendering is a total switch on a DU tag that
 *            throws on an unknown tag rather than falling through.
 *   HOLDS  — the L1 EMITTED code. `join` absorbs the separator, so the emitted
 *            Rust contains zero `if`s; the L0 emitted code contains one (the
 *            trailing-comma branch), which is the branch the arrest removes.
 *   DOES NOT HOLD — the surrounding codebase. #10827 counted 2401 `if`
 *            occurrences in `src/Core/*.fs`, and Bonsai's own grammar has a
 *            `Cond` node with a committed golden vector (`factorial`). This is a
 *            design goal the code does not currently meet, and this file does not
 *            change that.
 */

import { call, cstr, lambda, param, serialize, type Expr } from "../../../src/Core.TypeScript/bonsai/index";
import { RUST_OP_RENDERER, canonicalInputsFor, renderOps, type ZetaIrV1 } from "./codegen-from-ir";

// ─── the ladder ──────────────────────────────────────────────────────────────

/**
 * The `fn` names this edge understands, highest level first.
 *
 * `map`/`join` are L1. `loop_accum` is L0 — the floor every target must have,
 * and the only list form a target with an empty native set is left holding.
 * `mix` and `row` are leaves: they are not lowered, and a target that cannot
 * render them is refused rather than approximated.
 */
export const L1_FNS = ["map", "join"] as const;
export const L0_FNS = ["loop_accum"] as const;
export const LEAF_FNS = ["mix", "row"] as const;

/**
 * The `fn`s that are MASSIVELY-PARALLEL SHAPED, and may therefore be written in a
 * program. Aaron 2026-08-15:
 *
 *   "we only want massively parallel algos in our IR. We can have specialization
 *    that optimizes for branching and CPUs for specialization, but never in the
 *    spec itself."
 *
 * The razor is composability, not conditional-freeness: an opcode that traps the
 * caller is capture/extraction-shaped, one that leaves the caller free to compose
 * further is mutual-empowerment-shaped (manifesto §3 weight-free, at instruction
 * semantics). Checked per name:
 *
 *   map        — elementwise, no inter-element ordering. Parallel by construction.
 *   join       — a fold whose combine is associative, so it is tree-reducible.
 *   row · mix  — pure elementwise leaves.
 *
 * `loop_accum` is NOT here, on purpose: it sequences. It is exactly the
 * branch-and-CPU-shaped form Aaron places in **specialization**, and this file
 * treats it that way — it is only ever PRODUCED by lowering, never authored.
 * `assertParallelShaped` is the mechanical guard, and the arrest ladder is
 * therefore the spec/specialization split made operational: L1 is what a program
 * may say, L0 is what a target that cannot do better is given.
 */
export const PARALLEL_FNS: readonly string[] = [...L1_FNS, ...LEAF_FNS];

/**
 * Refuse a program that names a sequential form directly. Written programs live
 * at L1; L0 is a lowering product. Without this the split is a convention, and a
 * convention is not a check.
 */
export function assertParallelShaped(e: Expr): void {
  const offenders = [...new Set(callsIn(e))].filter((fn) => !PARALLEL_FNS.includes(fn));
  if (offenders.length > 0) {
    throw new Error(
      `bonsai-emit: the authored program names non-parallel-shaped \`fn\`(s): ${offenders.join(", ")}. ` +
        `Sequential forms are a SPECIALIZATION produced by lowering, never something a program says. ` +
        `(Aaron 2026-08-15: "only massively parallel algos in our IR … specialization that optimizes ` +
        `for branching and CPUs, but never in the spec itself.")`,
    );
  }
}

/**
 * A target descriptor — the thing that must NOT be in the IR.
 *
 * `nativeFns` is the whole knob: it says which `fn`s this target can express
 * directly. Everything else is lowered until it can. An empty set is legal and
 * is the substrate-agnosticism test.
 */
export interface TargetDescriptor {
  readonly name: string;
  readonly nativeFns: readonly string[];
}

/** Rust with iterator combinators — arrests at L1. */
export const TARGET_RUST_IDIOMATIC: TargetDescriptor = {
  name: "rust-idiomatic",
  nativeFns: ["map", "join"],
};

/** Rust with no combinators declared — arrests at L0, reproducing `emitRust`. */
export const TARGET_RUST_PORTABLE: TargetDescriptor = {
  name: "rust-portable",
  nativeFns: [],
};

/**
 * The floor: a target that declares NOTHING native. Stands in for the Q# lane,
 * whose interface carries no list vocabulary at all. If this cannot emit, the
 * design is von-Neumann-specific and the claim of substrate agnosticism is false.
 */
export const TARGET_FLOOR: TargetDescriptor = {
  name: "floor",
  nativeFns: [],
};

// ─── the program, written once, at the highest level ─────────────────────────

/**
 * The output-assembly program as a Bonsai expression:
 *
 *   join(",\n", map(λ(id, x). row(id, mix(x)), inputs))
 *
 * This is the part of every generated oracle that reads like a translation
 * rather than native code — a mutable `String`, an `enumerate()`, and a branch
 * to decide whether to write a comma. It is also the part where a fold node
 * actually applies, which is why it is the first edge rather than `mix` itself.
 *
 * Every node here is already in the shipped v1 grammar. `map`, `join`, `row`,
 * `loop_accum` and `mix` are new *values* of `Call.fn`, not new node kinds — no
 * oracle whitelists `fn` (verified across F#/TS/C#/Rust in #10827), so this
 * round-trips through the committed serializer today and no version tag moves.
 *
 * Note there is no `cond` node here and no sequencing `fn`: every name the
 * program uses is in `PARALLEL_FNS`, and `assertParallelShaped` enforces it
 * rather than leaving it to review.
 */
export function outputAssemblyProgram(): Expr {
  const e = call("join", [
    cstr(",\n"),
    call("map", [lambda(["id", "x"], call("row", [param("id"), call("mix", [param("x")])])), param("inputs")]),
  ]);
  assertParallelShaped(e);
  return e;
}

/**
 * The program's canonical Bonsai bytes — proof it is a real expression in the
 * shipped format, not a private data structure wearing Bonsai's name.
 */
export function programWire(): string {
  const r = serialize(outputAssemblyProgram());
  if (!r.ok) {
    throw new Error(`bonsai-emit: the output-assembly program does not serialize: ${JSON.stringify(r.error)}`);
  }
  return r.value;
}

// ─── the arrest pass (the nanopass) ──────────────────────────────────────────

/**
 * Lowering rules, keyed by the `fn` being lowered. Total by construction: a `fn`
 * that is neither native, nor a leaf, nor listed here is REFUSED at generation
 * time. That refusal is the same discipline `codegen-from-ir.ts` learned the hard
 * way — its previous `if (op === "mul") … else <xorshr>` shape turned every
 * unknown op into a silently-wrong one, and a generator that cannot fail on input
 * it does not understand is not a generator.
 */
const LOWERINGS: Readonly<Record<string, (args: readonly Expr[]) => Expr>> = {
  /** join(sep, map(f, xs)) ⇒ loop_accum(sep, f, xs) — the only rung below L1. */
  join: (args) => {
    const [sep, inner] = args;
    if (sep === undefined || inner === undefined || inner.kind !== "call" || inner.fn !== "map") {
      throw new Error(
        "bonsai-emit: `join` lowers only in the shape join(sep, map(f, xs)). " +
          "Refusing to lower a shape whose semantics this pass has not been shown to preserve.",
      );
    }
    const [f, xs] = inner.args;
    if (f === undefined || xs === undefined) {
      throw new Error("bonsai-emit: `map` requires exactly (f, xs)");
    }
    return call("loop_accum", [sep, f, xs]);
  },
};

/** Every `fn` name appearing in an expression, in traversal order. */
export function callsIn(e: Expr): string[] {
  switch (e.kind) {
    case "call":
      return [e.fn, ...e.args.flatMap(callsIn)];
    case "lambda":
      return callsIn(e.body);
    case "binary":
      return [...callsIn(e.left), ...callsIn(e.right)];
    case "cond":
      return [...callsIn(e.test), ...callsIn(e.then), ...callsIn(e.else)];
    case "const":
    case "param":
      return [];
    default: {
      const unknown: string = (e as { kind: string }).kind;
      throw new Error(`bonsai-emit: unknown Bonsai node kind \`${unknown}\``);
    }
  }
}

/**
 * Arrest lowering at the highest level the target supports.
 *
 * Rewrites downward while any `fn` in the tree is neither declared native by the
 * descriptor nor terminal, and stops the moment none is left. Note what is NOT
 * here: no branch on target identity. The descriptor is data; the decision is
 * `nativeFns.includes(fn)`; adding a target adds a value, never a case.
 *
 * `L0_FNS` is terminal WITHOUT being declared. That is what "floor" means: the
 * bottom rung is native to every target by definition, so a descriptor declaring
 * nothing still terminates. Requiring a target to declare the floor would make
 * `TARGET_FLOOR` un-emittable — which is exactly the bug this line was written
 * to fix, caught by the empty-descriptor test rather than by review.
 */
export function arrest(e: Expr, target: TargetDescriptor): Expr {
  const native = new Set<string>(target.nativeFns);
  const terminal = new Set<string>([...LEAF_FNS, ...L0_FNS]);

  const step = (x: Expr): Expr => {
    if (x.kind !== "call") return x;
    if (native.has(x.fn) || terminal.has(x.fn)) {
      return call(x.fn, x.args.map(step));
    }
    const rule = LOWERINGS[x.fn];
    if (rule === undefined) {
      throw new Error(
        `bonsai-emit: target \`${target.name}\` declares no native \`${x.fn}\` and no lowering exists for it. ` +
          `Refusing to emit — an un-lowerable node emitted as something else is the silent-mis-compilation class.`,
      );
    }
    return step(rule(x.args));
  };

  return step(e);
}

/** The level a tree arrested at, named for the report. */
export function levelOf(e: Expr): "L1" | "L0" {
  const fns = new Set(callsIn(e));
  return L1_FNS.some((f) => fns.has(f)) ? "L1" : "L0";
}

// ─── the Rust renderer (a total switch over what survived the arrest) ────────

/** The separator carried by the arrested tree's first argument (a `str` const). */
function separatorOf(e: Expr & { kind: "call" }): string {
  const sep = e.args[0];
  if (sep === undefined || sep.kind !== "const" || sep.value.t !== "str") {
    throw new Error(`bonsai-emit: \`${e.fn}\` requires a string-const separator as its first argument`);
  }
  return sep.value.v;
}

/** Rust source-literal escaping for a separator read out of the tree. */
function rustStr(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
}

/**
 * Render the arrested output-assembly expression as Rust.
 *
 * Total: one case per surviving shape, and a throw on anything else. The two
 * cases are the two rungs — they emit the same bytes at run time and read
 * differently at rest, which is the whole claim. Both READ the separator out of
 * the tree, so the Bonsai expression is load-bearing rather than decorative: edit
 * the program and the emitted Rust changes or refuses.
 */
export function renderRustAssembly(e: Expr): string {
  if (e.kind !== "call") {
    throw new Error("bonsai-emit: the output-assembly program must be a call at the root");
  }
  switch (e.fn) {
    case "join": {
      // L1 — iterator chain. `join` absorbs the separator, so the trailing-comma
      // branch that L0 needs does not exist here: zero `if`s in the emitted code.
      return [
        `    let body: String = inputs`,
        `        .iter()`,
        `        .map(|(id, x)| format!("  \\"{id}\\": \\"{}\\"", mix(*x)))`,
        `        .collect::<Vec<_>>()`,
        `        .join("${rustStr(separatorOf(e))}");`,
        `    let s = format!("{{\\n  \\"_source\\": \\"generated-from-ir\\",\\n{body}\\n}}\\n");`,
      ].join("\n");
    }
    case "loop_accum": {
      // The L0 template is pinned to the one separator `emitRust` bakes in. A
      // different separator is REFUSED, not approximated — the L0 lane's bytes
      // are a committed byte-lock and silently re-rendering them under a
      // separator this template does not implement is the mis-compilation class.
      const sep = separatorOf(e);
      if (sep !== ",\n") {
        throw new Error(
          `bonsai-emit: the L0 loop template implements only the separator ",\\n" (got ${JSON.stringify(sep)}). ` +
            `Refusing to emit — this lane's bytes are pinned to \`emitRust\`.`,
        );
      }
      // L0 — the floor. These bytes are PINNED to `emitRust`'s by
      // `bonsai-emit.test.ts`; changing them without changing that emitter is a
      // named test failure, which is the whole point of the pin.
      return [
        `    let mut s = String::from("{\\n");`,
        `    s.push_str("  \\"_source\\": \\"generated-from-ir\\",\\n");`,
        `    for (i, (id, x)) in inputs.iter().enumerate() {`,
        `        let comma = if i < inputs.len() - 1 { "," } else { "" };`,
        `        s.push_str(&format!("  \\"{}\\": \\"{}\\"{}\\n", id, mix(*x), comma));`,
        `    }`,
        `    s.push_str("}\\n");`,
      ].join("\n");
    }
    default:
      throw new Error(
        `bonsai-emit: no Rust rendering for \`${e.fn}\` at the assembly root. ` +
          `Refusing to emit rather than approximating it.`,
      );
  }
}

/**
 * Emit the Rust oracle for `ir`, arresting the output-assembly program at the
 * highest level `target` declares.
 *
 * The `mix` function is emitted by `codegen-from-ir.ts`'s existing op renderer,
 * byte-for-byte identical in both lanes — deliberately, so the ONLY difference
 * between the two emitted programs is the arrest level and any measured
 * difference is attributable to it.
 */
export function emitRustAt(
  ir: ZetaIrV1,
  target: TargetDescriptor,
  inputs?: readonly (readonly [string, string])[],
): string {
  const arrested = arrest(outputAssemblyProgram(), target);
  // renderOps validates the width and REFUSES an op outside the v1..v4 grammar —
  // both refusals inherited, not re-implemented.
  const steps = renderOps(ir, RUST_OP_RENDERER);
  const ins = inputs ?? canonicalInputsFor(ir.width);
  const ty = ir.width === 32 ? "u32" : "u64";

  return `// GENERATED by codegen-from-ir.ts — DO NOT EDIT
// IR-driven total interpreter for ${ir.generator} (width=${String(ir.width)})
use std::fs;
use std::path::Path;

fn mix(x: ${ty}) -> ${ty} {
    let mut z = x;
${steps.join("\n")}
    z
}

fn main() {
    let inputs: [(&str, ${ty}); ${String(ins.length)}] = [
${ins.map(([id, x]) => `        ("${id}", ${x}),`).join("\n")}
    ];
${renderRustAssembly(arrested)}
    let target = Path::new("..").join("rust-output.json");
    fs::write(target, s).expect("write rust-output.json");
    println!("wrote rust-output.json (generated-from-ir)");
}
`;
}
