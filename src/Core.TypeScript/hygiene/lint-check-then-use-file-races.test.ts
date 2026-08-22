// src/Core.TypeScript/hygiene/lint-check-then-use-file-races.test.ts
//
// FALSIFIERS FOR THE LINT.
//
// The organising problem, stated plainly because it decides the shape of this
// file: a linter that passes on a tree containing the defect is worthless, and
// "it found nothing" is exactly what a broken linter and a clean tree look
// like from the outside. So the load-bearing assertions here are the POSITIVE
// ones -- a fixture carrying each shape, and the lint refusing it. A test that
// only asserts the real tree is quiet would be the vacuity class wearing a
// green tick.
//
// The last two describes run the REAL CLI over a REAL directory on disk: one
// holding a fixture with the defect (must exit 1) and one holding only the
// corrected forms (must exit 0). That pair is the end-to-end proof that the
// binary, not just the pure function, can fail.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  analyzeSource,
  auditFiles,
  baselineKey,
  enclosingBlockEnd,
  enclosingBlockStart,
  findCalls,
  firstArgument,
  isExistenceGate,
  listingScopeEnd,
  main,
  maskNonCode,
  suppressions,
  type Finding,
} from "./lint-check-then-use-file-races.ts";

const rules = (fs: readonly Finding[]): string[] => fs.map((f) => f.rule);

// ═══════════════════════════════════════════════════════════════════════════
// THE THREE OBSERVED INSTANCES, REBUILT AS FIXTURES
//
// Reconstructed from the shapes recorded in the lint's header, not copied from
// the fixed files -- the fixed files no longer contain the defect, so they
// cannot serve as evidence that anything can fail.
// ═══════════════════════════════════════════════════════════════════════════

/** Instance 2's shape: existsSync(abs) gating readFileSync(abs). */
const INSTANCE_2 = `
import { existsSync, readFileSync } from "node:fs";
export function loadProfile(abs: string): string | null {
  if (!existsSync(abs)) return null;
  return readFileSync(abs, "utf8");
}
`;

/** Instance 1's shape: readdir, then re-stat each entry to learn its kind. */
const INSTANCE_1 = `
import { readdirSync, statSync, readFileSync } from "node:fs";
export function collect(root: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(root)) {
    const p = join(root, name);
    if (statSync(p).isDirectory()) continue;
    out.push(readFileSync(p, "utf8"));
  }
  return out;
}
`;

/** Instance 3's shape: one existsSync gating a readdirSync of the same dir. */
const INSTANCE_3 = `
import { existsSync, readdirSync } from "node:fs";
export function charts(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir);
}
`;

/** The correction for instance 2 -- read, then interpret the failure. */
const FIXED_2 = `
import { readFileSync } from "node:fs";
export function loadProfile(abs: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
`;

/** The correction for instance 1 -- the kind arrives with the listing. */
const FIXED_1 = `
import { readdirSync, readFileSync } from "node:fs";
export function collect(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    out.push(readFileSync(join(root, entry.name), "utf8"));
  }
  return out;
}
`;

describe("the lint can fail -- each observed instance, rebuilt", () => {
  test("instance 2: existsSync gating readFileSync on the same path", () => {
    const found = analyzeSource(INSTANCE_2, "fixture.ts");
    expect(rules(found)).toEqual(["check-then-use"]);
    expect(found[0]?.detail).toContain("existsSync(abs)");
    expect(found[0]?.detail).toContain("readFileSync(abs)");
    expect(found[0]?.line).toBe(4);
  });

  test("instance 3: existsSync gating readdirSync on the same path", () => {
    expect(rules(analyzeSource(INSTANCE_3, "fixture.ts"))).toEqual(["check-then-use"]);
  });

  test("instance 1: readdir then re-stat, which no path-identity rule can see", () => {
    const found = analyzeSource(INSTANCE_1, "fixture.ts");
    // `readdirSync(root)` and `statSync(p)` never name the same text, so the
    // path-identity rule structurally cannot pair them. Rule 2 is why this
    // instance is not invisible.
    expect(found.map((f) => f.rule)).toContain("readdir-then-stat");
  });

  test("the refusal NAMES the fix, per shape", () => {
    expect(analyzeSource(INSTANCE_2, "f.ts")[0]?.fix).toContain("ENOENT");
    const rd = analyzeSource(INSTANCE_1, "f.ts").find((f) => f.rule === "readdir-then-stat");
    expect(rd?.fix).toContain("withFileTypes");
  });
});

describe("the corrected forms are silent -- so a pass means something", () => {
  test("read-then-interpret-ENOENT produces no finding", () => {
    expect(analyzeSource(FIXED_2, "fixture.ts")).toEqual([]);
  });

  test("withFileTypes produces no finding", () => {
    expect(analyzeSource(FIXED_1, "fixture.ts")).toEqual([]);
  });

  test("a stat read for SIZE is a measurement, not a gate", () => {
    const src = `
      import { statSync, readFileSync } from "node:fs";
      const bytes = statSync(p).size;
      const text = readFileSync(p, "utf8");
    `;
    expect(analyzeSource(src, "fixture.ts")).toEqual([]);
  });

  test("a check and a use in DIFFERENT blocks do not pair", () => {
    const src = `
      import { existsSync, readFileSync } from "node:fs";
      function a(p: string): boolean { return existsSync(p); }
      function b(p: string): string { return readFileSync(p, "utf8"); }
    `;
    expect(analyzeSource(src, "fixture.ts")).toEqual([]);
  });
});

describe("a bound stat is the same defect as an inline one", () => {
  test("const st = statSync(p); if (st.isDirectory()) ... still gates", () => {
    const src = `
      import { statSync, readFileSync } from "node:fs";
      function f(p: string): string {
        const st = statSync(p);
        if (!st.isFile()) return "";
        return readFileSync(p, "utf8");
      }
    `;
    expect(rules(analyzeSource(src, "fixture.ts"))).toEqual(["check-then-use"]);
  });

  test("a bare assignment binding counts too (st = statSync(p) inside a try)", () => {
    const src = `let st; try { st = statSync(p); } catch { return; } if (st.isDirectory()) x();`;
    const { masked } = maskNonCode(src);
    const calls = findCalls(src, masked, ["statSync"]);
    expect(calls.length).toBe(1);
    expect(calls.map((c) => isExistenceGate(c, masked, masked.length))).toEqual([true]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// "A CHECK THAT DID NOT RUN MUST NEVER LOOK LIKE ONE THAT PASSED"
// ═══════════════════════════════════════════════════════════════════════════

describe("what it cannot read, it reports", () => {
  test("an unlexable file is a finding, not a silent skip", () => {
    const found = analyzeSource("const s = 'unterminated\nconst t = 1;\n", "broken.ts");
    expect(rules(found)).toEqual(["unparsed"]);
    expect(found[0]?.detail).toContain("NOT scanned");
  });

  test("an unterminated block comment is a finding", () => {
    expect(rules(analyzeSource("/* never closed\nexistsSync(p);\n", "b.ts"))).toEqual(["unparsed"]);
  });

  test("an unreadable file is a finding, not a skip", () => {
    const found = auditFiles([{ path: "x.ts", text: "", readError: "EACCES" }]);
    expect(rules(found)).toEqual(["unreadable"]);
    expect(found[0]?.detail).toContain("EACCES");
  });
});

describe("the suppression hatch", () => {
  test("a reasoned toctou-ok silences that check", () => {
    const src = INSTANCE_2.replace(
      "if (!existsSync(abs)) return null;",
      "if (!existsSync(abs)) return null; // toctou-ok: fixture path is ours alone",
    );
    expect(analyzeSource(src, "fixture.ts")).toEqual([]);
  });

  test("an UNREASONED toctou-ok is itself a finding", () => {
    const src = INSTANCE_2.replace(
      "if (!existsSync(abs)) return null;",
      "if (!existsSync(abs)) return null; // toctou-ok:",
    );
    expect(rules(analyzeSource(src, "fixture.ts"))).toEqual(["empty-suppression"]);
  });

  test("suppressions() reads the reason off the line", () => {
    expect([...suppressions("x(); // toctou-ok: because\n").entries()]).toEqual([[1, "because"]]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE LEXER -- every case here is one this audit got WRONG on main first
// ═══════════════════════════════════════════════════════════════════════════

describe("maskNonCode", () => {
  test("preserves offsets exactly", () => {
    const src = 'const a = "hello"; // c\nconst b = 1;\n';
    expect(maskNonCode(src).masked.length).toBe(src.length);
  });

  test("a call written inside a comment is not a call site", () => {
    expect(analyzeSource("// if (existsSync(p)) readFileSync(p);\n", "f.ts")).toEqual([]);
  });

  test("`return /re/.test(s)` is a regex, not a division (4 files failed on this)", () => {
    const src = "function f(s: string) { return /^backlog\\(B-\\d+/i.test(s); }\n";
    expect(maskNonCode(src).unlexable).toBe("");
  });

  test("`h[i]! / h[j]!` is a division, not a regex (TS non-null assertion)", () => {
    const src = "const q = Math.trunc(h[i]![j]! / h[i]![i]!);\n";
    expect(maskNonCode(src).unlexable).toBe("");
  });

  test("`return !/x/.test(s)` -- a `!` after a KEYWORD is logical not", () => {
    expect(maskNonCode("function f(s: string) { return !/^\\s*!/.test(s); }\n").unlexable).toBe("");
  });

  test("a template substitution holding a nested template lexes", () => {
    const src = 'const s = `a ${x ? `\\`${y}\\`` : "n"} b`;\n';
    expect(maskNonCode(src).unlexable).toBe("");
  });

  test("code inside ${...} is still CODE and is scanned", () => {
    const src = "const s = `${existsSync(p) ? readFileSync(p, 'utf8') : ''}`;\n";
    expect(rules(analyzeSource(src, "f.ts"))).toEqual(["check-then-use"]);
  });

  test("a path spelled as a literal still pairs (masking must not erase it)", () => {
    const src = 'if (existsSync("/etc/zeta.json")) readFileSync("/etc/zeta.json", "utf8");\n';
    expect(rules(analyzeSource(src, "f.ts"))).toEqual(["check-then-use"]);
  });
});

describe("argument and scope primitives", () => {
  test("firstArgument takes the top-level comma, not a nested one", () => {
    expect(firstArgument('join(a, b), "utf8"')).toBe("join(a,b)");
    expect(firstArgument("p")).toBe("p");
  });

  test("enclosingBlockEnd stops at the block that encloses the offset", () => {
    const src = "function f() { if (x) { a(); } b(); } c();";
    expect(src[enclosingBlockEnd(src, src.indexOf("a();"))]).toBe("}");
    expect(enclosingBlockEnd(src, src.indexOf("a();"))).toBe(src.indexOf("} b();"));
  });

  test("enclosingBlockStart is its inverse", () => {
    const src = "function f() { if (x) { a(); } }";
    expect(enclosingBlockStart(src, src.indexOf("a();"))).toBe(src.indexOf("{ a();"));
  });

  test("listingScopeEnd steps over a try wrapper, which enclosingBlockEnd does not", () => {
    const src =
      "function f() { let e; try { e = readdirSync(d); } catch { return; } for (const n of e) { statSync(n).isFile(); } }";
    const at = src.indexOf("readdirSync");
    expect(listingScopeEnd(src, at)).toBeGreaterThan(enclosingBlockEnd(src, at));
    expect(listingScopeEnd(src, at)).toBeGreaterThan(src.indexOf("statSync"));
  });
});

describe("baselineKey", () => {
  const row: Finding = {
    rule: "check-then-use",
    file: "f.ts",
    line: 4,
    signature: "existsSync(abs)->readFileSync(abs)",
    detail: "x at line 4 gates y at line 5.",
    fix: "",
  };

  test("is line-independent, so an edit above a finding does not thaw it", () => {
    expect(baselineKey(row)).toBe(baselineKey({ ...row, line: 400, detail: "different prose" }));
  });

  test("but IS dependent on the path expression, so a rename re-raises it", () => {
    expect(baselineKey(row)).not.toBe(baselineKey({ ...row, signature: "existsSync(other)->readFileSync(other)" }));
  });

  test("a REAL finding carries a signature naming both call sites", () => {
    expect(analyzeSource(INSTANCE_2, "f.ts")[0]?.signature).toBe("existsSync(abs)->readFileSync(abs)");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// END TO END -- the CLI, over a real directory
// ═══════════════════════════════════════════════════════════════════════════

describe("the scan floor -- an audit that inspected nothing did not pass", () => {
  test("a root with no TypeScript in it is a finding, not a clean bill", () => {
    const root = mkdtempSync(join(tmpdir(), "toctou-empty-"));
    try {
      expect(main([root, "--quiet"])).toBe(1);
      expect(main([join(root, "does-not-exist"), "--quiet"])).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("--min-files catches a root that went QUIET without going empty", () => {
    const root = mkdtempSync(join(tmpdir(), "toctou-thin-"));
    try {
      writeFileSync(join(root, "ok.ts"), FIXED_2, "utf8");
      expect(main([root, "--quiet"])).toBe(0);
      expect(main([root, "--quiet", "--min-files", "500"])).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the CLI exits non-zero on a directory carrying the defect", () => {
  test("dirty fixture => 1, clean fixture => 0", () => {
    const root = mkdtempSync(join(tmpdir(), "toctou-fixture-"));
    try {
      const dirty = join(root, "dirty");
      const clean = join(root, "clean");
      mkdirSync(dirty);
      mkdirSync(clean);
      writeFileSync(join(dirty, "defect.ts"), INSTANCE_2, "utf8");
      writeFileSync(join(clean, "corrected.ts"), FIXED_2, "utf8");

      // THE PROOF: the same binary, the same flags, opposite verdicts, decided
      // only by what is in the tree it was pointed at.
      expect(main([dirty, "--quiet"])).toBe(1);
      expect(main([clean, "--quiet"])).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a baseline grandfathers exactly the row it names and nothing else", () => {
    const root = mkdtempSync(join(tmpdir(), "toctou-baseline-"));
    try {
      writeFileSync(join(root, "defect.ts"), INSTANCE_2, "utf8");
      const bl = join(root, "baseline.json");
      expect(main([root, "--quiet", "--baseline", bl, "--write-baseline"])).toBe(1);
      // Written, then honoured: the same tree is now quiet...
      expect(main([root, "--quiet", "--baseline", bl])).toBe(0);
      // ...but a NEW instance in the same file is not.
      writeFileSync(join(root, "defect.ts"), INSTANCE_2 + INSTANCE_3, "utf8");
      expect(main([root, "--quiet", "--baseline", bl])).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE REAL TREE
// ═══════════════════════════════════════════════════════════════════════════

describe("src/Core.TypeScript, against the committed baseline", () => {
  test("no NEW check-then-use race, and nothing unlexable or unreadable", () => {
    const code = main([
      "src/Core.TypeScript",
      "--quiet",
      "--min-files",
      "1500",
      "--baseline",
      "src/Core.TypeScript/hygiene/lint-check-then-use-file-races.baseline.json",
    ]);
    expect(code).toBe(0);
  }, 120_000);
});
