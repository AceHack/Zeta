/**
 * codegen-interface.ts — Emit language-specific interfaces from IR descriptions.
 *
 * The IR describes an interface as DATA (a JSON object with name, type params,
 * members, variance annotations, and inheritance). The codegen reads this and
 * emits the interface in all 7 target languages using the GCF+specialize principle:
 * richest shared structure + per-language extras (variance in C#, trait bounds in Rust, etc).
 *
 * Design: interfaces ARE IR nodes. Same schema, different dimension.
 * The generator that emits StarRing code can also emit StarRing's interface definition.
 */

// ─── IR Schema for Interface Descriptions ──────────────────────────────────

export interface InterfaceMember {
  name: string;
  kind: "property" | "method";
  // For properties: type is the return type
  // For methods: params + returns
  type?: string;
  params?: { name: string; type: string }[];
  returns?: string;
  doc?: string;
}

export interface InterfaceIr {
  schema: "zeta-ir-v2-interface";
  name: string;
  typeParams: { name: string; variance: "invariant" | "covariant" | "contravariant" }[];
  extends?: string[];
  members: InterfaceMember[];
  doc?: string;
  laws?: string[]; // Documentation of algebraic laws (not machine-checked here)
}

// ─── Type mapping: DATA, applied in ONE pass ──────────────────────────────
//
// Each target language declares its IR-primitive -> native-type map as data, and
// `applyTypeMap` rewrites every declared token in a SINGLE scan.
//
// Why one pass instead of the chain of `.replace` calls this replaced: a chain is
// order-dependent because every later pattern re-scans the OUTPUT of every earlier
// one. `int64 -> int` followed by `int -> long` yields `long` for `int64`, which
// is a silent miscompile of the IR. The chains here were safe only by accident —
// several of their links mapped a token to ITSELF (`.replace(/\bint\b/g, "int")`,
// ten of which CodeQL flagged as js/identity-replacement), and a dead link is
// indistinguishable by eye from a load-bearing one. A single pass CANNOT cascade,
// so the property is structural rather than a fact about the current ordering.
//
// Falsifiers: `codegen-interface.test.ts` §"type maps are single-pass" shuffles
// each map's key order and requires byte-identical output (a chain fails this),
// and `codegen-interface-golden.json` byte-locks all seven emitters.

export type TypeMap = Readonly<Record<string, string>>;

/** The IR primitive type names every language map must account for. */
export const IR_PRIMITIVES: readonly string[] = ["int", "int64", "bool", "string", "void"];

/**
 * A map key must be a bare word: the pattern below anchors each key with `\b`, so
 * a key containing punctuation could never match the way its author intended.
 * Such a key is REFUSED rather than quietly escaped into an entry that matches
 * nothing — a map entry that cannot fire is the vacuity class.
 */
const BARE_WORD_KEY = /^\w+$/;

/**
 * Rewrite every whole-word occurrence of a map key with its value, in ONE pass.
 *
 * Key order is irrelevant, and that is a property of the PATTERN rather than of
 * any sorting done here: both ends of every alternative are anchored with a word
 * boundary, so a key that is a prefix of another key cannot match the prefix and
 * stop. `(?:int|int64)` tries `int` inside `int64` first, fails the trailing
 * boundary against the `6`, backtracks, and takes `int64`. A longest-first sort
 * was written here first and a mutation proved it dead — removing it changed no
 * result, because the boundaries had already decided every case.
 *
 * The falsifier for the claim is `codegen-interface.test.ts` §"longer keys win
 * over their own prefixes": drop either `\\b` from the pattern and it fails.
 */
export function applyTypeMap(t: string, map: TypeMap): string {
  const keys = Object.keys(map);
  for (const k of keys) {
    if (!BARE_WORD_KEY.test(k)) {
      throw new Error(`type-map key ${JSON.stringify(k)} is not a bare word; \\b cannot anchor it`);
    }
  }
  if (keys.length === 0) return t;
  const pattern = new RegExp(`\\b(?:${keys.join("|")})\\b`, "g");
  return t.replace(pattern, m => map[m] ?? m);
}

export const CS_TYPES: TypeMap = { int64: "long", int: "int" };

function csType(t: string): string {
  return applyTypeMap(t, CS_TYPES);
}

// ─── Emit C# ──────────────────────────────────────────────────────────────

export function emitCSharp(ir: InterfaceIr): string {
  const typeParams = ir.typeParams.length
    ? `<${ir.typeParams.map(tp => {
        const prefix = tp.variance === "covariant" ? "out " :
                       tp.variance === "contravariant" ? "in " : "";
        return `${prefix}${tp.name}`;
      }).join(", ")}>`
    : "";

  const extendsClause = ir.extends?.length
    ? ` : ${ir.extends.map(e => `${e}${ir.typeParams.length ? `<${ir.typeParams.map(t => t.name).join(", ")}>` : ""}`).join(", ")}`
    : "";

  const members = ir.members.map(m => {
    const doc = m.doc ? `    /// <summary>${m.doc}</summary>\n` : "";
    if (m.kind === "property") {
      return `${doc}    public ${csType(m.type!)} ${m.name} { get; }`;
    } else {
      const params = (m.params || []).map(p => `${csType(p.type)} ${p.name}`).join(", ");
      return `${doc}    public ${csType(m.returns!)} ${m.name}(${params});`;
    }
  }).join("\n\n");

  const doc = ir.doc ? `/// <summary>\n/// ${ir.doc}\n/// </summary>\n` : "";
  const laws = ir.laws?.length
    ? `/// <remarks>\n/// Laws:\n${ir.laws.map((l: any) => `/// - ${typeof l === "string" ? l : l.doc || l.id}`).join("\n")}\n/// </remarks>\n`
    : "";

  return `// GENERATED by codegen-interface.ts — DO NOT EDIT
namespace Zeta.Core;

${doc}${laws}public interface ${ir.name}${typeParams}${extendsClause}
{
${members}
}
`;
}

// ─── Emit TypeScript ──────────────────────────────────────────────────────

export function emitTypeScript(ir: InterfaceIr): string {
  const typeParams = ir.typeParams.length
    ? `<${ir.typeParams.map(tp => tp.name).join(", ")}>`
    : "";
  const extendsClause = ir.extends?.length
    ? ` extends ${ir.extends.map(e => `${e}${ir.typeParams.length ? `<${ir.typeParams.map(t => t.name).join(", ")}>` : ""}`).join(", ")}`
    : "";

  const members = ir.members.map(m => {
    const doc = m.doc ? `  /** ${m.doc} */\n` : "";
    if (m.kind === "property") {
      return `${doc}  readonly ${m.name}: ${tsType(m.type!)};`;
    } else {
      const params = (m.params || []).map(p => `${p.name}: ${tsType(p.type)}`).join(", ");
      return `${doc}  ${m.name}(${params}): ${tsType(m.returns!)};`;
    }
  }).join("\n\n");

  const doc = ir.doc ? `/** ${ir.doc} */\n` : "";

  return `// GENERATED by codegen-interface.ts — DO NOT EDIT

${doc}export interface ${ir.name}${typeParams}${extendsClause} {
${members}
}
`;
}

// Type param names are absent from the map, so they pass through untouched
// (they match the generic declaration emitted above).
export const TS_TYPES: TypeMap = { bool: "boolean", int64: "number", int: "number" };

function tsType(t: string): string {
  return applyTypeMap(t, TS_TYPES);
}

// ─── Emit Rust ───────────────────────────────────────────────────────────

export function emitRust(ir: InterfaceIr): string {
  const typeParams = ir.typeParams.length
    ? `<${ir.typeParams.map(tp => tp.name).join(", ")}>`
    : "";
  const bounds = ir.extends?.length
    ? `: ${ir.extends.join(" + ")}`
    : "";

  const members = ir.members.map(m => {
    const doc = m.doc ? `    /// ${m.doc}\n` : "";
    if (m.kind === "property") {
      return `${doc}    fn ${toSnake(m.name)}(&self) -> ${rustType(m.type!)};`;
    } else {
      const params = (m.params || []).map(p => `${toSnake(p.name)}: ${rustType(p.type)}`).join(", ");
      return `${doc}    fn ${toSnake(m.name)}(&self, ${params}) -> ${rustType(m.returns!)};`;
    }
  }).join("\n\n");

  const doc = ir.doc ? `/// ${ir.doc}\n` : "";

  return `// GENERATED by codegen-interface.ts — DO NOT EDIT

${doc}pub trait ${ir.name}${typeParams}${bounds} {
${members}
}
`;
}

// Type param names are absent from the map, so they stay as declared in the IR.
//
// `void` was MISSING from this map until 2026-09-09, and the chain of `.replace`
// calls it replaced made that invisible: the chain listed four tokens, two of
// which mapped to THEMSELVES, so it read as exhaustive. Every void-returning IR
// member therefore emitted `-> void;`, which is not a Rust type and does not
// compile. Rust spells the unit return `()`.
export const RUST_TYPES: TypeMap = { int64: "i64", int: "i32", bool: "bool", string: "&str", void: "()" };

function rustType(t: string): string {
  return applyTypeMap(t, RUST_TYPES);
}

function toSnake(s: string): string {
  return s.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
}

// ─── Emit F# ────────────────────────────────────────────────────────────

export function emitFSharp(ir: InterfaceIr): string {
  // Per-IR map: type params become F# tick-prefixed generics, then the shared
  // primitives. Built as ONE map so a type param named after a primitive cannot
  // be rewritten twice (a chain would turn a param named `void` into `'unit`).
  const fsharpTypes: TypeMap = {
    ...Object.fromEntries(ir.typeParams.map(tp => [tp.name, `'${tp.name}`])),
    void: "unit",
    int64: "int64",
    int: "int",
  };
  const fsharpType = (t: string): string => applyTypeMap(t, fsharpTypes);

  const typeParams = ir.typeParams.length
    ? `<${ir.typeParams.map(tp => `'${tp.name}`).join(", ")}>`
    : "";
  const inherits = ir.extends?.length
    ? ir.extends.map(e => `    inherit ${e}${ir.typeParams.length ? `<${ir.typeParams.map(t => `'${t.name}`).join(", ")}>` : ""}`).join("\n") + "\n"
    : "";

  const members = ir.members.map(m => {
    const doc = m.doc ? `    /// ${m.doc}\n` : "";
    if (m.kind === "property") {
      return `${doc}    abstract member ${m.name}: ${fsharpType(m.type!)}`;
    } else {
      const paramTypes = (m.params || []).map(p => fsharpType(p.type)).join(" * ");
      return `${doc}    abstract member ${m.name}: ${paramTypes} -> ${fsharpType(m.returns!)}`;
    }
  }).join("\n\n");

  const doc = ir.doc ? `/// ${ir.doc}\n` : "";

  return `// GENERATED by codegen-interface.ts — DO NOT EDIT
namespace Zeta.Core

${doc}[<Interface>]
type ${ir.name}${typeParams} =
${inherits}${members}
`;
}

// ─── Emit Python ─────────────────────────────────────────────────────────

export function emitPython(ir: InterfaceIr): string {
  const typeParams = ir.typeParams.length
    ? ir.typeParams.map(tp => {
        const variance = tp.variance === "covariant" ? ", covariant=True" :
                         tp.variance === "contravariant" ? ", contravariant=True" : "";
        return `${tp.name} = TypeVar("${tp.name}"${variance})`;
      }).join("\n") + "\n\n"
    : "";

  const genericBase = ir.typeParams.length
    ? `, Generic[${ir.typeParams.map(t => t.name).join(", ")}]`
    : "";

  const bases = ir.extends?.length
    ? ir.extends.map(e => `${e}${ir.typeParams.length ? `[${ir.typeParams.map(t => t.name).join(", ")}]` : ""}`).join(", ")
    : `Protocol${genericBase}`;

  const members = ir.members.map(m => {
    const doc = m.doc ? `        \"\"\"${m.doc}\"\"\"\n` : "";
    if (m.kind === "property") {
      return `    @property\n    @abstractmethod\n    def ${toSnake(m.name)}(self) -> ${pythonType(m.type!)}:\n${doc}        ...`;
    } else {
      const params = (m.params || []).map(p => `${toSnake(p.name)}: ${pythonType(p.type)}`).join(", ");
      return `    @abstractmethod\n    def ${toSnake(m.name)}(self, ${params}) -> ${pythonType(m.returns!)}:\n${doc}        ...`;
    }
  }).join("\n\n");

  const doc = ir.doc ? `    \"\"\"${ir.doc}\"\"\"\n\n` : "";

  return `# GENERATED by codegen-interface.ts — DO NOT EDIT
from __future__ import annotations
from abc import abstractmethod
from typing import TypeVar, Protocol, Generic

${typeParams}class ${ir.name}(${bases}):
${doc}${members}
`;
}

export const PYTHON_TYPES: TypeMap = {
  int64: "int", int: "int", bool: "bool", string: "str", void: "None",
};

function pythonType(t: string): string {
  return applyTypeMap(t, PYTHON_TYPES);
}

// ─── Emit Go ─────────────────────────────────────────────────────────────

export function emitGo(ir: InterfaceIr): string {
  const typeParams = ir.typeParams.length
    ? `[${ir.typeParams.map(tp => `${tp.name} any`).join(", ")}]`
    : "";
  const embeds = ir.extends?.length
    ? ir.extends.map(e => `    ${e}${ir.typeParams.length ? `[${ir.typeParams.map(t => t.name).join(", ")}]` : ""}`).join("\n") + "\n"
    : "";

  const members = ir.members.map(m => {
    const doc = m.doc ? `    // ${m.doc}\n` : "";
    if (m.kind === "property") {
      return `${doc}    ${m.name}() ${goType(m.type!)}`;
    } else {
      const params = (m.params || []).map(p => `${p.name} ${goType(p.type)}`).join(", ");
      // A Go method that returns nothing has NO result type — not the word
      // `void`, which is what this emitted before 2026-09-09. `GO_TYPES` maps
      // `void` to the empty string; the result is appended only when non-empty.
      const ret = goType(m.returns!);
      return `${doc}    ${m.name}(${params})${ret ? ` ${ret}` : ""}`;
    }
  }).join("\n\n");

  const doc = ir.doc ? `// ${ir.doc}\n` : "";

  return `// GENERATED by codegen-interface.ts — DO NOT EDIT
package algebra

${doc}type ${ir.name}${typeParams} interface {
${embeds}${members}
}
`;
}

// Go names four of the five IR primitives identically. The map is spelled out
// rather than left empty so the mapping is DECLARED and checkable, instead of
// merely happening to be the identity.
//
// `void` maps to the EMPTY STRING because Go has no void type: a method that
// returns nothing simply omits the result type. The call site appends the
// result only when it is non-empty.
export const GO_TYPES: TypeMap = {
  int64: "int64", int: "int", bool: "bool", string: "string", void: "",
};

function goType(t: string): string {
  return applyTypeMap(t, GO_TYPES);
}

// ─── Emit Q# ─────────────────────────────────────────────────────────────

export function emitQSharp(ir: InterfaceIr): string {
  // Q# doesn't have interfaces — emit as a newtype + function signatures

  const functions = ir.members.map(m => {
    const doc = m.doc ? `    /// ${m.doc}\n` : "";
    if (m.kind === "property") {
      return `${doc}    function ${m.name}() : ${qsharpType(m.type!)} { ... }`;
    } else {
      const params = (m.params || []).map(p => `${p.name} : ${qsharpType(p.type)}`).join(", ");
      return `${doc}    function ${m.name}(${params}) : ${qsharpType(m.returns!)} { ... }`;
    }
  }).join("\n\n");

  const doc = ir.doc ? `    /// ${ir.doc}\n` : "";

  return `// GENERATED by codegen-interface.ts — DO NOT EDIT
// Q# doesn't have interfaces — this is a specification (function signatures)
namespace Zeta.Core {
${doc}
    // ${ir.name} specification:
${functions}
}
`;
}

// Q# has no generics in the same way — the known type params collapse to Int.
export const QSHARP_TYPES: TypeMap = {
  TWeight: "Int", TState: "Int", TEvent: "Int", T: "Int",
  int64: "Int", int: "Int", bool: "Bool", string: "String", void: "Unit",
};

function qsharpType(t: string): string {
  return applyTypeMap(t, QSHARP_TYPES);
}

// ─── Main: read IR JSON, emit all 7 ──────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export function emitAll(ir: InterfaceIr, outDir: string): void {
  mkdirSync(outDir, { recursive: true });

  const files: [string, string, string][] = [
    ["cs", `I${ir.name}.cs`, emitCSharp(ir)],
    ["ts", `${ir.name}.ts`, emitTypeScript(ir)],
    ["rs", `${toSnake(ir.name)}.rs`, emitRust(ir)],
    ["fsx", `${ir.name}.fsx`, emitFSharp(ir)],
    ["py", `${toSnake(ir.name)}.py`, emitPython(ir)],
    ["go", `${toSnake(ir.name)}.go`, emitGo(ir)],
    ["qs", `${ir.name}.qs`, emitQSharp(ir)],
  ];

  for (const [, filename, content] of files) {
    writeFileSync(join(outDir, filename), content);
  }

  console.log(`[codegen-interface] emitted ${files.length} interface files from ${ir.name} → ${outDir}`);
  for (const [, filename] of files) {
    console.log(`  ${filename}`);
  }
}

// ─── CLI entry point ─────────────────────────────────────────────────────

if (import.meta.main) {
  const [irPath, outDir] = process.argv.slice(2);
  if (!irPath || !outDir) {
    console.error("Usage: bun codegen-interface.ts <ir.json> <out-dir>");
    process.exit(1);
  }
  const ir: InterfaceIr = JSON.parse(readFileSync(irPath, "utf-8"));
  if (ir.schema !== "zeta-ir-v2-interface") {
    console.error(`ERROR: expected schema "zeta-ir-v2-interface", got "${ir.schema}"`);
    process.exit(1);
  }
  emitAll(ir, outDir);
}

/**
 * Every language type map that is a compile-time constant, keyed by emitter.
 *
 * Exported so the falsifiers can shuffle each map key order and require
 * byte-identical output — a property the chain of `.replace` calls this
 * replaced could not hold, and the reason the identity-mapping links were
 * load-bearing-LOOKING rather than load-bearing.
 *
 * F# is absent by construction: its map is built per-IR from `ir.typeParams`,
 * and `emitFSharp` is covered by the golden byte-lock instead.
 */
export const STATIC_TYPE_MAPS: Readonly<Record<string, TypeMap>> = {
  cs: CS_TYPES,
  ts: TS_TYPES,
  rs: RUST_TYPES,
  py: PYTHON_TYPES,
  go: GO_TYPES,
  qs: QSHARP_TYPES,
};
