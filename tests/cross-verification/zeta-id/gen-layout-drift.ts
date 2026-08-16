// gen-layout-drift.ts — the six generated bit-layout files must agree with
// `docs/zeta-id-v1-layout.yaml`, the source of truth they were generated from.
//
// WHY THIS EXISTS. `tests/cross-verification/zeta-id/README.md` recorded the hole:
//
//   > `docs/zeta-id-v1-layout.yaml` — the source of truth; `zeta-id-generator.ts`
//   > regenerates six `.gen` files from it. **There is no CI gate verifying the
//   > `.gen` files match the YAML**, so an edit without regeneration fails nowhere
//   > until a codec stops compiling.
//
// The cross-verify oracles do not close it. `compare.ts` pins each oracle's
// COMMITTED output JSON to `vectors.yaml`, and CI re-executes five of the seven
// oracles (TS via `bun test`, F#/C# via `dotnet test`, Python via `pytest`, MUMPS via
// `run-mumps.ts`). Go and Rust are NOT re-executed anywhere in CI — `gate.yml` runs
// only `go test ./algebra/` and `cargo test --manifest-path src/Core.Rust.Observe/…`.
// So `zeta_id.gen.go` and `bit_layout.gen.rs` could carry a wrong constant while
// their stale committed outputs still matched `vectors.yaml` and every job stayed
// green. This check is the independent reproduction for exactly that gap.
//
// WHY CONSTANTS AND NOT A BYTE DIFF OF THE REGENERATED FILE. Running the generator
// in CI would need prettier + gofmt + cargo fmt + ruff on the runner, and a
// formatter version bump would then fail this check for a reason that is not drift.
// (Measured 2026-08-15: regenerating without `src/Core.Python/.venv/bin/ruff`
// present changes `NewType("Bits", int)` to `NewType('Bits', int)` and nothing
// else.) The load-bearing content is the offset/width pairs, so those are what is
// compared — formatter-immune, and it still fails on any wrong number.
//
// ANTI-VACUITY. A regex that matches nothing produces an empty set, and an empty
// set agrees with everything. Every language must therefore yield EXACTLY
// 2 × (number of fields in the YAML) constants; a short or empty parse is a hard
// failure that says the check DID NOT RUN, never a pass. Same discipline as
// `run-bytelock-ci.mjs`'s liveness floor and `run-checked.ts`'s exit 2.
//
//   bun tests/cross-verification/zeta-id/gen-layout-drift.ts

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

/** One named field of the 128-bit layout, as declared in the YAML. */
export type LayoutField = { name: string; offset: number; width: number };

/** A generated constant, keyed by its normalised name (`versionoffset`, `versionwidth`, …). */
export type ConstantMap = Map<string, number>;

/**
 * Normalise an identifier across six naming conventions to one key.
 * `VERSION_OFFSET`, `VersionOffset` and `version` + `offset` all become `versionoffset`.
 */
export function normaliseKey(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

/**
 * A capture group that the regex guarantees is present.
 *
 * `noUncheckedIndexedAccess` types every group as possibly-undefined, and the honest
 * response to a group that genuinely cannot be absent is to say so loudly rather than
 * to silence it with `!` — if the regex is ever edited into a shape where the group
 * really can be missing, this throws instead of quietly reading `undefined`.
 */
function group(m: RegExpExecArray | RegExpMatchArray, n: number): string {
  const v = m[n];
  if (v === undefined) throw new Error(`regex matched but capture group ${n} is absent in: ${m[0]}`);
  return v;
}

/**
 * Read the `fields:` list out of `docs/zeta-id-v1-layout.yaml`.
 *
 * Deliberately a small hand parser over the same shape the generator itself reads,
 * and it stops at `reserved_bits:` exactly as the generator does — reserved bits are
 * not named fields and no generated constant covers them.
 */
export function parseLayoutFields(yamlText: string): LayoutField[] {
  const fields: LayoutField[] = [];
  let current: Partial<LayoutField> | null = null;
  let inFields = false;

  for (const rawLine of yamlText.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("fields:")) {
      inFields = true;
      continue;
    }
    if (line.startsWith("reserved_bits:")) break;
    if (!inFields) continue;

    const nameMatch = /^-\s*name:\s*(\S+)/.exec(line);
    if (nameMatch !== null) {
      if (current?.name !== undefined && current.offset !== undefined && current.width !== undefined) {
        fields.push(current as LayoutField);
      }
      current = { name: group(nameMatch, 1) };
      continue;
    }
    if (current === null) continue;

    const offsetMatch = /^offset:\s*(\d+)\s*$/.exec(line);
    if (offsetMatch !== null) {
      current.offset = Number(group(offsetMatch, 1));
      continue;
    }
    const widthMatch = /^width:\s*(\d+)\s*$/.exec(line);
    if (widthMatch !== null) {
      current.width = Number(group(widthMatch, 1));
    }
  }
  if (current?.name !== undefined && current.offset !== undefined && current.width !== undefined) {
    fields.push(current as LayoutField);
  }
  return fields;
}

/** The six generated lanes, each with the path it lives at and how its constants are spelled. */
export type Lane = {
  language: string;
  /** Path relative to the repository root. */
  path: string;
  /** Extract every `<field><offset|width>` constant the file declares. */
  extract: (text: string) => ConstantMap;
};

/** `<name> = <number>` in one capture pair: group 1 is the identifier, group 2 the value. */
function collect(text: string, re: RegExp): ConstantMap {
  const out: ConstantMap = new Map();
  for (const m of text.matchAll(re)) {
    out.set(normaliseKey(group(m, 1)), Number(group(m, 2)));
  }
  return out;
}

export const LANES: readonly Lane[] = [
  {
    language: "TypeScript",
    path: "src/Core.TypeScript/zeta-id/zeta-id.gen.ts",
    // version: { offset: makeBits(123n), width: makeBits(5n) },
    extract: (text) => {
      const out: ConstantMap = new Map();
      const re = /(\w+):\s*\{\s*offset:\s*makeBits\((\d+)n\),\s*width:\s*makeBits\((\d+)n\)\s*\}/g;
      for (const m of text.matchAll(re)) {
        out.set(normaliseKey(`${group(m, 1)}offset`), Number(group(m, 2)));
        out.set(normaliseKey(`${group(m, 1)}width`), Number(group(m, 3)));
      }
      return out;
    },
  },
  {
    language: "F#",
    path: "src/Core.FSharp.ZetaId/GeneratedBitLayout.fs",
    // let VersionOffset = 123<bit>
    extract: (text) => collect(text, /let\s+(\w+)\s*=\s*(\d+)<bit>/g),
  },
  {
    language: "C#",
    path: "src/Core.CSharp.ZetaId/GeneratedBitLayout.cs",
    // public static readonly Bits VersionOffset = new Bits(123);
    extract: (text) => collect(text, /Bits\s+(\w+)\s*=\s*new Bits\((\d+)\)/g),
  },
  {
    language: "Rust",
    path: "src/Core.Rust.ZetaId/src/bit_layout.gen.rs",
    // pub const VERSION_OFFSET: Bits = Bits(123);
    extract: (text) => collect(text, /pub const\s+(\w+)\s*:\s*Bits\s*=\s*Bits\((\d+)\)/g),
  },
  {
    language: "Go",
    path: "src/Core.Go/zeta_id/zeta_id.gen.go",
    // VersionOffset    Bits = 123
    extract: (text) => collect(text, /^\s*(\w+)\s+Bits\s*=\s*(\d+)\s*$/gm),
  },
  {
    language: "Python",
    path: "src/Core.Python/src/zeta/zeta_id_gen.py",
    // VERSION_OFFSET = Bits(123)
    extract: (text) => collect(text, /^\s*(\w+)\s*=\s*Bits\((\d+)\)\s*$/gm),
  },
] as const;

export const LAYOUT_YAML_PATH = "docs/zeta-id-v1-layout.yaml";

export type DriftFinding = { language: string; detail: string };

/**
 * Compare every generated lane against the YAML. Returns the findings; empty means agreed.
 *
 * A missing file, an unparseable file, and a wrong constant are all findings — the first
 * two say the check could not run for that lane, which must never read as agreement.
 */
export function checkLayoutDrift(repoRoot: string): { fields: LayoutField[]; findings: DriftFinding[] } {
  const findings: DriftFinding[] = [];
  const yamlPath = join(repoRoot, LAYOUT_YAML_PATH);
  if (!existsSync(yamlPath)) {
    return { fields: [], findings: [{ language: "(layout)", detail: `${LAYOUT_YAML_PATH} is missing — the source of truth is absent, so nothing can be checked` }] };
  }
  const fields = parseLayoutFields(readFileSync(yamlPath, "utf-8"));
  if (fields.length === 0) {
    return { fields, findings: [{ language: "(layout)", detail: `${LAYOUT_YAML_PATH} yielded 0 fields — a layout with no fields agrees with everything, which is not a check` }] };
  }

  const expected: ConstantMap = new Map();
  for (const f of fields) {
    expected.set(normaliseKey(`${f.name}offset`), f.offset);
    expected.set(normaliseKey(`${f.name}width`), f.width);
  }

  for (const lane of LANES) {
    const p = join(repoRoot, lane.path);
    if (!existsSync(p)) {
      findings.push({ language: lane.language, detail: `${lane.path} is missing — a generated lane that is absent verified nothing` });
      continue;
    }
    const actual = lane.extract(readFileSync(p, "utf-8"));

    // ANTI-VACUITY FLOOR. Two constants per field, no more and no fewer. A parse that
    // came up short means the extractor no longer matches the emitted shape, and an
    // extractor that matches nothing would otherwise agree with every possible file.
    if (actual.size !== expected.size) {
      findings.push({
        language: lane.language,
        detail: `${lane.path} parsed ${actual.size} constants, expected ${expected.size} (2 x ${fields.length} fields) — the check DID NOT RUN for this lane`,
      });
      continue;
    }

    for (const [key, want] of [...expected].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      const got = actual.get(key);
      if (got === undefined) {
        findings.push({ language: lane.language, detail: `${lane.path} declares no constant for '${key}'` });
      } else if (got !== want) {
        findings.push({ language: lane.language, detail: `${lane.path} '${key}' = ${got}, ${LAYOUT_YAML_PATH} says ${want}` });
      }
    }
  }
  return { fields, findings };
}

/** Walk up from `start` until a directory containing `docs/zeta-id-v1-layout.yaml` is found. */
export function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, LAYOUT_YAML_PATH))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`could not locate a repository root containing ${LAYOUT_YAML_PATH} above ${start}`);
}

if (import.meta.main) {
  const root = findRepoRoot(import.meta.dir);
  const { fields, findings } = checkLayoutDrift(root);
  if (findings.length > 0) {
    process.stderr.write(
      `zeta-id generated-layout drift — ${findings.length} finding(s):\n` +
        findings.map((f) => `  [${f.language}] ${f.detail}`).join("\n") +
        `\n\nRegenerate with: bun src/Core.TypeScript/zeta-id/zeta-id-generator.ts\n`,
    );
    process.exit(1);
  }
  process.stdout.write(
    `zeta-id generated-layout: ${LANES.length} lanes x ${fields.length} fields agree with ${LAYOUT_YAML_PATH}.\n`,
  );
}
