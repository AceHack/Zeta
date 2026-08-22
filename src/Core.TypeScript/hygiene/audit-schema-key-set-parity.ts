#!/usr/bin/env bun
// audit-schema-key-set-parity.ts — fail when two oracles that declare the SAME
// schema id disagree on their KEY SET.
//
// WHY THIS EXISTS
//
//   The four-oracle byte-lock pins field *values*. It does not pin field
//   *names*. A golden vector / treaty case that fixes `temperaturePpm = 250000`
//   passes just as happily whether the producing type has eight fields or nine,
//   so one oracle can grow or lose a field under an unchanged schema id and
//   every existing check stays green.
//
//   That is not hypothetical. PR #10722 added a required `fidelity` field to
//   TypeScript's `TemperatureReadout` while F#'s `TemperatureReadout`
//   (`src/Core/Heat.fs`) kept eight fields, and BOTH still declare
//   `zeta.temperature.readout.v1`. The divergence was filed
//   (`workitems/081M010WYE5087G0R003J89QVF-*`) rather than hidden, and it was
//   filed precisely because nothing could see it. Verified before this tool was
//   written: the three suites that read the heat treaty
//   (`heat-signals.test.ts`, `darkhall-room.test.ts`, `batch-heat-bridge.test.ts`)
//   report 51 pass / 0 fail / exit 0 with the divergence live on main.
//
//   So the gap is in the verification substrate, not in one type. This tool
//   closes the named half of it: same schema id, different key set, across
//   oracles.
//
// WHAT IT COMPARES
//
//   The unit of comparison is the DECLARED SCHEMA ID (`zeta.<name>.v<N>`), and
//   only where at least two oracles BIND that id to a declared type shape.
//   Merely mentioning the string is not binding — `zeta.multisig.v1` is an F#
//   signing domain and its only TypeScript mention is an assertion that a
//   different domain is DELIBERATELY not equal to it. A string-intersection
//   check would have reported that pair as a divergence; this one does not see
//   it at all, because neither side binds it to a record or interface.
//
//   Version suffixes are the escape hatch and they fall out for free: the key
//   is the whole id, so `...v1` and `...v2` are different schemas and are never
//   compared. Divergence WITHIN a version is the defect.
//
// ORACLE BINDINGS
//
//   TypeScript — `export const X = "zeta.a.v1"` plus an interface carrying
//     `readonly schema: typeof X` (or an inline `schema: "zeta.a.v1"`).
//     `extends` chains are resolved within the file; a member written `name?:`
//     is OPTIONAL.
//
//   F# — `let X = "zeta.a.v1"` plus a record construction literal assigning
//     `Schema = X`. The literal is used rather than the type declaration
//     because F# REQUIRES a record literal to mention every field, so the
//     literal's key set is exhaustive by compiler rule. Copy-update
//     expressions (`{ r with ... }`) are exempt from that rule and are skipped.
//
//   Field names are normalised to the wire form by camel-casing the F# field.
//   That normalisation was checked against every `[<JsonPropertyName("x")>]`
//   attribute in the scanned F# surfaces: all of them satisfy
//   `camelCase(field) === x`, so the normalisation is faithful and not a guess.
//
// OPTIONALITY — STATED LIMITATION, CONSERVATIVE READING
//
//   A new OPTIONAL field is a compatible extension; a new REQUIRED field is a
//   breaking divergence. TypeScript makes that distinction visible (`?`) and it
//   is used. F# record LITERALS do not carry types, so this tool cannot tell an
//   `X option` field from a required one. It therefore takes the conservative
//   reading and treats every F# key as required. Consequence, stated plainly:
//   an F#-only field that is genuinely optional will be reported as a
//   divergence and must be resolved or declared. That is the safe direction to
//   be wrong in.
//
// DECLARED EXCEPTIONS
//
//   `audit-schema-key-set-parity.exceptions.json` — text, diffable, in the
//   proof lineage (no-binary-in-proof-lineage). An honest declared exception
//   beats a guessed fix in a treaty. Exceptions are themselves checked: one
//   that no longer matches a live divergence is STALE and fails, so the file
//   cannot rot into a blanket mute.
//
// SCAN FLOOR
//
//   If fewer than `--min-schemas` schema ids are actually compared, the run
//   FAILS instead of reporting success. A check that silently inspects nothing
//   because a glob or a path moved is a check that did not run looking like one
//   that passed.
//
// DST: pure function of the file tree. No clock, no network, no randomness.
// Output ordering is `localeCompare`-free — plain ordinal sort throughout.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-schema-key-set-parity.ts
//   bun src/Core.TypeScript/hygiene/audit-schema-key-set-parity.ts --json
//   bun src/Core.TypeScript/hygiene/audit-schema-key-set-parity.ts --min-schemas 6
//
// Exit codes:
//   0  every compared schema agrees across oracles (or is declared)
//   1  usage error
//   2  key-set divergence (or a stale declared exception)
//   3  scan floor breach — fewer schemas compared than required

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, relative } from "node:path";

export type OracleName = "fsharp" | "typescript";

export interface SchemaField {
  readonly key: string;
  readonly optional: boolean;
}

export interface SchemaBinding {
  readonly schemaId: string;
  readonly oracle: OracleName;
  readonly typeName: string;
  readonly file: string;
  readonly line: number;
  readonly fields: readonly SchemaField[];
}

export interface KeyDivergence {
  readonly schemaId: string;
  readonly key: string;
  readonly presentIn: OracleName;
  readonly presentAs: "required" | "optional";
  readonly absentFrom: OracleName;
  readonly severity: "breaking" | "compatible";
}

export interface DeclaredException {
  readonly schema: string;
  readonly key: string;
  readonly presentIn: OracleName;
  readonly absentFrom: OracleName;
  readonly reason: string;
  readonly workitem: string;
}

export interface AuditReport {
  readonly comparedSchemas: readonly string[];
  readonly singleOracleSchemas: readonly string[];
  readonly breaking: readonly KeyDivergence[];
  readonly compatible: readonly KeyDivergence[];
  readonly declaredAccepted: readonly KeyDivergence[];
  readonly staleExceptions: readonly DeclaredException[];
  readonly bindings: readonly SchemaBinding[];
}

const SCHEMA_ID = /^zeta\.[A-Za-z0-9][A-Za-z0-9._-]*\.v[0-9]+$/;

// The scan floor. Nine schema ids are declared in both F# and TypeScript on
// main; of those, the ones that bind a type shape in both oracles are what can
// actually be compared. Raise this when more oracles or schemas are covered —
// never lower it silently.
export const DEFAULT_MIN_SCHEMAS = 6;

const SKIP_DIRS: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  "prior-art",
  "references",
  "bin",
  "obj",
  "dist",
  "BenchmarkDotNet.Artifacts",
]);

/** PascalCase / already-camel field name to its wire form. */
export function camelCase(name: string): string {
  if (name.length === 0) {
    return name;
  }

  return name.slice(0, 1).toLowerCase() + name.slice(1);
}

/**
 * Replace the CONTENT of string literals and comments with spaces, preserving
 * length and therefore every index into the original text. Brace matching runs
 * over the mask so that a `{` inside a string or a comment cannot desynchronise
 * the depth counter; values are read back out of the original.
 */
export function maskLiteralsAndComments(text: string): string {
  const out = text.split("");
  let i = 0;

  const blank = (from: number, to: number): void => {
    for (let k = from; k < to && k < out.length; k += 1) {
      if (out[k] !== "\n") {
        out[k] = " ";
      }
    }
  };

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    // Line comments: `//` (TS) and `--` is NOT a comment in F#; F# uses `//` too.
    if (ch === "/" && next === "/") {
      let end = text.indexOf("\n", i);
      end = end === -1 ? text.length : end;
      blank(i, end);
      i = end;
      continue;
    }

    // Block comments: `/* ... */` (TS) and `(* ... *)` (F#).
    if (ch === "/" && next === "*") {
      let end = text.indexOf("*/", i + 2);
      end = end === -1 ? text.length : end + 2;
      blank(i, end);
      i = end;
      continue;
    }

    if (ch === "(" && next === "*") {
      let end = text.indexOf("*)", i + 2);
      end = end === -1 ? text.length : end + 2;
      blank(i, end);
      i = end;
      continue;
    }

    // Triple-quoted F# string.
    if (text.startsWith('"""', i)) {
      let end = text.indexOf('"""', i + 3);
      end = end === -1 ? text.length : end + 3;
      blank(i + 3, end - 3);
      i = end;
      continue;
    }

    // Ordinary string / template literal.
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let k = i + 1;

      while (k < text.length) {
        if (text[k] === "\\") {
          k += 2;
          continue;
        }

        if (text[k] === quote) {
          break;
        }

        k += 1;
      }

      blank(i + 1, k);
      i = Math.min(k + 1, text.length);
      continue;
    }

    i += 1;
  }

  return out.join("");
}

/** Index of the `}` matching the `{` at `open`, over already-masked text. */
export function matchBrace(masked: string, open: number): number {
  let depth = 0;

  for (let i = open; i < masked.length; i += 1) {
    const ch = masked[i];

    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;

      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

function lineOf(text: string, index: number): number {
  let line = 1;

  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text[i] === "\n") {
      line += 1;
    }
  }

  return line;
}

/**
 * Depth-1 spans of a `{ ... }` body: the regions between top-level separators,
 * with nested braces / brackets / parens skipped wholesale.
 */
function depthOneSlices(masked: string, open: number, close: number): readonly [number, number][] {
  const slices: [number, number][] = [];
  let start = open + 1;
  let depth = 0;

  for (let i = open + 1; i < close; i += 1) {
    const ch = masked[i];

    if (ch === "{" || ch === "[" || ch === "(") {
      depth += 1;
    } else if (ch === "}" || ch === "]" || ch === ")") {
      depth -= 1;
    } else if (depth === 0 && (ch === ";" || ch === "\n")) {
      slices.push([start, i]);
      start = i + 1;
    }
  }

  slices.push([start, close]);
  return slices;
}

// ---------------------------------------------------------------------------
// TypeScript extraction
// ---------------------------------------------------------------------------

interface RawTsInterface {
  readonly name: string;
  readonly extends: readonly string[];
  readonly fields: readonly SchemaField[];
  readonly schemaConstRef: string | undefined;
  readonly schemaLiteral: string | undefined;
  readonly line: number;
}

const TS_CONST = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g;
const TS_INTERFACE = /(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)\s*(?:extends\s+([^{]+?))?\s*\{/g;
const TS_MEMBER = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(\?)?\s*:\s*([\s\S]*)$/;
const TS_TYPEOF = /^typeof\s+([A-Za-z_$][\w$]*)/;
const TS_STRING_TYPE = /^"([^"]*)"/;

export function extractTypeScript(text: string, file: string): readonly SchemaBinding[] {
  const masked = maskLiteralsAndComments(text);
  const consts = new Map<string, string>();

  for (const match of text.matchAll(TS_CONST)) {
    // Only accept a const whose declaration survives masking (i.e. was not
    // itself inside a comment).
    const at = match.index ?? 0;

    if (masked.slice(at, at + 5).trim().length === 0) {
      continue;
    }

    const [, constName, constValue] = match;

    if (constName === undefined || constValue === undefined) {
      continue;
    }

    consts.set(constName, constValue);
  }

  const raw: RawTsInterface[] = [];

  for (const match of masked.matchAll(TS_INTERFACE)) {
    const open = (match.index ?? 0) + match[0].length - 1;
    const close = matchBrace(masked, open);

    if (close === -1) {
      continue;
    }

    const fields: SchemaField[] = [];
    let schemaConstRef: string | undefined;
    let schemaLiteral: string | undefined;

    for (const [from, to] of depthOneSlices(masked, open, close)) {
      const slice = text.slice(from, to);
      const member = TS_MEMBER.exec(slice);

      if (member === null) {
        continue;
      }

      const [, name, optional, typeText] = member;

      if (name === undefined) {
        continue;
      }

      fields.push({ key: name, optional: optional === "?" });

      if (name === "schema") {
        const trimmed = (typeText ?? "").trim();
        const viaTypeof = TS_TYPEOF.exec(trimmed);
        const viaLiteral = TS_STRING_TYPE.exec(trimmed);

        if (viaTypeof !== null) {
          schemaConstRef = viaTypeof[1];
        } else if (viaLiteral !== null) {
          schemaLiteral = viaLiteral[1];
        }
      }
    }

    const interfaceName = match[1];

    if (interfaceName === undefined) {
      continue;
    }

    raw.push({
      name: interfaceName,
      extends: (match[2] ?? "")
        .split(",")
        .map((part) => part.trim().replace(/<.*$/, ""))
        .filter((part) => part.length > 0),
      fields,
      schemaConstRef,
      schemaLiteral,
      line: lineOf(text, match.index ?? 0),
    });
  }

  const byName = new Map(raw.map((item) => [item.name, item]));

  const flatten = (item: RawTsInterface, seen: ReadonlySet<string>): readonly SchemaField[] | undefined => {
    const fields: SchemaField[] = [...item.fields];

    for (const parent of item.extends) {
      if (seen.has(parent)) {
        continue;
      }

      const base = byName.get(parent);

      // An unresolvable base means the key set would be UNDER-reported. Refuse
      // to guess: drop the binding rather than compare an incomplete shape.
      if (base === undefined) {
        return undefined;
      }

      const inherited = flatten(base, new Set([...seen, parent]));

      if (inherited === undefined) {
        return undefined;
      }

      fields.push(...inherited);
    }

    return fields;
  };

  const bindings: SchemaBinding[] = [];

  for (const item of raw) {
    const schemaId =
      item.schemaLiteral ?? (item.schemaConstRef === undefined ? undefined : consts.get(item.schemaConstRef));

    if (schemaId === undefined || !SCHEMA_ID.test(schemaId)) {
      continue;
    }

    const fields = flatten(item, new Set([item.name]));

    if (fields === undefined) {
      continue;
    }

    const deduped = new Map<string, SchemaField>();

    for (const field of fields) {
      const prior = deduped.get(field.key);

      // A redeclared member narrows: required wins over optional.
      deduped.set(field.key, {
        key: field.key,
        optional: (prior?.optional ?? true) && field.optional,
      });
    }

    bindings.push({
      schemaId,
      oracle: "typescript",
      typeName: item.name,
      file,
      line: item.line,
      fields: [...deduped.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
    });
  }

  return bindings;
}

// ---------------------------------------------------------------------------
// F# extraction
// ---------------------------------------------------------------------------

const FS_CONST = /let\s+([A-Za-z_][\w']*)\s*=\s*"([^"]*)"/g;
const FS_FIELD = /^\s*(?:\[<[^\]]*>\]\s*)*([A-Z][\w']*)\s*=\s*([\s\S]*)$/;
const FS_PATH = /^([A-Za-z_][\w'.]*)/;

/** `let X = "zeta.a.v1"` bindings in one file, ignoring commented-out ones. */
export function fsharpConstants(text: string): ReadonlyMap<string, string> {
  const masked = maskLiteralsAndComments(text);
  const consts = new Map<string, string>();

  for (const match of text.matchAll(FS_CONST)) {
    const at = match.index ?? 0;

    if (masked.slice(at, at + 3).trim().length === 0) {
      continue;
    }

    const [, constName, constValue] = match;

    if (constName === undefined || constValue === undefined) {
      continue;
    }

    consts.set(constName, constValue);
  }

  return consts;
}

/**
 * Resolve the right-hand side of `Schema = <expr>` to a schema id.
 *
 * The subtle case, and the one that produced a false positive before it was
 * fixed: `{ Schema = readout.Schema; ... }` is a PASS-THROUGH of another
 * value's schema, not a declaration of this type's schema. Resolving its tail
 * identifier `Schema` against the enclosing file's `let Schema = "..."` bound
 * four heat-shaped records in `DarkHallRoomTranscript.fs` to
 * `zeta.darkhall.room-ui.v1` and invented nine divergences that do not exist.
 *
 * So a QUALIFIED path only resolves when its qualifier is module-shaped
 * (F# convention: modules are PascalCase, values are camelCase). `readout.Schema`
 * is rejected; `HeatReadout.TemperatureSchema` is accepted.
 */
export function resolveFSharpSchemaValue(
  valueText: string,
  fileConsts: ReadonlyMap<string, string>,
  globalConsts: ReadonlyMap<string, ReadonlySet<string>>,
): string | undefined {
  const value = valueText.trim();
  const literal = /^"([^"]*)"/.exec(value);

  if (literal !== null) {
    return literal[1];
  }

  const path = FS_PATH.exec(value);

  if (path === null) {
    return undefined;
  }

  const segments = (path[1] ?? "").split(".").filter((part) => part.length > 0);
  const name = segments[segments.length - 1];

  if (name === undefined) {
    return undefined;
  }

  if (segments.length > 1) {
    const qualifier = segments[segments.length - 2] ?? "";
    const head = qualifier.slice(0, 1);

    // Lower-case qualifier => a value, not a module => this is a pass-through.
    if (head !== head.toUpperCase()) {
      return undefined;
    }
  }

  const local = fileConsts.get(name);

  if (local !== undefined) {
    return local;
  }

  const global = globalConsts.get(name);

  // A name that means different things in different files resolves to nothing
  // rather than to a guess.
  if (global !== undefined && global.size === 1) {
    return [...global][0];
  }

  return undefined;
}

export function extractFSharp(
  text: string,
  file: string,
  globalConsts: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
): readonly SchemaBinding[] {
  const masked = maskLiteralsAndComments(text);
  const consts = fsharpConstants(text);

  const bindings: SchemaBinding[] = [];

  for (let i = 0; i < masked.length; i += 1) {
    if (masked[i] !== "{") {
      continue;
    }

    const close = matchBrace(masked, i);

    if (close === -1) {
      continue;
    }

    // `{| ... |}` anonymous records and `{ r with ... }` copy-updates are not
    // exhaustive, so their key set says nothing about the type's key set.
    const body = text.slice(i, close + 1);

    if (/^\{\s*[A-Za-z_][\w'.]*\s+with\b/.test(body)) {
      continue;
    }

    const fields: SchemaField[] = [];
    let schemaId: string | undefined;

    for (const [from, to] of depthOneSlices(masked, i, close)) {
      const slice = text.slice(from, to);
      const field = FS_FIELD.exec(slice);

      if (field === null) {
        continue;
      }

      const [, name, valueText] = field;

      if (name === undefined) {
        continue;
      }

      fields.push({ key: camelCase(name), optional: false });

      if (name === "Schema") {
        schemaId = resolveFSharpSchemaValue(valueText ?? "", consts, globalConsts);
      }
    }

    if (schemaId === undefined || !SCHEMA_ID.test(schemaId) || fields.length < 2) {
      continue;
    }

    bindings.push({
      schemaId,
      oracle: "fsharp",
      typeName: `<record literal>`,
      file,
      line: lineOf(text, i),
      fields: fields.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
    });
  }

  return bindings;
}

// ---------------------------------------------------------------------------
// Walk + compare
// ---------------------------------------------------------------------------

export function collectSourceFiles(root: string, dirs: readonly string[]): readonly string[] {
  const found: string[] = [];

  const walk = (dir: string): void => {
    let entries: readonly string[];

    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of [...entries].sort()) {
      if (SKIP_DIRS.has(entry) || entry.startsWith(".")) {
        continue;
      }

      const full = join(dir, entry);
      let info;

      try {
        info = statSync(full);
      } catch {
        continue;
      }

      if (info.isDirectory()) {
        walk(full);
        continue;
      }

      if (entry.endsWith(".fs") || (entry.endsWith(".ts") && !entry.endsWith(".d.ts"))) {
        found.push(full);
      }
    }
  };

  for (const dir of dirs) {
    const full = resolve(root, dir);

    if (existsSync(full)) {
      walk(full);
    }
  }

  return found.sort();
}

function exceptionKey(schema: string, key: string, presentIn: string, absentFrom: string): string {
  return `${schema}\u0000${key}\u0000${presentIn}\u0000${absentFrom}`;
}

export function compare(
  bindings: readonly SchemaBinding[],
  exceptions: readonly DeclaredException[],
): AuditReport {
  const bySchema = new Map<string, SchemaBinding[]>();

  for (const binding of bindings) {
    const list = bySchema.get(binding.schemaId) ?? [];
    list.push(binding);
    bySchema.set(binding.schemaId, list);
  }

  const comparedSchemas: string[] = [];
  const singleOracleSchemas: string[] = [];
  const breaking: KeyDivergence[] = [];
  const compatible: KeyDivergence[] = [];
  const declaredAccepted: KeyDivergence[] = [];

  const declared = new Map(
    exceptions.map((item) => [exceptionKey(item.schema, item.key, item.presentIn, item.absentFrom), item]),
  );
  const usedExceptions = new Set<string>();

  for (const schemaId of [...bySchema.keys()].sort()) {
    const list = bySchema.get(schemaId) ?? [];
    const oracles = [...new Set(list.map((item) => item.oracle))].sort();

    if (oracles.length < 2) {
      singleOracleSchemas.push(schemaId);
      continue;
    }

    comparedSchemas.push(schemaId);

    // Per oracle, the union of required keys and the union of all keys. Where
    // one oracle has several binding sites for a schema they are the same type,
    // so a key required at any site is required.
    const perOracle = new Map<OracleName, { required: Set<string>; all: Set<string> }>();

    for (const oracle of oracles) {
      const required = new Set<string>();
      const all = new Set<string>();

      for (const binding of list.filter((item) => item.oracle === oracle)) {
        for (const field of binding.fields) {
          all.add(field.key);

          if (!field.optional) {
            required.add(field.key);
          }
        }
      }

      perOracle.set(oracle, { required, all });
    }

    for (const left of oracles) {
      for (const right of oracles) {
        if (left === right) {
          continue;
        }

        const leftSide = perOracle.get(left);
        const rightSide = perOracle.get(right);

        if (leftSide === undefined || rightSide === undefined) {
          continue;
        }

        for (const key of [...leftSide.all].sort()) {
          if (rightSide.all.has(key)) {
            continue;
          }

          const required = leftSide.required.has(key);
          const divergence: KeyDivergence = {
            schemaId,
            key,
            presentIn: left,
            presentAs: required ? "required" : "optional",
            absentFrom: right,
            severity: required ? "breaking" : "compatible",
          };

          if (!required) {
            compatible.push(divergence);
            continue;
          }

          const token = exceptionKey(schemaId, key, left, right);

          if (declared.has(token)) {
            usedExceptions.add(token);
            declaredAccepted.push(divergence);
            continue;
          }

          breaking.push(divergence);
        }
      }
    }
  }

  const staleExceptions = exceptions.filter(
    (item) => !usedExceptions.has(exceptionKey(item.schema, item.key, item.presentIn, item.absentFrom)),
  );

  return {
    comparedSchemas,
    singleOracleSchemas,
    breaking,
    compatible,
    declaredAccepted,
    staleExceptions,
    bindings,
  };
}

export function renderReport(report: AuditReport, minSchemas: number): string {
  const lines: string[] = [];

  lines.push("# Schema key-set parity across oracles");
  lines.push("");
  lines.push(`Compared schemas : ${report.comparedSchemas.length} (floor ${minSchemas})`);
  lines.push(`Single-oracle    : ${report.singleOracleSchemas.length} (not compared)`);
  lines.push(`Breaking         : ${report.breaking.length}`);
  lines.push(`Compatible       : ${report.compatible.length}`);
  lines.push(`Declared         : ${report.declaredAccepted.length}`);
  lines.push(`Stale exceptions : ${report.staleExceptions.length}`);
  lines.push("");

  lines.push("## Compared (bound to a type shape in >= 2 oracles)");

  for (const schemaId of report.comparedSchemas) {
    const sites = report.bindings
      .filter((item) => item.schemaId === schemaId)
      .map((item) => `${item.oracle}:${item.fields.length}`)
      .sort();
    lines.push(`  ${schemaId}  [${[...new Set(sites)].join(" ")}]`);
  }

  if (report.breaking.length > 0) {
    lines.push("");
    lines.push("## BREAKING — required in one oracle, absent from another");

    for (const item of report.breaking) {
      lines.push(
        `  ${item.schemaId}: key '${item.key}' is REQUIRED in ${item.presentIn} and ABSENT from ${item.absentFrom}`,
      );
    }

    lines.push("");
    lines.push("  Resolve by adding the field to the other oracle, making it optional,");
    lines.push("  bumping the schema version, or declaring it in");
    lines.push("  src/Core.TypeScript/hygiene/audit-schema-key-set-parity.exceptions.json");
  }

  if (report.compatible.length > 0) {
    lines.push("");
    lines.push("## Compatible — optional in one oracle, absent from another");

    for (const item of report.compatible) {
      lines.push(`  ${item.schemaId}: key '${item.key}' optional in ${item.presentIn}, absent from ${item.absentFrom}`);
    }
  }

  if (report.declaredAccepted.length > 0) {
    lines.push("");
    lines.push("## Declared exceptions (accepted)");

    for (const item of report.declaredAccepted) {
      lines.push(`  ${item.schemaId}: '${item.key}' ${item.presentIn} -> not in ${item.absentFrom}`);
    }
  }

  if (report.staleExceptions.length > 0) {
    lines.push("");
    lines.push("## STALE exceptions — declared, but no longer a live divergence");

    for (const item of report.staleExceptions) {
      lines.push(`  ${item.schema}: '${item.key}' ${item.presentIn} -> ${item.absentFrom} (${item.workitem})`);
    }

    lines.push("");
    lines.push("  Remove these rows. A muted exception that no longer describes reality");
    lines.push("  is how an exceptions file turns into a blanket mute.");
  }

  return lines.join("\n");
}

export function loadExceptions(path: string): readonly DeclaredException[] {
  if (!existsSync(path)) {
    return [];
  }

  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));

  if (parsed === null || typeof parsed !== "object" || !Array.isArray((parsed as { divergences?: unknown }).divergences)) {
    throw new Error(`${path}: expected an object with a 'divergences' array`);
  }

  return (parsed as { divergences: readonly DeclaredException[] }).divergences;
}

export function runAudit(root: string, minSchemas: number): { readonly report: AuditReport; readonly exitCode: 0 | 2 | 3 } {
  const files = collectSourceFiles(root, ["src"]);
  const bindings: SchemaBinding[] = [];

  // Pass 1 — the cross-file F# constant table. `HeatReadout.TemperatureSchema`
  // is referenced from files that do not declare it, so a per-file table alone
  // would silently under-resolve (and an under-resolving check is the no-op the
  // scan floor exists to catch).
  const globalConsts = new Map<string, Set<string>>();

  for (const file of files.filter((item) => item.endsWith(".fs"))) {
    for (const [name, value] of fsharpConstants(readFileSync(file, "utf8"))) {
      if (!SCHEMA_ID.test(value)) {
        continue;
      }

      const seen = globalConsts.get(name) ?? new Set<string>();
      seen.add(value);
      globalConsts.set(name, seen);
    }
  }

  // Pass 2 — bindings.
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const rel = relative(root, file);

    if (file.endsWith(".fs")) {
      bindings.push(...extractFSharp(text, rel, globalConsts));
    } else {
      bindings.push(...extractTypeScript(text, rel));
    }
  }

  const exceptions = loadExceptions(
    join(root, "src/Core.TypeScript/hygiene/audit-schema-key-set-parity.exceptions.json"),
  );
  const report = compare(bindings, exceptions);

  if (report.comparedSchemas.length < minSchemas) {
    return { report, exitCode: 3 };
  }

  if (report.breaking.length > 0 || report.staleExceptions.length > 0) {
    return { report, exitCode: 2 };
  }

  return { report, exitCode: 0 };
}

function main(argv: readonly string[]): number {
  let minSchemas = DEFAULT_MIN_SCHEMAS;
  let json = false;
  let root = process.cwd();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--json") {
      json = true;
    } else if (arg === "--min-schemas") {
      const value = Number.parseInt(argv[i + 1] ?? "", 10);

      if (!Number.isInteger(value) || value < 0) {
        process.stderr.write("--min-schemas requires a non-negative integer\n");
        return 1;
      }

      minSchemas = value;
      i += 1;
    } else if (arg === "--root") {
      root = resolve(argv[i + 1] ?? "");
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "usage: audit-schema-key-set-parity.ts [--json] [--min-schemas N] [--root DIR]\n",
      );
      return 0;
    } else {
      process.stderr.write(`unknown argument: ${arg}\n`);
      return 1;
    }
  }

  const { report, exitCode } = runAudit(root, minSchemas);

  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderReport(report, minSchemas)}\n`);
  }

  if (exitCode === 3) {
    process.stderr.write(
      `\nSCAN FLOOR BREACH: compared ${report.comparedSchemas.length} schemas, floor is ${minSchemas}.\n` +
        "A check that inspected nothing is not a check that passed.\n",
    );
  }

  return exitCode;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
