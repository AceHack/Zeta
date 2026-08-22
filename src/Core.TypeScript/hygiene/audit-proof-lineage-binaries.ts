#!/usr/bin/env bun
// audit-proof-lineage-binaries.ts — the enforcement half of
// `.claude/rules/no-binary-in-proof-lineage.md`.
//
// WHY THIS FILE EXISTS
// --------------------
// The rule says verification artifacts are TEXT. `src/wasm-dla/bytelock/` holds six committed
// `.wasm` files, in a directory literally named "bytelock", which reads like a flat violation
// and was flagged as one (OpenSSF Scorecard `BinaryArtifactsID`, surfaced in code scanning via
// `.github/workflows/scorecard.yml`).
//
// It is not a violation, and the reason is a distinction the rule did not previously draw:
//
//   THE EVIDENCE IS TEXT. THE THING UNDER TEST IS NOT EVIDENCE.
//
// Those `.wasm` files are the SUBJECT of the comparison — nine independently-compiled DLA
// substrates that `run-bytelock-ci.mjs` LOADS AND EXECUTES. The evidence they are judged
// against is `testdata/golden-seed-*.json`: hex-in-JSON, diffable, exactly what the rule
// mandates. Deleting the binaries would delete the experiment, not the proof.
//
// But "documented exception" with no scope is the vacuity class this repo cares most about
// avoiding — it is a licence, not a boundary. So the exception is machine-checked here, and it
// is DERIVED rather than hand-listed: the allowed set comes from the byte-lock runner's own
// roster and the build script's own declared outputs. Add a binary to that directory without
// wiring it into both, and this audit goes red.
//
// WHAT IT CHECKS
// --------------
//   1. SCOPE      — every tracked binary under src/wasm-dla/bytelock/ is a declared build
//                   output or a runner-roster substrate. A stray build intermediate fails.
//   2. LOADED     — every committed .wasm there appears in the runner's roster. A binary
//                   nothing executes is not "under test"; it is just a binary.
//   3. BUILDABLE  — every roster substrate has a build recipe in build-substrates.mjs whose
//                   input source file exists and is itself text. The exception rests on the
//                   binary being REPRODUCIBLE; if it cannot be re-derived, it is trusted, and
//                   trusted bytes in a proof lineage are what the rule forbids.
//   4. LOADABLE   — every roster .wasm carries the 8-byte WebAssembly header. This is the
//                   PRE-MERGE twin of the runner's own exit-3 guard: `dla-canonical-zig.wasm`
//                   sat on main as an `ar` archive for two weeks, and the only check that
//                   would have caught it runs post-merge in `bytelock.yml`. This one runs in
//                   `cross-verify`, on every PR.
//   5. GOLDENS    — the actual proof lineage is text: every testdata/golden-seed-*.json parses,
//                   and every trajectory entry is a 0x-prefixed hex string of the declared
//                   length. AND the runner must actually READ them. Until this audit landed it
//                   did not: `run-bytelock-ci.mjs` recomputed the golden from `reference.mjs`
//                   on every run and never opened the committed files, so the four hex-in-JSON
//                   vectors — the rule's own artifact — were dead weight, and a co-ordinated
//                   edit to reference.mjs plus a rebuild would have moved the locked trajectory
//                   with a green byte-lock and no vector diff to review.
//   6. DWARF      — no substrate may carry DWARF debug sections except the one named,
//                   ceilinged exemption below. `dla-canonical-rust.wasm` is 478 KB of which
//                   472 KB is `.debug_*` (measured, see DWARF_EXEMPT); its actual code section
//                   is 1,996 bytes, in family with the other five. The size gap is a missing
//                   `-C debuginfo=0`, not a different kind of artifact — and the ceiling stops
//                   it being read as licence for the next one.
//
// LIVENESS: the audit refuses to pass while inspecting nothing (empty roster, no goldens).
// "Checked 0 substrates" must never read as success — the same floor the byte-lock runner
// applies to itself.
//
// Usage:  bun src/Core.TypeScript/hygiene/audit-proof-lineage-binaries.ts [--root <dir>]
// Exit 0 = the exception holds. Exit 1 = it does not, with the reason and the rule anchor.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const RULE = ".claude/rules/no-binary-in-proof-lineage.md";
const BYTELOCK_DIR = "src/wasm-dla/bytelock";
const RUNNER = "run-bytelock-ci.mjs";
const BUILDER = "build-substrates.mjs";

// The WebAssembly magic (00 61 73 6d) plus the binary-format version (01 00 00 00). Eight
// bytes, not four: a wrong version is equally unloadable, and the `ar` archive that shipped on
// main differed in the first four (21 3c 61 72 = "!<ar").
const WASM_HEADER = Object.freeze([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

// DWARF carried by a committed substrate, named and ceilinged rather than tolerated.
//
// MEASURED 2026-08-16 by walking the section table of the committed file:
//   .debug_str 265,057 · .debug_info 150,552 · .debug_ranges 46,518 · .debug_line 7,818 ·
//   .debug_abbrev 2,449  = 472,394 of 478,353 bytes (98.8%). Code section: 1,996 bytes.
//   Strings are rustc-remapped (`/rustc/<hash>/…`), so no builder-machine path leaks — but
//   472 KB of upstream libcore DWARF is not reviewable and is not evidence of anything.
//
// THE FIX IS ONE FLAG: `-C debuginfo=0` (or `wasm-opt --strip-debug`) in the Rust recipe in
// build-substrates.mjs, which would land it at ~6 KB. It is NOT applied here because doing so
// rewrites the committed artefact, and this branch has no `rustup`/`wasm32-unknown-unknown` to
// re-derive it with — a rebuilt binary nobody could reproduce is exactly the trust this audit
// exists to refuse. Filed as a follow-up; the ceiling below means it can only shrink.
const DWARF_EXEMPT: Readonly<Record<string, { ceiling: number; why: string }>> = Object.freeze({
  "dla-canonical-rust.wasm": {
    ceiling: 480_000,
    why: "rustc emits DWARF for wasm32 cdylib by default; recipe lacks -C debuginfo=0",
  },
});

const rootArgIdx = process.argv.indexOf("--root");
const root = rootArgIdx >= 0 ? (process.argv[rootArgIdx + 1] ?? ".") : ".";
const base = join(root, BYTELOCK_DIR);

const findings: string[] = [];
function fail(what: string, detail: string): void {
  findings.push(`${what}\n      ${detail}`);
}

// ── Inputs ────────────────────────────────────────────────────────────────────
// Both parsed from the sources that already own the truth. A hand-maintained allowlist here
// would drift from the roster it claims to describe, and a drifted allowlist is a check that
// passes for the wrong reason.

function read(rel: string): string {
  return readFileSync(join(base, rel), "utf8");
}

if (!existsSync(join(base, RUNNER)) || !existsSync(join(base, BUILDER))) {
  console.error(
    `audit-proof-lineage-binaries: ${BYTELOCK_DIR}/${RUNNER} or /${BUILDER} is missing — ` +
      `the audit cannot derive its allowed set and must not report success.\n  Rule: ${RULE}`,
  );
  process.exit(1);
}

const runnerSrc = read(RUNNER);
const builderSrc = read(BUILDER);

/** The substrates the byte-lock runner LOADS: `{ name: "Zig", file: "…-zig.wasm", type: "wasm" }`. */
function parseRoster(src: string): { name: string; file: string }[] {
  const block = src.match(/const WASM_SUBSTRATES\s*=\s*\[([\s\S]*?)\n\];/);
  if (!block) return [];
  const body = block[1] ?? "";
  const out: { name: string; file: string }[] = [];
  const re = /name:\s*"([^"]+)"\s*,\s*file:\s*"([^"]+)"/g;
  for (let m = re.exec(body); m !== null; m = re.exec(body)) {
    const [, name, file] = m;
    if (name && file) out.push({ name, file });
  }
  return out;
}

/** The artefacts `build-substrates.mjs` declares it PRODUCES, and the sources it reads. */
function parseRecipes(src: string): { name: string; output: string | null; inputs: string[] }[] {
  const block = src.match(/const SUBSTRATES\s*=\s*\[([\s\S]*?)\n\];/);
  if (!block) return [];
  const out: { name: string; output: string | null; inputs: string[] }[] = [];
  // Entries are separated by the two-space-indented `{` that opens each object literal.
  for (const chunk of (block[1] ?? "").split(/\n\s{2}\{\n/).slice(1)) {
    const name = chunk.match(/name:\s*"([^"]+)"/)?.[1];
    if (!name) continue;
    const outMatch = chunk.match(/output:\s*(?:"([^"]+)"|null)/);
    const output = outMatch?.[1] ?? null;
    // Every `dla-canonical.*` literal that is not the declared output is an input source.
    const inputs = [...chunk.matchAll(/"(dla-canonical[^"]*)"/g)]
      .flatMap((m) => (m[1] === undefined ? [] : [m[1]]))
      .filter((f) => f !== output && !f.endsWith(".wasm"));
    out.push({ name, output, inputs: [...new Set(inputs)] });
  }
  return out;
}

const roster = parseRoster(runnerSrc);
const recipes = parseRecipes(builderSrc);
const declaredOutputs = new Set(recipes.map((r) => r.output).filter((o): o is string => o !== null));

// ── Tracked files under the byte-lock directory ───────────────────────────────

function trackedFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "--", BYTELOCK_DIR], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return out.split("\n").filter(Boolean);
}

/**
 * Binary by CONTENT, not by extension. An extension list only catches the formats someone
 * already thought of; a NUL byte in the head of the file catches the one they did not.
 */
function isBinary(absPath: string): boolean {
  let head: Buffer;
  try {
    head = readFileSync(absPath).subarray(0, 8000);
  } catch {
    return false;
  }
  return head.includes(0x00);
}

const tracked = trackedFiles();
const trackedRel = new Set(tracked.map((p) => p.slice(`${BYTELOCK_DIR}/`.length)));

// ── 1. SCOPE — every tracked binary is a declared output or a roster substrate ─
const allowed = new Set<string>([...declaredOutputs, ...roster.map((r) => r.file)]);
let binariesSeen = 0;

for (const rel of trackedRel) {
  const abs = join(base, rel);
  if (!existsSync(abs) || !isBinary(abs)) continue;
  binariesSeen++;
  if (!allowed.has(rel)) {
    fail(
      `SCOPE: ${BYTELOCK_DIR}/${rel} is a committed binary that no substrate declares.`,
      `It is neither a declared output of ${BUILDER} nor a substrate in ${RUNNER}'s roster, so ` +
        `nothing builds it and nothing loads it. The "artifact under test" exception in ${RULE} ` +
        `does not reach it — delete it, or wire it into both.`,
    );
  }
}

// ── 2. LOADED — every committed .wasm is in the roster ────────────────────────
const rosterFiles = new Set(roster.map((r) => r.file));
for (const rel of trackedRel) {
  if (!rel.endsWith(".wasm")) continue;
  if (!rosterFiles.has(rel)) {
    fail(
      `LOADED: ${BYTELOCK_DIR}/${rel} is committed but ${RUNNER} never loads it.`,
      `A binary that is not executed is not under test, and only a binary under test earns the ` +
        `exception in ${RULE}. Add it to WASM_SUBSTRATES or remove it.`,
    );
  }
}

// ── 3/4. BUILDABLE + LOADABLE, per roster substrate ───────────────────────────
for (const sub of roster) {
  const recipe = recipes.find((r) => r.output === sub.file);
  if (!recipe) {
    fail(
      `BUILDABLE: roster substrate "${sub.name}" (${sub.file}) has no recipe in ${BUILDER}.`,
      `The exception rests on the binary being reproducible from checked-in source. Without a ` +
        `recipe it is a trusted blob, which is the thing ${RULE} forbids.`,
    );
  } else if (recipe.inputs.length === 0) {
    fail(
      `BUILDABLE: recipe "${recipe.name}" declares no source input.`,
      `Could not identify the checked-in source ${sub.file} is built from; the reproducibility ` +
        `claim is unverifiable as written.`,
    );
  } else {
    for (const input of recipe.inputs) {
      if (!trackedRel.has(input)) {
        fail(
          `BUILDABLE: ${BYTELOCK_DIR}/${input} (source for ${sub.file}) is not tracked.`,
          `The binary cannot be re-derived from the repository, so it is trusted rather than ` +
            `reproducible.`,
        );
      } else if (isBinary(join(base, input))) {
        fail(
          `BUILDABLE: ${BYTELOCK_DIR}/${input} (source for ${sub.file}) is itself binary.`,
          `The source of an exempted artefact must be reviewable text.`,
        );
      }
    }
  }

  const abs = join(base, sub.file);
  if (!existsSync(abs)) {
    fail(
      `LOADABLE: roster substrate "${sub.name}" points at ${sub.file}, which is not committed.`,
      `Every WASM_SUBSTRATES entry is loaded from the tree in CI; a missing file means the ` +
        `substrate silently SKIPs and the roster overstates coverage.`,
    );
    continue;
  }
  const head = readFileSync(abs).subarray(0, WASM_HEADER.length);
  const ok = head.length === WASM_HEADER.length && WASM_HEADER.every((b, i) => head[i] === b);
  if (!ok) {
    const found = [...head].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    fail(
      `LOADABLE: ${BYTELOCK_DIR}/${sub.file} is not a WebAssembly module.`,
      `Expected header ${WASM_HEADER.map((b) => b.toString(16).padStart(2, "0")).join(" ")}, ` +
        `found ${found}. This is the pre-merge twin of the runner's exit-3 guard — an ` +
        `unloadable substrate verifies nothing while sitting in the roster claiming breadth.`,
    );
  }
}

// ── 6. DWARF budget ───────────────────────────────────────────────────────────
/** Sum of `.debug_*` custom-section bytes in a WebAssembly module. */
function dwarfBytes(abs: string): number {
  const b = readFileSync(abs);
  // Reading past the end means the module is truncated, which the caller reports as an
  // un-auditable section table rather than silently treating a missing byte as a zero.
  const at = (i: number): number => {
    const v = b[i];
    if (v === undefined) throw new Error(`truncated module: no byte at offset ${i}`);
    return v;
  };
  let p = 8;
  let total = 0;
  while (p < b.length) {
    const id = at(p++);
    let size = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = at(p++);
      size |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    if (id === 0) {
      let q = p;
      let nameLen = 0;
      let s = 0;
      let c: number;
      do {
        c = at(q++);
        nameLen |= (c & 0x7f) << s;
        s += 7;
      } while (c & 0x80);
      const name = b.subarray(q, q + nameLen).toString("latin1");
      if (name.startsWith(".debug_")) total += size;
    }
    p += size;
  }
  return total;
}

for (const sub of roster) {
  const abs = join(base, sub.file);
  if (!existsSync(abs)) continue;
  let bytes: number;
  try {
    bytes = dwarfBytes(abs);
  } catch (e) {
    fail(
      `DWARF: could not walk the section table of ${BYTELOCK_DIR}/${sub.file}.`,
      `${(e as Error).message} — a module whose sections cannot be enumerated cannot be audited.`,
    );
    continue;
  }
  if (bytes === 0) continue;
  const exempt = DWARF_EXEMPT[sub.file];
  if (!exempt) {
    fail(
      `DWARF: ${BYTELOCK_DIR}/${sub.file} carries ${bytes.toLocaleString()} bytes of .debug_* sections.`,
      `A committed substrate must ship stripped — debug sections are unreviewable bulk that ` +
        `prove nothing about the trajectory. Strip it (e.g. -C debuginfo=0, --strip-debug, ` +
        `wasm-opt --strip-debug) or add a ceilinged entry to DWARF_EXEMPT with the reason.`,
    );
  } else if (bytes > exempt.ceiling) {
    fail(
      `DWARF: ${BYTELOCK_DIR}/${sub.file} carries ${bytes.toLocaleString()} bytes of .debug_*, ` +
        `over its ceiling of ${exempt.ceiling.toLocaleString()}.`,
      `Known exemption (${exempt.why}) — the ceiling exists so it can only shrink. Strip the ` +
        `artefact rather than raising the number.`,
    );
  }
}

// ── 5. GOLDENS — the actual proof lineage, and it must be read ────────────────
const goldens = [...trackedRel].filter((f) => /^testdata\/golden-seed-\d+\.json$/.test(f)).sort();

for (const rel of goldens) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(join(base, rel), "utf8"));
  } catch (e) {
    fail(`GOLDEN: ${BYTELOCK_DIR}/${rel} is not parseable JSON.`, (e as Error).message);
    continue;
  }
  const g = parsed as Record<string, unknown>;
  const traj = g.trajectory;
  if (!Array.isArray(traj)) {
    fail(`GOLDEN: ${BYTELOCK_DIR}/${rel} has no trajectory array.`, `Found ${typeof traj}.`);
    continue;
  }
  const bad = traj.findIndex((v) => typeof v !== "string" || !/^0x[0-9a-f]{8}$/.test(v));
  if (bad >= 0) {
    fail(
      `GOLDEN: ${BYTELOCK_DIR}/${rel} trajectory[${bad}] is not a 0x-prefixed 8-digit hex string.`,
      `Got ${JSON.stringify(traj[bad])}. ${RULE} requires every byte-lock to be hex-in-JSON so ` +
        `the diff is readable.`,
    );
  }
  if (typeof g.n_walkers === "number" && g.n_walkers !== traj.length) {
    fail(
      `GOLDEN: ${BYTELOCK_DIR}/${rel} declares n_walkers=${g.n_walkers} but carries ${traj.length} entries.`,
      `A truncated vector pins less than it claims.`,
    );
  }
  for (const key of ["cluster_size", "max_r_bits"]) {
    if (!Number.isInteger(g[key])) {
      fail(
        `GOLDEN: ${BYTELOCK_DIR}/${rel} field ${key} is not an integer.`,
        `Got ${JSON.stringify(g[key])}.`,
      );
    }
  }
}

// A text golden vector that nothing reads is the vacuity class in its purest form: it looks
// like the rule is satisfied, and it constrains nothing. The runner must open these files.
if (!/golden-seed-/.test(runnerSrc)) {
  fail(
    `GOLDEN: ${RUNNER} never reads testdata/golden-seed-*.json.`,
    `${goldens.length} committed hex-in-JSON vector(s) constrain nothing — the runner would be ` +
      `recomputing its own expectation, so a co-ordinated edit to reference.mjs plus a rebuild ` +
      `moves the locked trajectory with a green byte-lock and no vector diff. ${RULE} exists to ` +
      `make exactly that visible in a git diff.`,
  );
}

// ── Liveness — the audit must not pass while inspecting nothing ───────────────
if (roster.length === 0) {
  fail(
    `LIVENESS: parsed 0 substrates out of ${RUNNER}.`,
    `The allowed set is derived from that roster; an empty roster makes every SCOPE check ` +
      `vacuously true. Refusing to report success.`,
  );
}
if (goldens.length === 0) {
  fail(
    `LIVENESS: found 0 committed golden vectors under ${BYTELOCK_DIR}/testdata/.`,
    `The text half of the proof lineage is absent, so there is nothing for the exception to be ` +
      `an exception TO. Refusing to report success.`,
  );
}

// ── Report ────────────────────────────────────────────────────────────────────
// Coverage is printed unconditionally. "0 checked" must never be mistaken for "0 problems".
console.log(
  `proof-lineage binaries: ${roster.length} roster substrate(s), ${recipes.length} build ` +
    `recipe(s), ${binariesSeen} committed binary file(s), ${goldens.length} golden vector(s) ` +
    `under ${BYTELOCK_DIR}/`,
);

if (findings.length > 0) {
  console.error(`\n${findings.length} finding(s):\n`);
  for (const f of findings) console.error(`  - ${f}\n`);
  console.error(`Rule: ${RULE}`);
  process.exit(1);
}

console.log(`OK — the "artifact under test" exception in ${RULE} holds.`);
