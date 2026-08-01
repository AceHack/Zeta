import { describe, test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MUTATIONS,
  isCommentLine,
  selectTarget,
  pickMutation,
  applyMutation,
  pairWithTests,
  runMutant,
} from "./mutation-runner";

function scratch(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "mutrun-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

describe("deterministic selection — no RNG, no clock", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g"];

  test("same (agent, tick) always selects the same item", () => {
    for (let i = 0; i < 50; i++) {
      expect(selectTarget(items, "otto", 7)).toBe(selectTarget(items, "otto", 7));
    }
  });

  test("different ticks move the selection (it is not pinned to one item)", () => {
    const seen = new Set(Array.from({ length: 40 }, (_, t) => selectTarget(items, "otto", t)));
    expect(seen.size).toBeGreaterThan(1);
  });

  test("different agents diverge — the property that removes coordination", () => {
    // Two agents on the same tick must be able to pick different work WITHOUT exchanging a
    // message. If every agent always picked identically, the fleet would do one agent's work N
    // times over and the whole parallelism claim would be false.
    const otto = Array.from({ length: 30 }, (_, t) => selectTarget(items, "otto", t));
    const alexa = Array.from({ length: 30 }, (_, t) => selectTarget(items, "alexa", t));
    expect(otto).not.toEqual(alexa);
  });

  test("empty input selects nothing rather than throwing", () => {
    expect(selectTarget([], "otto", 1)).toBeNull();
  });
});

describe("applyMutation", () => {
  test("changes only the FIRST occurrence — one behavioural change per run", () => {
    const src = "if (a >= b) {} if (c >= d) {}";
    const out = applyMutation(src, { name: "gte-to-gt", find: " >= ", replace: " > " });
    expect(out).toBe("if (a > b) {} if (c >= d) {}");
  });

  test("every catalogue entry actually changes a string that contains it", () => {
    for (const m of MUTATIONS) {
      expect(applyMutation(`x${m.find}y`, m)).not.toBe(`x${m.find}y`);
    }
  });

  test("pickMutation returns null when nothing in the catalogue applies", () => {
    expect(pickMutation("const x = 1;\n", "otto", 0)).toBeNull();
  });
});

describe("pairWithTests", () => {
  test("keeps only sources that have a matching test file", () => {
    const root = scratch({
      "a.ts": "export const a = 1;\n",
      "a.test.ts": "test('a', () => {});\n",
      "b.ts": "export const b = 2;\n", // no b.test.ts
    });
    const pairs = pairWithTests(["a.ts", "b.ts"], root);
    expect(pairs.map((p) => p.source)).toEqual(["a.ts"]);
  });

  test("never mutates test files or type declarations themselves", () => {
    const root = scratch({ "a.test.ts": "x", "a.d.ts": "y", "a.ts": "z", "a.test.test.ts": "w" });
    expect(pairWithTests(["a.test.ts", "a.d.ts"], root)).toHaveLength(0);
  });
});

/**
 * THE LOAD-BEARING PAIR.
 *
 * A mutation runner that reported "killed" unconditionally would look exactly like a healthy
 * codebase — the same could-not-fail shape this tool exists to find, turned on the tool itself.
 * So both directions are proven: a strong suite KILLS, a vacuous suite SURVIVES.
 */
describe("the runner discriminates — both directions proven", () => {
  const SRC = `export function atLeast(a: number, b: number): boolean {\n  return a >= b;\n}\n`;

  test("POSITIVE CONTROL: a real test KILLS the mutant", () => {
    const root = scratch({
      "m.ts": SRC,
      // Pins the boundary a >= b at a === b, which is exactly what `>=` -> `>` breaks.
      "m.test.ts":
        `import { test, expect } from "bun:test";\n` +
        `import { atLeast } from "./m";\n` +
        `test("boundary", () => { expect(atLeast(2, 2)).toBe(true); });\n`,
    });
    const finding = runMutant(root, { source: "m.ts", test: "m.test.ts" },
      { name: "gte-to-gt", find: " >= ", replace: " > " });
    expect(finding.survived).toBe(false);
  });

  test("NEGATIVE CONTROL: a vacuous test lets the mutant SURVIVE", () => {
    const root = scratch({
      "m.ts": SRC,
      // Never exercises the boundary — the exact shape of the real Shiva sweep test that
      // asserted `remaining >= 0` on a count that is non-negative by construction.
      "m.test.ts":
        `import { test, expect } from "bun:test";\n` +
        `import { atLeast } from "./m";\n` +
        `test("vacuous", () => { expect(typeof atLeast(5, 1)).toBe("boolean"); });\n`,
    });
    const finding = runMutant(root, { source: "m.ts", test: "m.test.ts" },
      { name: "gte-to-gt", find: " >= ", replace: " > " });
    expect(finding.survived).toBe(true);
  });
});

describe("the file is ALWAYS restored", () => {
  test("restored after a normal run", () => {
    const root = scratch({
      "m.ts": `export const f = (a: number, b: number) => a >= b;\n`,
      "m.test.ts": `import { test } from "bun:test";\ntest("noop", () => {});\n`,
    });
    const before = readFileSync(join(root, "m.ts"), "utf8");
    runMutant(root, { source: "m.ts", test: "m.test.ts" },
      { name: "gte-to-gt", find: " >= ", replace: " > " });
    expect(readFileSync(join(root, "m.ts"), "utf8")).toBe(before);
  });

  test("restored even when the suite cannot run at all", () => {
    // This writes to a live repo's working tree. If a crash could leave a mutated file on disk,
    // one careless `git add -A` in a trunk-based repo pushes deliberately-broken code.
    const root = scratch({
      "m.ts": `export const f = (a: number, b: number) => a >= b;\n`,
      "m.test.ts": `this is not valid typescript at all (((\n`,
    });
    const before = readFileSync(join(root, "m.ts"), "utf8");
    runMutant(root, { source: "m.ts", test: "m.test.ts" },
      { name: "gte-to-gt", find: " >= ", replace: " > " });
    expect(readFileSync(join(root, "m.ts"), "utf8")).toBe(before);
  });
});

describe("comments are inert — the false-positive class", () => {
  // Regression: validating this runner against real code, the first ` >= ` in
  // ephemeral-task-hierarchy.ts sat on line 8 INSIDE the docstring. Mutating a comment changes
  // nothing, so the suite passed and the runner reported a surviving mutant on a file whose
  // invariants are in fact well covered. False positives are how a drift report becomes noise
  // nobody reads — the same trap as the 183-false-positive regex detector measured and dropped
  // earlier the same day.
  test("recognises comment lines", () => {
    expect(isCommentLine("  // a >= b")).toBe(true);
    expect(isCommentLine("   * a >= b")).toBe(true);
    expect(isCommentLine("  /* a >= b")).toBe(true);
    expect(isCommentLine("  return a >= b;")).toBe(false);
  });

  test("skips a docstring occurrence and mutates the real one below it", () => {
    const src = [
      "/**",
      " * doc: forall p, x >= y holds",
      " */",
      "export const f = (a: number, b: number) => a >= b;",
    ].join("\n");
    const out = applyMutation(src, { name: "gte-to-gt", find: " >= ", replace: " > " });
    expect(out.split("\n")[1]).toContain(" >= ");   // comment untouched
    expect(out.split("\n")[3]).toContain(" > ");    // code mutated
  });

  test("skips an occurrence after a trailing //", () => {
    const src = "const x = 1; // guard when a >= b\nexport const f = (a: number, b: number) => a >= b;\n";
    const out = applyMutation(src, { name: "gte-to-gt", find: " >= ", replace: " > " });
    expect(out.split("\n")[0]).toContain(" >= ");
    expect(out.split("\n")[1]).toContain(" > ");
  });

  test("a comment-only occurrence yields NO applicable mutation (not a false finding)", () => {
    const src = "// only a >= here\nexport const g = 1;\n";
    expect(applyMutation(src, { name: "gte-to-gt", find: " >= ", replace: " > " })).toBe(src);
    expect(pickMutation(src, "otto", 0)).toBeNull();
  });
});
