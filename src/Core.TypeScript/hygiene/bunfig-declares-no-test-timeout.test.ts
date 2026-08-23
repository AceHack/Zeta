import { test, expect, describe } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// WHY THIS EXISTS. `bunfig.toml` carried `[test] timeout = 20000` for months. bun 1.3.14
// does not implement that key, and does not warn about unknown bunfig keys, so the line
// read as authoritative and did nothing -- the real per-test cap stayed at the built-in
// 5000 ms. MEASURED 2026-08-14 in an isolated directory containing only that bunfig and one
// test sleeping 7s:
//
//     x sleeps 7s -- should pass if timeout=20000 is honoured [5000.74ms]
//       ^ this test timed out after 5000ms.
//
// The cost was not the slow test; it was the CONFIGURATION LIE. #10508 set a 10s solver
// budget trusting that 20000, the budget sat above the real cap, and the resulting CI
// timeouts masked a genuine solver-version finding until someone traced the cause.
//
// This guard is cheap (one file read, no I/O over the tree) and it fails the moment the key
// comes back. It deliberately does NOT assert that a 5s timeout fires -- proving that would
// cost 5 seconds of CI on every run to re-learn something already written down here.
// Work-item 081KZZ3JHP1087G0R00027ARRR.

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

// EVERY bunfig, not just the default one. The tier split (2026-08-16) added
// `bunfig.hermetic.toml`, and a second config file is a second place for the same lie to
// reappear -- a guard scoped to one filename would go quietly vacuous the moment the lane
// people actually gate on stops being the file it reads. Adding a bunfig without adding it
// here is caught by the manifest test below.
const CONFIGS = ["bunfig.toml", "bunfig.hermetic.toml", "bunfig.hardware-lane.toml"] as const;

test("the guard covers every bunfig in the repo root", () => {
  const present = readdirSync(REPO_ROOT).filter((f) => /^bunfig(\..+)?\.toml$/.test(f)).sort();
  expect(present).toEqual([...CONFIGS].sort());
});

for (const config of CONFIGS) describe(config + " does not declare a test timeout bun will ignore", () => {
  const text = readFileSync(join(REPO_ROOT, config), "utf8");

  test("the file is the one we think it is -- a vacuous pass is not a pass", () => {
    expect(text).toContain("[test]");
    expect(text).toContain("pathIgnorePatterns");
  });

  test("no uncommented `timeout =` key under [test]", () => {
    const offenders = text
      .split("\n")
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => !line.startsWith("#"))
      .filter(({ line }) => /^timeout\s*=/.test(line));

    // If this fails: bun still ignores the key. Set the timeout at the call site instead --
    // test("name", fn, 30_000) -- or pass `bun test --timeout <ms>` for a whole run.
    expect(offenders).toEqual([]);
  });
});
