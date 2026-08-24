// Falsifiers for the elevator lint. Half of these are the cases the eslint rule
// `sonarjs/no-os-command-from-path` demonstrably does NOT catch — a `run()` wrapper, an
// argv-prefix array, a program chosen through a variable — which is why the P1 in
// docs/BUGS.md (2026-08-24) was live on main while that rule was available.
import { expect, test, describe } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  blankComments,
  collectFiles,
  regexAllowedAfter,
  commandPositionReason,
  main,
  MIN_SCANNED_FILES,
  scanSource,
  WAIVER_RE,
} from "./lint-no-path-resolved-privilege-elevator.ts";

const one = (src: string) => scanSource("f.ts", src);

describe("the shapes eslint's callee-based rule cannot see", () => {
  test("a project run() wrapper", () => {
    expect(one('const r = run("sudo", ["rm", "-rf", p]);').length).toBe(1);
  });
  test("an argv PREFIX built as an array", () => {
    expect(one('const prefix = ["sudo"] as const;').length).toBe(1);
    expect(one('return ["sudo", "--", commandPath];').length).toBe(1);
  });
  test("the program chosen through a variable", () => {
    expect(one('const cmd = needsSudo ? "sudo" : "tar";').length).toBe(1);
    expect(one('const cmd = "doas";').length).toBe(1);
  });
  test("the ordinary spawn shapes are still caught", () => {
    expect(one('spawnSync("sudo", ["-k"]);').length).toBe(1);
    expect(one('execFileSync(\n  "pkexec",\n  ["dd"],\n);').length).toBe(1);
  });
});

describe("what is NOT a command position — a lint that flags everything gets turned off", () => {
  test("an object property value", () => {
    expect(one('return { ok: true, mechanism: "sudo" };')).toEqual([]);
  });
  test("a comparison", () => {
    expect(one('if (mechanism === "sudo") { go(); }')).toEqual([]);
    expect(one('if (mechanism !== "sudo") { go(); }')).toEqual([]);
  });
  test("a type-alias member", () => {
    expect(one('export type EscalationMechanism = "sudo" | "pkexec";')).toEqual([]);
  });
  test("a nullish default", () => {
    expect(one('const service = options.service ?? "sudo";')).toEqual([]);
  });
  test("an element that is not first in its array", () => {
    expect(one('const w = ["env", "sudo", "command"];')).toEqual([]);
  });
  test("a mention inside a comment or a doc block", () => {
    expect(one('// spawnSync("sudo", ["-k"]) used to live here\nconst x = 1;')).toEqual([]);
    expect(one('/**\n * `execFileSync("sudo", [])` is what this replaced.\n */\nconst x = 1;')).toEqual([]);
  });
  test("the resolver itself, which legitimately takes the NAME", () => {
    expect(one('const p = resolveElevatorPathOrThrow("sudo");')).toEqual([]);
    expect(one('const r = resolveElevator("pkexec");')).toEqual([]);
  });
});

describe("the waiver is a DECLARATION, and an empty one does not count", () => {
  test("a reasoned marker on the same line waives", () => {
    expect(one('const S = "sudo"; // zeta-elevator-not-argv: PAM service name')).toEqual([]);
  });
  test("a reasoned marker on the line above waives", () => {
    expect(one('// zeta-elevator-not-argv: PAM service name\nconst S = "sudo";')).toEqual([]);
  });
  test("a marker with NO reason does not waive — an unexplained suppression is the vacuity class", () => {
    expect(one('const S = "sudo"; // zeta-elevator-not-argv:').length).toBe(1);
    expect(WAIVER_RE.test("zeta-elevator-not-argv:")).toBe(false);
  });
  test("an unrelated comment does not waive", () => {
    expect(one('const S = "sudo"; // this is fine, trust me').length).toBe(1);
  });
});

describe("mechanics", () => {
  test("blankComments preserves length, and therefore every line number", () => {
    const src = 'const a = 1; // "sudo"\n/* "doas" */\nconst b = "pkexec";';
    const out = blankComments(src);
    expect(out.length).toBe(src.length);
    expect(out.split("\n").length).toBe(src.split("\n").length);
    expect(out).not.toContain("sudo");
    expect(out).toContain("pkexec");
  });

  test("a string containing a comment opener does not blank the rest of the file", () => {
    const src = 'const u = "http://x"; const c = "sudo";';
    expect(blankComments(src)).toContain("sudo");
    expect(one(src).length).toBe(1);
  });

  test("commandPositionReason names WHY, so a finding can be argued with", () => {
    expect(commandPositionReason("spawnSync(")).toBe("first argument of a call");
    expect(commandPositionReason("const x = [")).toBe("first element of an array literal");
    expect(commandPositionReason("const x = cond ? ")).toBe("a ternary branch");
    expect(commandPositionReason("const x = ")).toBe("the value of an assignment");
    expect(commandPositionReason("const x = cond ? a : ")).toBe("a ternary branch");
    expect(commandPositionReason("{ mechanism: ")).toBeNull();
  });

  test("the line number reported is the line the literal is on, not the line the call starts on", () => {
    const f = one('const x = 1;\nconst y = 2;\nspawnSync(\n  "sudo",\n  [],\n);');
    expect(f[0]?.line).toBe(4);
  });

  test("every elevator name in the roster is matched, not just sudo", () => {
    for (const n of ["sudo", "doas", "pkexec", "gsudo", "runas"]) {
      expect(one(`spawnSync("${n}", []);`).length).toBe(1);
    }
  });
});

// ── SCOPE REGRESSIONS: a clean result over a shrunken corpus is not a clean result ───────
// Both cases below are ways this lint could keep printing OK while checking less than it
// claims -- the same class as `lint:markdown` (#10712) narrowing its glob to nothing and
// reporting success. Neither is hypothetical: the symlink case was introduced by fixing a
// check-then-use race, and caught before it shipped.

describe("the corpus cannot silently collapse", () => {
  test("a symlinked source file is SCANNED — `isFile()` alone would drop it", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-elev-sym-"));
    try {
      mkdirSync(join(root, "real"), { recursive: true });
      writeFileSync(join(root, "real", "bad.ts"), 'const r = run("sudo", ["rm", "-rf", p]);\n');
      symlinkSync("real/bad.ts", join(root, "linked.ts"));
      const acc: string[] = [];
      collectFiles(root, "", acc);
      // A Dirent does not follow links: `linked.ts` reports isSymbolicLink(), and neither
      // isDirectory() nor isFile(). Dropping it would remove a real file from a SECURITY
      // lint's corpus while the report still said OK.
      expect(acc.toSorted()).toEqual(["linked.ts", "real/bad.ts"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a directory symlink is not recursed twice — the link is not a directory to the walker", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-elev-dir-"));
    try {
      mkdirSync(join(root, "real"), { recursive: true });
      writeFileSync(join(root, "real", "a.ts"), "const x = 1;\n");
      symlinkSync("real", join(root, "alias"));
      const acc: string[] = [];
      collectFiles(root, "", acc);
      expect(acc).toEqual(["real/a.ts"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a collapsed corpus REFUSES (exit 2) rather than reporting OK", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-elev-floor-"));
    try {
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "a.ts"), "const x = 1;\n");
      // One clean file: zero findings, so without a floor this would print OK and exit 0.
      expect(main(root)).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the floor is below the live corpus, so ordinary growth and deletion never trip it", () => {
    const acc: string[] = [];
    for (const r of ["src", "tools"]) collectFiles(r, "", acc);
    expect(acc.length).toBeGreaterThan(MIN_SCANNED_FILES);
  });
});

// ── REGEX LITERALS: the lexer bug that let the lint be silenced ─────────────────────────
// Found 2026-08-24 by running the lint against the very comment that documents its scope.
// A regex literal is not a string, and treating one as a string desynchronises the lexer
// for the rest of the file. Both directions are pinned: the false POSITIVE that surfaced
// it, and the false NEGATIVE that makes it a bypass rather than a nuisance.

describe("regex literals are lexed, not mistaken for strings", () => {
  test("FALSE NEGATIVE — a char class containing `/*` must not blank real code", () => {
    // MEASURED: with no regex state, `/[/*]/` reads as a block-comment opener, and the
    // whole `spawnSync("sudo", ...)` line below it was blanked -- the lint reported OK on
    // a file containing the exact defect it exists to find. That is a bypass: an attacker
    // adds one innocuous-looking regex and the guard goes quiet.
    const src = 'const re = /[/*]/;\nconst r = spawnSync("sudo", ["-p", "", "true"]);\nconst d = 1; /* x */\n';
    const f = scanSource("f.ts", src);
    expect(f.length).toBe(1);
    expect(f[0]?.line).toBe(2);
  });

  test("FALSE POSITIVE — a quote inside a regex must not swallow the rest of the file", () => {
    // The real line from zflash/setup.ts:154 that surfaced this.
    const src =
      'const escaped = path.replace(/(["\\\\$`])/g, "\\\\$1");\n' +
      '// a comment mentioning spawnSync("sudo", []) — prose, not code\n' +
      "const ok = 1;\n";
    expect(scanSource("f.ts", src)).toEqual([]);
  });

  test("a real elevator AFTER a quote-bearing regex is still caught", () => {
    const src = 'const escaped = path.replace(/(["\\\\$`])/g, "\\\\$1");\n' + 'const r = spawnSync("sudo", ["-k"]);\n';
    expect(scanSource("f.ts", src).length).toBe(1);
  });

  test("DIVISION is not a regex — `a / b` must not open one", () => {
    const src = 'const q = total / count;\nconst r = run("sudo", ["rm"]);\n';
    expect(scanSource("f.ts", src).length).toBe(1);
  });

  test("regexAllowedAfter: a value ends an expression, so `/` after it is division", () => {
    for (const v of ["a", "1", ")", "]", "_", "$"]) expect(regexAllowedAfter(v)).toBe(false);
    for (const v of ["", "(", ",", "=", ":", "&", "|", "!", "{", ";", "?"]) {
      expect(regexAllowedAfter(v)).toBe(true);
    }
  });

  test("an unterminated regex recovers at the newline rather than swallowing the file", () => {
    const src = 'const bad = /oops\nconst r = run("sudo", ["rm"]);\n';
    expect(scanSource("f.ts", src).length).toBe(1);
  });

  test("blankComments still preserves length after the regex state was added", () => {
    const src = 'const re = /[/*]/; // "sudo"\nconst x = "pkexec";\n';
    expect(blankComments(src).length).toBe(src.length);
  });
});
