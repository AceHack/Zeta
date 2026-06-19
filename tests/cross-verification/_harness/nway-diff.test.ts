// nway-diff.test.ts — divergence self-test for the shared N-way oracle harness.
//
// WHY THIS EXISTS
// ---------------
// A passing cross-verification ("all oracles agree") is only meaningful if the
// harness would ACTUALLY FAIL when an oracle diverges. A green that cannot turn
// red is a Sybil green. This self-test proves the harness BITES: it copies a real
// primitive's oracle outputs to a temp dir, injects a single-byte mutation into
// ONE oracle, runs the harness, and asserts that it (a) exits non-zero and
// (b) names the mutated oracle as the dissenter. This is the Bonsai-bug class
// (one port silently wrong) that per-oracle unit tests structurally cannot catch,
// because each oracle only ever checks itself.
//
// Run: `bun test tests/cross-verification/_harness/nway-diff.test.ts`
// (or `bun nway-diff.test.ts` from this dir).

import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runNWayDiff } from "./nway-diff.ts";

const HARNESS_DIR = import.meta.dir;
const SPLITMIX_DIR = join(HARNESS_DIR, "..", "splitmix64");

/** Copy a primitive fixture dir into a throwaway temp dir we can safely mutate. */
function stageFixture(): string {
  const tmp = mkdtempSync(join(tmpdir(), "nway-diff-selftest-"));
  cpSync(SPLITMIX_DIR, tmp, { recursive: true });
  return tmp;
}

/** Capture console.error lines while running fn, so we can assert on the report. */
async function captureErr<T>(fn: () => T | Promise<T>): Promise<{ result: T; err: string }> {
  const orig = console.error;
  const buf: string[] = [];
  console.error = (...args: unknown[]) => {
    buf.push(args.map(String).join(" "));
  };
  try {
    const result = await fn();
    return { result, err: buf.join("\n") };
  } finally {
    console.error = orig;
  }
}

test("control: the unmutated splitmix64 fixture passes (exit 0)", () => {
  const dir = stageFixture();
  try {
    const code = runNWayDiff({ dir, verbose: false });
    expect(code).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a one-byte mutation in ONE oracle is caught, exits non-zero, names the culprit", async () => {
  const dir = stageFixture();
  try {
    // Mutate the Go oracle: flip one digit of one vector value. A single-byte
    // change to a single oracle — exactly the silent-desync failure mode.
    const goPath = join(dir, "go-output.json");
    const go = JSON.parse(readFileSync(goPath, "utf8")) as Record<string, string>;
    const firstValueKey = Object.keys(go).find((k) => k !== "_source");
    if (firstValueKey === undefined) {
      throw new Error("go-output.json has no vector keys to mutate");
    }
    const original = go[firstValueKey];
    if (original === undefined) {
      throw new Error(`go-output.json vector ${firstValueKey} is undefined`);
    }
    if (original.length === 0) {
      throw new Error(`go-output.json vector ${firstValueKey} is empty`);
    }
    // Change exactly one character (last digit), keeping the same shape/length.
    const lastChar = original[original.length - 1] ?? "";
    const flipped = lastChar === "0" ? "1" : "0";
    go[firstValueKey] = original.slice(0, -1) + flipped;
    expect(go[firstValueKey]).not.toBe(original);
    writeFileSync(goPath, JSON.stringify(go, null, 2));

    const { result: code, err } = await captureErr(() => runNWayDiff({ dir, verbose: false }));

    // (a) It must FAIL loudly.
    expect(code).toBe(1);
    // (b) The report must name Go as the dissenter on the mutated vector.
    expect(err).toContain("divergence");
    expect(err).toContain(firstValueKey);
    expect(err).toContain("Go");
    expect(err).toContain("DIVERGES");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a deleted vector key in one oracle is caught as MISSING", async () => {
  const dir = stageFixture();
  try {
    const pyPath = join(dir, "python-output.json");
    const py = JSON.parse(readFileSync(pyPath, "utf8")) as Record<string, string>;
    const dropKey = Object.keys(py).find((k) => k !== "_source");
    if (dropKey === undefined) {
      throw new Error("python-output.json has no vector keys to delete");
    }
    const pyWithoutDrop = Object.fromEntries(Object.entries(py).filter(([key]) => key !== dropKey));
    writeFileSync(pyPath, JSON.stringify(pyWithoutDrop, null, 2));

    const { result: code, err } = await captureErr(() => runNWayDiff({ dir, verbose: false }));

    expect(code).toBe(1);
    expect(err).toContain(dropKey);
    expect(err).toContain("Python");
    expect(err).toContain("MISSING");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
