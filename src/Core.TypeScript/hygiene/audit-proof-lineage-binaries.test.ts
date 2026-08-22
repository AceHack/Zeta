// Mutation tests for audit-proof-lineage-binaries.ts.
//
// A rule with no enforcement and an exception with no scope are the same defect — a check that
// structurally cannot fail. So this suite does not assert that the audit passes on `main` (CI
// does that, in the `cross-verify` floor job); it asserts that the audit FAILS, by name, on one
// deliberately broken thing at a time.
//
// Each case builds a minimal synthetic repo in a temp dir and runs the audit against it with
// `--root`, so nothing here depends on the real tree's current contents. Every mutation is
// asserted to have LANDED before its finding is asserted: a `.replace()` that silently no-ops
// is precisely how a mutation test becomes the vacuity it was written to prevent.

import { test, expect, beforeEach, afterEach } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const AUDIT = join(import.meta.dir, "audit-proof-lineage-binaries.ts");
const REL = "src/wasm-dla/bytelock";

/** A minimal but genuinely valid WebAssembly module: magic + binary-format version. */
const WASM_MODULE = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

/** The same module plus a `.debug_str` custom section, for the DWARF-budget case. */
function wasmWithDwarf(): Buffer {
  const name = Buffer.from(".debug_str", "latin1");
  const payload = Buffer.from([1, 2, 3, 4, 5]);
  const body = Buffer.concat([Buffer.from([name.length]), name, payload]);
  return Buffer.concat([WASM_MODULE, Buffer.from([0x00, body.length]), body]);
}

// The runner and builder fixtures mirror the real files' SHAPE, because the audit derives its
// allowed set by parsing them. If the real files are restructured such that these stop
// resembling them, this suite is the thing that should notice.
const RUNNER = `import { readFileSync } from "fs";
// reads testdata/golden-seed-\${seed}.json as the reference pin
const WASM_SUBSTRATES = [
  { name: "WAT", file: "dla-canonical-wat.wasm", type: "wasm" },
];
`;

const BUILDER = `const SUBSTRATES = [
  {
    name: "WAT",
    output: "dla-canonical-wat.wasm",
    build: () => {
      run("wat2wasm", ["dla-canonical.wat", "-o", "dla-canonical-wat.wasm"]);
    },
  },
];
`;

function golden(seed: number): string {
  return JSON.stringify(
    {
      spec_version: "1",
      seed,
      grid_size: 128,
      n_walkers: 3,
      prng: "xorshift32",
      substrate: "reference-js",
      cluster_size: 2,
      max_r_bits: 1_065_353_216,
      trajectory: ["0x00400040", "0x00410041", "0xffffffff"],
    },
    null,
    2,
  );
}

let root: string;
let dir: string;

function git(...args: string[]): void {
  execFileSync("git", args, { cwd: root, stdio: "pipe" });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "proof-lineage-audit-"));
  dir = join(root, REL);
  mkdirSync(join(dir, "testdata"), { recursive: true });
  writeFileSync(join(dir, "run-bytelock-ci.mjs"), RUNNER);
  writeFileSync(join(dir, "build-substrates.mjs"), BUILDER);
  writeFileSync(join(dir, "dla-canonical.wat"), "(module) ;; source, text\n");
  writeFileSync(join(dir, "dla-canonical-wat.wasm"), WASM_MODULE);
  writeFileSync(join(dir, "testdata", "golden-seed-42.json"), golden(42));
  git("init", "-q");
  git("add", "-Af");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Run the audit against the synthetic repo. Returns exit status and combined output. */
function audit(): { exit: number; out: string } {
  try {
    const out = execFileSync("bun", [AUDIT, "--root", root], { encoding: "utf8", stdio: "pipe" });
    return { exit: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { exit: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

/** Edit a fixture file, asserting the edit actually landed, then re-stage it. */
function mutate(rel: string, from: string, to: string): void {
  const path = join(dir, rel);
  const src = readFileSync(path, "utf8");
  const next = src.replace(from, to);
  expect(next).not.toBe(src); // the mutation must land, or the test proves nothing
  writeFileSync(path, next);
  git("add", "-Af");
}

test("baseline: a well-formed byte-lock directory passes", () => {
  const { exit, out } = audit();
  expect(out).toContain("1 roster substrate(s)");
  expect(exit).toBe(0);
});

test("SCOPE: a stray build intermediate nothing declares is caught", () => {
  // A rustc codegen-unit intermediate is exactly what was committed by accident on main.
  writeFileSync(join(dir, "dla_canonical_rust.cgu.0.rcgu.o"), Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x00]));
  git("add", "-Af");
  const { exit, out } = audit();
  expect(exit).toBe(1);
  expect(out).toContain("SCOPE:");
  expect(out).toContain("rcgu.o");
});

test("SCOPE: binary-ness is decided by content, not by a known extension list", () => {
  writeFileSync(join(dir, "notes.txt"), Buffer.from([0x68, 0x69, 0x00, 0x68, 0x69]));
  git("add", "-Af");
  const { exit, out } = audit();
  expect(exit).toBe(1);
  expect(out).toContain("notes.txt");
});

test("SCOPE: a text file is not mistaken for a binary", () => {
  writeFileSync(join(dir, "NOTES.md"), "# just prose\n");
  git("add", "-Af");
  expect(audit().exit).toBe(0);
});

test("LOADED: a committed .wasm that the runner never loads is caught", () => {
  writeFileSync(join(dir, "dla-canonical-orphan.wasm"), WASM_MODULE);
  git("add", "-Af");
  const { exit, out } = audit();
  expect(exit).toBe(1);
  expect(out).toContain("LOADED:");
  expect(out).toContain("dla-canonical-orphan.wasm");
});

test("LOADABLE: the `ar` archive that shipped on main for two weeks is caught", () => {
  writeFileSync(join(dir, "dla-canonical-wat.wasm"), Buffer.from("!<arch>\n", "ascii"));
  git("add", "-Af");
  const { exit, out } = audit();
  expect(exit).toBe(1);
  expect(out).toContain("LOADABLE:");
  expect(out).toContain("21 3c 61 72"); // the exact bytes that were on main
});

test("LOADABLE: a roster entry with no committed file is caught", () => {
  rmSync(join(dir, "dla-canonical-wat.wasm"));
  git("add", "-Af");
  const { exit, out } = audit();
  expect(exit).toBe(1);
  expect(out).toContain("LOADABLE:");
});

test("BUILDABLE: a substrate with no build recipe is caught", () => {
  mutate("build-substrates.mjs", 'output: "dla-canonical-wat.wasm",', 'output: "something-else.wasm",');
  const { exit, out } = audit();
  expect(exit).toBe(1);
  expect(out).toContain("BUILDABLE:");
});

test("BUILDABLE: a recipe whose source file is untracked is caught", () => {
  git("rm", "-q", "--cached", `${REL}/dla-canonical.wat`);
  const { exit, out } = audit();
  expect(exit).toBe(1);
  expect(out).toContain("BUILDABLE:");
  expect(out).toContain("dla-canonical.wat");
});

test("GOLDEN: a runner that never reads the committed vectors is caught", () => {
  // The exact hole this audit was written for: four hex-in-JSON vectors, zero consumers.
  mutate("run-bytelock-ci.mjs", "// reads testdata/golden-seed-${seed}.json as the reference pin\n", "");
  const { exit, out } = audit();
  expect(exit).toBe(1);
  expect(out).toContain("never reads testdata/golden-seed-*.json");
});

test("GOLDEN: a trajectory entry that is not hex-in-JSON is caught", () => {
  mutate("testdata/golden-seed-42.json", '"0x00410041"', "1074003");
  const { exit, out } = audit();
  expect(exit).toBe(1);
  expect(out).toContain("trajectory[1] is not a 0x-prefixed");
});

test("GOLDEN: a vector shorter than the n_walkers it declares is caught", () => {
  mutate("testdata/golden-seed-42.json", '"n_walkers": 3', '"n_walkers": 800');
  const { exit, out } = audit();
  expect(exit).toBe(1);
  expect(out).toContain("declares n_walkers=800");
});

test("DWARF: an unstripped substrate is caught, and named with its byte count", () => {
  writeFileSync(join(dir, "dla-canonical-wat.wasm"), wasmWithDwarf());
  git("add", "-Af");
  const { exit, out } = audit();
  expect(exit).toBe(1);
  expect(out).toContain("DWARF:");
  expect(out).toContain(".debug_*");
});

test("LIVENESS: an empty roster does not pass by inspecting nothing", () => {
  mutate("run-bytelock-ci.mjs", '  { name: "WAT", file: "dla-canonical-wat.wasm", type: "wasm" },\n', "");
  const { exit, out } = audit();
  expect(exit).toBe(1);
  expect(out).toContain("LIVENESS:");
  expect(out).toContain("parsed 0 substrates");
});

test("LIVENESS: no committed golden vectors does not pass by inspecting nothing", () => {
  git("rm", "-q", "-f", `${REL}/testdata/golden-seed-42.json`);
  const { exit, out } = audit();
  expect(exit).toBe(1);
  expect(out).toContain("LIVENESS:");
  expect(out).toContain("0 committed golden vectors");
});

test("a missing runner or builder fails rather than reporting an empty success", () => {
  git("rm", "-q", "-f", `${REL}/run-bytelock-ci.mjs`); // -f removes the working file too
  const { exit, out } = audit();
  expect(exit).toBe(1);
  expect(out).toContain("cannot derive its allowed set");
});
