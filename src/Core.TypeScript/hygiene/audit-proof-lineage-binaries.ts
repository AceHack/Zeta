#!/usr/bin/env bun
// audit-proof-lineage-binaries.ts — the enforcement half of
// `.claude/rules/no-binary-in-proof-lineage.md`.
//
// WHY THIS FILE EXISTS
// --------------------
// The rule says verification artifacts are TEXT. `src/wasm-dla/bytelock/` held six committed
// `.wasm` files from 2026-08-01 to 2026-09-10, in a directory literally named "bytelock",
// which read like a flat violation and was flagged as one (OpenSSF Scorecard
// `BinaryArtifactsID`, surfaced in code scanning via `.github/workflows/scorecard.yml`).
//
// It was not a violation, and the reason is a distinction the rule did not previously draw:
//
//   THE EVIDENCE IS TEXT. THE THING UNDER TEST IS NOT EVIDENCE.
//
// Those `.wasm` files were the SUBJECT of the comparison — nine independently-compiled DLA
// substrates that `run-bytelock-ci.mjs` LOADS AND EXECUTES. The evidence they are judged
// against is `testdata/golden-seed-*.json`: hex-in-JSON, diffable, exactly what the rule
// mandates. Deleting the binaries would have deleted the experiment, not the proof.
//
// THEY ARE NOW BUILT IN CI AND THE SIX ALERTS ARE CLOSED BY DELETION — which is the
// disposition the exception's own condition 3 preferred all along ("where the toolchain also
// exists in CI, prefer BUILDING over COMMITTING"). So this file's job has GAINED a half
// rather than lost one: it still refuses an unearned commit, and it now also refuses an
// unearned DELETION — a substrate that is neither committed nor built-and-required is a
// roster entry nothing holds to account. See check 4.
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
//   4. LOADABLE / BUILT-IN-CI — a roster substrate is either COMMITTED, in which case it
//                   must carry the 8-byte WebAssembly header, or BUILT BY CI, in which case
//                   `bytelock.yml` must run the shared build action AND name the substrate in
//                   a `BYTELOCK_REQUIRED_SUBSTRATES` list so its absence fails the run by
//                   name. See the block at that check for why condition 2 is the load-bearing
//                   one. The header half is the
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
//   6. DWARF      — no COMMITTED substrate may carry DWARF debug sections except a named,
//                   ceilinged exemption. DWARF_EXEMPT is now empty: its one entry was
//                   `dla-canonical-rust.wasm` (472 KB of `.debug_*` around a 1,996-byte code
//                   section), and that artefact is no longer committed. The check is kept
//                   with no entries on purpose — commit a substrate again and any DWARF in it
//                   fails outright, with nothing grandfathered to hide behind.
//
// LIVENESS: the audit refuses to pass while inspecting nothing (empty roster, no goldens),
// and it PRINTS the committed/built split so a reader can see that checks 1/2/4-header/6 had
// no committed subject rather than inferring health from a silent OK.
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
const WORKFLOW = ".github/workflows/bytelock.yml";
const BUILD_ACTION = ".github/actions/build-wasm-substrates";

// The WebAssembly magic (00 61 73 6d) plus the binary-format version (01 00 00 00). Eight
// bytes, not four: a wrong version is equally unloadable, and the `ar` archive that shipped on
// main differed in the first four (21 3c 61 72 = "!<ar").
const WASM_HEADER = Object.freeze([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

// DWARF carried by a COMMITTED substrate, named and ceilinged rather than tolerated.
//
// EMPTY SINCE 2026-09-10, and the emptiness is a result rather than a relaxation. Its one
// entry was `dla-canonical-rust.wasm`: 472,394 of 478,353 bytes (98.8%) were `.debug_*`
// against a 1,996-byte code section, measured 2026-08-16 by walking its section table. The
// note here said "THE FIX IS ONE FLAG: `-C debuginfo=0` … which would land it at ~6 KB",
// and declined to apply it because this branch had no `rustup` to re-derive the committed
// artefact with.
//
// Both halves of that have now been settled by measurement:
//
//   * THE NAMED FLAG IS A NO-OP. On rustc 1.99.0 the module is 624,772 bytes with
//     `-C debuginfo=0` and 624,772 bytes without it — the DWARF is upstream libcore's,
//     already compiled. `-C strip=debuginfo` is the flag that works, landing it at 8,058
//     bytes. A fix asserted and never run is the shape this file exists to catch, and this
//     one sat in its own header for three weeks.
//   * THE ARTEFACT IS NO LONGER COMMITTED. All six substrates are built in CI, so there is
//     nothing to strip in the tree and no ceiling to keep. `build-substrates.mjs` carries
//     the working flag.
//
// The check below is kept with an empty exemption map ON PURPOSE: commit a substrate again
// and any DWARF in it fails outright, with no grandfathered entry to hide behind.
const DWARF_EXEMPT: Readonly<Record<string, { ceiling: number; why: string }>> = Object.freeze({});

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

// ── The CI half, derived from the workflow rather than declared here ──────────
//
// A roster substrate that is NOT committed has to come from somewhere, and "somewhere" is
// `bytelock.yml`. Two facts are read out of that file, both derived so neither can drift
// from what CI actually does:
//
//   * does the byte-lock job run the shared build action at all, and
//   * which substrate NAMES appear in a `BYTELOCK_REQUIRED_SUBSTRATES` list.
//
// The second is the load-bearing one. `run-bytelock-ci.mjs` fails the job when a name on
// that list did not execute, so a substrate that is built-not-committed AND named there
// cannot silently vanish: a broken toolchain becomes a red byte-lock rather than a smaller
// roster. Without it, deleting a binary would convert a hard failure into an absence, which
// is the "check that did not run looking like one that passed" class this whole directory
// is built around.
function readOrEmpty(path: string): string {
  // One syscall, one answer. An `existsSync` gate here is a check-then-use race and the
  // repo's own linter refuses it: the file can be created or removed between the two calls,
  // so the check reads as defensive and prevents nothing.
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw e;
  }
}
const workflowSrc = readOrEmpty(join(root, WORKFLOW));
const ciRunsBuildAction =
  workflowSrc.includes("./.github/actions/build-wasm-substrates") &&
  existsSync(join(root, BUILD_ACTION, "action.yml"));
const ciRequiredNames = new Set<string>(
  [...workflowSrc.matchAll(/required_substrates:\s*"([^"]*)"/g)].flatMap((m) =>
    (m[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ),
);

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

  // ── BUILT-IN-CI, the branch that used to be an outright failure ─────────────
  //
  // Before 2026-09-10 a roster substrate whose file was not committed failed here, because
  // every one of them WAS committed and a missing file could only mean a silent SKIP. Six
  // of them are now built in CI instead, so "not committed" has a second, legitimate
  // reading — and the audit's job is to tell the two apart rather than to forbid one.
  //
  // What separates them is whether the byte-lock would NOTICE the substrate going missing.
  // Both conditions below are read out of `bytelock.yml` itself:
  //
  //   1. the job runs the shared build action, so something actually produces the file, and
  //   2. the substrate's NAME is on a `BYTELOCK_REQUIRED_SUBSTRATES` list, so
  //      `run-bytelock-ci.mjs` fails the run by name if it did not execute.
  //
  // Condition 2 is what keeps the deletion honest. It converts "the file is absent" from an
  // absence nobody sees into a named, red per-route floor — the same guarantee the committed
  // file used to give by simply being there.
  const committed = trackedRel.has(sub.file);
  if (!committed) {
    if (!ciRunsBuildAction) {
      fail(
        `BUILT-IN-CI: roster substrate "${sub.name}" (${sub.file}) is neither committed nor built by CI.`,
        `${WORKFLOW} does not use ${BUILD_ACTION}, so nothing produces this substrate and the ` +
          `byte-lock would report it TOOLING-ABSENT while the roster claims it as coverage. ` +
          `Either commit it under the five conditions in ${RULE}, or build it.`,
      );
    }
    if (!ciRequiredNames.has(sub.name)) {
      fail(
        `BUILT-IN-CI: substrate "${sub.name}" is built rather than committed, but no leg REQUIRES it.`,
        `No BYTELOCK_REQUIRED_SUBSTRATES list in ${WORKFLOW} names "${sub.name}", so a broken ` +
          `toolchain would make it silently absent instead of failing the run. A built substrate ` +
          `earns its roster seat from the per-route floor; without that it is a roster entry ` +
          `nothing holds to account.`,
      );
    }
    continue; // nothing in the tree to check the header or DWARF of
  }

  const abs = join(base, sub.file);
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
  // COMMITTED ONLY. The DWARF budget is a rule about what enters the repository, not about
  // what a build leaves in a working tree — a developer who has just run
  // `build-substrates.mjs` has unstripped artefacts sitting here by design, and failing on
  // those would be an audit arguing with its own build step.
  if (!trackedRel.has(sub.file)) continue;
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
// The committed/built split is printed EXPLICITLY. When every substrate is built rather than
// committed, the SCOPE / LOADED / LOADABLE / DWARF checks have no subject left — they are
// still correct, and they are still the guard that fires the day someone commits one again,
// but a reader must be able to see that they inspected nothing rather than inferring health
// from a silent OK. That is the same distinction the byte-lock's own "Verified 0 of 10"
// refusal exists to draw.
const committedSubstrates = roster.filter((s) => trackedRel.has(s.file)).length;
console.log(
  `proof-lineage binaries: ${roster.length} roster substrate(s) ` +
    `(${committedSubstrates} committed, ${roster.length - committedSubstrates} built in CI), ` +
    `${recipes.length} build recipe(s), ${binariesSeen} committed binary file(s), ` +
    `${goldens.length} golden vector(s) under ${BYTELOCK_DIR}/`,
);

if (findings.length > 0) {
  console.error(`\n${findings.length} finding(s):\n`);
  for (const f of findings) console.error(`  - ${f}\n`);
  console.error(`Rule: ${RULE}`);
  process.exit(1);
}

console.log(`OK — the "artifact under test" exception in ${RULE} holds.`);
